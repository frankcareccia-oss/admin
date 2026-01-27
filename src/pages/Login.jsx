// admin/src/pages/Login.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login, me, clearAccessToken } from "../api/client";
import PageContainer from "../components/layout/PageContainer";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = React.useState("admin@perkvalet.local");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const notice = location.state?.notice || "";
  const from = location.state?.from?.pathname;

  function normalizeLanding(v) {
    const s = String(v || "").trim();
    return s.startsWith("/") ? s : "";
  }

  // POS-7: normalize API systemRole into UI gate role
  // API returns: "pv_admin" | "user"
  // UI gates expect: "pv_admin" | "merchant"
  function normalizeUiRole(apiRole) {
    const r = String(apiRole || "");
    return r === "pv_admin" ? "pv_admin" : "merchant";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const emailNorm = String(email || "").trim().toLowerCase();
      const passRaw = String(password || "");

      const r = await login(emailNorm, passRaw);

      let landing = normalizeLanding(r?.landing);
      let apiRole = String(r?.systemRole || "");

      // If server didn't return enough info, ask /me (browser helper)
      if (!landing || !apiRole) {
        const m = await me();
        landing = landing || normalizeLanding(m?.landing);
        apiRole = apiRole || String(m?.user?.systemRole || "");
      }

      const uiRole = normalizeUiRole(apiRole);

      // Persist roles
      localStorage.setItem("perkvalet_system_role", uiRole);
      localStorage.setItem("perkvalet_system_role_raw", apiRole || "");

      // POS-7: deterministic POS landing override (email-based for now)
      const forcePos = emailNorm === "pos@perkvalet.host";
      if (forcePos) {
        landing = "/merchant/pos";
        localStorage.setItem("perkvalet_is_pos", "1");
        localStorage.setItem("perkvalet_landing", landing);
      } else {
        localStorage.removeItem("perkvalet_is_pos");
        if (landing) localStorage.setItem("perkvalet_landing", landing);
        else localStorage.removeItem("perkvalet_landing");
      }

      // Choose destination:
      // - For POS, ignore `from` unless it’s already a POS path
      const safeDefault = landing || (uiRole === "pv_admin" ? "/merchants" : "/merchant");
      const dest =
        forcePos
          ? (String(from || "").startsWith("/merchant/pos") ? from : "/merchant/pos")
          : (from || safeDefault);

      navigate(dest, { replace: true });
    } catch (err) {
      clearAccessToken();
      localStorage.removeItem("perkvalet_system_role");
      localStorage.removeItem("perkvalet_system_role_raw");
      localStorage.removeItem("perkvalet_landing");
      localStorage.removeItem("perkvalet_is_pos");
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>PerkValet Login</h2>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
          Sign in to access your portal.
        </div>

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
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.22)",
              }}
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

          <button
            disabled={busy}
            type="submit"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 800,
            }}
          >
            {busy ? "Signing in..." : "Sign in"}
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
