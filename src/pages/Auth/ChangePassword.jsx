// admin/src/pages/Auth/ChangePassword.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { changePassword, getSystemRole } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import { color, btn, inputStyle as themeInput } from "../../theme";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never break UI for logging
  }
}

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
      pvUiHook("auth.change_password.validation_failed.ui", {
        stable: "auth:change_password", reason: v,
      });
      return;
    }

    setBusy(true);
    pvUiHook("auth.change_password.submit_started.ui", { stable: "auth:change_password" });
    try {
      await changePassword(cur, pw1);
      pvUiHook("auth.change_password.submit_succeeded.ui", { stable: "auth:change_password" });

      // changePassword() clears JWT; user must sign in again
      navigate("/login", {
        replace: true,
        state: { notice: "Password changed. Please sign in again." },
      });
    } catch (err) {
      setError(err?.message || "Change password failed");
      pvUiHook("auth.change_password.submit_failed.ui", {
        stable: "auth:change_password", error: err?.message,
      });
    } finally {
      setBusy(false);
    }
  }

  const homeRoute = getSystemRole() === "pv_admin" ? "/admin" : "/merchant";

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 14 }}>
          <a href={homeRoute} style={{ color: color.textMuted, textDecoration: "none" }}>&larr; Back</a>
        </div>
        <h2 style={{ marginTop: 0, marginBottom: 6, color: color.text }}>Change password</h2>
        <div style={{ color: color.textMuted, marginBottom: 14 }}>
          After changing your password, you'll be signed out and asked to sign in again.
        </div>

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
            <div style={{ fontSize: 13, color: color.textMuted }}>Current password</div>
            <input
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete="current-password"
              style={{ ...themeInput }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: color.textMuted }}>New password</div>
            <input
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              style={{ ...themeInput }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: color.textMuted }}>Confirm new password</div>
            <input
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              style={{ ...themeInput }}
            />
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: color.textMuted }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show passwords
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
            {busy ? "Saving…" : "Change password"}
          </button>

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
        </form>
      </div>
    </PageContainer>
  );
}
