/**
 * PromotionValidation.jsx — Projected vs actual comparison with AI insights
 *
 * After 14+ days of data, shows how the promotion is performing relative to
 * the simulator's projections. Includes AI-generated actionable advice.
 */

import React from "react";
import { color } from "../theme";
import { getPromotionValidation } from "../api/client";

const C = {
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75",
  muted: "#888780",
  border: "#E5E5E0",
  green: "#2E7D32",
  amber: "#F57F17",
  red: "#C62828",
  bg: "#F4F4F0",
};

const s = {
  container: { background: "#fff", borderRadius: 12, padding: "20px", border: `1px solid ${C.border}`, marginTop: 12 },
  title: { fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 12, color: C.muted, marginBottom: 16 },
  metricRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 },
  metricCard: (borderColor) => ({
    padding: "12px 14px", borderRadius: 8, background: C.bg,
    borderLeft: `3px solid ${borderColor}`,
  }),
  metricLabel: { fontSize: 11, color: C.muted, marginBottom: 4 },
  metricValues: { display: "flex", alignItems: "baseline", gap: 8 },
  metricActual: { fontSize: 20, fontWeight: 700, color: C.navy },
  metricProjected: { fontSize: 13, color: C.muted },
  tag: (type) => ({
    display: "inline-block", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 8px", marginLeft: 6,
    background: type === "over" ? "#E8F5E9" : type === "under" ? "#FFEBEE" : "#F5F5F5",
    color: type === "over" ? C.green : type === "under" ? C.red : C.muted,
  }),
  insightBox: (direction) => ({
    padding: "14px 16px", borderRadius: 8, fontSize: 13, lineHeight: 1.6, marginTop: 12,
    background: direction === "over" ? "#F0FDF4" : "#FFF5F5",
    border: `1px solid ${direction === "over" ? "#BBF7D0" : "#FECACA"}`,
    color: C.navy,
  }),
  notReady: { textAlign: "center", padding: 20, color: C.muted, fontSize: 13 },
};

export default function PromotionValidation({ promotionId, promotionName }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!promotionId) return;
    getPromotionValidation(promotionId)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [promotionId]);

  if (loading) return null; // Don't show loading state — just appear when ready
  if (!data) return null;

  if (!data.ready) {
    return (
      <div style={s.container}>
        <div style={s.title}>Performance Validation</div>
        <div style={s.notReady}>
          {data.daysNeeded > 0
            ? `${data.daysNeeded} more days of data needed to compare projections with actual results.`
            : "Computing validation data..."}
        </div>
      </div>
    );
  }

  const { outcome, divergence, insight } = data;
  const direction = divergence?.direction;

  return (
    <div style={s.container}>
      <div style={s.title}>
        Performance Validation
        {divergence && <span style={s.tag(direction)}>
          {direction === "over" ? `+${divergence.divergencePct}% ahead` : `${divergence.divergencePct}% behind`}
        </span>}
      </div>
      <div style={s.subtitle}>
        {promotionName} · {outcome.durationDays} days of data
        {outcome.objective && ` · Goal: ${outcome.objective.replace("-", " ")}`}
      </div>

      {/* Metrics grid */}
      <div style={s.metricRow}>
        {outcome.enrollmentActual != null && (
          <div style={s.metricCard(C.teal)}>
            <div style={s.metricLabel}>Enrollments</div>
            <div style={s.metricValues}>
              <div style={s.metricActual}>{outcome.enrollmentActual}</div>
              <div style={s.metricProjected}>/ {outcome.enrollmentProjected} projected</div>
            </div>
          </div>
        )}
        {outcome.costActualCents != null && (
          <div style={s.metricCard(C.amber)}>
            <div style={s.metricLabel}>Promotion Cost</div>
            <div style={s.metricValues}>
              <div style={s.metricActual}>${(outcome.costActualCents / 100).toFixed(0)}</div>
              <div style={s.metricProjected}>/ ${(outcome.costProjectedCents / 100).toFixed(0)} projected</div>
            </div>
          </div>
        )}
        {outcome.redemptionRate != null && (
          <div style={s.metricCard(C.green)}>
            <div style={s.metricLabel}>Redemption Rate</div>
            <div style={s.metricValues}>
              <div style={s.metricActual}>{Math.round(outcome.redemptionRate * 100)}%</div>
            </div>
          </div>
        )}
      </div>

      {/* Attribution rate */}
      {outcome.attributionRateAvg != null && (
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
          Attribution rate: <strong style={{ color: outcome.attributionRateAvg >= 0.6 ? C.green : C.amber }}>
            {Math.round(outcome.attributionRateAvg * 100)}%
          </strong>
          {outcome.attributionRateAvg < 0.6 && " — below 60% target"}
        </div>
      )}

      {/* AI Insight */}
      {insight && (
        <div style={s.insightBox(direction || "over")}>
          {insight}
        </div>
      )}
    </div>
  );
}
