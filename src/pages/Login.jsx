// admin/src/pages/Login.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login, me, getAccessToken, pvClearSession } from "../api/client";
import PageContainer from "../components/layout/PageContainer";

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
  } catch {}
}

// Storage keys (keep in sync with src/api/client.js conventions)
const ADMIN_KEY_STORAGE = "perkvalet_admin_api_key";
const JWT_STORAGE = "perkvalet_access_token";
const SYSTEM_ROLE_STORAGE = "perkvalet_system_role";
const SYSTEM_ROLE_RAW_STORAGE = "perkvalet_system_role_raw";
const LANDING_STORAGE = "perkvalet_landing";
const IS_POS_STORAGE = "perkvalet_is_pos";
const MERCHANT_ROLE_HINT_STORAGE = "perkvalet_merchant_role";
const RETURN_TO_STORAGE = "perkvalet_return_to";

// Broadcast key (optional cross-tab signal; harmless if no listener)
const AUTH_BROADCAST_KEY = "perkvalet_auth_broadcast";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = React.useState("admin@perkvalet.local");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const notice = location.state?.notice || "";
  const alreadyAuthed = Boolean(getAccessToken());

  React.useEffect(() => {
    pvUiHook("auth.login.page_loaded.ui", {
      tc: "TC-LOGIN-UI-00",
      sev: "info",
      stable: "auth:login",
      alreadyAuthed,
      path: location?.pathname || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalizeLanding(v) {
    const s = String(v || "").trim();
    return s.startsWith("/") ? s : "";
  }

  function normalizeUiRole(apiRole) {
    const r = String(apiRole || "");
    if (r === "pv_admin") return "pv_admin";
    if (r === "pv_ar_clerk") return "pv_ar_clerk";
    return "merchant";
  }

  function readReturnTo({ peekOnly = false } = {}) {
    const rt = String(sessionStorage.getItem(RETURN_TO_STORAGE) || "").trim();
    if (!peekOnly && rt) sessionStorage.removeItem(RETURN_TO_STORAGE);
    return rt.startsWith("/") ? rt : "";
  }

  function writeReturnTo(path) {
    const s = String(path || "").trim();
    if (!s || !s.startsWith("/")) return;
    try {
      sessionStorage.setItem(RETURN_TO_STORAGE, s);
    } catch {}
  }

  function buildDefaultDest({ uiRole, landing }) {
    return landing || ((uiRole === "pv_admin" || uiRole === "pv_ar_clerk") ? "/merchants" : "/merchant");
  }

  function getIncomingFrom() {
    // Common patterns in other pages:
    // - navigate("/login", { state: { from: "/deep/link" } })
    // - navigate("/login", { state: { returnTo: "/deep/link" } })
    try {
      const s = location?.state || {};
      const from = String(s?.from || s?.returnTo || "").trim();
      return from.startsWith("/") ? from : "";
    } catch {
      return "";
    }
  }

  function goHome() {
    const role = String(localStorage.getItem(SYSTEM_ROLE_STORAGE) || "").trim();
    const landing = String(localStorage.getItem(LANDING_STORAGE) || "").trim();
    const dest = landing || ((role === "pv_admin" || role === "pv_ar_clerk") ? "/merchants" : "/merchant");

    pvUiHook("auth.login.go_home.click.ui", {
      tc: "TC-LOGIN-UI-20",
      sev: "info",
      stable: "auth:login",
      dest,
      role: role || null,
    });

    navigate(dest, { replace: true });
  }

  function clearSessionKeys({ keepAdminKey }) {
    // Capture approval token if we intend to keep it
    const adminKey = keepAdminKey ? String(localStorage.getItem(ADMIN_KEY_STORAGE) || "") : "";

    // Auth/session keys
    localStorage.removeItem(JWT_STORAGE);
    localStorage.removeItem(SYSTEM_ROLE_STORAGE);
    localStorage.removeItem(SYSTEM_ROLE_RAW_STORAGE);
    localStorage.removeItem(LANDING_STORAGE);
    localStorage.removeItem(IS_POS_STORAGE);
    localStorage.removeItem(MERCHANT_ROLE_HINT_STORAGE);

    // Return-to / deep-link state
    sessionStorage.removeItem(RETURN_TO_STORAGE);

    // If we do NOT want to keep admin approval, remove it too
    if (!keepAdminKey) {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
    } else if (adminKey) {
      // Re-apply to be explicit (in case something else touched it)
      localStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
    }

    // Optional: cross-tab nudge (harmless if no listener exists)
    try {
      localStorage.setItem(
        AUTH_BROADCAST_KEY,
        JSON.stringify({ ts: new Date().toISOString(), action: "reset_session", keepAdminKey: !!keepAdminKey })
      );
    } catch {}
  }

  function onResetSession({ keepAdminKey }) {
    setError("");

    pvUiHook("auth.login.reset_session.click.ui", {
      tc: keepAdminKey ? "TC-LOGIN-UI-30" : "TC-LOGIN-UI-31",
      sev: "info",
      stable: "auth:reset",
      keepAdminKey: !!keepAdminKey,
      alreadyAuthed,
    });

    try {
      clearSessionKeys({ keepAdminKey });

      // Best-effort call into shared helper (if its signature changes, we don't break the UI)
      try {
        pvClearSession({
          reason: keepAdminKey ? "start_over_keep_approval" : "remove_admin_access",
          broadcast: true,
        });
      } catch {}

      navigate("/login", { replace: true });

      pvUiHook("auth.login.reset_session.success.ui", {
        tc: keepAdminKey ? "TC-LOGIN-UI-32" : "TC-LOGIN-UI-33",
        sev: "info",
        stable: "auth:reset",
        keepAdminKey: !!keepAdminKey,
      });
    } catch (e) {
      const msg = e?.message || "Start over failed";
      setError(msg);

      pvUiHook("auth.login.reset_session.failure.ui", {
        tc: "TC-LOGIN-UI-34",
        sev: "error",
        stable: "auth:reset",
        keepAdminKey: !!keepAdminKey,
        error: e?.message || String(e),
      });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    pvUiHook("auth.login.submit.click.ui", {
      tc: "TC-LOGIN-UI-10",
      sev: "info",
      stable: "auth:login",
      emailLength: String(email || "").trim().length,
      alreadyAuthed,
    });

    try {
      const emailNorm = String(email || "").trim().toLowerCase();
      const passRaw = String(password || "");

      const r = await login(emailNorm, passRaw);

      // Security-V1: if privileged + untrusted device, backend returns
      // requiresDeviceVerification=true (token may or may not be issued depending on backend policy).
      if (r?.requiresDeviceVerification) {
        // Determine the best destination to return to after verification:
        // 1) incoming "from" (deep-link)
        // 2) existing returnTo stored (peek only)
        // 3) safe default (after we normalize role/landing if available)
        const incomingFrom = getIncomingFrom();
        const existingRt = readReturnTo({ peekOnly: true });

        const apiRoleHint = String(r?.systemRole || r?.user?.systemRole || "").trim();
        const uiRoleHint = normalizeUiRole(apiRoleHint);

        const landingHint = normalizeLanding(r?.landing);
        const safeDefault = buildDefaultDest({ uiRole: uiRoleHint, landing: landingHint });

        const dest = incomingFrom || existingRt || safeDefault;

        // Persist so VerifyDevice page can read without relying on location.state
        writeReturnTo(dest);

        pvUiHook("auth.login.requires_device_verification.ui", {
          tc: "TC-LOGIN-UI-15",
          sev: "warn",
          stable: "auth:login:device",
          dest,
          incomingFrom: Boolean(incomingFrom),
          existingRt: Boolean(existingRt),
          uiRoleHint,
        });

        navigate(`/verify-device?returnTo=${encodeURIComponent(dest)}`, {
          replace: true,
          state: { returnTo: dest, email: emailNorm },
        });
        return;
      }

      let landing = normalizeLanding(r?.landing);
      let apiRole = String(r?.systemRole || "");

      if (!landing || !apiRole) {
        const m = await me();
        landing = landing || normalizeLanding(m?.landing);
        apiRole = apiRole || String(m?.user?.systemRole || "");
      }

      const uiRole = normalizeUiRole(apiRole);

      localStorage.setItem(SYSTEM_ROLE_STORAGE, uiRole);
      localStorage.setItem(SYSTEM_ROLE_RAW_STORAGE, apiRole || "");

      if (landing) localStorage.setItem(LANDING_STORAGE, landing);
      else localStorage.removeItem(LANDING_STORAGE);

      const safeDefault = landing || ((uiRole === "pv_admin" || uiRole === "pv_ar_clerk") ? "/merchants" : "/merchant");
      const rt = readReturnTo();
      const dest = rt || safeDefault;

      pvUiHook("auth.login.submit.success.ui", {
        tc: "TC-LOGIN-UI-11",
        sev: "info",
        stable: "auth:login",
        uiRole,
        dest,
        usedReturnTo: Boolean(rt),
      });

      navigate(dest, { replace: true });
    } catch (err) {
      try {
        pvClearSession({ reason: "login_failed", broadcast: false });
      } catch {}

      const msg = err?.message || "Login failed";
      setError(msg);

      pvUiHook("auth.login.submit.failure.ui", {
        tc: "TC-LOGIN-UI-12",
        sev: "error",
        stable: "auth:login",
        error: err?.message || String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>PerkValet Login</h2>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>Sign in to access your portal.</div>

        {alreadyAuthed ? (
          <div
            style={{
              background: "rgba(0,120,255,0.08)",
              border: "1px solid rgba(0,120,255,0.18)",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>You’re already signed in</div>
            <div style={{ color: "rgba(0,0,0,0.78)", marginBottom: 10, lineHeight: 1.35 }}>
              If things feel out of sync, you can start over on this computer.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={goHome}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Go to Home
              </button>

              <button
                type="button"
                onClick={() => onResetSession({ keepAdminKey: true })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
                title="Signs you out and returns you to the login screen (keeps admin approval for this browser)"
              >
                Start over on this computer
              </button>

              <button
                type="button"
                onClick={() => onResetSession({ keepAdminKey: false })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "rgba(255,0,0,0.06)",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
                title="Signs you out and removes admin approval for this browser"
              >
                Remove admin access from this computer
              </button>
            </div>
          </div>
        ) : null}

        {notice ? (
          <div
            style={{
              background: "rgba(0,120,255,0.08)",
              border: "1px solid rgba(0,120,255,0.18)",
              padding: 10,
              borderRadius: 12,
              marginBottom: 12,
              whiteSpace: "pre-wrap",
            }}
          >
            {notice}
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          style={{
            display: "grid",
            gap: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            padding: 14,
            background: "white",
            opacity: alreadyAuthed ? 0.6 : 1,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={busy}
              style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.22)" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>Password</div>

            <div style={{ position: "relative" }}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                disabled={busy}
                style={{
                  padding: "10px 44px 10px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.22)",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={busy}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  cursor: busy ? "not-allowed" : "pointer",
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Emails are case-insensitive; passwords are case-sensitive.
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link
                to="/pos/login"
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  whiteSpace: "nowrap",
                }}
              >
                POS Login
              </Link>

              <Link
                to="/forgot-password"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "white",
                  whiteSpace: "nowrap",
                }}
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            disabled={busy || alreadyAuthed}
            type="submit"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: busy || alreadyAuthed ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {alreadyAuthed ? "Signed in" : busy ? "Signing in..." : "Sign in"}
          </button>

          {error ? (
            <div
              style={{
                background: "rgba(255,0,0,0.06)",
                border: "1px solid rgba(255,0,0,0.15)",
                padding: 10,
                borderRadius: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {error}
            </div>
          ) : null}
        </form>
      </div>
    </PageContainer>
  );
}
