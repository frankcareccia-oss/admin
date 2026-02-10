// src/App.jsx
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import RequireAuth from "./components/RequireAuth";

import GuestPayPage from "./pages/pay/GuestPayPage";

import Login from "./pages/Login";
import Merchants from "./pages/Merchants";
import MerchantDetail from "./pages/MerchantDetail";
import StoreDetail from "./pages/StoreDetail";
import AdminKey from "./pages/Settings/AdminKey";
import PrintStoreQr from "./pages/PrintStoreQr";
import MerchantStores from "./pages/MerchantStores";
import MerchantStoreDetail from "./pages/MerchantStoreDetail";

import MerchantInvoices from "./pages/MerchantInvoices";

import MerchantInvoiceDetail from "./pages/MerchantInvoiceDetail";
import MerchantPortalInvoices from "./pages/MerchantPortalInvoices";

import AdminBillingPolicy from "./pages/Billing/AdminBillingPolicy";
import AdminInvoiceList from "./pages/Billing/AdminInvoiceList";
import AdminInvoiceDetail from "./pages/Billing/AdminInvoiceDetail";
import AdminMerchantBillingPolicy from "./pages/Billing/AdminMerchantBillingPolicy";

import MerchantPos from "./pages/MerchantPos";
import PosRegisterVisit from "./pages/PosRegisterVisit";
import PosGrantReward from "./pages/PosGrantReward";

import PosProvision from "./pages/PosProvision";
import PosLogin from "./pages/PosLogin";

import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import ChangePassword from "./pages/Auth/ChangePassword";

import MerchantUsers from "./pages/MerchantUsers";
import AdminMerchantUsers from "./pages/AdminMerchantUsers";

import { getAccessToken, logout, AUTH_BC_NAME } from "./api/client";

/**
 * pvUiHook: structured UI events for QA/docs/chatbot.
 * Must never throw.
 */
function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never break UI for logging
  }
}

function getSystemRole() {
  return localStorage.getItem("perkvalet_system_role") || "";
}

function getLanding() {
  return localStorage.getItem("perkvalet_landing") || "";
}

function isPosSession() {
  // legacy POS flag (if used)
  return localStorage.getItem("perkvalet_is_pos") === "1";
}

function computeHome() {
  const authed = Boolean(getAccessToken());
  if (!authed) return "/login";

  if (isPosSession()) return "/merchant/pos";

  const landing = getLanding();
  if (landing) return landing;

  const role = getSystemRole();
  if (role === "pv_admin") return "/merchants";
  return "/merchant";
}

const navPill = ({ isActive }) => ({
  textDecoration: "none",
  color: "inherit",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: isActive ? "rgba(0,0,0,0.08)" : "white",
  fontWeight: isActive ? 700 : 600,
});

function isPublicPayPath(pathname) {
  return pathname.startsWith("/p/") || pathname.startsWith("/pay/");
}

function MerchantHomeGate() {
  if (isPosSession()) return <Navigate to="/merchant/pos" replace />;
  return <MerchantStores />;
}

