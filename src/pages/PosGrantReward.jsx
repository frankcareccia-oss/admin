// admin/src/pages/PosGrantReward.jsx
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

const LS_POS_NEEDS_REFRESH = "perkvalet_pos_needs_refresh";
const LS_POS_LAST_ACTION = "perkvalet_pos_last_action";

function markDashboardNeedsRefresh(payload) {
  try {
    localStorage.setItem(LS_POS_NEEDS_REFRESH, "1");
    localStorage.setItem(
      LS_POS_LAST_ACTION,
      JSON.stringify({
        ...payload,
        at: new Date().toISOString(),
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

function normalizePhone(raw) {
  const v = String(raw || "").trim();
  const hasLetters = /[A-Za-z]/.test(v);
  const digits = v.replace(/[^\d]/g, "");
  return { v, digits, hasLetters };
}

function validatePhone(raw) {
  const { v, digits, hasLetters } = normalizePhone(raw);
  if (!v) return { ok: false, reason: "" };
  if (hasLetters) return { ok: false, reason: "Phone cannot contain letters." };
  if (digits.length < 10 || digits.length > 15) return { ok: false, reason: "Phone should be 10–15 digits." };
  return { ok: true, normalized: digits, note: `Phone detected (${digits.length} digits).` };
}

function validateEmail(raw) {
  const v = String(raw || "").trim();
  if (!v) return { ok: false, reason: "" };
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!ok) return { ok: false, reason: "Email format looks invalid." };
  return { ok: true, normalized: v.toLowerCase(), note: "Email detected." };
}

function maskPhoneDigits(digits) {
  const d = String(digits || "");
  const last4 = d.slice(-4);
  return `***-***-${last4 || "****"}`;
}

function maskEmail(email) {
  const v = String(email || "").trim();
  const [u, d] = v.split("@");
  const uMasked = u ? `${u.slice(0, 2)}***` : "***";
  return `${uMasked}@${d || "***"}`;
}

export default function PosGrantReward() {
  const debugEnabled = isUiDebugEnabled();

  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [useKind, setUseKind] = React.useState("phone");

  const [touchedPhone, setTouchedPhone] = React.useState(false);
  const [touchedEmail, setTouchedEmail] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [debugOpen, setDebugOpen] = React.useState(false);

  const inFlightRef = React.useRef(false);
  const phoneInputRef = React.useRef(null);

  const phoneV = React.useMemo(() => validatePhone(phone), [phone]);
  const emailV = React.useMemo(() => validateEmail(email), [email]);

  const phoneHasValue = String(phone || "").trim().length > 0;
  const emailHasValue = String(email || "").trim().length > 0;

  const phoneValid = phoneHasValue && phoneV.ok;
  const emailValid = emailHasValue && emailV.ok;

  const bothPresent = phoneHasValue && emailHasValue;
  const bothValid = phoneValid && emailValid;

  function resolveSubmission() {
    if (bothValid) {
      if (useKind === "phone") return { kind: "phone", identifier: phoneV.normalized, masked: maskPhoneDigits(phoneV.normalized) };
      return { kind: "email", identifier: emailV.normalized, masked: maskEmail(emailV.normalized) };
    }
    if (phoneValid) return { kind: "phone", identifier: phoneV.normalized, masked: maskPhoneDigits(phoneV.normalized) };
    if (emailValid) return { kind: "email", identifier: emailV.normalized, masked: maskEmail(emailV.normalized) };
    return null;
  }

  const submission = resolveSubmission();
  const canSubmit = Boolean(submission) && !busy;

  React.useEffect(() => {
    pvUiHook("pos.reward.page_loaded.ui", {
      tc: "TC-POS-REWARD-UI-01",
      sev: "info",
      stable: "pos:reward",
    });

    try {
      setTimeout(() => phoneInputRef.current?.focus?.(), 0);
    } catch {}
  }, []);

  function clearInputsAfterSuccess(submittedKind) {
    setPhone("");
    setEmail("");
    setUseKind("phone");
    setTouchedPhone(false);
    setTouchedEmail(false);

    try {
      setTimeout(() => phoneInputRef.current?.focus?.(), 0);
    } catch {}

    pvUiHook("pos.reward.inputs_cleared.ui", {
      tc: "TC-POS-REWARD-UI-05",
      sev: "info",
      stable: "pos:reward",
      submittedKind: submittedKind || null,
      clearedPhone: true,
      clearedEmail: true,
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouchedPhone(true);
    setTouchedEmail(true);

    if (!submission) {
      setError("Enter a valid phone or email.");
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const started = Date.now();
    setBusy(true);
    setError("");
    setResult(null);
    setSuccessMsg("");
    setDebugOpen(false);

    pvUiHook("pos.reward.submit_clicked.ui", {
      tc: "TC-POS-REWARD-UI-02",
      sev: "info",
      stable: "pos:reward",
      identifierKind: submission.kind,
      identifierMasked: submission.masked,
      bothPresent,
      bothValid,
      chosenKind: useKind,
    });

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${apiBase()}/pos/reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...buildPosHeaders(),
        },
        body: JSON.stringify({ identifier: submission.identifier }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) throw new Error(friendlyError(res, data));

      setResult(data);
      setSuccessMsg(`OK — Reward granted. (${submission.masked})`);

      pvUiHook("pos.reward.submit_succeeded.ui", {
        tc: "TC-POS-REWARD-UI-03",
        sev: "info",
        stable: "pos:reward",
        identifierKind: submission.kind,
        identifierMasked: submission.masked,
        ms: Date.now() - started,
      });

      // NEW: tell dashboard to refresh next time it's shown
      markDashboardNeedsRefresh({ type: "reward", identifierMasked: submission.masked });

      clearInputsAfterSuccess(submission.kind);
    } catch (err) {
      const msg = err?.message || "Failed to grant reward";
      setError(msg);

      pvUiHook("pos.reward.submit_failed.ui", {
        tc: "TC-POS-REWARD-UI-04",
        sev: "warn",
        stable: "pos:reward",
        identifierKind: submission?.kind,
        identifierMasked: submission?.masked,
        ms: Date.now() - started,
        error: msg,
      });
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  const phoneInlineErr = touchedPhone && phoneHasValue && !phoneV.ok ? phoneV.reason : "";
  const emailInlineErr = touchedEmail && emailHasValue && !emailV.ok ? emailV.reason : "";

  const detectedKindLabel = submission ? submission.kind.toUpperCase() : "—";
  const detectedOk = Boolean(submission);

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
      <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 10 }}>Enter a customer phone or email.</div>

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
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Phone</div>
          <input
            ref={phoneInputRef}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setUseKind("phone");
              setError("");
              setSuccessMsg("");
            }}
            onBlur={() => setTouchedPhone(true)}
            placeholder="(408) 205-4684"
            inputMode="tel"
            autoComplete="off"
            style={styles.input}
          />
          <div style={styles.smallNote}>Digits only are sent to the server. Letters are rejected.</div>
          {phoneInlineErr ? <div style={styles.inlineErr}>{phoneInlineErr}</div> : null}
        </div>

        <div style={{ textAlign: "center", color: "rgba(0,0,0,0.45)", fontWeight: 900, margin: "2px 0" }}>OR</div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Email</div>
          <input
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setUseKind("email");
              setError("");
              setSuccessMsg("");
            }}
            onBlur={() => setTouchedEmail(true)}
            placeholder="name@example.com"
            inputMode="email"
            autoComplete="off"
            style={styles.input}
          />
          <div style={styles.smallNote}>Email is lowercased before sending.</div>
          {emailInlineErr ? <div style={styles.inlineErr}>{emailInlineErr}</div> : null}
        </div>

        {bothValid ? (
          <div style={styles.selectorBox}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Both are valid — which should we use?</div>
            <label style={styles.radioRow}>
              <input type="radio" name="useKind" checked={useKind === "phone"} onChange={() => setUseKind("phone")} />
              <span style={{ fontWeight: 900 }}>Use phone</span>
              <span style={{ color: "rgba(0,0,0,0.60)", fontWeight: 800 }}>({maskPhoneDigits(phoneV.normalized)})</span>
            </label>
            <label style={styles.radioRow}>
              <input type="radio" name="useKind" checked={useKind === "email"} onChange={() => setUseKind("email")} />
              <span style={{ fontWeight: 900 }}>Use email</span>
              <span style={{ color: "rgba(0,0,0,0.60)", fontWeight: 800 }}>({maskEmail(emailV.normalized)})</span>
            </label>
          </div>
        ) : null}

        <div style={styles.inlineMetaRow}>
          <div style={styles.detectPill}>
            Detected: <span style={{ fontWeight: 900 }}>{detectedKindLabel}</span>
            {detectedOk ? (
              <span style={{ marginLeft: 8, color: "rgba(0,120,0,0.85)", fontWeight: 900 }}>✓ valid</span>
            ) : (
              <span style={{ marginLeft: 8, color: "rgba(0,0,0,0.55)", fontWeight: 900 }}>ready</span>
            )}
          </div>
          <div style={styles.metaNote}>
            {submission
              ? `${submission.kind === "phone" ? phoneV.note : emailV.note} (masked: ${submission.masked})`
              : "Enter a valid phone or email."}
          </div>
        </div>

        <button disabled={!canSubmit} type="submit" style={styles.primaryBtn}>
          {busy ? "Working..." : "Grant"}
        </button>
      </form>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {successMsg ? <div style={styles.successBox}>{successMsg}</div> : null}

      {debugEnabled && result ? (
        <div style={styles.debugWrap}>
          <button type="button" onClick={() => setDebugOpen((v) => !v)} style={styles.debugBtn} aria-expanded={debugOpen ? "true" : "false"}>
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
  smallNote: {
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
    fontWeight: 800,
  },
  inlineErr: {
    fontSize: 12,
    color: "rgba(150,0,0,0.85)",
    fontWeight: 900,
  },
  selectorBox: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
  },
  radioRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginTop: 6,
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
  border: "1px solid rgba(0,140,0,0.40)",
  background: "rgba(0,170,0,0.14)",
  color: "rgba(0,85,0,0.95)",
  fontWeight: 900,
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
