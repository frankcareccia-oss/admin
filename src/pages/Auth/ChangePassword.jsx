// admin/src/pages/Auth/ChangePassword.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { changePassword, getSystemRole } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [cur, setCur] = React.useState("");
  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  function validate() {
    if (!cur) return "Current password is required.";
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
      await changePassword(cur, pw1);

      // changePassword() clears JWT; user must sign in again
      navigate("/login", {
        replace: true,
        state: { notice: "Password changed. Please sign in again." },
      });
    } catch (err) {
      setError(err?.message || "Change password failed");
    } finally {
      setBusy(false);
    }
  }

  const homeRoute = getSystemRole() === "pv_admin" ? "/admin" : "/merchant";

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 14 }}>
          <a href={homeRoute} style={{ color: "inherit", textDecoration: "none" }}>&larr; Back</a>
        </div>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Change password</h2>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
          After changing your password, you’ll be signed out and asked to sign in again.
        </div>

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
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>Current password</div>
            <input
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.22)",
              }}
            />
          </label>

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
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)" }}>Confirm new password</div>
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
            {busy ? "Saving…" : "Change password"}
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
