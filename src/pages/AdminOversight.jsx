/**
 * AdminOversight.jsx — Platform oversight dashboard
 * Route: /admin/oversight
 * Access: pv_admin only
 *
 * Shows platform-wide KPIs, merchant health grid, and system alerts.
 */

import React from "react";
import { Link } from "react-router-dom";
import { color } from "../theme";
import { API_BASE, getAccessToken } from "../api/client";

async function fetchOversight(endpoint) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/admin/oversight/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to load ${endpoint}`);
  return res.json();
}

const C = {
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75",
  muted: "#888780",
  border: "#E5E5E0",
  green: "#2E7D32",
  amber: "#EF9F27",
  red: "#C62828",
  bg: "#F4F4F0",
};

const s = {
  page: { padding: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: C.navy },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 4 },
  refreshBtn: {
    padding: "6px 16px", borderRadius: 6, border: `1px solid ${C.border}`,
    background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.navy,
  },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 },
  kpiCard: { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" },
  kpiValue: { fontSize: 28, fontWeight: 700, color: C.navy },
  kpiLabel: { fontSize: 11, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.3px" },
  kpiTrend: (val) => ({
    fontSize: 11, fontWeight: 700,
    color: val > 0 ? C.green : val < 0 ? C.red : C.muted,
  }),
  countsRow: { display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap" },
  countBadge: { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", textAlign: "center" },
  countValue: { fontSize: 22, fontWeight: 700, color: C.navy },
  countLabel: { fontSize: 11, color: C.muted },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 10 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${C.border}`, color: C.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" },
  td: { padding: "10px 12px", borderBottom: `1px solid ${C.border}` },
  healthBar: (score) => ({
    width: 60, height: 6, borderRadius: 3, background: "#eee", display: "inline-block", verticalAlign: "middle", marginRight: 6,
    position: "relative", overflow: "hidden",
  }),
  healthFill: (score) => ({
    position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 3,
    width: `${score}%`,
    background: score >= 70 ? C.green : score >= 40 ? C.amber : C.red,
  }),
  alertCard: (severity) => ({
    padding: "10px 14px", borderRadius: 8, marginBottom: 6, fontSize: 13,
    background: severity === "error" ? "#FEF2F2" : "#FFFBEB",
    border: `1px solid ${severity === "error" ? "#FECACA" : "#FDE68A"}`,
    color: C.navy,
  }),
  alertBadge: (severity) => ({
    display: "inline-block", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "1px 6px", marginRight: 8,
    background: severity === "error" ? "#FEE2E2" : "#FEF3C7",
    color: severity === "error" ? C.red : "#92400E",
  }),
  cronDot: (ok) => ({
    display: "inline-block", width: 8, height: 8, borderRadius: "50%",
    background: ok ? C.green : C.red, marginRight: 6,
  }),
  loading: { textAlign: "center", padding: 40, color: C.muted },
};

export default function AdminOversight() {
  const [dashboard, setDashboard] = React.useState(null);
  const [merchants, setMerchants] = React.useState(null);
  const [alerts, setAlerts] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [d, m, a] = await Promise.all([
        fetchOversight("dashboard"),
        fetchOversight("merchants"),
        fetchOversight("alerts"),
      ]);
      setDashboard(d);
      setMerchants(m.merchants);
      setAlerts(a);
    } catch (e) {
      console.error("[AdminOversight]", e?.message);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (loading) return <div style={s.loading}>Loading platform overview...</div>;

  const kpis = dashboard?.kpis || {};
  const counts = dashboard?.counts || {};
  const cronHealth = dashboard?.cronHealth || {};

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Platform Oversight</div>
          <div style={s.subtitle}>
            {counts.activeMerchants} active merchants · {counts.totalStores} stores · {counts.totalConsumers} consumers
            <span style={{ marginLeft: 12 }}>
              <span style={s.cronDot(cronHealth.allOk)} />
              {cronHealth.allOk ? "All crons healthy" : `${cronHealth.failedRecently} cron failures`}
            </span>
          </div>
        </div>
        <button style={s.refreshBtn} onClick={load}>Refresh</button>
      </div>

      {/* Platform KPIs */}
      <div style={s.kpiGrid}>
        {Object.entries(kpis).map(([key, kpi]) => (
          <div key={key} style={s.kpiCard}>
            <div style={s.kpiLabel}>{kpi.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={s.kpiValue}>
                {key.includes("Cents") ? `$${(kpi.value / 100).toFixed(0)}` : kpi.value?.toLocaleString()}
              </div>
              <span style={s.kpiTrend(kpi.trend)}>
                {kpi.trend > 0 ? "+" : ""}{kpi.trend}% vs prior week
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Counts */}
      <div style={s.countsRow}>
        {[
          { label: "Merchants", value: counts.totalMerchants },
          { label: "Active Stores", value: counts.totalStores },
          { label: "Consumers", value: counts.totalConsumers },
          { label: "Active Promotions", value: counts.totalPromotions },
        ].map(c => (
          <div key={c.label} style={s.countBadge}>
            <div style={s.countValue}>{c.value?.toLocaleString()}</div>
            <div style={s.countLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts && alerts.count > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Alerts ({alerts.count})</div>
          {alerts.alerts.map((a, i) => (
            <div key={i} style={s.alertCard(a.severity)}>
              <span style={s.alertBadge(a.severity)}>{a.severity === "error" ? "ERROR" : "WARN"}</span>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Merchant Health Grid */}
      {merchants && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Merchant Health</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={s.table}>
              <thead>
                <tr style={{ background: C.bg }}>
                  <th style={s.th}>Merchant</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>POS</th>
                  <th style={s.th}>Promos</th>
                  <th style={s.th}>7d Txns</th>
                  <th style={s.th}>Attr %</th>
                  <th style={s.th}>Health</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map(m => (
                  <tr key={m.id} style={{ background: m.isSeedMerchant ? "rgba(29,158,117,0.03)" : "transparent" }}>
                    <td style={s.td}>
                      <Link to={`/merchants/${m.id}`} style={{ color: C.navy, textDecoration: "none", fontWeight: 600 }}>
                        {m.name}
                      </Link>
                      {m.isSeedMerchant && <span style={{ marginLeft: 6, fontSize: 9, color: C.teal, fontWeight: 700 }}>SEED</span>}
                    </td>
                    <td style={{ ...s.td, fontSize: 12, color: C.muted }}>{m.merchantType || "—"}</td>
                    <td style={{ ...s.td, fontSize: 12 }}>{m.posTypes.join(", ") || "—"}</td>
                    <td style={{ ...s.td, fontSize: 12 }}>
                      {m.activePromos}
                      {m.promoTypes.length > 0 && (
                        <span style={{ marginLeft: 4, fontSize: 10, color: C.muted }}>
                          ({m.promoTypes.join(", ")})
                        </span>
                      )}
                    </td>
                    <td style={s.td}>{m.weeklyTransactions}</td>
                    <td style={{ ...s.td, color: m.attributionRate >= 60 ? C.green : m.attributionRate >= 40 ? C.amber : C.red, fontWeight: 600 }}>
                      {m.attributionRate}%
                    </td>
                    <td style={s.td}>
                      <div style={s.healthBar(m.healthScore)}>
                        <div style={s.healthFill(m.healthScore)} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: m.healthScore >= 70 ? C.green : m.healthScore >= 40 ? C.amber : C.red }}>
                        {m.healthScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
