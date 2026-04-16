/**
 * PromotionSimulator.jsx — Context-aware what-if tool
 *
 * Shows historical performance (solid line) + projected outcomes (dashed line).
 * Sliders update projection in real time — all math client-side.
 *
 * Two modes:
 * - Existing promotion: historical + projection, some fields locked
 * - New promotion: projection only, nothing locked
 */

import React from "react";
import {
  ComposedChart, Line, Area, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { color } from "../theme";

const C = {
  teal: "#00796B",
  tealLight: "#B2DFDB",
  orange: "#FF6F00",
  orangeLight: "#FFE0B2",
  green: "#2E7D32",
  amber: "#FFB300",
  red: "#C62828",
  navy: color.navy || "#0B2A33",
  gray: "#9E9E9E",
};

const s = {
  container: { background: "#fff", border: `1px solid ${color.border}`, borderRadius: 12, padding: "20px" },
  title: { fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 13, color: color.muted, marginBottom: 16 },
  splitRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 },
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: color.muted, letterSpacing: "0.5px" },
  fieldRow: { display: "flex", alignItems: "center", gap: 10 },
  label: { fontSize: 13, fontWeight: 500, color: C.navy, minWidth: 140 },
  lockIcon: { fontSize: 14, cursor: "help", title: "Locked for enrolled consumers" },
  slider: { flex: 1, maxWidth: 200 },
  input: { width: 80, padding: "4px 8px", borderRadius: 4, border: `1px solid ${color.border}`, fontSize: 13, textAlign: "right" },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 },
  summaryCard: (cardColor) => ({
    background: "#fff", border: `1px solid ${color.border}`, borderRadius: 8, padding: "12px 14px",
    borderLeft: `4px solid ${cardColor}`,
  }),
  summaryValue: { fontSize: 20, fontWeight: 700, color: C.navy },
  summaryLabel: { fontSize: 11, color: color.muted, marginTop: 2 },
  summaryDetail: { fontSize: 11, color: color.muted, marginTop: 4, lineHeight: 1.4 },
  confidence: (level) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
    borderRadius: 12, fontSize: 12, fontWeight: 600,
    background: level === "high" ? "#E8F5E9" : level === "medium" ? "#FFF8E1" : "#FFF3E0",
    color: level === "high" ? C.green : level === "medium" ? C.amber : C.orange,
  }),
};

function getConfidence(dataAgeDays) {
  if (dataAgeDays < 14) return { level: "low", label: "Low confidence", detail: "Less than 2 weeks of data" };
  if (dataAgeDays < 60) return { level: "medium", label: "Moderate confidence", detail: `Based on ${dataAgeDays} days` };
  return { level: "high", label: "High confidence", detail: `Based on ${dataAgeDays} days of solid data` };
}

function projectStamp(baseline, params) {
  const { stampThreshold, rewardValueCents, expiryDays } = params;

  const monthlyEnrollments = Math.round(
    baseline.avgDailyVisitors * 30 * baseline.attributionRate * baseline.enrollmentConversionRate
  );

  const daysToMilestone = baseline.avgVisitsPerConsumerPerMonth > 0
    ? Math.round(stampThreshold / (baseline.avgVisitsPerConsumerPerMonth / 30))
    : stampThreshold * 7;

  const monthlyRedemptions = baseline.currentEnrolled > 0 && stampThreshold > 0
    ? Math.round(baseline.currentEnrolled * (baseline.avgVisitsPerConsumerPerMonth / stampThreshold))
    : Math.max(1, monthlyEnrollments);

  const monthlyCostCents = monthlyRedemptions * rewardValueCents;

  // Generate 90-day projection curve
  const points = [];
  const today = new Date();
  for (let i = 0; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ramp = Math.min(1, i / 30);
    points.push({
      date: d.toISOString().slice(0, 10),
      projected: Math.round((monthlyRedemptions / 30) * ramp),
    });
  }

  return { monthlyEnrollments, daysToMilestone, monthlyRedemptions, monthlyCostCents, points };
}

