// admin/src/pages/PosGrantReward.jsx
// POS Grant Reward — Phase A
// Shows reward card before confirmation, structured success screen per spec §4.
// Entry requires consumerId from POS Dashboard (redirect guard enforced).

import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAccessToken } from "../api/client";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

const SS_POS_DASH_NEEDS_REFRESH = "perkvalet_pos_dash_needs_refresh";
const LS_POS_NEEDS_REFRESH = "perkvalet_pos_needs_refresh";
const LS_POS_LAST_ACTION = "perkvalet_pos_last_action";

function markDashboardNeedsRefresh(payload) {
  try { sessionStorage.setItem(SS_POS_DASH_NEEDS_REFRESH, "1"); } catch {}
  try {
    localStorage.setItem(LS_POS_NEEDS_REFRESH, "1");
    localStorage.setItem(LS_POS_LAST_ACTION, JSON.stringify({ ...payload, at: new Date().toISOString() }));
  } catch {}
}

function apiBase() {
  return (import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001").trim().replace(/\/+$/, "");
}

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
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
    return Boolean(import.meta?.env?.DEV) && String(localStorage.getItem("PV_UI_DEBUG") || "") === "1";
  } catch { return false; }
}

function friendlyError(res, data) {
  const s = res.status;
  if (s === 401) return "Session expired. Please re-login.";
  if (s === 403) return "Not authorized for POS actions.";
  if (s === 409) return "Request rejected (replay/clock). Try again.";
  if (s === 422) return "No reward available for this customer.";
  if (s === 429) return "Too many requests. Please wait a moment and retry.";
  if (s >= 500) return "Server error. Please retry.";
  return data?.message || data?.error?.message || data?.error || (typeof data === "string" ? data : "") || `Request failed (${s})`;
}

function normalizePhoneDigits(raw) {
  return String(raw || "").replace(/\D/g, "").slice(0, 10);
}

function maskPhoneDigits(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  return `***-***-${d.slice(-4) || "****"}`;
}

function firstName(displayName) {
  if (!displayName) return null;
  return String(displayName).trim().split(/\s+/)[0] || null;
}

