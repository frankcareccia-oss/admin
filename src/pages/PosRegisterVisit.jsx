// admin/src/pages/PosRegisterVisit.jsx
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
    "X-POS-Timestamp": new Date().toISOString(),
    "X-POS-Nonce": randomHex(16),
    "X-POS-Idempotency-Key": randomHex(16),
  };
}

function classifyIdentifier(raw) {
  const v = String(raw || "").trim();
  const digits = v.replace(/[^\d]/g, "");

  const looksPhone = digits.length >= 10 && digits.length <= 15 && v.indexOf("@") === -1;

  // “Good enough” email check (UI gate only; backend remains authoritative)
  const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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
  try {
    const dev = Boolean(import.meta?.env?.DEV);
    const optIn = String(localStorage.getItem("PV_UI_DEBUG") || "") === "1";
    return dev && optIn;
  } catch {
    return false;
  }
}

function friendlyError(res, data) {
  const s = res.status;

  if (s === 401) return "Session expired. Please re-login.";
  if (s === 403) return "Not authorized for POS actions.";
  if (s === 409) return "Request rejected (replay/clock). Try again.";
  if (s === 429) return "Too many requests. Please wait a moment and retry.";
  if (s >= 500) return "Server error. Please retry.";

  return (
    data?.message ||
    data?.error?.message ||
    data?.error ||
    (typeof data === "string" ? data : "") ||
    `Request failed (${s})`
  );
}

function validateIdentifier(raw) {
  const v = String(raw || "").trim();
  if (!v) return { ok: false, reason: "Customer identifier is required." };

  const { kind, digits } = classifyIdentifier(v);

  if (kind === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return { ok: false, kind, reason: "Email format looks invalid." };
    }
    return { ok: true, kind, normalized: v.toLowerCase(), note: "Email detected." };
  }

  if (kind === "phone") {
    if (digits.length < 10 || digits.length > 15) {
      return { ok: false, kind, reason: "Phone should be 10–15 digits (you can include dashes/spaces)." };
    }
    return { ok: true, kind, normalized: digits, note: `Phone detected (${digits.length} digits).` };
  }

  // token
  // Allow alnum + common token chars. Disallow spaces.
  if (/\s/.test(v)) return { ok: false, kind, reason: "Token cannot contain spaces." };
  if (v.length < 6) return { ok: false, kind, reason: "Token looks too short (min 6 characters)." };
  if (!/^[A-Za-z0-9._:-]+$/.test(v)) {
    return { ok: false, kind, reason: "Token contains unsupported characters." };
  }
  return { ok: true, kind, normalized: v, note: "Token detected." };
}

export default function PosRegisterVisit() {
  const debugEnabled = isUiDebugEnabled();

  const [identifier, setIdentifier] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [debugOpen, setDebugOpen] = React.useState(false);

  const inFlightRef = React.useRef(false);

  const validation = React.useMemo(() => validateIdentifier(identifier), [identifier]);

  React.useEffect(() => {
    pvUiHook("pos.visit.page_loaded.ui", {
      tc: "TC-POS-VISIT-UI-01",
      sev: "info",
      stable: "pos:visit",
    });
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);

    if (!validation.ok) return;
    if (inFlightRef.current) return; // hard block double submit
    inFlightRef.current = true;

    const started = Date.now();
    setBusy(true);
    setError("");
    setResult(null);
    setSuccessMsg("");
    setDebugOpen(false);

    const v = String(identifier || "").trim();
    const { kind } = classifyIdentifier(v);

    pvUiHook("pos.visit.submit_clicked.ui", {
      tc: "TC-POS-VISIT-UI-02",
      sev: "info",
      stable: "pos:visit",
      identifierKind: kind,
      identifierMasked: maskIdentifier(v),
    });

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase()}/pos/visit`, {
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

      if (!res.ok) throw new Error(friendlyError(res, data));

      setResult(data);
      setSuccessMsg(`OK — Visit registered. (${maskIdentifier(v)})`);

      pvUiHook("pos.visit.submit_succeeded.ui", {
        tc: "TC-POS-VISIT-UI-03",
        sev: "info",
        stable: "pos:visit",
        identifierKind: kind,
        identifierMasked: maskIdentifier(v),
        ms: Date.now() - started,
      });
    } catch (err) {
      const msg = err?.message || "Failed to register visit";
      setError(msg);

      pvUiHook("pos.visit.submit_failed.ui", {
        tc: "TC-POS-VISIT-UI-04",
        sev: "warn",
        stable: "pos:visit",
        identifierKind: kind,
        identifierMasked: maskIdentifier(v),
        ms: Date.now() - started,
        error: msg,
      });
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  const showInlineProblem = touched && !validation.ok;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <Link to="/merchant/pos" style={styles.pill}>
          {"< POS Dashboard"}
        </Link>
        <Link to="/merchant/pos/reward" style={styles.pill}>
          Grant Reward
        </Link>
      </div>

      <h2>Register Visit</h2>
      <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 10 }}>
        Enter a customer identifier (phone, email, or scan token).
      </div>

      <div style={styles.hintBox}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Accepted formats</div>
        <ul style={styles.hintList}>
          <li><b>Phone</b>: (408) 205-4684, 4082054684, +1 408 205 4684</li>
          <li><b>Email</b>: name@example.com</li>
          <li><b>Token</b>: scanned code (letters/numbers, no spaces)</li>
        </ul>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setError("");
            setSuccessMsg("");
          }}
          onBlur={() => setTouched(true)}
          placeholder="Phone / Email / Token"
          inputMode="text"
          autoComplete="off"
          style={styles.input}
        />

        <div style={styles.inlineMetaRow}>
          <div style={styles.detectPill}>
            Detected: <span style={{ fontWeight: 900 }}>{String(validation.kind || "—").toUpperCase()}</span>
            {validation.ok ? (
              <span style={{ marginLeft: 8, color: "rgba(0,120,0,0.85)", fontWeight: 900 }}>
                ✓ valid
              </span>
            ) : (
              <span style={{ marginLeft: 8, color: "rgba(150,0,0,0.85)", fontWeight: 900 }}>
                ✕ needs attention
              </span>
            )}
          </div>

          {validation.ok ? (
            <div style={styles.metaNote}>
              {validation.note} (masked: <b>{maskIdentifier(identifier)}</b>)
            </div>
          ) : (
            <div style={styles.metaNote}>{showInlineProblem ? validation.reason : " "}</div>
          )}
        </div>

        <button disabled={busy || !validation.ok} type="submit" style={styles.primaryBtn}>
          {busy ? "Working..." : "Register"}
        </button>
      </form>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {successMsg ? <div style={styles.successBox}>{successMsg}</div> : null}

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
  hintBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
    marginBottom: 12,
  },
  hintList: {
    margin: 0,
    paddingLeft: 18,
    color: "rgba(0,0,0,0.70)",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.22)",
  },
  inlineMetaRow: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 10,
    alignItems: "center",
  },
  detectPill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontWeight: 800,
  },
  metaNote: {
    color: "rgba(0,0,0,0.60)",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  primaryBtn: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    width: 180,
    opacity: 1,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    color: "red",
    border: "1px solid rgba(255,0,0,0.18)",
    background: "rgba(255,0,0,0.04)",
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  },
  successBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,150,0,0.18)",
    background: "rgba(0,150,0,0.06)",
    fontWeight: 800,
    whiteSpace: "pre-wrap",
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
