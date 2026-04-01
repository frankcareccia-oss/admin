// admin/src/pages/Auth/ForgotPassword.jsx
import React from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import { color, btn, inputStyle as themeInput } from "../../theme";

export default function ForgotPassword() {
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const emailNorm = String(email || "").trim().toLowerCase();
      await forgotPassword(emailNorm);
      setDone(true);
    } catch (err) {
      setError(err?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6, color: color.text }}>Forgot password</h2>
        <div style={{ color: color.textMuted, marginBottom: 14 }}>
          Enter your email and we'll send a reset link if an account exists.
        </div>

        {done ? (
          <div
            style={{
              background: color.primarySubtle,
              border: `1px solid ${color.primaryBorder}`,
              padding: 12,
              borderRadius: 12,
              color: color.text,
            }}
          >
            If an account exists, a reset link has been sent.
            <div style={{ marginTop: 10 }}>
              <Link to="/login" style={{ textDecoration: "none", color: color.primary }}>
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{
              display: "grid",
              gap: 12,
              border: `1px solid ${color.border}`,
              borderRadius: 14,
              padding: 14,
              background: color.cardBg,
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 13, color: color.textMuted }}>Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                style={{ ...themeInput }}
              />
            </label>

            <button
              disabled={busy}
              type="submit"
              style={{
                ...(busy ? btn.primaryDisabled : btn.primary),
                padding: 12,
                borderRadius: 12,
              }}
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>

            <div style={{ fontSize: 12, color: color.textFaint }}>
              For security, we don't confirm whether an email is registered.
            </div>

            {error ? (
              <div
                style={{
                  background: color.dangerSubtle,
                  border: `1px solid ${color.dangerBorder}`,
                  color: color.danger,
                  padding: 10,
                  borderRadius: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ marginTop: 6 }}>
              <Link to="/login" style={{ fontSize: 12, textDecoration: "none", color: color.primary }}>
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
