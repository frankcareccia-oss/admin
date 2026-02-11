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
import MerchantStoreEdit from "./pages/MerchantStoreEdit";
import MerchantStoreCreate from "./pages/MerchantStoreCreate";

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

import { getAccessToken, logout, AUTH_BC_NAME, me } from "./api/client";

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

function getLanding() {
  try {
    return localStorage.getItem("perkvalet_landing") || "";
  } catch {
    return "";
  }
}

function getSystemRole() {
  try {
    return localStorage.getItem("perkvalet_system_role") || "";
  } catch {
    return "";
  }
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

  const sys = getSystemRole();
  if (sys === "pv_admin") return "/merchants";
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

/* -----------------------------
   Merchant role resolution
-------------------------------- */

const MerchantCtx = React.createContext({
  merchantRole: null, // owner|merchant_admin|ap_clerk|store_admin|store_subadmin|null
  merchantRolePath: null,
  loading: false,
});

const MERCHANT_ROLE_ALLOWED = ["owner", "merchant_admin", "ap_clerk", "store_admin", "store_subadmin"];

function findMerchantRoleDeep(payload) {
  // Schema-agnostic deep scan for any allowed role string.
  // Returns { role, path } or { role:null, path:null }.
  const maxNodes = 5000;

  const seen = new Set();
  let nodes = 0;

  function isObj(x) {
    return x && typeof x === "object";
  }

  function scan(node, path) {
    nodes += 1;
    if (nodes > maxNodes) return null;

    if (node == null) return null;

    if (typeof node === "string") {
      const v = node.trim();
      if (MERCHANT_ROLE_ALLOWED.includes(v)) return { role: v, path };
      return null;
    }

    if (typeof node === "number" || typeof node === "boolean") return null;

    if (isObj(node)) {
      if (seen.has(node)) return null;
      seen.add(node);

      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          const hit = scan(node[i], `${path}[${i}]`);
          if (hit) return hit;
        }
        return null;
      }

      const keys = Object.keys(node);
      for (const k of keys) {
        const hit = scan(node[k], path ? `${path}.${k}` : k);
        if (hit) return hit;
      }
    }

    return null;
  }

  const hit = scan(payload, "");
  return hit || { role: null, path: null };
}

function canEditStores(merchantRole) {
  return merchantRole === "merchant_admin" || merchantRole === "owner";
}

function canSeeInvoices(merchantRole) {
  return merchantRole === "merchant_admin" || merchantRole === "owner" || merchantRole === "ap_clerk";
}

