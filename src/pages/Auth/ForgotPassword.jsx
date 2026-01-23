// admin/src/pages/Auth/ForgotPassword.jsx
import React from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";

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
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Forgot password</h2>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
          Enter your email and we’ll send a reset link if an account exists.
        </div>

        {done ? (
          <div
            style={{
              background: "rgba(0,120,255,0.08)",
              border: "1px solid rgba(0,120,255,0.18)",
              padding: 12,
              borderRadius: 12,
            }}
          >
            If an account exists, a reset link has been sent.
            <div style={{ marginTop: 10 }}>
              <Link to="/login" style={{ textDecoration: "none" }}>
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
              {busy ? "Sending…" : "Send reset link"}
            </button>

            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              For security, we don’t confirm whether an email is registered.
            </div>

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

            <div style={{ marginTop: 6 }}>
              <Link to="/login" style={{ fontSize: 12, textDecoration: "none" }}>
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