function RequirePosSession({ children }) {
  const location = useLocation();
  if (!isPosSession()) {
    return (
      <Navigate
        to="/pos/login"
        replace
        state={{ notice: "POS session required. Please sign in.", from: location.pathname }}
      />
    );
  }
  return children;
}

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Force re-render when another tab logs in/out or storage changes
  const [, bump] = React.useReducer((x) => x + 1, 0);

  const authed = Boolean(getAccessToken());
  const role = getSystemRole();
  const pos = isPosSession();
  const homePath = computeHome();

  const onLoginPage = location.pathname.startsWith("/login");
  const onForgotPage = location.pathname.startsWith("/forgot-password");
  const onResetPage = location.pathname.startsWith("/reset-password");

  const onAuthPage = onLoginPage || onForgotPage || onResetPage;
  const onPublicPay = isPublicPayPath(location.pathname);

  React.useEffect(() => {
    pvUiHook("app.layout.route_changed.ui", {
      tc: "TC-APP-UI-01",
      sev: "info",
      stable: "app:route",
      path: location.pathname,
      authed,
      role: role || null,
      pos,
      publicPay: onPublicPay,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Cross-tab auth sync: BroadcastChannel + storage event
  React.useEffect(() => {
    function handleLogoutRedirect(reason) {
      pvUiHook("app.auth.sync.redirect.ui", {
        tc: "TC-APP-UI-12",
        sev: "info",
        stable: "auth:sync",
        reason,
      });
      // Always land on login (no state.from for normal logout sync)
      navigate("/login", { replace: true, state: { notice: "Please sign in." } });
      bump();
    }

    let bc = null;
    try {
      bc = new BroadcastChannel(AUTH_BC_NAME);
      bc.onmessage = (ev) => {
        const type = ev?.data?.type || "";
        if (type === "session_cleared") {
          handleLogoutRedirect(String(ev?.data?.reason || "session_cleared"));
        } else if (type === "login") {
          bump();
        }
      };
    } catch {
      // ignore
    }

    function onStorage(e) {
      // if token is removed in another tab, force redirect here
      if (e.key === "perkvalet_access_token" && !e.newValue) {
        handleLogoutRedirect("storage_token_cleared");
        return;
      }
      // otherwise just re-render (role/landing/admin key updates, etc.)
      if (String(e.key || "").startsWith("perkvalet_")) bump();
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        if (bc) bc.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function onLogout() {
    pvUiHook("app.layout.logout_clicked.ui", {
      tc: "TC-APP-UI-10",
      sev: "info",
      stable: "app:logout",
      path: location.pathname,
      role: role || null,
      pos,
    });

    await logout();

    pvUiHook("app.layout.logout_completed.ui", {
      tc: "TC-APP-UI-11",
      sev: "info",
      stable: "app:logout",
    });

    navigate("/login", { replace: true });
  }

  if (onPublicPay) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <main style={{ padding: 16 }}>{children}</main>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "grid", gridTemplateRows: "56px 1fr" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Link to={homePath} style={{ fontWeight: 800, textDecoration: "none", color: "inherit" }}>
          {role === "pv_admin" ? "PerkValet Admin" : "PerkValet Merchant"}
        </Link>

        {/* On auth pages, keep header simple (no pills while “at login”) */}
        {onAuthPage ? (
          authed ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <NavLink to={homePath} style={navPill}>
                Home
              </NavLink>
              <button
                onClick={onLogout}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Logout
              </button>
            </div>
          ) : null
        ) : (
          <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {!authed ? (
              <NavLink to="/login" style={navPill}>
                Login
              </NavLink>
            ) : (
              <>
                {role === "pv_admin" ? (
                  <>
                    <NavLink to="/merchants" style={navPill}>
                      Merchants
                    </NavLink>
                    <NavLink to="/admin/billing-policy" style={navPill}>
                      Billing Policy
                    </NavLink>
                    <NavLink to="/admin/invoices" style={navPill}>
                      Invoices (All)
                    </NavLink>
                    <NavLink to="/settings/admin-key" style={navPill}>
                      Admin Key
                    </NavLink>
                  </>
                ) : pos ? (
                  <NavLink to="/merchant/pos" style={navPill}>
                    POS
                  </NavLink>
                ) : (
                  <>
                    <NavLink to="/merchant" style={navPill}>
                      My Stores
                    </NavLink>
                    <NavLink to="/merchant/users" style={navPill}>
                      Team
                    </NavLink>
                    <NavLink to="/merchant/invoices" style={navPill}>
                      Invoices
                    </NavLink>
                  </>
                )}

                <NavLink to="/account/change-password" style={navPill}>
                  Account
                </NavLink>

                <button
                  onClick={onLogout}
                  style={{
                    marginLeft: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Logout
                </button>
              </>
            )}
          </nav>
        )}
      </header>

      <main style={{ padding: 16, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  // ONE “command” to do a clean start:
  // http://localhost:5173/?fresh=1
  const sp = new URLSearchParams(window.location.search);
  if (sp.get("fresh") === "1") {
    // hard reset: clear everything + broadcast + land on /login
    try {
      // import inline to avoid circular issues in some bundlers
      // eslint-disable-next-line no-unused-vars
      const { pvClearSession } = require("./api/client");
      pvClearSession({ reason: "fresh_start", broadcast: true });
    } catch {
      // fallback: at least clear token
      try {
        localStorage.removeItem("perkvalet_access_token");
      } catch {}
    }
    window.location.replace("/login");
    return null;
  }

  const authed = Boolean(getAccessToken());

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* POS public */}
          <Route path="/pos/provision" element={<PosProvision />} />
          <Route path="/pos/login" element={<PosLogin />} />

          {/* Guest Pay public */}
          <Route path="/p/:code" element={<GuestPayPage />} />
          <Route path="/pay/:token" element={<GuestPayPage />} />

          {/* Default */}
          <Route path="/" element={<Navigate to={authed ? computeHome() : "/login"} replace />} />

          {/* Account */}
          <Route
            path="/account/change-password"
            element={
              <RequireAuth>
                <ChangePassword />
              </RequireAuth>
            }
          />

          {/* PV Admin */}
          <Route
            path="/settings/admin-key"
            element={
              <RequireAuth requiredRole="pv_admin">
                <AdminKey />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/billing-policy"
            element={
              <RequireAuth requiredRole="pv_admin">
                <AdminBillingPolicy />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <RequireAuth requiredRole="pv_admin">
                <AdminInvoiceList />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invoices/:invoiceId"
            element={
              <RequireAuth requiredRole="pv_admin">
                <AdminInvoiceDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/merchants/:merchantId/billing-policy"
            element={
              <RequireAuth requiredRole="pv_admin">
                <AdminMerchantBillingPolicy />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants"
            element={
              <RequireAuth requiredRole="pv_admin">
                <Merchants />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId"
            element={
              <RequireAuth requiredRole="pv_admin">
                <MerchantDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId/users"
            element={
              <RequireAuth requiredRole="pv_admin">
                <AdminMerchantUsers />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId/invoices"
            element={
              <RequireAuth requiredRole="pv_admin">
                <MerchantInvoices />
              </RequireAuth>
            }
          />
          <Route
            path="/stores/:storeId"
            element={
              <RequireAuth requiredRole="pv_admin">
                <StoreDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/stores/:storeId/print"
            element={
              <RequireAuth requiredRole="pv_admin">
                <PrintStoreQr />
              </RequireAuth>
            }
          />

          {/* Merchant */}
          <Route
            path="/merchant"
            element={
              <RequireAuth requiredRole="merchant">
                <MerchantHomeGate />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/users"
            element={
              <RequireAuth requiredRole="merchant">
                <MerchantUsers />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/stores/:storeId"
            element={
              <RequireAuth requiredRole="merchant">
                <MerchantStoreDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/invoices"
            element={
              <RequireAuth requiredRole="merchant">
                <MerchantPortalInvoices />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/invoices/:invoiceId"
            element={
              <RequireAuth requiredRole="merchant">
                <MerchantInvoiceDetail />
              </RequireAuth>
            }
          />

          {/* POS (AUTH + POS SESSION REQUIRED) */}
          <Route
            path="/merchant/pos"
            element={
              <RequireAuth requiredRole="merchant">
                <RequirePosSession>
                  <MerchantPos />
                </RequirePosSession>
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/pos/visit"
            element={
              <RequireAuth requiredRole="merchant">
                <RequirePosSession>
                  <PosRegisterVisit />
                </RequirePosSession>
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/pos/reward"
            element={
              <RequireAuth requiredRole="merchant">
                <RequirePosSession>
                  <PosGrantReward />
                </RequirePosSession>
              </RequireAuth>
            }
          />

          {/* Anything else */}
          <Route path="*" element={<Navigate to={computeHome()} replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