export default function PromotionSimulator({ simulatorData, mode = "existing" }) {
  if (!simulatorData) return null;

  const { promotion, historical, baseline, lockedFields } = simulatorData;
  const isNew = mode === "new";

  const defaults = promotion?.currentParams || {
    stampThreshold: 10,
    rewardValueCents: 500,
    expiryDays: 90,
  };

  const [params, setParams] = React.useState({
    stampThreshold: defaults.stampThreshold || 10,
    rewardValueCents: defaults.rewardValueCents || 500,
    expiryDays: defaults.expiryDays || 90,
  });

  const isLocked = (field) => (lockedFields || []).includes(field);

  const handleChange = (field, value) => {
    if (isLocked(field)) return;
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const projection = projectStamp(baseline || { avgDailyVisitors: 0, attributionRate: 0, avgVisitsPerConsumerPerMonth: 0, currentEnrolled: 0, enrollmentConversionRate: 0 }, params);
  const confidence = getConfidence(baseline?.dataAgeDays || 0);

  // Merge historical + projected for chart
  const chartData = [];
  if (historical && historical.length > 0) {
    for (const h of historical) {
      chartData.push({ date: h.date, actual: h.rewardsRedeemed, projected: null });
    }
  }
  for (const p of projection.points) {
    chartData.push({ date: p.date, actual: null, projected: p.projected });
  }

  // Today marker
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={s.container}>
      <div style={s.title}>Promotion Simulator</div>
      <div style={s.subtitle}>Adjust parameters to see projected impact</div>

      {/* Confidence indicator */}
      <div style={{ marginBottom: 16 }}>
        <span style={s.confidence(confidence.level)}>
          {"●".repeat(confidence.level === "high" ? 5 : confidence.level === "medium" ? 3 : 1)}
          {"○".repeat(confidence.level === "high" ? 0 : confidence.level === "medium" ? 2 : 4)}
          {" "}{confidence.label}
        </span>
        <span style={{ fontSize: 11, color: color.muted, marginLeft: 8 }}>{confidence.detail}</span>
      </div>

      {/* Sliders */}
      <div style={s.splitRow}>
        <div style={s.section}>
          <div style={s.sectionLabel}>{isNew ? "Parameters" : "Current Settings"}</div>

          <div style={s.fieldRow}>
            <span style={s.label}>Stamp threshold {isLocked("stampThreshold") && <span style={s.lockIcon} title="Locked — cannot change for enrolled consumers">🔒</span>}</span>
            <input
              type="range" min="1" max="50" value={params.stampThreshold}
              onChange={e => handleChange("stampThreshold", parseInt(e.target.value))}
              disabled={isLocked("stampThreshold")} style={s.slider}
            />
            <input value={params.stampThreshold} readOnly style={s.input} />
          </div>

          <div style={s.fieldRow}>
            <span style={s.label}>Reward value {isLocked("rewardValue") && <span style={s.lockIcon} title="Locked — face value guaranteed at enrollment">🔒</span>}</span>
            <input
              type="range" min="100" max="5000" step="50" value={params.rewardValueCents}
              onChange={e => handleChange("rewardValueCents", parseInt(e.target.value))}
              disabled={isLocked("rewardValue")} style={s.slider}
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>${(params.rewardValueCents / 100).toFixed(2)}</span>
          </div>
        </div>

        <div style={s.section}>
          <div style={s.sectionLabel}>Adjustable</div>

          <div style={s.fieldRow}>
            <span style={s.label}>Expiry window</span>
            <input
              type="range" min="30" max="365" value={params.expiryDays}
              onChange={e => handleChange("expiryDays", parseInt(e.target.value))}
              style={s.slider}
            />
            <span style={{ fontSize: 13 }}>{params.expiryDays} days</span>
          </div>
        </div>
      </div>

      {/* Projection Chart */}
      {chartData.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <ReferenceLine x={todayStr} stroke={C.gray} strokeDasharray="3 3" label={{ value: "Today", fontSize: 10, fill: C.gray }} />
              <Line type="monotone" dataKey="actual" stroke={C.teal} strokeWidth={2} dot={false} name="Historical" connectNulls={false} />
              <Line type="monotone" dataKey="projected" stroke={C.orange} strokeWidth={2} strokeDasharray="6 3" dot={false} name="Projected" connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projection Summary Cards */}
      <div style={s.summaryRow}>
        <div style={s.summaryCard(C.teal)}>
          <div style={s.summaryValue}>${(projection.monthlyCostCents / 100).toFixed(0)}/mo</div>
          <div style={s.summaryLabel}>Estimated Monthly Cost</div>
          <div style={s.summaryDetail}>Based on ~{projection.monthlyRedemptions} redemptions/month</div>
        </div>

        <div style={s.summaryCard(C.amber)}>
          <div style={s.summaryValue}>{projection.monthlyEnrollments}/mo</div>
          <div style={s.summaryLabel}>Estimated New Enrollments</div>
          <div style={s.summaryDetail}>Based on current traffic and attribution</div>
        </div>

        <div style={s.summaryCard(C.orange)}>
          <div style={s.summaryValue}>{projection.daysToMilestone} days</div>
          <div style={s.summaryLabel}>Days to First Redemption</div>
          <div style={s.summaryDetail}>Average time for a consumer to reach milestone</div>
        </div>
      </div>
    </div>
  );
}
