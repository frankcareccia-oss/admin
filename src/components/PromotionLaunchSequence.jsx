/**
 * PromotionLaunchSequence.jsx — Pre-publish checklist + legal flag review
 *
 * Flow: Review flags → Acknowledge or fix → Preview → Confirm → Launch
 * Used when transitioning a promotion from draft → active.
 */

import React from "react";
import { color } from "../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function scanPromotion(promoData) {
  const token = localStorage.getItem("pv_token");
  const res = await fetch(`${API_BASE}/merchant/onboarding/scan-promotion`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(promoData),
  });
  if (!res.ok) throw new Error("Scan failed");
  return res.json();
}

async function acknowledgeFlag(promotionId, flagId, action) {
  const token = localStorage.getItem("pv_token");
  await fetch(`${API_BASE}/merchant/onboarding/acknowledge-flag`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ promotionId, flagId, action }),
  });
}

const C = {
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75",
  muted: "#999",
  border: "#E5E5E0",
  amber: "#F57F17",
  red: "#C62828",
  green: "#2E7D32",
};

const s = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modal: {
    background: "#fff", borderRadius: 16, padding: "24px", maxWidth: 550, width: "90%",
    maxHeight: "80vh", overflowY: "auto",
  },
  title: { fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.muted, marginBottom: 20 },

  flagCard: (severity) => ({
    background: severity === "warning" ? "#FFF8E1" : "#F5F5F5",
    border: `1px solid ${severity === "warning" ? "#FFE082" : C.border}`,
    borderRadius: 10, padding: "14px 16px", marginBottom: 10,
  }),
  flagIcon: (severity) => ({
    fontSize: 16, marginRight: 6,
    color: severity === "warning" ? C.amber : C.muted,
  }),
  flagTitle: { fontSize: 14, fontWeight: 600, color: C.navy, display: "flex", alignItems: "center" },
  flagMessage: { fontSize: 13, color: C.navy, marginTop: 6, lineHeight: 1.5 },
  flagActions: { display: "flex", gap: 8, marginTop: 10 },
  flagBtn: {
    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${C.border}`, background: "#fff", color: C.navy,
  },
  flagBtnPrimary: {
    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
    border: "none", background: C.teal, color: "#fff",
  },

  checkItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 14, color: C.navy },
  checkIcon: (ok) => ({ color: ok ? C.green : C.muted, fontSize: 16 }),

  primaryBtn: { padding: "14px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: C.teal, color: "#fff", fontSize: 15, fontWeight: 700, width: "100%", marginTop: 16 },
  secondaryBtn: { padding: "12px 20px", borderRadius: 8, cursor: "pointer", border: `1px solid ${C.border}`, background: "transparent", color: C.navy, fontSize: 14, fontWeight: 600, width: "100%", marginTop: 8 },
  cancelBtn: { padding: "12px 20px", borderRadius: 8, cursor: "pointer", border: "none", background: "transparent", color: C.muted, fontSize: 14, width: "100%", marginTop: 4, textAlign: "center" },
};

export default function PromotionLaunchSequence({ promotion, onLaunch, onCancel }) {
  const [step, setStep] = React.useState("scanning"); // scanning, flags, checklist, confirm
  const [flags, setFlags] = React.useState([]);
  const [acknowledged, setAcknowledged] = React.useState({});
  const [launching, setLaunching] = React.useState(false);

  React.useEffect(() => {
    scanPromotion(promotion)
      .then(data => {
        setFlags(data.flags || []);
        setStep(data.flags?.length > 0 ? "flags" : "checklist");
      })
      .catch(() => setStep("checklist"));
  }, [promotion]);

  const handleAcknowledge = async (flagId) => {
    setAcknowledged(prev => ({ ...prev, [flagId]: true }));
    if (promotion.id) {
      await acknowledgeFlag(promotion.id, flagId, "acknowledged").catch(() => {});
    }
  };

  const allFlagsHandled = flags.every(f => acknowledged[f.id]);

  const checklist = [
    { label: "Promotion name is clear and descriptive", ok: promotion.name?.length > 5 },
    { label: "Reward value is set", ok: !!promotion.rewardValue || promotion.rewardType === "custom" },
    { label: "Visit threshold is reasonable (3-20)", ok: promotion.threshold >= 3 && promotion.threshold <= 20 },
    { label: "Expiry window is set", ok: !!promotion.rewardExpiryDays },
    { label: "Terms & conditions generated", ok: !!promotion.legalText },
  ];

  const allChecksPass = checklist.every(c => c.ok);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await onLaunch();
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {step === "scanning" && (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
            Reviewing your promotion...
          </div>
        )}

        {step === "flags" && (
          <>
            <div style={s.title}>Review Before Launch</div>
            <div style={s.subtitle}>
              We found {flags.length} item{flags.length !== 1 ? "s" : ""} to review. These are suggestions — you decide what to do.
            </div>

            {flags.map(flag => (
              <div key={flag.id} style={s.flagCard(flag.severity)}>
                <div style={s.flagTitle}>
                  <span style={s.flagIcon(flag.severity)}>{flag.severity === "warning" ? "⚠️" : "ℹ️"}</span>
                  {flag.title}
                </div>
                <div style={s.flagMessage}>{flag.message}</div>
                {!acknowledged[flag.id] && (
                  <div style={s.flagActions}>
                    <button style={s.flagBtnPrimary} onClick={() => handleAcknowledge(flag.id)}>
                      Keep as is — I understand
                    </button>
                  </div>
                )}
                {acknowledged[flag.id] && (
                  <div style={{ fontSize: 12, color: C.green, marginTop: 6, fontWeight: 600 }}>
                    ✓ Acknowledged
                  </div>
                )}
              </div>
            ))}

            <button
              style={{ ...s.primaryBtn, opacity: allFlagsHandled ? 1 : 0.5 }}
              onClick={() => setStep("checklist")}
              disabled={!allFlagsHandled}
            >
              Continue →
            </button>
            <div style={s.cancelBtn} onClick={onCancel}>Cancel</div>
          </>
        )}

        {step === "checklist" && (
          <>
            <div style={s.title}>Pre-Launch Checklist</div>
            <div style={s.subtitle}>Quick review before your program goes live.</div>

            {checklist.map((item, i) => (
              <div key={i} style={s.checkItem}>
                <span style={s.checkIcon(item.ok)}>{item.ok ? "✓" : "○"}</span>
                <span style={{ color: item.ok ? C.navy : C.muted }}>{item.label}</span>
              </div>
            ))}

            <button style={s.primaryBtn} onClick={() => setStep("confirm")}>
              {allChecksPass ? "Ready to launch →" : "Launch anyway →"}
            </button>
            {flags.length > 0 && (
              <button style={s.secondaryBtn} onClick={() => setStep("flags")}>
                ← Back to review
              </button>
            )}
            <div style={s.cancelBtn} onClick={onCancel}>Cancel</div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
              <div style={s.title}>Launch "{promotion.name}"?</div>
              <div style={s.subtitle}>
                Once launched, customers can join this program immediately. You can pause it anytime from the Promotions page.
              </div>
            </div>

            <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.amber, marginBottom: 16, lineHeight: 1.5 }}>
              <strong>Important:</strong> The reward value and visit requirement are locked once customers join — they're a commitment to your customers.
            </div>

            <button style={s.primaryBtn} onClick={handleLaunch} disabled={launching}>
              {launching ? "Launching..." : "Launch Program"}
            </button>
            <button style={s.secondaryBtn} onClick={() => setStep("checklist")}>
              ← Back
            </button>
            <div style={s.cancelBtn} onClick={onCancel}>Cancel</div>
          </>
        )}
      </div>
    </div>
  );
}
