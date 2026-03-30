import React from "react";

const REPLACE_REASONS = [
  {
    value: "damaged_prints",
    label: "Printed copies are damaged, lost, or more copies are needed",
    action: "print",
  },
  {
    value: "signage_refresh",
    label: "Store signage or branding is being fully replaced",
    action: "replace",
  },
  {
    value: "security_reset",
    label: "Security reset — invalidate all existing printed QR copies",
    action: "replace",
  },
  {
    value: "other",
    label: "Other",
    action: "replace",
  },
];

const pill = (disabled = false) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "10px 20px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: disabled ? "rgba(0,0,0,0.03)" : "#FFFFFF",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 800,
  fontSize: 14,
  color: disabled ? "rgba(0,0,0,0.35)" : "#0B2A33",
  opacity: disabled ? 0.6 : 1,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  transition: "background 0.15s, border-color 0.15s",
});

const pillPrimary = (disabled = false) => ({
  ...pill(disabled),
  background: disabled ? "rgba(47,143,139,0.4)" : "#2F8F8B",
  border: "1px solid transparent",
  color: "#FFFFFF",
});

export default function ReplaceQrCard({
  replaceReason,
  setReplaceReason,
  onCancel,
  onContinue,
  regenerating = false,
}) {
  const selectedReasonMeta =
    REPLACE_REASONS.find((r) => r.value === replaceReason) || null;

  const shouldSteerToPrint = selectedReasonMeta?.action === "print";
  const shouldAllowReplace = selectedReasonMeta?.action === "replace";

  return (
    <div
      style={{
        marginBottom: 24,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "#FFFFFF",
        padding: 24,
        boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0B2A33" }}>
          Replace active store QR?
        </h2>
        <p style={{ marginTop: 10, maxWidth: 680, fontSize: 13, lineHeight: 1.6, color: "rgba(11,42,51,0.70)" }}>
          Replacing the active QR will invalidate all currently printed copies
          for this store. Use <strong>Print</strong> if you only need another
          copy of the current QR.
        </p>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.10)",
          background: "#FEFCF7",
          padding: 16,
          marginBottom: 16,
        }}
      >
        <label
          htmlFor="replaceReason"
          style={{ display: "block", fontSize: 12, fontWeight: 800, color: "rgba(11,42,51,0.65)", marginBottom: 8 }}
        >
          Why are you replacing this store QR?
        </label>

        <select
          id="replaceReason"
          value={replaceReason}
          onChange={(e) => setReplaceReason(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 520,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#FFFFFF",
            outline: "none",
            boxSizing: "border-box",
            fontSize: 14,
            color: "#0B2A33",
            cursor: "pointer",
          }}
        >
          <option value="">Select a reason…</option>
          {REPLACE_REASONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>

        {shouldSteerToPrint ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(47,143,139,0.06)",
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#0B2A33" }}>
              This reason usually does <strong>not</strong> require a new QR.
              Close this card and use Print to create another copy of the
              current active store QR.
            </p>
          </div>
        ) : null}

        {shouldAllowReplace ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: 10,
              border: "1px solid rgba(200,0,0,0.15)",
              background: "rgba(255,0,0,0.04)",
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(140,0,0,0.85)" }}>
              Replacing this QR will create a new active code and invalidate all
              previously printed QR copies. Continue only if you are prepared to
              replace all existing printed QR signage at this location.
            </p>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={onCancel} style={pill(false)}>
          Cancel
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={!replaceReason || regenerating}
          style={pillPrimary(!replaceReason || regenerating)}
        >
          {regenerating
            ? "Working…"
            : shouldAllowReplace
              ? "Generate New QR"
              : "Continue"}
        </button>
      </div>
    </div>
  );
}
