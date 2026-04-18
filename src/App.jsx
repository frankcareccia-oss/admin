// src/App.jsx
import React from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  useLocation,
  useNavigate,
  matchPath,
} from "react-router-dom";

import RequireAuth from "./components/RequireAuth";
import { color, btn, palette } from "./theme";

import GuestPayPage from "./pages/pay/GuestPayPage";

import Login from "./pages/Login";
import VerifyDevice from "./pages/VerifyDevice";
import VerifyDeviceDone from "./pages/VerifyDeviceDone";
import Merchants from "./pages/Merchants";
import MerchantDetail from "./pages/MerchantDetail";
import StoreDetail from "./pages/StoreDetail";
import AdminKey from "./pages/Settings/AdminKey";
import PlatformConfig from "./pages/Settings/PlatformConfig";
import PrintStoreQr from "./pages/PrintStoreQr";
import MerchantStores from "./pages/MerchantStores";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantSettings from "./pages/MerchantSettings";
import MerchantStoreDetail from "./pages/MerchantStoreDetail";
import MerchantStoreEdit from "./pages/MerchantStoreEdit";
import MerchantStoreCreate from "./pages/MerchantStoreCreate";
import MerchantStoreQrPage from "./pages/MerchantStoreQrPage";
import AdminMerchantOwnershipChange from "./pages/AdminMerchantOwnershipChange";

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
import GroceryPosSimulator from "./pages/GroceryPosSimulator";
import AdminPaymentEvents from "./pages/AdminPaymentEvents";
import PosBundles from "./pages/PosBundles";

import ForgotPassword from "./pages/Auth/ForgotPassword";
import ResetPassword from "./pages/Auth/ResetPassword";
import ChangePassword from "./pages/Auth/ChangePassword";

import MerchantUsers from "./pages/MerchantUsers";
import AdminMerchantUsers from "./pages/AdminMerchantUsers";
import MerchantInvoices from "./pages/MerchantInvoices";
import MerchantProducts from "./pages/MerchantProducts";
import MerchantPromotions from "./pages/MerchantPromotions";
import MerchantBundles from "./pages/MerchantBundles";
import MerchantReports from "./pages/MerchantReports";
import MerchantDashboardReporting from "./pages/MerchantDashboardReporting";
import MerchantGrowthAdvisor from "./pages/MerchantGrowthAdvisor";
import MerchantGrowthStudio from "./pages/MerchantGrowthStudio";
import MerchantSetup from "./pages/MerchantSetup";
import AdminHome from "./pages/AdminHome";
import AdminReports from "./pages/AdminReports";
import AdminSystem from "./pages/AdminSystem";
import MerchantOnboarding from "./pages/MerchantOnboarding";
import AdminMerchantStoreDetail from "./pages/AdminMerchantStoreDetail";
import AdminMerchantBilling from "./pages/AdminMerchantBilling";
import AdminMerchantInvoices from "./pages/AdminMerchantInvoices";
import AdminMerchantStores from "./pages/AdminMerchantStores";
import AdminStoreQrPage from "./pages/AdminStoreQrPage";

import {
  getAccessToken,
  logout,
  AUTH_BC_NAME,
  me,
  authDeviceStatus,
  API_BASE,
  pvSupportGetMerchantId,
} from "./api/client";

import SupportInfo from "./components/SupportInfo";

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

