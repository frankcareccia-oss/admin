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

function onlyDigits(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

function looksEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

function maskPhoneDigits(digits) {
  const d = onlyDigits(digits);
  const last4 = d.slice(-4);
  return `***-***-${last4 || "****"}`;
}

function maskEmail(email) {
  const v = String(email || "").trim();
  if (!v.includes("@")) return "***@***";
  const [u, d] = v.split("@");
  const uMasked = u ? `${u.slice(0, 2)}***` : "***";
  return `${uMasked}@${d || "***"}`;
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

function validatePhone(raw) {
  const digits = onlyDigits(raw);
  if (!raw) return { ok: false, reason: "Phone is empty." };
  // Hard rule: if user typed letters, do not allow it to “become” a token.
  if (/[A-Za-z]/.test(String(raw))) {
    return { ok: false, reason: "Phone cannot contain letters." };
  }
  if (digits.length < 10 || digits.length > 15) {
    return { ok: false, reason: "Phone should be 10–15 digits (you can include dashes/spaces)." };
  }
  return { ok: true, digits, note: `Phone detected (${digits.length} digits).` };
}

function validateEmail(raw) {
  const v = String(raw || "").trim();
  if (!v) return { ok: false, reason: "Email is empty." };
  if (!looksEmail(v)) return { ok: false, reason: "Email format looks invalid." };
  return { ok: true, email: v.toLowerCase(), note: "Email detected." };
}

function computeChoice(phoneRaw, emailRaw) {
  const phone = String(phoneRaw || "");
  const email = String(emailRaw || "").trim();

  const phoneHas = phone.trim().length > 0;
  const emailHas = email.length > 0;

  if (!phoneHas && !emailHas) {
    return { ok: false, kind: "none", reason: "Enter a phone OR an email." };
  }
  if (phoneHas && emailHas) {
    return { ok: false, kind: "both", reason: "Choose phone OR email (not both)." };
  }

  if (phoneHas) {
    const v = validatePhone(phone);
    if (!v.ok) return { ok: false, kind: "phone", reason: v.reason };
    return {
      ok: true,
      kind: "phone",
      identifier: v.digits,
      masked: maskPhoneDigits(v.digits),
      note: v.note,
    };
  }

  // emailHas
  const v = validateEmail(email);
  if (!v.ok) return { ok: false, kind: "email", reason: v.reason };
  return {
    ok: true,
    kind: "email",
    identifier: v.email,
    masked: maskEmail(v.email),
    note: v.note,
  };
}

export default function PosRegisterVisit() {
  const debugEnabled = isUiDebugEnabled();

  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [debugOpen, setDebugOpen] = React.useState(false);

  const inFlightRef = React.useRef(false);

  const choice = React.useMemo(() => computeChoice(phone, email), [phone, email]);

  React.useEffect(() => {
    pvUiHook("pos.visit.page_loaded.ui", {
      tc: "TC-POS-VISIT-UI-01",
      sev: "info",
      stable: "pos:visit",
    });
  }, []);

  function onChangePhone(v) {
    setPhone(v);
    if (String(v || "").trim().length > 0) setEmail(""); // enforce single choice
    setError("");
    setSuccessMsg("");
  }

  function onChangeEmail(v) {
    setEmail(v);
    if (String(v || "").trim().length > 0) setPhone(""); // enforce single choice
    setError("");
    setSuccessMsg("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);

    if (!choice.ok) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const started = Date.now();
    setBusy(true);
    setError("");
    setResult(null);
    setSuccessMsg("");
    setDebugOpen(false);

    pvUiHook("pos.visit.submit_clicked.ui", {
      tc: "TC-POS-VISIT-UI-02",
      sev: "info",
      stable: "pos:visit",
      identifierKind: choice.kind,
      identifierMasked: choice.masked,
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
        body: JSON.stringify({ identifier: choice.identifier }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) throw new Error(friendlyError(res, data));

      setResult(data);
      setSuccessMsg(`OK — Visit registered. (${choice.masked})`);

      pvUiHook("pos.visit.submit_succeeded.ui", {
        tc: "TC-POS-VISIT-UI-03",
        sev: "info",
        stable: "pos:visit",
        identifierKind: choice.kind,
        identifierMasked: choice.masked,
        ms: Date.now() - started,
      });
    } catch (err) {
      const msg = err?.message || "Failed to register visit";
      setError(msg);

      pvUiHook("pos.visit.submit_failed.ui", {
        tc: "TC-POS-VISIT-UI-04",
        sev: "warn",
        stable: "pos:visit",
        identifierKind: choice.kind,
        identifierMasked: choice.masked,
        ms: Date.now() - started,
        error: msg,
      });
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  const showInlineProblem = touched && !choice.ok;

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
        Enter a customer phone <b>or</b> email.
      </div>

      <div style={styles.hintBox}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Accepted formats</div>
        <ul style={styles.hintList}>
          <li>
            <b>Phone</b>: (408) 205-4684, 4082054684, +1 408 205 4684
          </li>
          <li>
            <b>Email</b>: name@example.com
          </li>
        </ul>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Phone</div>
          <input
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="(408) 205-4684"
            inputMode="tel"
            autoComplete="off"
            disabled={busy}
            style={styles.input}
          />
          <div style={styles.hintSmall}>Digits only are sent to the server. Letters are rejected.</div>
        </label>

        <div style={styles.orRow}>
          <div style={styles.orLine} />
          <div style={styles.orText}>OR</div>
          <div style={styles.orLine} />
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={styles.label}>Email</div>
          <input
            value={email}
            onChange={(e) => onChangeEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="name@example.com"
            inputMode="email"
            autoComplete="off"
            disabled={busy}
            style={styles.input}
          />
          <div style={styles.hintSmall}>Email is lowercased before sending.</div>
        </label>

        <div style={styles.inlineMetaRow}>
          <div style={styles.detectPill}>
            Detected:{" "}
            <span style={{ fontWeight: 900 }}>
              {choice.kind === "none" ? "—" : String(choice.kind || "—").toUpperCase()}
            </span>
            {choice.ok ? (
              <span style={{ marginLeft: 8, color: "rgba(0,120,0,0.85)", fontWeight: 900 }}>✓ valid</span>
            ) : (
              <span style={{ marginLeft: 8, color: "rgba(150,0,0,0.85)", fontWeight: 900 }}>✕ needs attention</span>
            )}
          </div>

          {choice.ok ? (
            <div style={styles.metaNote}>
              {choice.note} (masked: <b>{choice.masked}</b>)
            </div>
          ) : (
            <div style={styles.metaNote}>{showInlineProblem ? choice.reason : " "}</div>
          )}
        </div>

        <button disabled={busy || !choice.ok} type="submit" style={styles.primaryBtn}>
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
  label: { fontSize: 13, color: "rgba(0,0,0,0.7)", fontWeight: 900 },
  hintSmall: { fontSize: 12, color: "rgba(0,0,0,0.55)", fontWeight: 700 },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.22)",
  },
  orRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
    margin: "6px 0",
  },
  orLine: { height: 1, background: "rgba(0,0,0,0.12)" },
  orText: { fontWeight: 900, color: "rgba(0,0,0,0.55)", fontSize: 12 },
  inlineMetaRow: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
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
