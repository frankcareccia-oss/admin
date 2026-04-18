/**
 * PromotionValidation.jsx — Projected vs actual comparison
 *
 * After 2+ weeks of data, compares simulator projections with actual outcomes.
 * Feeds back into future projections — each cycle gets tighter.
 */

import React from "react";
import { color } from "../theme";
import { merchantGetPromotionDetail } from "../api/client";

const C = {
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75",
  muted: "#999",
  border: "#E5E5E0",
  green: "#2E7D32",
  amber: "#F57F17",
  red: "#C62828",
};

const s = {
  container: { background: "#fff", borderRadius: 12, padding: "20px", border: `1px solid ${C.border}` },
  title: { fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 12, color: C.muted, marginBottom: 16 },

  metricRow: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  metric: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#F9FAFB", borderRadius: 8 },
  metricLabel: { fontSize: 13, fontWeight: 600, color: C.navy },
  metricValues: { display: "flex", gap: 16, alignItems: "center" },
  metricValue: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  metricTag: (type) => ({
    fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "2px 6px",
    background: type === "ahead" ? "#E8F5E9" : type === "behind" ? "#FFEBEE" : "#F5F5F5",
    color: type === "ahead" ? C.green : type === "behind" ? C.red : C.muted,
  }),

  insight: { fontSize: 13, color: C.navy, lineHeight: 1.6, padding: "12px 16px", background: "#F0FDF4", borderRadius: 8, border: `1px solid #BBF7D0`, marginBottom: 8 },

  notReady: { textAlign: "center", padding: 30, color: C.muted, fontSize: 14 },
};

function compareMetric(actual, projected) {
  if (!projected || projected === 0) return { pct: 0, tag: "on-track" };
  const pct = Math.round(((actual - projected) / projected) * 100);
  const tag = pct > 10 ? "ahead" : pct < -10 ? "behind" : "on-track";
  return { pct, tag };
}

export default function PromotionValidation({ promotionId }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!promotionId) return;
    merchantGetPromotionDetail(promotionId, { period: "30d" })
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [promotionId]);

  if (loading) return <div style={s.notReady}>Loading...</div>;
  if (!data?.timeSeries?.length || data.timeSeries.length < 14) {
    return (
      <div style={s.container}>
        <div style={s.title}>Performance vs Projection</div>
        <div style={s.notReady}>
          Need at least 2 weeks of data to compare projections with actual results.
          Check back after {14 - (data?.timeSeries?.length || 0)} more days.
        </div>
      </div>
    );
  }

  const { summary, timeSeries, promotion } = data;
  const days = timeSeries.length;

  // Simple projections based on early data (first week → extrapolate)
  const firstWeek = timeSeries.slice(0, 7);
  const avgDailyEnrollments = firstWeek.reduce((s, d) => s + d.newEnrollments, 0) / 7;
  const avgDailyRedemptions = firstWeek.reduce((s, d) => s + d.rewardsRedeemed, 0) / 7;

  const projectedEnrollments = Math.round(avgDailyEnrollments * days);
  const projectedRedemptions = Math.round(avgDailyRedemptions * days);

  const actualEnrollments = summary.totalEnrolled;
  const actualRedemptions = summary.rewardsRedeemed;

  const enrollComp = compareMetric(actualEnrollments, projectedEnrollments);
  const redeemComp = compareMetric(actualRedemptions, projectedRedemptions);

  const insights = [];
  if (enrollComp.tag === "ahead") {
    insights.push("Enrollment is ahead of pace — your program is resonating with customers.");
  }
  if (enrollComp.tag === "behind") {
    insights.push("Enrollment is below pace. Consider: Is your team asking every customer? Is the reward compelling enough?");
  }
  if (redeemComp.tag === "ahead") {
    insights.push("Redemption rate is strong — customers are engaged and using their rewards.");
  }
  if (redeemComp.tag === "behind" && actualRedemptions > 0) {
    insights.push("Redemptions are slower than expected. Customers may not know they have rewards — consider sending a reminder notification.");
  }

  return (
    <div style={s.container}>
      <div style={s.title}>Performance vs Projection</div>
      <div style={s.subtitle}>Based on {days} days of data · {promotion?.name}</div>

      <div style={s.metricRow}>
        <div style={s.metric}>
          <div style={s.metricLabel}>Enrollments</div>
          <div style={s.metricValues}>
            <div style={s.metricValue}>
              <div>{actualEnrollments}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>actual</div>
            </div>
            <div style={{ color: C.muted }}>vs</div>
            <div style={s.metricValue}>
              <div>{projectedEnrollments}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>projected</div>
            </div>
            <span style={s.metricTag(enrollComp.tag)}>
              {enrollComp.tag === "ahead" ? `+${enrollComp.pct}%` : enrollComp.tag === "behind" ? `${enrollComp.pct}%` : "On track"}
            </span>
          </div>
        </div>

        <div style={s.metric}>
          <div style={s.metricLabel}>Redemptions</div>
          <div style={s.metricValues}>
            <div style={s.metricValue}>
              <div>{actualRedemptions}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>actual</div>
            </div>
            <div style={{ color: C.muted }}>vs</div>
            <div style={s.metricValue}>
              <div>{projectedRedemptions}</div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>projected</div>
            </div>
            <span style={s.metricTag(redeemComp.tag)}>
              {redeemComp.tag === "ahead" ? `+${redeemComp.pct}%` : redeemComp.tag === "behind" ? `${redeemComp.pct}%` : "On track"}
            </span>
          </div>
        </div>

        <div style={s.metric}>
          <div style={s.metricLabel}>Budget consumed</div>
          <div style={s.metricValues}>
            <div style={s.metricValue}>
              ${((summary.redemptionValueCents || 0) / 100).toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.map((text, i) => (
        <div key={i} style={s.insight}>{text}</div>
      ))}
    </div>
  );
}
