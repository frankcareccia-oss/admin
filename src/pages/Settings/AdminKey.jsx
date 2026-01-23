// src/pages/Settings/AdminKey.jsx
import React from "react";
import { whoAmI } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";

const STORAGE_KEY = "perkvalet_admin_api_key";

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

export default function AdminKey() {
  const [value, setValue] = React.useState(() => localStorage.getItem(STORAGE_KEY) || "");

  // Result panel state
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  // Local status banner (replaces alert())
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState("info"); // info | success | error

  function showMessage(type, text) {
    setMsgType(type);
    setMsg(text);
  }

  function onSave() {
    localStorage.setItem(STORAGE_KEY, value.trim());
    showMessage("success", "Saved admin key.");
  }

  function onClear() {
    localStorage.removeItem(STORAGE_KEY);
    setValue("");
    setResult(null);
    showMessage("success", "Cleared admin key.");
  }

  async function onTest() {
    setLoading(true);
    setResult(null);
    showMessage("info", "");
    try {
      const res = await whoAmI();
      setResult({ ok: true, data: res });
      showMessage("success", "Test succeeded: /whoami returned OK.");
    } catch (err) {
      const emsg = err?.message || "Unknown error";
      setResult({ ok: false, error: emsg });
      showMessage("error", `Test failed: ${emsg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer size="form">
      <PageHeader
        title="Admin Key"
        subtitle={
          <span>
            Stored in <code>localStorage</code> as <code>{STORAGE_KEY}</code>.
          </span>
        }
        right={
          <button onClick={onTest} disabled={loading} style={buttonBase}>
            {loading ? "Testing…" : "Test /whoami"}
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
                ? "rgba(255,0,0,0.06)"
                : msgType === "success"
                ? "rgba(0,120,255,0.08)"
                : "rgba(0,0,0,0.03)",
            border:
              msgType === "error"
                ? "1px solid rgba(255,0,0,0.15)"
                : msgType === "success"
                ? "1px solid rgba(0,120,255,0.18)"
                : "1px solid rgba(0,0,0,0.12)",
          }}
        >
          {msg}
        </div>
      ) : null}

      <div style={card}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900, color: "rgba(0,0,0,0.75)" }}>API Key</div>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="some-secret"
            style={controlBase}
          />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={onSave} style={buttonBase}>
            Save
          </button>
          <button onClick={onClear} style={buttonBase}>
            Clear
          </button>
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
