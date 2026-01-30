// src/pages/Settings/AdminKey.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { whoAmI } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";

const STORAGE_KEY = "perkvalet_admin_api_key";

// Guardrails (requested)
const MIN_LEN = 6;
const MAX_LEN = 15;

const controlBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const card = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  padding: 14,
  background: "white",
};

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

function validateSecret(raw) {
  const v = String(raw || "");
  const hasWhitespace = /\s/.test(v);
  const trimmed = v.trim();
  const len = trimmed.length;

  if (!trimmed) return { ok: false, reason: "empty", message: "Enter your admin setup secret to enable this browser." };
  if (hasWhitespace)
    return {
      ok: false,
      reason: "whitespace",
      message: "No spaces please. Paste the secret exactly (no whitespace).",
    };
  if (len < MIN_LEN)
    return { ok: false, reason: "too_short", message: `Too short. Use at least ${MIN_LEN} characters.` };
  if (len > MAX_LEN)
    return { ok: false, reason: "too_long", message: `Too long. Max ${MAX_LEN} characters.` };

  return { ok: true, value: trimmed, len };
}

export default function AdminKey() {
  const navigate = useNavigate();

  const inputRef = React.useRef(null);

  const [value, setValue] = React.useState(() => localStorage.getItem(STORAGE_KEY) || "");

  // Result panel state
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  // Local status banner
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState("info"); // info | success | error
  const [nextCta, setNextCta] = React.useState(null); // "merchants" | null

  // Compute saved from storage each render (keeps UI consistent with Clear)
  const saved = Boolean((localStorage.getItem(STORAGE_KEY) || "").trim());

  // Live validation state for enabling Save
  const validation = validateSecret(value);
  const canSave = validation.ok && !saved;

  function showMessage(type, text, cta = null) {
    setMsgType(type);
    setMsg(text);
    setNextCta(cta);
  }

  function onSave() {
    pvUiHook("admin_key.save.click.ui", { tc: "TC-AK-UI-01", sev: "info", stable: "adminKey" });

    const v = validateSecret(value);
    if (!v.ok) {
      showMessage("error", v.message, null);
      pvUiHook("admin_key.save.blocked.ui", {
        tc: "TC-AK-UI-01B",
        sev: "warn",
        stable: "adminKey",
        reason: v.reason,
      });
      return;
    }

    localStorage.setItem(STORAGE_KEY, v.value);

    showMessage(
      "success",
      "This browser is now enabled for admin setup. Next: go back to Merchants.",
      "merchants"
    );

    pvUiHook("admin_key.save.success.ui", {
      tc: "TC-AK-UI-02",
      sev: "info",
      stable: "adminKey",
      len: v.len,
    });
  }

  function onClear() {
    pvUiHook("admin_key.clear.click.ui", { tc: "TC-AK-UI-03", sev: "info", stable: "adminKey" });

    localStorage.removeItem(STORAGE_KEY);
    setValue("");
    setResult(null);

    // Calm, forward-looking guidance (no scary status language).
    showMessage("info", "Cleared. Now paste the correct admin setup secret and click Save.", null);

    try {
      inputRef.current?.focus();
    } catch {}

    pvUiHook("admin_key.clear.success.ui", { tc: "TC-AK-UI-03A", sev: "info", stable: "adminKey" });
  }

  async function onTest() {
    setLoading(true);
    setResult(null);
    showMessage("info", "");
    pvUiHook("admin_key.test.click.ui", { tc: "TC-AK-UI-10", sev: "info", stable: "adminKey" });

    try {
      const res = await whoAmI();
      setResult({ ok: true, data: res });
      showMessage("success", "Success. This secret works.", "merchants");
      pvUiHook("admin_key.test.success.ui", { tc: "TC-AK-UI-11", sev: "info", stable: "adminKey" });
    } catch (err) {
      const emsg = err?.message || "Unknown error";
      setResult({ ok: false, error: emsg });
      showMessage("error", `Test failed: ${emsg}`, null);
      pvUiHook("admin_key.test.failure.ui", {
        tc: "TC-AK-UI-12",
        sev: "error",
        stable: "adminKey",
        error: emsg,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer size="form">
      <PageHeader
        title="Enable this browser for admin setup"
        subtitle={
          <span>
            You’re already a PerkValet administrator. This step unlocks admin setup features on <b>this computer</b>.
          </span>
        }
        right={
          <button onClick={onTest} disabled={loading} style={buttonBase}>
            {loading ? "Testing…" : "Test"}
          </button>
        }
      />

      {msg ? (
        <div
          style={{
            ...card,
            marginBottom: 12,
            background:
              msgType === "error"
                ? "rgba(255,0,0,0.08)"
                : msgType === "success"
                ? "rgba(0,120,255,0.08)"
                : "rgba(0,0,0,0.03)",
            border:
              msgType === "error"
                ? "1px solid rgba(255,0,0,0.20)"
                : msgType === "success"
                ? "1px solid rgba(0,120,255,0.18)"
                : "1px solid rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 360px" }}>{msg}</div>

            {nextCta === "merchants" ? (
              <button
                type="button"
                onClick={() => navigate("/merchants")}
                style={{
                  ...buttonBase,
                  borderRadius: 999,
                  fontWeight: 900,
                }}
              >
                Go to Merchants
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Admin setup secret</div>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 10, lineHeight: 1.35 }}>
          This is a private secret provided to you by PerkValet. It works like a password to unlock admin setup on this
          computer.
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter the secret…"
            style={controlBase}
            disabled={saved}
            maxLength={MAX_LEN + 20} // allow paste; validation enforces MAX_LEN
          />

          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.60)", lineHeight: 1.3 }}>
            Guardrails: {MIN_LEN}–{MAX_LEN} characters. Letters, numbers, and symbols are OK. No spaces.
          </div>

          {!saved && value ? (
            validation.ok ? (
              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>Looks good ({validation.len} chars).</div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: "rgba(140,0,0,0.95)",
                  background: "rgba(255,0,0,0.08)",
                  border: "1px solid rgba(255,0,0,0.20)",
                  padding: "8px 10px",
                  borderRadius: 12,
                }}
              >
                {validation.message}
              </div>
            )
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={onSave}
            disabled={!canSave}
            style={{
              ...buttonBase,
              background: canSave ? "rgba(0,120,255,0.14)" : "rgba(0,0,0,0.03)",
              border: canSave ? "1px solid rgba(0,120,255,0.30)" : "1px solid rgba(0,0,0,0.18)",
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {saved ? "Saved ✓" : "Save"}
          </button>

          <button onClick={onClear} style={buttonBase}>
            Clear
          </button>

          {saved ? (
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
              This browser is enabled. Use <b>Clear</b> to turn it off.
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
              After saving, go back to <b>Merchants</b> to continue.
            </span>
          )}
        </div>

        {result ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Result</div>
            <pre
              style={{
                margin: 0,
                padding: 12,
                borderRadius: 12,
                background: "rgba(0,0,0,0.04)",
                fontSize: 13,
                overflow: "auto",
              }}
            >
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
