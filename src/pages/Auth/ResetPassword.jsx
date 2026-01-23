// admin/src/pages/Auth/ResetPassword.jsx
import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  function validate() {
    if (!token) return "Missing reset token.";
    if (!pw1 || !pw2) return "Please enter and confirm your new password.";
    if (pw1 !== pw2) return "Passwords do not match.";
    if (pw1.length < 10) return "Password must be at least 10 characters.";
    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setBusy(true);
    try {
      await resetPassword(token, pw1);
      setDone(true);

      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { notice: "Password reset successful. Please sign in with your new password." },
        });
      }, 400);
    } catch (err) {
      setError(err?.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Reset password</h2>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
          Set a new password for your account.
        </div>

        {!token ? (
          <div
            style={{
              background: "rgba(255,0,0,0.06)",
              border: "1px solid rgba(255,0,0,0.15)",
              padding: 12,
              borderRadius: 12,
            }}
          >
            Missing reset token. Please request a new reset link.
            <div style={{ marginTop: 10 }}>
              <Link to="/forgot-password" style={{ textDecoration: "none" }}>
                Request a reset link
              </Link>
            </div>
          </div>
        ) : done ? (
          <div
            style={{
              background: "rgba(0,120,255,0.08)",
              border: "1px solid rgba(0,120,255,0.18)",
              padding: 12,
              borderRadius: 12,
            }}
          >
            Password reset successful. Redirecting to login…
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
              <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>New password</div>
              <input
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.22)",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>Confirm password</div>
              <input
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.22)",
                }}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Show passwords
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
              {busy ? "Resetting…" : "Reset password"}
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
