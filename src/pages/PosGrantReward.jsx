// admin/src/pages/PosGrantReward.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAccessToken } from "../api/client";

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

const SS_POS_DASH_NEEDS_REFRESH = "perkvalet_pos_dash_needs_refresh";
const LS_POS_NEEDS_REFRESH = "perkvalet_pos_needs_refresh";
const LS_POS_LAST_ACTION = "perkvalet_pos_last_action";

function markDashboardNeedsRefresh(payload) {
  try {
    sessionStorage.setItem(SS_POS_DASH_NEEDS_REFRESH, "1");
  } catch {}
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

// Phone helpers (POS: phone-only)
function normalizePhoneDigits(raw) {
  return String(raw || "")
    .replace(/\D/g, "")
    .slice(0, 10);
}

function formatPhonePretty(digits) {
  const d = String(digits || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);

  if (d.length <= 3) return `(${a}`;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

function maskPhoneDigits(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  const last4 = d.slice(-4);
  return `***-***-${last4 || "****"}`;
}

function validatePhoneDigits10(rawDigits) {
  const d = normalizePhoneDigits(rawDigits);
  if (!d) return { ok: false, reason: "" };
  if (d.length !== 10) return { ok: false, reason: "Enter a 10-digit phone number." };
  return { ok: true, normalized: d };
}

export default function PosGrantReward() {
  const debugEnabled = isUiDebugEnabled();
  const location = useLocation();
  const navigate = useNavigate();

  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [lockedFromDash, setLockedFromDash] = React.useState(false);

  // POS-11: dashboard may pass consumerId
  const consumerIdFromDash = React.useMemo(() => {
    try {
      const v = location?.state?.consumerId;
      if (v == null) return null;
      const s = String(v).trim();
      return s ? s : null;
    } catch {
      return null;
    }
  }, [location?.state?.consumerId]);

  // POS-11: dashboard may pass displayName
  const displayNameFromDash = React.useMemo(() => {
    try {
      const v = location?.state?.displayName;
      if (v == null) return null;
      const s = String(v).trim();
      return s ? s : null;
    } catch {
      return null;
    }
  }, [location?.state?.displayName]);

  const [displayName, setDisplayName] = React.useState(null);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [debugOpen, setDebugOpen] = React.useState(false);

  const inFlightRef = React.useRef(false);
  const phoneInputRef = React.useRef(null);

  const phonePretty = formatPhonePretty(phoneDigits);
  const phoneV = React.useMemo(() => validatePhoneDigits10(phoneDigits), [phoneDigits]);
  const canSubmit = phoneV.ok && !busy;

  React.useEffect(() => {
    pvUiHook("pos.reward.page_loaded.ui", {
      tc: "TC-POS-REWARD-UI-01",
      sev: "info",
      stable: "pos:reward",
      cameFromDash: Boolean(location?.state?.identifier),
      consumerIdPresent: Boolean(location?.state?.consumerId),
      namePresent: Boolean(location?.state?.displayName),
    });

    // If dashboard passed an identifier, lock it and skip “confirm again”
    try {
      const fromDash = location?.state?.identifier;
      const digits = normalizePhoneDigits(fromDash);
      if (digits && digits.length === 10) {
        setPhoneDigits(digits);
        setLockedFromDash(true);

        // POS-11: show name if dashboard provided it
        setDisplayName(displayNameFromDash || null);

        pvUiHook("pos.reward.prefilled_from_dashboard.ui", {
          tc: "TC-POS-REWARD-UI-PREFILL-01",
          sev: "info",
          stable: "pos:reward",
          identifierMasked: location?.state?.identifierMasked || maskPhoneDigits(digits),
          consumerIdPresent: Boolean(location?.state?.consumerId),
          namePresent: Boolean(displayNameFromDash),
        });
        return;
      }
    } catch {}

    // Otherwise focus for manual entry
    try {
      setTimeout(() => phoneInputRef.current?.focus?.(), 0);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e) {
    e.preventDefault();

    if (!phoneV.ok) {
      setError(phoneV.reason || "Enter a 10-digit phone number.");
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

    const digits = phoneV.normalized;
    const masked = location?.state?.identifierMasked || maskPhoneDigits(digits);

    pvUiHook("pos.reward.submit_clicked.ui", {
      tc: "TC-POS-REWARD-UI-02",
      sev: "info",
      stable: "pos:reward",
      identifierKind: "phone",
      identifierMasked: masked,
      lockedFromDash,
      consumerIdPresent: Boolean(consumerIdFromDash),
      namePresent: Boolean(displayName),
    });

    try {
      const token = getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const body = {
        identifier: digits,
        ...(consumerIdFromDash ? { consumerId: consumerIdFromDash } : {}),
      };

      const res = await fetch(`${apiBase()}/pos/reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...buildPosHeaders(),
        },
        body: JSON.stringify(body),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) throw new Error(friendlyError(res, data));

      setResult(data);
      setSuccessMsg(`OK — Reward granted. (${masked})`);

      pvUiHook("pos.reward.submit_succeeded.ui", {
        tc: "TC-POS-REWARD-UI-03",
        sev: "info",
        stable: "pos:reward",
        identifierKind: "phone",
        identifierMasked: masked,
        ms: Date.now() - started,
        consumerIdPresent: Boolean(consumerIdFromDash),
        namePresent: Boolean(displayName),
      });

      markDashboardNeedsRefresh({ type: "reward", identifierMasked: masked });

      // UX: clear only if not prefilled from dashboard
      if (!lockedFromDash) {
        setPhoneDigits("");
        setDisplayName(null);
        try {
          setTimeout(() => phoneInputRef.current?.focus?.(), 0);
        } catch {}
      }
    } catch (err) {
      const msg = err?.message || "Failed to grant reward";
      setError(msg);

      pvUiHook("pos.reward.submit_failed.ui", {
        tc: "TC-POS-REWARD-UI-04",
        sev: "warn",
        stable: "pos:reward",
        identifierKind: "phone",
        identifierMasked: location?.state?.identifierMasked || maskPhoneDigits(phoneV?.normalized),
        ms: Date.now() - started,
        error: msg,
        consumerIdPresent: Boolean(consumerIdFromDash),
        namePresent: Boolean(displayName),
      });
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  const maskedDisplay = location?.state?.identifierMasked || maskPhoneDigits(phoneV?.normalized || phoneDigits);

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
      <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 10 }}>
        Confirm with the customer, then grant the reward.
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        {lockedFromDash && phoneV.ok ? (
          <div style={styles.confirmPanel}>
            <div style={styles.identityGrid}>
              <div style={styles.identityLabel}>Phone</div>
              <div style={styles.identityValue}>{maskedDisplay}</div>

              <div style={styles.identityLabel}>Name</div>
              <div style={styles.identityValueMuted}>{displayName ? String(displayName) : "—"}</div>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button disabled={!canSubmit} type="submit" style={styles.primaryBtn}>
                {busy ? "Working..." : "Confirm Reward"}
              </button>

              <div style={styles.metaLine}>
                To change customer, go back to <b>POS Dashboard</b>.
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 950 }}>Phone number</div>
              <input
                ref={phoneInputRef}
                className="pvInput"
                value={phonePretty || phoneDigits}
                onChange={(e) => {
                  const next = normalizePhoneDigits(e.target.value);
                  setPhoneDigits(next);
                  setDisplayName(null);
                  setError("");
                  setSuccessMsg("");
                }}
                placeholder=""
                inputMode="tel"
                autoComplete="off"
                style={{ ...styles.input, fontWeight: "inherit", color: "inherit" }}
              />
              <div style={styles.smallNote}>10 digits required.</div>
              <div style={styles.exampleLine}>Example: (555) 123-4567</div>

              <div style={styles.helperNote}>
                Tip: Use <b>POS Dashboard</b> to preview the customer name before confirming.
              </div>

              {error && !busy ? <div style={styles.inlineErr}>{error}</div> : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button disabled={!canSubmit} type="submit" style={styles.primaryBtn}>
                {busy ? "Working..." : "Confirm Reward"}
              </button>
            </div>
          </div>
        )}
      </form>

      {error && (lockedFromDash || phoneV.ok) ? <div style={styles.errorBox}>{error}</div> : null}
      {successMsg ? (
        <div style={styles.successBox}>
          <div style={{ fontWeight: 950 }}>{successMsg}</div>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                pvUiHook("pos.reward.back_to_dashboard_clicked.ui", {
                  tc: "TC-POS-REWARD-UI-BACK-01",
                  sev: "info",
                  stable: "pos:reward",
                });
                navigate("/merchant/pos");
              }}
              style={styles.pillBtn}
            >
              Back to POS Dashboard
            </button>
          </div>
        </div>
      ) : null}

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
  pillBtn: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  card: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "white",
  },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.22)",
    width: "100%",
  },
  smallNote: {
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
    fontWeight: 800,
  },
  exampleLine: {
    color: "rgba(0,0,0,0.22)",
    fontWeight: 650,
    fontSize: 12,
    marginTop: 2,
  },
  helperNote: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
    fontWeight: 700,
    lineHeight: 1.25,
  },
  inlineErr: {
    fontSize: 12,
    color: "rgba(150,0,0,0.85)",
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "black",
    color: "white",
    cursor: "pointer",
    fontWeight: 950,
    minWidth: 170,
  },
  confirmPanel: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
  },
  identityGrid: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    gap: 10,
    alignItems: "center",
  },
  identityLabel: { color: "rgba(0,0,0,0.60)", fontWeight: 950, fontSize: 12 },
  identityValue: { fontWeight: 950, fontSize: 16 },
  identityValueMuted: { fontWeight: 900, fontSize: 16, color: "rgba(0,0,0,0.45)" },

  metaLine: { color: "rgba(0,0,0,0.55)", fontSize: 12, fontWeight: 850 },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    color: "rgba(140,0,0,1)",
    border: "1px solid rgba(255,0,0,0.18)",
    background: "rgba(255,0,0,0.04)",
    fontWeight: 900,
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