// Resolves the current merchant user's merchantId via /me, then redirects to
// /merchants/:merchantId/promotions where MerchantPromotions reads useParams().
function MerchantPromotionsGate() {
  const navigate = useNavigate();
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    me().then((res) => {
      const merchantId =
        res?.user?.merchantUsers?.[0]?.merchantId ??
        res?.user?.merchantUsers?.[0]?.merchant?.id ??
        null;
      if (merchantId) {
        navigate(`/merchants/${merchantId}/promotions`, { replace: true });
      } else {
        setErr("Promotions are not available for this account.");
      }
    }).catch((e) => {
      setErr(e?.message || "Failed to load promotions.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <div style={{ padding: 24, color: color.danger }}>{err}</div>;
  return <div style={{ padding: 24, color: color.textMuted }}>Loading promotions…</div>;
}

function MerchantBundlesGate() {
  const navigate = useNavigate();
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    me().then((res) => {
      const merchantId =
        res?.user?.merchantUsers?.[0]?.merchantId ??
        res?.user?.merchantUsers?.[0]?.merchant?.id ??
        null;
      if (merchantId) {
        navigate(`/merchants/${merchantId}/bundles`, { replace: true });
      } else {
        setErr("Bundles are not available for this account.");
      }
    }).catch((e) => {
      setErr(e?.message || "Failed to load bundles.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <div style={{ padding: 24, color: color.danger }}>{err}</div>;
  return <div style={{ padding: 24, color: color.textMuted }}>Loading bundles…</div>;
}

function MerchantProductsGate() {
  const navigate = useNavigate();
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    me().then((res) => {
      const merchantId =
        res?.user?.merchantUsers?.[0]?.merchantId ??
        res?.user?.merchantUsers?.[0]?.merchant?.id ??
        null;
      if (merchantId) {
        navigate(`/merchants/${merchantId}/products`, { replace: true });
      } else {
        setErr("Products are not available for this account.");
      }
    }).catch((e) => {
      setErr(e?.message || "Failed to load products.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <div style={{ padding: 24, color: color.danger }}>{err}</div>;
  return <div style={{ padding: 24, color: color.textMuted }}>Loading products…</div>;
}

function MerchantReportsGate() {
  const navigate = useNavigate();
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    me().then((res) => {
      const merchantId =
        res?.user?.merchantUsers?.[0]?.merchantId ??
        res?.user?.merchantUsers?.[0]?.merchant?.id ??
        null;
      if (merchantId) {
        navigate(`/merchants/${merchantId}/reports`, { replace: true });
      } else {
        setErr("Reports are not available for this account.");
      }
    }).catch((e) => {
      setErr(e?.message || "Failed to load reports.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err) return <div style={{ padding: 24, color: color.danger }}>{err}</div>;
  return <div style={{ padding: 24, color: color.textMuted }}>Loading reports…</div>;
}

function computeHome() {
  const authed = Boolean(getAccessToken());
  if (!authed) return "/login";

  if (isPosSession()) return "/merchant/pos";

  const landing = getLanding();
  if (landing) return landing;

  const sys = getSystemRole();
  if (sys === "pv_admin") return "/admin";
  return "/merchant";
}

const navPill = ({ isActive }) => ({
  textDecoration: "none",
  color: isActive ? color.primary : color.text,
  padding: "8px 12px",
  borderRadius: 999,
  border: isActive ? `1px solid ${color.primaryBorder}` : "1px solid rgba(0,0,0,0.18)",
  background: isActive ? color.primarySubtle : color.cardBg,
  fontWeight: isActive ? 700 : 600,
});

function isPublicPayPath(pathname) {
  return pathname.startsWith("/p/") || pathname.startsWith("/pay/");
}

function MerchantHomeGate() {
  if (isPosSession()) return <Navigate to="/merchant/pos" replace />;
  return <Navigate to="/merchant/dashboard" replace />;
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
            border: `1px solid ${color.dangerBorder}`,
            background: color.dangerSubtle,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: color.text }}>Forbidden</div>
          <div style={{ color: color.textMuted }}>
            Store profile editing is available only to <code>merchant_admin</code> (or <code>owner</code>).
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
            Merchant role: <code>{merchantRole || "unknown"}</code>
          </div>
          {merchantRolePath ? (
            <div style={{ marginTop: 6, fontSize: 12, color: color.textMuted }}>
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

// Resolves which single section pill to show beside Dashboard in merchant nav
function getMerchantSectionPill(pathname) {
  if (pathname.startsWith('/merchant/stores') || /\/merchants\/[^/]+\/stores/.test(pathname))
    return { to: '/merchant/stores', label: 'My Stores' };
  if (pathname.startsWith('/merchant/users'))
    return { to: '/merchant/users', label: 'Team' };
  if (pathname.startsWith('/merchant/products') || /\/merchants\/[^/]+\/products/.test(pathname))
    return { to: '/merchant/products', label: 'Products' };
  if (pathname.startsWith('/merchant/promotions') || /\/merchants\/[^/]+\/promotions/.test(pathname))
    return { to: '/merchant/promotions', label: 'Promotions' };
  if (pathname.startsWith('/merchant/bundles') || /\/merchants\/[^/]+\/bundles/.test(pathname))
    return { to: '/merchant/bundles', label: 'Bundles' };
  if (pathname.startsWith('/merchant/invoices'))
    return { to: '/merchant/invoices', label: 'Billing' };
  if (pathname.startsWith('/merchant/reports') || /\/merchants\/[^/]+\/reports/.test(pathname))
    return { to: '/merchant/reports', label: 'Reports' };
  if (pathname.startsWith('/merchant/growth-advisor'))
    return { to: '/merchant/growth-advisor', label: 'Growth Advisor' };
  if (pathname.startsWith('/merchant/settings') || pathname.startsWith('/account/change-password'))
    return { to: '/merchant/settings', label: 'Settings' };
  return null; // on dashboard — no section pill
}

// Resolve human-readable page name for Support panel
function resolvePageName(pathname) {
  try {
    if (!pathname) return 'Unknown';
    if (pathname.startsWith('/merchants')) return 'Merchants';
    if (pathname === '/merchant/dashboard') return 'Merchant Dashboard';
    if (pathname.startsWith('/merchant/users')) return 'Merchant Team';
    if (pathname.startsWith('/merchant/stores')) return 'Merchant Stores';
    if (pathname.startsWith('/merchant/products')) return 'Merchant Products';
    if (pathname.startsWith('/merchant/reports')) return 'Merchant Reports';
    if (pathname.startsWith('/merchant/settings')) return 'Merchant Settings';
    if (pathname.startsWith('/merchant/invoices')) return 'Merchant Invoice Detail';
    if (pathname.startsWith('/admin/invoices/')) return 'Admin Invoice Detail';
    if (pathname.startsWith('/admin/invoices')) return 'Admin Invoice List';
    if (pathname.startsWith('/admin/billing-policy')) return 'Billing Policy';
    if (pathname.startsWith('/merchant/pos')) return 'POS';
    if (pathname.startsWith('/login')) return 'Login';
    return 'App';
  } catch {
    return 'Unknown';
  }
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
  const onVerifyDevice = location.pathname.startsWith("/verify-device");

  const onAuthPage = onLoginPage || onForgotPage || onResetPage || onVerifyDevice;
  const onPublicPay = isPublicPayPath(location.pathname);

  function deriveSupportRouteContext(pathname) {
    try {
      // Prefer explicit route params when available; otherwise leave blank.
      const patterns = [
        "/merchant/stores/:storeId/edit",
        "/merchant/stores/:storeId",
        "/merchants/:merchantId/stores/:storeId",
        "/merchants/:merchantId/stores",
        "/merchants/:merchantId/users",
        "/merchants/:merchantId/invoices",
        "/merchants/:merchantId/products",
        "/merchants/:merchantId/promotions",
        "/merchants/:merchantId/bundles",
        "/merchants/:merchantId",
        "/stores/:storeId/print-qr",
        "/merchant/invoices/:invoiceId",
        "/admin/invoices/:invoiceId",
      ];
      for (const p of patterns) {
        const m = matchPath({ path: p, end: false }, pathname);
        if (m && m.params) {
          return {
            merchantId: m.params.merchantId ? String(m.params.merchantId) : "",
            storeId: m.params.storeId ? String(m.params.storeId) : "",
          };
        }
      }
      return { merchantId: "", storeId: "" };
    } catch {
      return { merchantId: "", storeId: "" };
    }
  }

  const supportRouteCtx = deriveSupportRouteContext(location.pathname);
  const supportMerchantId = supportRouteCtx.merchantId || (typeof pvSupportGetMerchantId === "function" ? pvSupportGetMerchantId() : "") || "";

  // Merchant membership role (from /me)
  const [merchantRole, setMerchantRole] = React.useState(null);
  const [merchantRolePath, setMerchantRolePath] = React.useState(null);
  const [merchantRoleLoading, setMerchantRoleLoading] = React.useState(false);

  // Security-V1: device trust (pv_admin and privileged merchant roles)
  const [deviceTrusted, setDeviceTrusted] = React.useState(true);
  const [deviceTrustedLoading, setDeviceTrustedLoading] = React.useState(false);

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

  React.useEffect(() => {
    let cancelled = false;

    async function loadDeviceTrust() {
      if (!authed || sysRole !== "pv_admin" || onAuthPage || onPublicPay) {
        setDeviceTrusted(true);
        setDeviceTrustedLoading(false);
        return;
      }

      setDeviceTrustedLoading(true);
      try {
        const r = await authDeviceStatus();
        const trusted = Boolean(r?.trusted);
        if (!cancelled) setDeviceTrusted(trusted);

        pvUiHook("security.device.trust.loaded.ui", {
          stable: "security:device:trust",
          trusted,
        });
      } catch (e) {
        // If status endpoint fails, don't hard-block nav; page-level calls will surface the gate.
        if (!cancelled) setDeviceTrusted(true);

        pvUiHook("security.device.trust.failed.ui", {
          stable: "security:device:trust",
          error: e?.message || "status_failed",
        });
      } finally {
        if (!cancelled) setDeviceTrustedLoading(false);
      }
    }

    loadDeviceTrust();
    return () => {
      cancelled = true;
    };
  }, [authed, sysRole, onAuthPage, onPublicPay]);

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
        } else if (type === "login_requires_device_verification") {
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
      } catch { }
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
      <div style={{ height: "100vh", display: "grid", gridTemplateRows: "56px 1fr", background: color.pageBg }}>
        <header
          style={{
            background: "#FEFCF7",
            position: "sticky",
            top: 0,
            zIndex: 10,
            borderBottom: "1px solid rgba(0,0,0,0.10)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1200,
              margin: "0 auto",
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "0 24px",
              boxSizing: "border-box",
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
                      background: color.cardBg,
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
                        {!deviceTrustedLoading && deviceTrusted === false ? (
                          <div style={{ fontSize: 12, color: color.textMuted, fontWeight: 800 }}>
                            Device verification required
                          </div>
                        ) : (
                          <>
                            <NavLink to="/admin" style={navPill}>
                              Dashboard
                            </NavLink>
                            <NavLink to="/admin/platform/config" style={navPill}>
                              Settings
                            </NavLink>
                          </>
                        )}
                      </>
                    ) : pos ? (
                      <NavLink to="/merchant/pos" style={navPill}>
                        POS
                      </NavLink>
                    ) : (
                      <>
                        <NavLink to="/merchant/dashboard" style={navPill}>
                          Dashboard
                        </NavLink>
                        {(() => {
                          const pill = getMerchantSectionPill(location.pathname);
                          return pill ? (
                            <NavLink to={pill.to} style={navPill}>
                              {pill.label}
                            </NavLink>
                          ) : null;
                        })()}
                      </>
                    )}

                    {!pos && sysRole === "pv_admin" && !location.pathname.startsWith("/merchants/") && (
                      <NavLink to="/account/change-password" style={navPill}>
                        Change Password
                      </NavLink>
                    )}

                    <button
                      onClick={onLogout}
                      style={{
                        marginLeft: 8,
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(0,0,0,0.18)",
                        background: color.cardBg,
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

        <main style={{ padding: "0 16px 16px", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {children}
        </main>

        <SupportInfo
          authed={authed}
          systemRole={sysRole}
          merchantRole={merchantRole}
          merchantRolePath={merchantRolePath}
          deviceTrusted={deviceTrusted}
          deviceTrustedLoading={deviceTrustedLoading}
          pathname={location.pathname}
          apiBase={API_BASE}
          context={{ page: resolvePageName(location.pathname), merchantId: supportMerchantId || "", storeId: supportRouteCtx.storeId || "" }}
          meFn={me}
        />
      </div>
    </MerchantCtx.Provider>
  );
}

export default function App() {
  const authed = Boolean(getAccessToken());

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verify-device" element={<VerifyDevice />} />
          <Route path="/verify-device/done" element={<VerifyDeviceDone />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/pos/provision" element={<PosProvision />} />
          <Route path="/pos/login" element={<PosLogin />} />
          <Route path="/grocery/pos" element={<GroceryPosSimulator />} />

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
            path="/merchant/dashboard"
            element={
              <RequireAuth>
                <MerchantDashboard />
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
            path="/merchant/stores/:storeId/qr"
            element={
              <RequireAuth>
                <MerchantStoreQrPage />
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
            path="/merchant/pos/bundles"
            element={
              <RequireAuth>
                <RequirePosSession>
                  <PosBundles />
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
                <MerchantPortalInvoices />
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
            path="/merchant/products"
            element={
              <RequireAuth>
                <MerchantProductsGate />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/reports"
            element={
              <RequireAuth>
                <MerchantReportsGate />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/onboarding"
            element={
              <RequireAuth>
                <MerchantOnboarding />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/analytics"
            element={
              <RequireAuth>
                <MerchantDashboardReporting />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/growth-advisor"
            element={
              <RequireAuth>
                <MerchantGrowthAdvisor />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/growth-studio"
            element={
              <RequireAuth>
                <MerchantGrowthStudio />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/settings"
            element={
              <RequireAuth>
                <MerchantSettings />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/promotions"
            element={
              <RequireAuth>
                <MerchantPromotionsGate />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/bundles"
            element={
              <RequireAuth>
                <MerchantBundlesGate />
              </RequireAuth>
            }
          />

          <Route
            path="/merchant/portal/invoices"
            element={
              <RequireAuth>
                <Navigate to="/merchant/invoices" replace />
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
            path="/merchants/:merchantId/billing"
            element={
              <RequireAuth>
                <AdminMerchantBilling />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId/invoices"
            element={
              <RequireAuth>
                <AdminMerchantInvoices />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId/stores"
            element={
              <RequireAuth>
                <AdminMerchantStores />
              </RequireAuth>
            }
          />
          <Route
            path="/merchants/:merchantId/stores/:storeId"
            element={
              <RequireAuth>
                <AdminMerchantStoreDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/stores/:storeId/qr"
            element={
              <RequireAuth>
                <AdminStoreQrPage />
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
            path="/merchants/:merchantId/invoices"
            element={
              <RequireAuth>
                <MerchantInvoices />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/setup"
            element={
              <RequireAuth>
                <MerchantSetup />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/products"
            element={
              <RequireAuth>
                <MerchantProducts />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/promotions"
            element={
              <RequireAuth>
                <MerchantPromotions />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/bundles"
            element={
              <RequireAuth>
                <MerchantBundles />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/reports"
            element={
              <RequireAuth>
                <MerchantReports />
              </RequireAuth>
            }
          />

          <Route
            path="/merchants/:merchantId/ownership"
            element={
              <RequireAuth>
                <AdminMerchantOwnershipChange />
              </RequireAuth>
            }
          />

          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminHome />
              </RequireAuth>
            }
          />

          <Route
            path="/admin/reports"
            element={
              <RequireAuth>
                <AdminReports />
              </RequireAuth>
            }
          />

          <Route
            path="/admin/system"
            element={
              <RequireAuth>
                <AdminSystem />
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
            path="/admin/platform/config"
            element={
              <RequireAuth>
                <PlatformConfig />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/payment-events"
            element={
              <RequireAuth>
                <AdminPaymentEvents />
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
    </HashRouter>
  );
}