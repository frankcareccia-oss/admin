/**
 * PromotionMonitor.jsx — Live promotion health monitoring
 *
 * Shows: enrollment pace, redemption rate, budget consumption, alerts.
 * Data from PromotionDailySummary tables.
 */

import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  container: { background: "#fff", borderRadius: 12, padding: "20px", border: `1px solid ${C.border}`, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 4 },
  subtitle: { fontSize: 12, color: C.muted, marginBottom: 16 },

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 },
  kpi: { textAlign: "center" },
  kpiValue: { fontSize: 22, fontWeight: 700, color: C.navy },
  kpiLabel: { fontSize: 11, color: C.muted, marginTop: 2 },

  alert: (type) => ({
    padding: "10px 14px", borderRadius: 8, marginBottom: 8, fontSize: 13, lineHeight: 1.5,
    background: type === "warning" ? "#FFF8E1" : type === "danger" ? "#FFEBEE" : "#F0FDF4",
    border: `1px solid ${type === "warning" ? "#FFE082" : type === "danger" ? "#EF9A9A" : "#A5D6A7"}`,
    color: type === "warning" ? C.amber : type === "danger" ? C.red : C.green,
  }),

  statusBadge: (status) => ({
    display: "inline-block", fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px",
    background: status === "active" ? "#E8F5E9" : status === "draft" ? "#F5F5F5" : "#FFEBEE",
    color: status === "active" ? C.green : status === "draft" ? C.muted : C.red,
  }),
};

export default function PromotionMonitor({ promotionId, promotionName, promotionStatus }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!promotionId) return;
    merchantGetPromotionDetail(promotionId, { period: "30d" })
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [promotionId]);

  if (loading) return <div style={{ ...s.container, textAlign: "center", color: C.muted }}>Loading...</div>;
  if (!data) return null;

  const { promotion, summary, timeSeries } = data;
  const ts = timeSeries || [];

  // Generate alerts
  const alerts = [];

  if (summary.totalEnrolled === 0 && promotionStatus === "active") {
    alerts.push({ type: "warning", text: "No enrollments yet. Make sure your team is telling customers about the program." });
  }

  if (summary.rewardsRedeemed > 0 && summary.totalEnrolled > 0) {
    const redemptionRate = summary.rewardsRedeemed / summary.totalEnrolled;
    if (redemptionRate > 0.5) {
      alerts.push({ type: "success", text: `Strong redemption rate (${Math.round(redemptionRate * 100)}%). Your program is engaging customers well.` });
    }
  }

  if (summary.rewardsExpired > summary.rewardsRedeemed && summary.rewardsExpired > 0) {
    alerts.push({ type: "warning", text: `More rewards are expiring (${summary.rewardsExpired}) than being redeemed (${summary.rewardsRedeemed}). Consider extending the expiry window or promoting the program more.` });
  }

  return (
    <div style={s.container}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={s.title}>{promotionName || promotion?.name}</div>
          <div style={s.subtitle}>Last 30 days</div>
        </div>
        <span style={s.statusBadge(promotionStatus || promotion?.status)}>
          {promotionStatus || promotion?.status}
        </span>
      </div>

      {/* KPIs */}
      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiValue}>{summary.totalEnrolled}</div>
          <div style={s.kpiLabel}>Enrolled</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiValue}>{summary.rewardsRedeemed}</div>
          <div style={s.kpiLabel}>Redeemed</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiValue}>${((summary.redemptionValueCents || 0) / 100).toFixed(0)}</div>
          <div style={s.kpiLabel}>Value</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiValue}>{summary.rewardsExpired}</div>
          <div style={s.kpiLabel}>Expired</div>
        </div>
      </div>

      {/* Chart */}
      {ts.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={ts}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Area type="monotone" dataKey="newEnrollments" stroke={C.teal} fill={C.teal} fillOpacity={0.2} name="Enrollments" />
            <Area type="monotone" dataKey="rewardsRedeemed" stroke="#FF6F00" fill="#FF6F00" fillOpacity={0.2} name="Redeemed" />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {alerts.map((alert, i) => (
            <div key={i} style={s.alert(alert.type)}>{alert.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}
