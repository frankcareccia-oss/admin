/**
 * PromotionSimulator.jsx — Objective-driven promotion simulator
 *
 * Speaks the merchant's language: charts, metrics, and cards all
 * adapt to the goal the merchant selected in Growth Studio.
 *
 * Features:
 * - Objective banner with goal + primary metric
 * - Two-line revenue/cost chart with net contribution shading
 * - Data sufficiency banner (honest about data quality)
 * - Three summary cards (objective metric, net revenue, cost)
 * - Validation mode with divergence alerts (14+ days)
 * - Bar chart for traffic/slow-period objective
 * - Rolling 7-day average smoothing
 */

import React from "react";
import {
  ComposedChart, Line, Area, ReferenceLine, Bar, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { color } from "../theme";
import { merchantSetAvgTransactionValue } from "../api/client";

// ── Projection engine (client-side, mirrors backend) ────────────

const INDUSTRY_DEFAULTS = {
  coffee_shop: { avgTransactionValueCents: 650, avgDailyVisitors: 120, avgVisitsPerMonth: 2.8 },
  restaurant: { avgTransactionValueCents: 2200, avgDailyVisitors: 80, avgVisitsPerMonth: 1.5 },
  fitness: { avgTransactionValueCents: 1500, avgDailyVisitors: 50, avgVisitsPerMonth: 8.0 },
  salon_spa: { avgTransactionValueCents: 6500, avgDailyVisitors: 15, avgVisitsPerMonth: 1.2 },
  retail: { avgTransactionValueCents: 3500, avgDailyVisitors: 60, avgVisitsPerMonth: 1.8 },
};

function getDefaults(merchantType) {
  return INDUSTRY_DEFAULTS[merchantType] || { avgTransactionValueCents: 1500, avgDailyVisitors: 60, avgVisitsPerMonth: 2.0 };
}

function resolveBaseline(b, merchantType) {
  const ind = getDefaults(merchantType);
  return {
    avgDailyVisitors: b.avgDailyVisitors || ind.avgDailyVisitors,
    attributionRate: b.attributionRate || 0.15,
    avgVisitsPerConsumerPerMonth: b.avgVisitsPerConsumerPerMonth || ind.avgVisitsPerMonth,
    currentEnrolled: b.currentEnrolled || 0,
    enrollmentConversionRate: b.enrollmentConversionRate || 0.15,
    avgTransactionValueCents: b.avgTransactionValueCents || ind.avgTransactionValueCents,
    dataAgeDays: b.dataAgeDays || 0,
  };
}

function rollingAvg(points, window = 7) {
  return points.map((pt, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = points.slice(start, i + 1);
    const result = { date: pt.date };
    for (const k of Object.keys(pt)) {
      if (k === "date") continue;
      if (typeof pt[k] === "number") {
        result[k] = Math.round(slice.reduce((s, p) => s + (p[k] || 0), 0) / slice.length * 100) / 100;
      } else {
        result[k] = pt[k];
      }
    }
    return result;
  });
}

function makeCurve(monthlyRev, monthlyCost, days = 90) {
  const pts = [];
  const today = new Date();
  for (let i = 0; i <= days; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const ramp = Math.min(1, i / 30);
    pts.push({
      date: d.toISOString().slice(0, 10),
      revenue: Math.round((monthlyRev / 30) * ramp),
      cost: Math.round((monthlyCost / 30) * ramp),
      net: Math.round(((monthlyRev - monthlyCost) / 30) * ramp),
    });
  }
  return rollingAvg(pts);
}

function projectObjective(objective, rawBaseline, params, merchantType) {
  const b = resolveBaseline(rawBaseline, merchantType);

  switch (objective) {
    case "bring-back": {
      const lift = params.promotionType === "tiered" ? 1.40 : 1.25;
      const projected = b.avgVisitsPerConsumerPerMonth * lift;
      const incVisits = (projected - b.avgVisitsPerConsumerPerMonth) * Math.max(1, b.currentEnrolled);
      const rev = Math.round(incVisits * b.avgTransactionValueCents);
      const cost = Math.round(Math.max(1, b.currentEnrolled) * (projected / Math.max(1, params.stampThreshold)) * params.rewardValueCents);
      return {
        chartType: "line", currentValue: b.avgVisitsPerConsumerPerMonth.toFixed(1) + "x",
        projectedValue: projected.toFixed(1) + "x",
        changeDescription: `+${Math.round((lift - 1) * 100)}% more visits per member`,
        metricLabel: "Visit frequency lift",
        rev, cost, net: rev - cost, curve: makeCurve(rev, cost),
      };
    }
    case "grow-base": {
      const conv = b.enrollmentConversionRate || 0.15;
      const monthly = Math.round(b.avgDailyVisitors * 30 * b.attributionRate * conv);
      const at90 = b.currentEnrolled + monthly * 3;
      const incRevPer = b.avgVisitsPerConsumerPerMonth * b.avgTransactionValueCents * 0.35;
      const rev = Math.round(monthly * incRevPer);
      const cost = Math.round(Math.max(1, b.currentEnrolled) * (b.avgVisitsPerConsumerPerMonth / Math.max(1, params.stampThreshold)) * params.rewardValueCents);
      return {
        chartType: "line", currentValue: b.currentEnrolled.toLocaleString(),
        projectedValue: at90.toLocaleString(),
        changeDescription: `+${monthly} new members/month`,
        metricLabel: "Members in 90 days",
        rev, cost, net: rev - cost, curve: makeCurve(rev, cost),
      };
    }
    case "drive-revenue": {
      const projAOV = Math.round(b.avgTransactionValueCents * 1.25);
      const liftCents = projAOV - b.avgTransactionValueCents;
      const txns = Math.round(b.avgDailyVisitors * 30 * b.attributionRate);
      const rev = Math.round(liftCents * txns);
      const cost = Math.round(txns * 0.15 * params.rewardValueCents);
      return {
        chartType: "line",
        currentValue: `$${(b.avgTransactionValueCents / 100).toFixed(2)}`,
        projectedValue: `$${(projAOV / 100).toFixed(2)}`,
        changeDescription: `+$${(liftCents / 100).toFixed(2)} per transaction`,
        metricLabel: "Transaction value lift",
        rev, cost, net: rev - cost, curve: makeCurve(rev, cost),
      };
    }
    case "fill-slow": {
      const fraction = 0.15;
      const curTxns = Math.round(b.avgDailyVisitors * 30 * fraction);
      const projTxns = Math.round(curTxns * 1.35);
      const inc = projTxns - curTxns;
      const rev = Math.round(inc * b.avgTransactionValueCents);
      const cost = Math.round(projTxns * b.attributionRate * (params.rewardValueCents / Math.max(1, params.stampThreshold)));
      // bar data
      const barData = [];
      for (let h = 6; h <= 18; h++) {
        const label = h <= 11 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
        const norm = Math.exp(-0.5 * Math.pow((h - 9) / 3, 2));
        const cur = Math.round(b.avgDailyVisitors * norm * 0.12);
        const isTarget = h >= 14 && h <= 17;
        barData.push({ hour: label, current: cur, projected: isTarget ? Math.round(cur * 1.35) : cur, isTarget });
      }
      return {
        chartType: "bar",
        currentValue: `${curTxns}`, projectedValue: `${projTxns}`,
        changeDescription: `+${inc} during slow periods`,
        metricLabel: "Slow-period traffic lift",
        rev, cost, net: rev - cost, curve: makeCurve(rev, cost), barData,
      };
    }
    case "reward-best": {
      const curRate = 0.34, projRate = 0.52;
      const firstTimers = Math.round(b.avgDailyVisitors * 30 * 0.20);
      const inc = Math.round(firstTimers * (projRate - curRate));
      const rev = Math.round(inc * b.avgVisitsPerConsumerPerMonth * b.avgTransactionValueCents);
      const cost = Math.round(Math.round(firstTimers * projRate) * (params.rewardValueCents / Math.max(1, params.stampThreshold)) * 0.6);
      return {
        chartType: "line",
        currentValue: `${Math.round(curRate * 100)}%`,
        projectedValue: `${Math.round(projRate * 100)}%`,
        changeDescription: `+${inc} customers return after first visit/month`,
        metricLabel: "90-day retention lift",
        rev, cost, net: rev - cost, curve: makeCurve(rev, cost),
      };
    }
    default:
      return projectObjective("bring-back", rawBaseline, params, merchantType);
  }
}

// ── Data sufficiency ────────────────────────────────────────────

function getSufficiency(dataAgeDays, merchantType) {
  const cat = merchantType || "business";
  if (dataAgeDays === 0) return {
    level: "none", dots: 0, label: "No transaction data yet",
    detail: `These projections use industry averages for a ${cat}. Once your POS data starts flowing, we'll replace them with your actual numbers -- typically within 2-3 weeks.`,
  };
  if (dataAgeDays < 7) return {
    level: "minimal", dots: 1, label: "Collecting data",
    detail: `We're still learning your store's patterns. Projections will become directional in ~${7 - dataAgeDays} days.`,
  };
  if (dataAgeDays < 14) return {
    level: "low", dots: 2, label: "Early projections",
    detail: `Based on ${dataAgeDays} days of data. Expect better accuracy in ~${14 - dataAgeDays} days.`,
  };
  if (dataAgeDays < 60) return {
    level: "medium", dots: 3, label: "Moderate confidence",
    detail: `Based on ${dataAgeDays} days of real transaction data.`,
  };
  return {
    level: "high", dots: 5, label: "High confidence",
    detail: `Based on ${Math.round(dataAgeDays / 30)} months of solid data.`,
  };
}

// ── Objective labels ────────────────────────────────────────────

const OBJ_META = {
  "bring-back": { label: "Bring customers back more often", metric: "Avg visits/member/month" },
  "grow-base": { label: "Grow my loyal customer base", metric: "Total enrolled members" },
  "drive-revenue": { label: "Drive more revenue per visit", metric: "Avg transaction value" },
  "fill-slow": { label: "Fill my slow periods", metric: "Transactions during target window" },
  "reward-best": { label: "Reward my best customers", metric: "90-day retention rate" },
};

// ── Styles ──────────────────────────────────────────────────────

const C = {
  teal: "#1D9E75", tealBg: "#E1F5EE", tealDark: "#085041",
  amber: "#EF9F27", amberDark: "#854F0B",
  red: "#E24B4A", redBg: "#FEF2F2",
  gray: "#888780", grayLight: "#D3D1C7",
  bg: "#F4F4F0", white: "#fff",
  navy: color.navy || "#0B2A33",
};

const s = {
  container: { background: C.white, border: `1px solid ${color.border}`, borderRadius: 12, padding: 20 },
  objectiveBanner: {
    background: C.tealBg, borderLeft: `3px solid ${C.teal}`, borderRadius: "0 8px 8px 0",
    padding: "8px 14px", marginBottom: 16, fontSize: 13, color: C.tealDark, fontWeight: 500,
  },
  sufficiencyBanner: (level) => ({
    background: level === "none" || level === "minimal" ? "#FFF8E1" : level === "low" ? "#FFF3E0" : C.tealBg,
    border: `1px solid ${level === "none" || level === "minimal" ? "#FFE082" : level === "low" ? "#FFCC80" : "#B2DFDB"}`,
    borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#5F5E5A", lineHeight: 1.5,
  }),
  sufficiencyDots: { display: "inline-flex", gap: 3, marginRight: 8, verticalAlign: "middle" },
  dot: (filled) => ({
    width: 8, height: 8, borderRadius: "50%",
    background: filled ? C.teal : "#E0E0E0", display: "inline-block",
  }),
  splitRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 },
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: color.muted, letterSpacing: "0.5px" },
  fieldRow: { display: "flex", alignItems: "center", gap: 10 },
  label: { fontSize: 13, fontWeight: 500, color: C.navy, minWidth: 140 },
  slider: { flex: 1, maxWidth: 200 },
  input: { width: 80, padding: "4px 8px", borderRadius: 4, border: `1px solid ${color.border}`, fontSize: 13, textAlign: "right" },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 16 },
  card: (borderColor) => ({
    background: C.white, border: `1px solid ${color.border}`, borderRadius: 8, padding: "12px 16px",
    borderLeft: `3px solid ${borderColor}`,
  }),
  cardValue: (textColor) => ({ fontSize: 28, fontWeight: 500, color: textColor }),
  cardLabel: { fontSize: 11, color: C.gray, marginBottom: 4 },
  cardDetail: { fontSize: 11, color: "#5F5E5A", marginTop: 4 },
  aovPrompt: {
    background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: "12px 16px",
    marginBottom: 16, display: "flex", alignItems: "center", gap: 12,
  },
  aovInput: {
    width: 90, padding: "6px 10px", borderRadius: 6, border: "1px solid #FFE082",
    fontSize: 14, fontWeight: 600, textAlign: "right",
  },
  aovBtn: {
    padding: "6px 14px", borderRadius: 6, border: "none", background: C.teal,
    color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  divergenceAlert: (direction) => ({
    background: direction === "over" ? C.tealBg : C.redBg,
    border: `1px solid ${direction === "over" ? "#B2DFDB" : "#FECACA"}`,
    borderRadius: 8, padding: "12px 16px", marginTop: 12, fontSize: 12, lineHeight: 1.6,
  }),
};

