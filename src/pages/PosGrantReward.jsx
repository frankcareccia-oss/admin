import React from "react";
import { Link } from "react-router-dom";
import { getAccessToken } from "../api/client";

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

function apiBase() {
  const v = (import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001").trim();
  return v.replace(/\/+$/, "");
}

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  window.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildPosHeaders() {
  return {
    "X-POS-Timestamp": String(Math.floor(Date.now() / 1000)),
    "X-POS-Nonce": randomHex(16),
    "X-POS-Idempotency-Key": randomHex(16),
  };
}

function classifyIdentifier(raw) {
  const v = String(raw || "").trim();
  const digits = v.replace(/[^\d]/g, "");
  const looksPhone = digits.length >= 10 && digits.length <= 15 && v.indexOf("@") === -1;
  const looksEmail = v.includes("@") && v.includes(".");
  return { kind: looksEmail ? "email" : looksPhone ? "phone" : "token", digits };
}

function maskIdentifier(raw) {
  const v = String(raw || "").trim();
  const { kind, digits } = classifyIdentifier(v);

  if (kind === "email") {
    const [u, d] = v.split("@");
    const uMasked = u ? `${u.slice(0, 2)}***` : "***";
    return `${uMasked}@${d || "***"}`;
  }

  if (kind === "phone") {
    const last4 = digits.slice(-4);
    return `***-***-${last4 || "****"}`;
  }

  return v.length <= 6 ? "***" : `${v.slice(0, 3)}***${v.slice(-2)}`;
}

function isUiDebugEnabled() {
  // Debug payload display is:
  // - DEV-only, and
  // - requires explicit opt-in: localStorage.PV_UI_DEBUG === "1"
  try {
    const dev = Boolean(import.meta?.env?.DEV);
    const optIn = String(localStorage.getItem("PV_UI_DEBUG") || "") === "1";
    return dev && optIn;
  } catch {
    return false;
  }
}

export default function PosGrantReward() {
  const [identifier, setIdentifier] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [successMsg, setSuccessMsg] = React.useState("");
  const [debugOpen, setDebugOpen] = React.useState(false);

  const debugEnabled = isUiDebugEnabled();

  React.useEffect(() => {
    pvUiHook("pos.reward.page_loaded.ui", {
      tc: "TC-POS-REWARD-UI-01",
      sev: "info",
      stable: "pos:reward",
    });
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const started = Date.now();

    setBusy(true);
    setError("");
    setResult(null);
    setSuccessMsg("");
    setDebugOpen(false);

    const v = String(identifier || "").trim();
    const { kind } = classifyIdentifier(v);

    pvUiHook("pos.reward.submit_clicked.ui", {
      tc: "TC-POS-REWARD-UI-02",
      sev: "info",
      stable: "pos:reward",
      identifierKind: kind,
      identifierMasked: maskIdentifier(v),
    });

    try {
      if (!v) throw new Error("Customer identifier is required");

      const token = getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase()}/pos/reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...buildPosHeaders(),
        },
        body: JSON.stringify({ identifier: v }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error?.message ||
          (typeof data === "string" ? data : "") ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setResult(data);

      // IMPORTANT: Do NOT expose raw payload / tokens / IDs on the POS screen.
      // Show only a success banner (optionally includes masked identifier).
      setSuccessMsg(`OK — Reward granted. (${maskIdentifier(v)})`);

      pvUiHook("pos.reward.submit_succeeded.ui", {
        tc: "TC-POS-REWARD-UI-03",
        sev: "info",
        stable: "pos:reward",
        identifierKind: kind,
        identifierMasked: maskIdentifier(v),
        ms: Date.now() - started,
      });
    } catch (err) {
      const msg = err?.message || "Failed to grant reward";
      setError(msg);

      pvUiHook("pos.reward.submit_failed.ui", {
        tc: "TC-POS-REWARD-UI-04",
        sev: "warn",
        stable: "pos:reward",
        identifierKind: kind,
        identifierMasked: maskIdentifier(v),
        ms: Date.now() - started,
        error: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <Link to="/merchant/pos" style={styles.pill}>
          {"< POS Dashboard"}
        </Link>
        <Link to="/merchant/pos/visit" style={styles.pill}>
          Register Visit
        </Link>
      </div>

      <h2>Grant Reward</h2>
      <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
        Enter a customer identifier (phone, email, or scan token).
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Phone / Email / Token"
          inputMode="text"
          style={styles.input}
        />

        <button disabled={busy} type="submit" style={styles.primaryBtn}>
          {busy ? "Working..." : "Grant"}
        </button>
      </form>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {successMsg ? <div style={styles.successBox}>{successMsg}</div> : null}

      {/* DEV-only, opt-in debug payload view (hidden by default). */}
      {debugEnabled && result ? (
        <div style={styles.debugWrap}>
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            style={styles.debugBtn}
            aria-expanded={debugOpen ? "true" : "false"}
          >
            {debugOpen ? "Hide debug details" : "Show debug details"}
          </button>

          {debugOpen ? <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre> : null}

          <div style={styles.debugHint}>
            Debug is enabled because <code>localStorage.PV_UI_DEBUG</code> is set to <code>"1"</code> (DEV only).
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  pill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    textDecoration: "none",
    color: "inherit",
    fontWeight: 700,
  },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.22)",
  },
  primaryBtn: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    width: 180,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    color: "red",
    border: "1px solid rgba(255,0,0,0.18)",
    background: "rgba(255,0,0,0.04)",
  },
  successBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,150,0,0.18)",
    background: "rgba(0,150,0,0.06)",
    fontWeight: 800,
  },
  debugWrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px dashed rgba(0,0,0,0.25)",
    background: "rgba(0,0,0,0.02)",
  },
  debugBtn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  debugHint: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
    lineHeight: 1.35,
  },
  pre: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.02)",
    overflowX: "auto",
  },
};