function MerchantAdminOnly({ children }) {
  const { merchantRole, merchantRolePath, loading } = React.useContext(MerchantCtx);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading…</div>;
  }

  if (!canEditStores(merchantRole)) {
    return (
      <div style={{ maxWidth: 980 }}>
        <div style={{ marginBottom: 12 }}>
          <Link to="/merchant" style={{ textDecoration: "none" }}>
            ← Back to My Stores
          </Link>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(160,0,0,0.18)",
            background: "rgba(255,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Forbidden</div>
          <div style={{ color: "rgba(0,0,0,0.70)" }}>
            Store profile editing is available only to <code>merchant_admin</code> (or <code>owner</code>).
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            Merchant role: <code>{merchantRole || "unknown"}</code>
          </div>
          {merchantRolePath ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Merchant role path: <code>{merchantRolePath}</code>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return children;
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
  const sysRole = getSystemRole();
  const pos = isPosSession();
  const homePath = computeHome();

  const onLoginPage = location.pathname.startsWith("/login");
  const onForgotPage = location.pathname.startsWith("/forgot-password");
  const onResetPage = location.pathname.startsWith("/reset-password");

  const onAuthPage = onLoginPage || onForgotPage || onResetPage;
  const onPublicPay = isPublicPayPath(location.pathname);

  // Merchant membership role (from /me)
  const [merchantRole, setMerchantRole] = React.useState(null);
  const [merchantRolePath, setMerchantRolePath] = React.useState(null);
  const [merchantRoleLoading, setMerchantRoleLoading] = React.useState(false);

  React.useEffect(() => {
    pvUiHook("app.layout.route_changed.ui", {
      tc: "TC-APP-UI-01",
      sev: "info",
      stable: "app:route",
      path: location.pathname,
      authed,
      role: sysRole || null,
      pos,
      publicPay: onPublicPay,
      merchantRole: merchantRole || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Resolve merchant membership role once per auth session (non-pv_admin, non-pos, authed)
  React.useEffect(() => {
    let cancelled = false;

    async function loadMerchantRole() {
      if (!authed) {
        setMerchantRole(null);
        setMerchantRolePath(null);
        setMerchantRoleLoading(false);
        return;
      }

      // pv_admin doesn’t need merchant role; POS doesn’t either
      if (sysRole === "pv_admin" || pos) {
        setMerchantRole(null);
        setMerchantRolePath(null);
        setMerchantRoleLoading(false);
        return;
      }

      setMerchantRoleLoading(true);
      try {
        const profile = await me();
        const hit = findMerchantRoleDeep(profile);

        const mr = hit?.role || null;
        const mp = hit?.path || null;

        if (!cancelled) {
          setMerchantRole(mr);
          setMerchantRolePath(mp);
        }

        pvUiHook("app.merchant_role.resolved.ui", {
          stable: "merchant:role",
          merchantRole: mr,
          merchantRolePath: mp,
        });
      } catch (e) {
        if (!cancelled) {
          setMerchantRole(null);
          setMerchantRolePath(null);
        }

        pvUiHook("app.merchant_role.resolve_failed.ui", {
          stable: "merchant:role",
          error: e?.message || "resolve_failed",
        });
      } finally {
        if (!cancelled) setMerchantRoleLoading(false);
      }
    }

    loadMerchantRole();
    return () => {
      cancelled = true;
    };
  }, [authed, sysRole, pos]);

  // Cross-tab auth sync: BroadcastChannel + storage event
  React.useEffect(() => {
    function handleLogoutRedirect(reason) {
      pvUiHook("app.auth.sync.redirect.ui", {
        tc: "TC-APP-UI-12",
        sev: "info",
        stable: "auth:sync",
        reason,
      });
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
      if (e.key === "perkvalet_access_token" && !e.newValue) {
        handleLogoutRedirect("storage_token_cleared");
        return;
      }
      if (String(e.key || "").startsWith("perkvalet_")) bump();
    }

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      try {
        if (bc) bc.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function onLogout() {
    pvUiHook("app.layout.logout_clicked.ui", {
      tc: "TC-APP-UI-10",
      sev: "info",
      stable: "app:logout",
      path: location.pathname,
      role: sysRole || null,
      pos,
      merchantRole: merchantRole || null,
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
    <MerchantCtx.Provider value={{ merchantRole, merchantRolePath, loading: merchantRoleLoading }}>
      <div style={{ height: "100vh", display: "grid", gridTemplateRows: "56px 1fr" }}>
        <header
          style={{
            background: "#FEFCF7",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 980,
              margin: "0 auto",
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "0 16px",
              borderBottom: "1px solid rgba(0,0,0,0.10)",
              background: "#FEFCF7",
            }}
          >
            <Link
              to={homePath}
              style={{
                fontWeight: 900,
                textDecoration: "none",
                color: "inherit",
                letterSpacing: 0.2,
                flexShrink: 0,
              }}
            >
              PerkValet
            </Link>

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
                      flexShrink: 0,
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null
            ) : (
              <nav
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  minWidth: 0,
                  flex: 1,
                  overflowX: "auto",
                  overflowY: "hidden",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {!authed ? (
                  <NavLink to="/login" style={navPill}>
                    Login
                  </NavLink>
                ) : (
                  <>
                    {sysRole === "pv_admin" ? (
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

                        {canSeeInvoices(merchantRole) ? (
                          <NavLink to="/merchant/invoices" style={navPill}>
                            Invoices
                          </NavLink>
                        ) : null}
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
                        flexShrink: 0,
                      }}
                    >
                      Logout
                    </button>
                  </>
                )}
              </nav>
            )}
          </div>
        </header>

        <main style={{ padding: 16, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {children}
        </main>
      </div>
    </MerchantCtx.Provider>
  );
}

export default function App() {
  const authed = Boolean(getAccessToken());

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/pos/provision" element={<PosProvision />} />
          <Route path="/pos/login" element={<PosLogin />} />

          <Route path="/p/:code" element={<GuestPayPage />} />
          <Route path="/pay/:token" element={<GuestPayPage />} />

          <Route
            path="/"
            element={
              <RequireAuth>
                <Navigate to={computeHome()} replace />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant"
            element={
              <RequireAuth>
                <MerchantHomeGate />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/stores"
            element={
              <RequireAuth>
                <MerchantStores />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/stores/new"
            element={
              <RequireAuth>
                <MerchantAdminOnly>
                  <MerchantStoreCreate />
                </MerchantAdminOnly>
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/stores/:storeId/edit"
            element={
              <RequireAuth>
                <MerchantAdminOnly>
                  <MerchantStoreEdit />
                </MerchantAdminOnly>
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/stores/:storeId"
            element={
              <RequireAuth>
                <MerchantStoreDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/pos"
            element={
              <RequireAuth>
                <RequirePosSession>
                  <MerchantPos />
                </RequirePosSession>
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/pos/register-visit"
            element={
              <RequireAuth>
                <RequirePosSession>
                  <PosRegisterVisit />
                </RequirePosSession>
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/pos/grant-reward"
            element={
              <RequireAuth>
                <RequirePosSession>
                  <PosGrantReward />
                </RequirePosSession>
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/users"
            element={
              <RequireAuth>
                <MerchantUsers />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/invoices"
            element={
              <RequireAuth>
                <MerchantInvoices />
              </RequireAuth>
            }
          />
          <Route
            path="/merchant/invoices/:invoiceId"
            element={
              <RequireAuth>
                <MerchantInvoiceDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/portal/invoices"
            element={
              <RequireAuth>
                <MerchantPortalInvoices />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants"
            element={
              <RequireAuth>
                <Merchants />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId"
            element={
              <RequireAuth>
                <MerchantDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/stores"
            element={
              <RequireAuth>
                <MerchantStores />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId/stores/:storeId"
            element={
              <RequireAuth>
                <MerchantStoreDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/users"
            element={
              <RequireAuth>
                <AdminMerchantUsers />
              </RequireAuth>
            }
          />

          <Route
            path="/admin/billing-policy"
            element={
              <RequireAuth>
                <AdminBillingPolicy />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <RequireAuth>
                <AdminInvoiceList />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invoices/:invoiceId"
            element={
              <RequireAuth>
                <AdminInvoiceDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/admin/merchants/:merchantId/billing-policy"
            element={
              <RequireAuth>
                <AdminMerchantBillingPolicy />
              </RequireAuth>
            }
          />

          <Route
            path="/settings/admin-key"
            element={
              <RequireAuth>
                <AdminKey />
              </RequireAuth>
            }
          />

          <Route
            path="/stores/:storeId/print-qr"
            element={
              <RequireAuth>
                <PrintStoreQr />
              </RequireAuth>
            }
          />

          <Route
            path="/account/change-password"
            element={
              <RequireAuth>
                <ChangePassword />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to={authed ? computeHome() : "/login"} replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
