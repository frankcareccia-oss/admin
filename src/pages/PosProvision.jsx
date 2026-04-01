// admin/src/pages/PosProvision.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { color, btn, inputStyle as themeInput } from "../theme";

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

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  window.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskRaw(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (v.length <= 4) return "****";
  if (v.length <= 8) return `${v.slice(0, 2)}****`;
  return `${v.slice(0, 3)}****${v.slice(-2)}`;
}

function normalizeStoreId(v) {
  const s = String(v || "").trim();
  // allow numeric storeId (preferred) or "store:<id>"
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/store\D+(\d+)/i);
  if (m && m[1]) return m[1];
  return "";
}

export default function PosProvision() {
  const navigate = useNavigate();

  const [storeIdInput, setStoreIdInput] = React.useState(
    localStorage.getItem("perkvalet_pos_store_id") || ""
  );
  const [terminalLabel, setTerminalLabel] = React.useState(
    localStorage.getItem("perkvalet_pos_terminal_label") || ""
  );

  // Optional: "provisioning code" slot (for future QR-based provisioning).
  // Today we do NOT require it; we accept storeId-only provisioning.
  const [provisionCode, setProvisionCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ok, setOk] = React.useState("");

  React.useEffect(() => {
    pvUiHook("pos.provision.page_loaded.ui", {
      tc: "TC-POS-PROVISION-UI-01",
      sev: "info",
      stable: "pos:provision",
      hasExistingStoreId: Boolean(localStorage.getItem("perkvalet_pos_store_id")),
      hasExistingTerminalId: Boolean(localStorage.getItem("perkvalet_pos_terminal_id")),
    });
  }, []);

  function clearProvisioning() {
    localStorage.removeItem("perkvalet_pos_store_id");
    localStorage.removeItem("perkvalet_pos_terminal_id");
    localStorage.removeItem("perkvalet_pos_terminal_label");
    setOk("");
    setError("");
    pvUiHook("pos.provision.cleared.ui", {
      tc: "TC-POS-PROVISION-UI-04",
      sev: "info",
      stable: "pos:provision",
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOk("");

    const started = Date.now();

    const storeId = normalizeStoreId(storeIdInput);
    const label = String(terminalLabel || "").trim();
    const codeMasked = maskRaw(provisionCode);

    pvUiHook("pos.provision.submit_clicked.ui", {
      tc: "TC-POS-PROVISION-UI-02",
      sev: "info",
      stable: "pos:provision",
      storeIdPresent: Boolean(storeId),
      terminalLabelPresent: Boolean(label),
      provisionCodeMasked: codeMasked || null,
    });

    try {
      if (!storeId) {
        throw new Error("Store ID is required (numeric).");
      }

      // Create a stable terminal id if not present; otherwise reuse existing.
      let terminalId = localStorage.getItem("perkvalet_pos_terminal_id") || "";
      if (!terminalId) terminalId = `term_${randomHex(8)}`;

      localStorage.setItem("perkvalet_pos_store_id", storeId);
      localStorage.setItem("perkvalet_pos_terminal_id", terminalId);
      if (label) localStorage.setItem("perkvalet_pos_terminal_label", label);
      else localStorage.removeItem("perkvalet_pos_terminal_label");

      // IMPORTANT: We do NOT store raw provisionCode (to avoid leaving secrets on-screen / in storage).
      // In a later iteration, we can validate provisionCode against backend and exchange it for a safe terminal token.
      setOk("Terminal provisioned. Proceed to POS login.");

      pvUiHook("pos.provision.submit_succeeded.ui", {
        tc: "TC-POS-PROVISION-UI-03",
        sev: "info",
        stable: "pos:provision",
        storeId,
        terminalId,
        ms: Date.now() - started,
      });

      // Go to POS login page
      navigate("/pos/login", { replace: true });
    } catch (err) {
      const msg = err?.message || "Provisioning failed";
      setError(msg);

      pvUiHook("pos.provision.submit_failed.ui", {
        tc: "TC-POS-PROVISION-UI-99",
        sev: "warn",
        stable: "pos:provision",
        error: msg,
        ms: Date.now() - started,
      });
    } finally {
      setBusy(false);
    }
  }

  const existingStoreId = localStorage.getItem("perkvalet_pos_store_id") || "";
  const existingTerminalId = localStorage.getItem("perkvalet_pos_terminal_id") || "";
  const existingLabel = localStorage.getItem("perkvalet_pos_terminal_label") || "";

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <Link to="/login" style={styles.pill}>
          {"< Back to Login"}
        </Link>
        <Link to="/pos/login" style={styles.pill}>
          POS Login
        </Link>
      </div>

      <h2 style={{ color: color.text }}>POS Terminal Provisioning</h2>

      <div style={{ color: color.textMuted, marginBottom: 12 }}>
        One-time setup per terminal. This binds <b>this browser</b> to a store (and assigns a terminal ID).
      </div>

      {(existingStoreId || existingTerminalId) && (
        <div style={styles.infoBox}>
          <div style={{ fontWeight: 800, marginBottom: 6, color: color.text }}>Current terminal provisioning</div>
          <div style={styles.kvRow}>
            <div style={styles.kvKey}>Store ID</div>
            <div style={styles.kvVal}>{existingStoreId || "—"}</div>
          </div>
          <div style={styles.kvRow}>
            <div style={styles.kvKey}>Terminal ID</div>
            <div style={styles.kvVal}>{existingTerminalId || "—"}</div>
          </div>
          <div style={styles.kvRow}>
            <div style={styles.kvKey}>Label</div>
            <div style={styles.kvVal}>{existingLabel || "—"}</div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <button type="button" onClick={clearProvisioning} style={styles.secondaryBtn}>
              Clear provisioning
            </button>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Store ID (required)</div>
          <input
            value={storeIdInput}
            onChange={(e) => setStoreIdInput(e.target.value)}
            placeholder='Example: "5"'
            inputMode="numeric"
            style={styles.input}
          />
          <div style={styles.hint}>
            For now we use the numeric Store ID (later: scan/enter a provisioning QR/code).
          </div>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Terminal Label (optional)</div>
          <input
            value={terminalLabel}
            onChange={(e) => setTerminalLabel(e.target.value)}
            placeholder='Example: "Front Register"'
            inputMode="text"
            style={styles.input}
          />
          <div style={styles.hint}>
            Helps support/training (not required). Stored locally in this browser.
          </div>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Provisioning Code (optional / future)</div>
          <input
            value={provisionCode}
            onChange={(e) => setProvisionCode(e.target.value)}
            placeholder="(optional) paste/scan code"
            inputMode="text"
            style={styles.input}
          />
          <div style={styles.hint}>
            Not used yet. We do <b>not</b> store or display the raw code after submission.
          </div>
        </label>

        <button disabled={busy} type="submit" style={styles.primaryBtn}>
          {busy ? "Provisioning..." : "Provision this terminal"}
        </button>
      </form>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {ok ? <div style={styles.successBox}>{ok}</div> : null}

      <div style={{ marginTop: 18, color: color.textFaint, fontSize: 13 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>What this does (today)</div>
        <ul style={{ marginTop: 0 }}>
          <li>Stores Store ID + Terminal ID locally for this terminal/browser.</li>
          <li>Routes you to POS login (/pos/login).</li>
          <li>Does not reveal or persist any raw provisioning codes/tokens.</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  pill: {
    ...btn.pill,
    padding: "8px 12px",
    textDecoration: "none",
  },
  label: { fontSize: 13, color: color.textMuted },
  hint: { fontSize: 12, color: color.textFaint },
  input: { ...themeInput },
  primaryBtn: {
    ...btn.primary,
    padding: 12,
    borderRadius: 12,
    width: 260,
  },
  secondaryBtn: {
    ...btn.secondary,
    padding: "10px 12px",
    borderRadius: 12,
  },
  infoBox: {
    margin: "12px 0 16px",
    padding: 12,
    borderRadius: 12,
    border: `1px solid ${color.border}`,
    background: color.cardBg,
  },
  kvRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 10,
    padding: "4px 0",
  },
  kvKey: { fontWeight: 800, color: color.textMuted },
  kvVal: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", color: color.text },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    color: color.danger,
    border: `1px solid ${color.dangerBorder}`,
    background: color.dangerSubtle,
    whiteSpace: "pre-wrap",
    fontWeight: 700,
  },
  successBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,150,0,0.18)",
    background: "rgba(0,150,0,0.06)",
    whiteSpace: "pre-wrap",
    fontWeight: 900,
  },
};
