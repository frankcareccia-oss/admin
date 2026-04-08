/**
 * MerchantGrowthAdvisor.jsx
 *
 * Growth Advisor panel — shows summary, insights, and recommendations.
 * Route: /merchant/growth-advisor
 */

import React from "react";
import { color } from "../theme";
import { getGrowthAdvisor } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

const s = {
  card: {
    border: `1px solid ${color.border}`,
    borderRadius: 16,
    padding: "20px 24px",
    background: color.cardBg,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: color.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 12,
  },
  summary: {
    fontSize: 15,
    lineHeight: 1.6,
    color: color.text,
  },
  insight: {
    fontSize: 14,
    color: color.text,
    padding: "10px 14px",
    borderLeft: `3px solid ${color.primary}`,
    background: color.primarySubtle,
    borderRadius: "0 8px 8px 0",
    marginBottom: 8,
  },
  recommendation: {
    border: `1px solid ${color.border}`,
    borderRadius: 12,
    padding: "16px 20px",
    background: color.cardBg,
    marginBottom: 12,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: color.text,
    marginBottom: 4,
  },
  recDesc: {
    fontSize: 14,
    color: color.text,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  recReason: {
    fontSize: 13,
    color: color.textMuted,
    fontStyle: "italic",
  },
  recBadge: (type) => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
    marginBottom: 8,
    background:
      type === "loyalty" ? color.primarySubtle :
      type === "bundle" ? color.rewardSubtle :
      type === "time_based_promo" ? "rgba(59,130,246,0.10)" :
      type === "visit_incentive" ? "rgba(16,185,129,0.10)" :
      "rgba(0,0,0,0.06)",
    color:
      type === "loyalty" ? color.primary :
      type === "bundle" ? color.reward :
      type === "time_based_promo" ? "#2563eb" :
      type === "visit_incentive" ? "#059669" :
      color.textMuted,
  }),
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 8,
  },
  metricBox: {
    textAlign: "center",
    padding: "12px 8px",
    borderRadius: 10,
    background: color.primarySubtle,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 800,
    color: color.primary,
  },
  metricLabel: {
    fontSize: 11,
    color: color.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
  },
  empty: {
    padding: 24,
    textAlign: "center",
    color: color.textMuted,
    fontSize: 14,
  },
};

function formatCents(cents) {
  if (cents == null) return "--";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPct(val) {
  if (val == null) return "--";
  return `${Math.round(val * 100)}%`;
}

function typeLabel(type) {
  switch (type) {
    case "loyalty": return "Loyalty";
    case "bundle": return "Bundle";
    case "time_based_promo": return "Time Promo";
    case "visit_incentive": return "Visit Incentive";
    case "high_frequency_reward": return "Top Sellers";
    default: return type;
  }
}

export default function MerchantGrowthAdvisor() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    getGrowthAdvisor()
      .then(setData)
      .catch((e) => setError(e?.message || "Failed to load Growth Advisor"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.textMuted }}>Loading Growth Advisor...</div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.danger }}>{error}</div>
      </PageContainer>
    );
  }

  const m = data?.metrics || {};

  return (
    <PageContainer>
      <PageHeader
        title="Growth Advisor"
        subtitle="Data-driven insights and recommendations for your business."
      />

      {/* Summary */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Summary</div>
        <div style={s.summary}>{data?.summary || "No data available yet."}</div>
      </div>

      {/* Key Metrics */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Key Metrics</div>
        <div style={s.metricsGrid}>
          <div style={s.metricBox}>
            <div style={s.metricValue}>{m.totalOrders ?? "--"}</div>
            <div style={s.metricLabel}>Orders</div>
          </div>
          <div style={s.metricBox}>
            <div style={s.metricValue}>{formatCents(m.aov)}</div>
            <div style={s.metricLabel}>Avg Ticket</div>
          </div>
          <div style={s.metricBox}>
            <div style={s.metricValue}>{formatPct(m.repeatRate)}</div>
            <div style={s.metricLabel}>Repeat Rate</div>
          </div>
          <div style={s.metricBox}>
            <div style={s.metricValue}>{formatPct(m.firstToSecondVisitRate)}</div>
            <div style={s.metricLabel}>Return Rate</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: color.textFaint, textAlign: "right" }}>
          {m.period?.days || 30}-day window
        </div>
      </div>

      {/* Insights */}
      {data?.insights?.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Insights</div>
          {data.insights.map((insight, i) => (
            <div key={i} style={s.insight}>{insight}</div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {data?.recommendations?.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>Recommendations</div>
          {data.recommendations.map((rec, i) => (
            <div key={i} style={s.recommendation}>
              <div style={s.recBadge(rec.type)}>{typeLabel(rec.type)}</div>
              <div style={s.recTitle}>{rec.title}</div>
              <div style={s.recDesc}>{rec.description}</div>
              <div style={s.recReason}>{rec.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* No recommendations */}
      {(!data?.recommendations || data.recommendations.length === 0) && !data?.insights?.length && (
        <div style={s.card}>
          <div style={s.empty}>
            Not enough data yet. Growth Advisor will generate insights as transaction history builds up.
          </div>
        </div>
      )}
    </PageContainer>
  );
}