// ── Component ───────────────────────────────────────────────────

export default function PromotionSimulator({ simulatorData, mode = "existing", objective: propObjective }) {
  if (!simulatorData) return null;

  const { promotion, historical, baseline, lockedFields, merchantType, validation } = simulatorData;
  const isNew = mode === "new";

  const objective = propObjective || promotion?.objective || "bring-back";
  const meta = OBJ_META[objective] || OBJ_META["bring-back"];

  const defaults = promotion?.currentParams || { stampThreshold: 10, rewardValueCents: 500, expiryDays: 90 };

  const [params, setParams] = React.useState({
    stampThreshold: defaults.stampThreshold || 10,
    rewardValueCents: defaults.rewardValueCents || 500,
    expiryDays: defaults.expiryDays || 90,
    promotionType: promotion?.promotionType || "stamp",
  });

  const [aovInput, setAovInput] = React.useState("");
  const [aovSaved, setAovSaved] = React.useState(false);
  const [aovSaving, setAovSaving] = React.useState(false);

  const isLocked = (field) => (lockedFields || []).includes(field);
  const handleChange = (field, value) => {
    if (isLocked(field)) return;
    setParams(prev => ({ ...prev, [field]: value }));
  };

  // Resolve baseline with AOV
  const effectiveBaseline = { ...(baseline || {}), avgTransactionValueCents: baseline?.avgTransactionValueCents || 0 };
  const needsAov = !effectiveBaseline.avgTransactionValueCents;

  const handleSaveAov = async () => {
    const cents = Math.round(parseFloat(aovInput) * 100);
    if (!cents || cents < 100) return;
    setAovSaving(true);
    try {
      await merchantSetAvgTransactionValue(cents);
      effectiveBaseline.avgTransactionValueCents = cents;
      setAovSaved(true);
    } catch (e) { /* ignore */ }
    setAovSaving(false);
  };

  // Compute projection client-side for real-time slider response
  const proj = projectObjective(objective, effectiveBaseline, params, merchantType);
  const sufficiency = getSufficiency(effectiveBaseline.dataAgeDays || 0, merchantType);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Merge historical + projected for revenue/cost chart
  const chartData = [];
  if (historical && historical.length > 0) {
    for (const h of historical) {
      chartData.push({ date: h.date, actualCost: h.redemptionValueCents, revenue: null, cost: null });
    }
  }
  for (const pt of proj.curve) {
    chartData.push({ date: pt.date, actualCost: null, revenue: pt.revenue, cost: pt.cost, net: pt.net });
  }

  // Validation mode
  const validationMode = validation?.mode === "active" && validation.daysSinceLaunch >= 14;
  const divergence = validation?.divergence;

  return (
    <div style={s.container}>
      {/* Objective Banner */}
      <div style={s.objectiveBanner}>
        Goal: {meta.label} — measuring {meta.metric}
        {validationMode && divergence && (
          <span style={{ marginLeft: 12, fontWeight: 400, color: divergence.direction === "over" ? C.teal : C.red }}>
            {" "}| projected {proj.projectedValue} · actual so far {divergence.direction === "over" ? "ahead" : "behind"}
          </span>
        )}
      </div>

      {/* Data Sufficiency Banner */}
      <div style={s.sufficiencyBanner(sufficiency.level)}>
        <span style={s.sufficiencyDots}>
          {[1, 2, 3, 4, 5].map(i => <span key={i} style={s.dot(i <= sufficiency.dots)} />)}
        </span>
        <strong>{sufficiency.label}</strong>
        <span style={{ marginLeft: 6 }}>— {sufficiency.detail}</span>
      </div>

      {/* AOV Prompt (if needed) */}
      {needsAov && !aovSaved && (
        <div style={s.aovPrompt}>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>One quick question</strong> before we show your projection: What's the average amount a customer spends per visit?
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>e.g. $8.50 for a coffee and a snack</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>$</span>
            <input
              style={s.aovInput} value={aovInput} placeholder="8.50"
              onChange={e => setAovInput(e.target.value.replace(/[^0-9.]/g, ""))}
            />
            <button style={s.aovBtn} onClick={handleSaveAov} disabled={aovSaving}>
              {aovSaving ? "..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Sliders */}
      <div style={s.splitRow}>
        <div style={s.section}>
          <div style={s.sectionLabel}>{isNew ? "Parameters" : "Current Settings"}</div>
          <div style={s.fieldRow}>
            <span style={s.label}>
              Stamp threshold {isLocked("stampThreshold") && <span title="Locked for enrolled consumers" style={{ cursor: "help" }}>&#128274;</span>}
            </span>
            <input
              type="range" min="1" max="50" value={params.stampThreshold}
              onChange={e => handleChange("stampThreshold", parseInt(e.target.value))}
              disabled={isLocked("stampThreshold")} style={s.slider}
            />
            <input value={params.stampThreshold} readOnly style={s.input} />
          </div>
          <div style={s.fieldRow}>
            <span style={s.label}>
              Reward value {isLocked("rewardValue") && <span title="Locked — face value guaranteed" style={{ cursor: "help" }}>&#128274;</span>}
            </span>
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

      {/* Chart */}
      {proj.chartType === "bar" && proj.barData ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
            Daily Traffic by Hour — Slow Period Highlighted
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={proj.barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="current" fill={C.grayLight} name="Current" radius={[3, 3, 0, 0]} />
              <Bar dataKey="projected" fill={C.teal} name="Projected" radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 8 }}>
            Revenue vs. Cost — 90-Day Projection
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 100 ? `$${Math.round(v / 100)}` : v} />
              <Tooltip
                formatter={(val, name) => [
                  val >= 100 ? `$${(val / 100).toFixed(2)}` : val,
                  name,
                ]}
              />
              <Legend />
              <ReferenceLine
                x={todayStr} stroke={C.grayLight} strokeDasharray="4 2"
                label={{ value: "Today", position: "top", fontSize: 11, fill: C.gray }}
              />
              {/* Net contribution shading */}
              <Area
                type="monotone" dataKey="net" fill="rgba(29, 158, 117, 0.08)" stroke="none"
                name="Net contribution" connectNulls={false}
              />
              {/* Revenue line — teal */}
              <Line
                type="monotone" dataKey="revenue" stroke={C.teal} strokeWidth={2}
                strokeDasharray="6 4" dot={false} name="Revenue from loyalty" connectNulls={false}
              />
              {/* Cost line — amber */}
              <Line
                type="monotone" dataKey="cost" stroke={C.amber} strokeWidth={2}
                strokeDasharray="6 4" dot={false} name="Promotion cost" connectNulls={false}
              />
              {/* Historical actual cost */}
              {historical && historical.length > 0 && (
                <Line
                  type="monotone" dataKey="actualCost" stroke={C.gray} strokeWidth={2}
                  dot={false} name="Historical cost" connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Cards */}
      <div style={s.summaryRow}>
        {/* Card 1 — Objective Metric */}
        <div style={s.card(C.teal)}>
          <div style={s.cardLabel}>{proj.metricLabel}</div>
          <div style={s.cardValue(C.teal)}>
            {proj.currentValue} → {proj.projectedValue}
          </div>
          <div style={s.cardDetail}>{proj.changeDescription}</div>
        </div>

        {/* Card 2 — Net Revenue */}
        <div style={s.card(proj.net >= 0 ? C.teal : C.red)}>
          <div style={s.cardLabel}>Estimated net revenue contribution</div>
          <div style={s.cardValue(proj.net >= 0 ? C.teal : C.red)}>
            ${(proj.net / 100).toFixed(0)}/mo
          </div>
          <div style={s.cardDetail}>
            ${(proj.rev / 100).toFixed(0)} revenue - ${(proj.cost / 100).toFixed(0)} cost
          </div>
          {proj.net < 0 && (
            <div style={{ fontSize: 11, color: C.red, marginTop: 6, lineHeight: 1.4 }}>
              At these settings, promotion cost exceeds projected revenue lift.
              Consider adjusting the reward value or visit threshold.
            </div>
          )}
        </div>

        {/* Card 3 — Promotion Cost */}
        <div style={s.card(C.amber)}>
          <div style={s.cardLabel}>Estimated promotion cost</div>
          <div style={s.cardValue(C.amberDark)}>
            ${(proj.cost / 100).toFixed(0)}/mo
          </div>
          <div style={s.cardDetail}>
            Based on slider settings above
          </div>
        </div>
      </div>

      {/* Divergence Alert (validation mode) */}
      {validationMode && divergence && (
        <div style={s.divergenceAlert(divergence.direction)}>
          {divergence.direction === "under" ? (
            <>
              <strong>Performance below projection</strong> ({divergence.divergencePct}% from target)
              <br /><br />
              Possible reasons:
              <br />— Your team may not be consistently capturing customer information (check attribution rate)
              <br />— The promotion may need more visibility — consider counter signage or staff mentions at checkout
            </>
          ) : (
            <>
              <strong>Great news</strong> — performance is exceeding projections (+{divergence.divergencePct}% above target).
              <br />You may want to review your budget cap to ensure it covers the increased activity.
            </>
          )}
        </div>
      )}
    </div>
  );
}
