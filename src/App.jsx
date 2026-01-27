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

// pv_admin scoped invoices-in-merchant-context
import MerchantInvoices from "./pages/MerchantInvoices";

// merchant portal invoice pages
import MerchantInvoiceDetail from "./pages/MerchantInvoiceDetail";
import MerchantPortalInvoices from "./pages/MerchantPortalInvoices";

// Billing pages (Admin)
import AdminBillingPolicy from "./pages/Billing/AdminBillingPolicy";
import AdminInvoiceList from "./pages/Billing/AdminInvoiceList";
import AdminInvoiceDetail from "./pages/Billing/AdminInvoiceDetail";
import AdminMerchantBillingPolicy from "./pages/Billing/AdminMerchantBillingPolicy";

// Auth pages
import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import ChangePassword from "./pages/Auth/ChangePassword";

// POS pages (POS-7)
import MerchantPos from "./pages/MerchantPos";
import PosRegisterVisit from "./pages/PosRegisterVisit";
import PosGrantReward from "./pages/PosGrantReward";

import { logout, getAccessToken } from "./api/client";

/**
 * pvUiHook: structured UI events for QA/docs/chatbot.
 * Must never throw.
 */
function pvUiHook(event, fields = {}) {
  try {
    console.log(
      JSON.stringify({
        pvUiHook: event,
        ts: new Date().toISOString(),
        ...fields,
      })
    );
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

// POS hint set at login-time (we'll wire this in Login.jsx next if needed)
function isPosHint() {
  return localStorage.getItem("perkvalet_is_pos") === "1";
}

function computeHome() {
  const authed = Boolean(getAccessToken());
  if (!authed) return "/login";

  const landing = getLanding();
  if (landing) return landing;

  const role = getSystemRole();

  // pv_admin → Admin console
  if (role === "pv_admin") return "/merchants";

  // POS associates → POS dashboard (if hint is present)
  if (isPosHint()) return "/merchant/pos";

  // default merchant
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

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const authed = Boolean(getAccessToken());
  const role = getSystemRole();
  const homePath = computeHome();

  const onLoginPage = location.pathname.startsWith("/login");
  const onForgotPage = location.pathname.startsWith("/forgot-password");
  const onResetPage = location.pathname.startsWith("/reset-password");

  const onPublicPay = isPublicPayPath(location.pathname);

  React.useEffect(() => {
    pvUiHook("app.layout.route_changed.ui", {
      tc: "TC-APP-UI-01",
      sev: "info",
      stable: "app:route",
      path: location.pathname,
      authed,
      role: role || null,
      publicPay: onPublicPay,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function onLogout() {
    pvUiHook("app.layout.logout_clicked.ui", {
      tc: "TC-APP-UI-10",
      sev: "info",
      stable: "app:logout",
      path: location.pathname,
      role: role || null,
    });

    await logout();
    localStorage.removeItem("perkvalet_system_role");
    localStorage.removeItem("perkvalet_landing");
    localStorage.removeItem("perkvalet_is_pos");

    pvUiHook("app.layout.logout_completed.ui", {
      tc: "TC-APP-UI-11",
      sev: "info",
      stable: "app:logout",
    });

    navigate("/login", { replace: true, state: { from: location } });
  }

  // Public pay pages should look like public pages
  if (onPublicPay) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <main style={{ padding: 16 }}>{children}</main>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateRows: "56px 1fr",
      }}
    >
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
        <Link
          to={homePath}
          style={{ fontWeight: 800, textDecoration: "none", color: "inherit" }}
          onClick={() => {
            pvUiHook("app.layout.home_clicked.ui", {
              tc: "TC-APP-UI-20",
              sev: "info",
              stable: "app:nav",
              role: role || null,
            });
          }}
        >
          {role === "pv_admin" ? "PerkValet Admin" : "PerkValet Merchant"}
        </Link>

        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {!authed ? (
            onLoginPage || onForgotPage || onResetPage ? null : (
              <NavLink
                to="/login"
                style={navPill}
                onClick={() => {
                  pvUiHook("app.layout.nav_login_clicked.ui", {
                    tc: "TC-APP-UI-21",
                    sev: "info",
                    stable: "app:nav",
                  });
                }}
              >
                Login
              </NavLink>
            )
          ) : (
            <>
              {role === "pv_admin" ? (
                <>
                  <NavLink
                    to="/merchants"
                    style={navPill}
                    onClick={() =>
                      pvUiHook("app.layout.nav_merchants_clicked.ui", {
                        tc: "TC-APP-UI-22",
                        sev: "info",
                        stable: "app:nav",
                      })
                    }
                  >
                    Merchants
                  </NavLink>

                  <NavLink
                    to="/admin/billing-policy"
                    style={navPill}
                    onClick={() =>
                      pvUiHook("app.layout.nav_billing_policy_clicked.ui", {
                        tc: "TC-APP-UI-23",
                        sev: "info",
                        stable: "app:nav",
                      })
                    }
                  >
                    Billing Policy
                  </NavLink>

                  <NavLink
                    to="/admin/invoices"
                    style={navPill}
                    onClick={() =>
                      pvUiHook("app.layout.nav_admin_invoices_clicked.ui", {
                        tc: "TC-APP-UI-24",
                        sev: "info",
                        stable: "app:nav",
                      })
                    }
                  >
                    Invoices (All)
                  </NavLink>

                  <NavLink
                    to="/settings/admin-key"
                    style={navPill}
                    onClick={() =>
                      pvUiHook("app.layout.nav_admin_key_clicked.ui", {
                        tc: "TC-APP-UI-25",
                        sev: "info",
                        stable: "app:nav",
                      })
                    }
                  >
                    Admin Key
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink
                    to="/merchant"
                    style={navPill}
                    onClick={() =>
                      pvUiHook("app.layout.nav_my_stores_clicked.ui", {
                        tc: "TC-APP-UI-26",
                        sev: "info",
                        stable: "app:nav",
                      })
                    }
                  >
                    My Stores
                  </NavLink>

                  <NavLink
                    to="/merchant/invoices"
                    style={navPill}
                    onClick={() =>
                      pvUiHook("app.layout.nav_merchant_invoices_clicked.ui", {
                        tc: "TC-APP-UI-27",
                        sev: "info",
                        stable: "app:nav",
                      })
                    }
                  >
                    Invoices
                  </NavLink>
                </>
              )}

              <NavLink
                to="/account/change-password"
                style={navPill}
                onClick={() =>
                  pvUiHook("app.layout.nav_account_clicked.ui", {
                    tc: "TC-APP-UI-28",
                    sev: "info",
                    stable: "app:nav",
                  })
                }
              >
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
      </header>

      <main
        style={{
          padding: 16,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const authed = Boolean(getAccessToken());

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Guest Pay (PUBLIC) */}
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
                {isPosHint() ? <Navigate to="/merchant/pos" replace /> : <MerchantStores />}
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

          {/* POS */}
          <Route
            path="/merchant/pos"
            element={
              <RequireAuth requiredRole="merchant">
                <MerchantPos />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/pos/visit"
            element={
              <RequireAuth requiredRole="merchant">
                <PosRegisterVisit />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/pos/reward"
            element={
              <RequireAuth requiredRole="merchant">
                <PosGrantReward />
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