export default function PosGrantReward() {
  const debugEnabled = isUiDebugEnabled();
  const location = useLocation();
  const navigate = useNavigate();

  // --- Route state
  const state = location?.state || {};
  const fromDashDigits = normalizePhoneDigits(state.identifier);
  const consumerIdFromDash = state.consumerId ? String(state.consumerId) : null;
  const displayName = state.displayName ? String(state.displayName).trim() : null;
  const maskedDisplay = state.identifierMasked || maskPhoneDigits(fromDashDigits);
  const rewardLabelFromDash = state.rewardLabel ? String(state.rewardLabel) : null;

  // --- Local state
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [grantedReward, setGrantedReward] = React.useState(null); // backend response reward object
  const [grantedProgress, setGrantedProgress] = React.useState(null);
  const [grantedConsumer, setGrantedConsumer] = React.useState(null);
  const [completed, setCompleted] = React.useState(false);
  const [debugOpen, setDebugOpen] = React.useState(false);
  const [debugData, setDebugData] = React.useState(null);
  const inFlightRef = React.useRef(false);

  // --- Entry guard: must come from dashboard with consumerId
  const hasValidEntry = Boolean(fromDashDigits.length === 10 && consumerIdFromDash);

  React.useEffect(() => {
    pvUiHook("pos.reward.page_loaded.ui", {
      tc: "TC-POS-REWARD-UI-01",
      sev: "info",
      stable: "pos:reward",
      cameFromDash: Boolean(state.identifier),
      consumerIdPresent: Boolean(consumerIdFromDash),
      namePresent: Boolean(displayName),
    });

    if (!hasValidEntry) {
      pvUiHook("pos.reward.entry_blocked.ui", {
        tc: "TC-POS-13-FRAUD-11",
        sev: "warn",
        stable: "pos:reward",
        reason: !fromDashDigits ? "missing_identifier" : !consumerIdFromDash ? "missing_consumerId" : "invalid_identifier",
      });
      try { setTimeout(() => navigate("/merchant/pos", { replace: true }), 50); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onConfirmReward(e) {
    e.preventDefault();
    if (completed || !hasValidEntry) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const started = Date.now();
    setBusy(true);
    setError("");
    setDebugData(null);

    pvUiHook("pos.reward.confirm_clicked.ui", {
      tc: "TC-POS-REWARD-UI-02",
      sev: "info",
      stable: "pos:reward",
      identifierMasked: maskedDisplay,
      consumerIdPresent: true,
      namePresent: Boolean(displayName),
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
        body: JSON.stringify({ identifier: fromDashDigits, consumerId: consumerIdFromDash }),
      });

      let data = null;
      try { data = await res.json(); } catch {}

      if (!res.ok) throw new Error(friendlyError(res, data));

      setGrantedReward(data.reward || null);
      setGrantedProgress(data.progress || null);
      setGrantedConsumer(data.consumer || null);
      setCompleted(true);
      setDebugData(data);

      pvUiHook("pos.reward.confirmed.ui", {
        tc: "TC-POS-REWARD-UI-03",
        sev: "info",
        stable: "pos:reward",
        identifierMasked: maskedDisplay,
        ms: Date.now() - started,
        rewardType: data.reward?.type || null,
        redemptionId: data.redemptionId || null,
      });

      markDashboardNeedsRefresh({ type: "reward", identifierMasked: maskedDisplay });
    } catch (err) {
      const msg = err?.message || "Failed to grant reward";
      setError(msg);
      pvUiHook("pos.reward.failed.ui", {
        tc: "TC-POS-REWARD-UI-04",
        sev: "warn",
        stable: "pos:reward",
        identifierMasked: maskedDisplay,
        ms: Date.now() - started,
        error: msg,
      });
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  }

  const fName = firstName(displayName);

  // --- Reward label to display pre-confirmation (from route state)
  const previewLabel = rewardLabelFromDash || "Reward";

  // --- Post-grant display values
  const grantedLabel = grantedReward?.label || previewLabel;
  const grantedDescription = grantedReward?.description || null;
  const nextVisitOnly = grantedReward?.nextVisitOnly === true;

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Back nav */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <Link to="/merchant/pos" style={styles.pill}>{"< POS Dashboard"}</Link>
      </div>

      {/* ── SUCCESS SCREEN (§4) ── */}
      {completed ? (
        <div style={styles.successCard}>
          <div style={styles.successCheck}>Reward granted ✓</div>

          <div style={styles.successName}>
            {fName ? `${fName} received:` : "Reward granted to customer:"}
          </div>

          <div style={styles.successRewardLabel}>{grantedLabel}</div>

          {grantedDescription && grantedDescription !== grantedLabel ? (
            <div style={styles.successRewardDesc}>{grantedDescription}</div>
          ) : null}

          <div style={styles.successApplied}>
            {nextVisitOnly ? "Available on next visit." : "Applied to this visit."}
          </div>

          {grantedProgress?.programLabel ? (
            <div style={styles.successProgress}>
              {grantedProgress.programLabel}
              {grantedProgress.remainingStamps != null
                ? ` · ${grantedProgress.remainingStamps} stamps remaining`
                : ""}
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={() => {
                pvUiHook("pos.reward.back_clicked.ui", { tc: "TC-POS-REWARD-UI-BACK-01", sev: "info", stable: "pos:reward" });
                navigate("/merchant/pos");
              }}
              style={styles.backBtn}
            >
              Back to POS Dashboard
            </button>
          </div>
        </div>
      ) : (
        /* ── PRE-CONFIRMATION SCREEN ── */
        <form onSubmit={onConfirmReward} style={{ display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0 }}>Grant Reward</h2>

          {/* Customer identity */}
          <div style={styles.identityCard}>
            <div style={styles.identityRow}>
              <span style={styles.identityLabel}>Customer</span>
              <span style={styles.identityValue}>{displayName || maskedDisplay}</span>
            </div>
            <div style={styles.identityRow}>
              <span style={styles.identityLabel}>Phone</span>
              <span style={styles.identityValueMuted}>{maskedDisplay}</span>
            </div>
          </div>

          {/* Reward preview card */}
          <div style={styles.rewardCard}>
            <div style={styles.rewardCardTag}>Reward ready</div>
            <div style={styles.rewardCardLabel}>{previewLabel}</div>
            <div style={styles.rewardCardNote}>Confirm with the customer, then tap Grant.</div>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          <button
            type="submit"
            disabled={busy || completed}
            style={{ ...styles.grantBtn, opacity: busy || completed ? 0.55 : 1 }}
          >
            {busy ? "Granting..." : "Grant Reward"}
          </button>

          <div style={styles.metaLine}>
            To change customer, go back to <b>POS Dashboard</b>.
          </div>
        </form>
      )}

      {/* Debug panel (DEV only) */}
      {debugEnabled && debugData ? (
        <div style={styles.debugWrap}>
          <button type="button" onClick={() => setDebugOpen((v) => !v)} style={styles.debugBtn}>
            {debugOpen ? "Hide debug" : "Show debug"}
          </button>
          {debugOpen ? <pre style={styles.pre}>{JSON.stringify(debugData, null, 2)}</pre> : null}
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

  // Identity card
  identityCard: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.025)",
    display: "grid",
    gap: 6,
  },
  identityRow: { display: "flex", gap: 12, alignItems: "baseline" },
  identityLabel: { color: "rgba(0,0,0,0.55)", fontWeight: 950, fontSize: 12, width: 70, flexShrink: 0 },
  identityValue: { fontWeight: 950, fontSize: 17 },
  identityValueMuted: { fontWeight: 900, fontSize: 15, color: "rgba(0,0,0,0.50)" },

  // Reward preview card
  rewardCard: {
    padding: "16px 18px",
    borderRadius: 16,
    border: "1px solid rgba(0,170,0,0.30)",
    background: "rgba(0,200,0,0.07)",
  },
  rewardCardTag: { fontSize: 11, fontWeight: 950, color: "rgba(0,100,0,0.80)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 },
  rewardCardLabel: { fontSize: 22, fontWeight: 950, color: "rgba(0,0,0,0.85)", marginBottom: 6 },
  rewardCardNote: { fontSize: 13, color: "rgba(0,0,0,0.55)", fontWeight: 850 },

  // Grant button
  grantBtn: {
    padding: "15px 20px",
    borderRadius: 14,
    border: "none",
    background: "black",
    color: "white",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    width: "100%",
  },

  // Error
  errorBox: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,0,0,0.20)",
    background: "rgba(255,0,0,0.04)",
    color: "rgba(140,0,0,1)",
    fontWeight: 900,
    fontSize: 14,
  },

  metaLine: { color: "rgba(0,0,0,0.50)", fontSize: 12, fontWeight: 850 },

  // Success card (§4)
  successCard: {
    padding: "24px 20px",
    borderRadius: 18,
    border: "1px solid rgba(0,140,0,0.35)",
    background: "rgba(0,200,0,0.09)",
  },
  successCheck: { fontSize: 20, fontWeight: 950, color: "rgba(0,100,0,0.90)", marginBottom: 16 },
  successName: { fontSize: 14, fontWeight: 950, color: "rgba(0,0,0,0.60)", marginBottom: 4 },
  successRewardLabel: { fontSize: 28, fontWeight: 950, color: "rgba(0,0,0,0.88)", marginBottom: 6 },
  successRewardDesc: { fontSize: 14, color: "rgba(0,0,0,0.60)", fontWeight: 850, marginBottom: 8 },
  successApplied: { fontSize: 13, color: "rgba(0,80,0,0.80)", fontWeight: 900, marginTop: 4 },
  successProgress: { marginTop: 12, fontSize: 12, color: "rgba(0,0,0,0.50)", fontWeight: 850 },

  backBtn: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 14,
  },

  // Debug
  debugWrap: { marginTop: 16, padding: 12, borderRadius: 12, border: "1px dashed rgba(0,0,0,0.22)", background: "rgba(0,0,0,0.02)" },
  debugBtn: { padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.18)", background: "white", cursor: "pointer", fontWeight: 800 },
  pre: { marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.02)", overflowX: "auto", fontSize: 12 },
};
