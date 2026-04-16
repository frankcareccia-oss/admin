/**
 * MerchantDashboardReporting.jsx — Pre-aggregated reporting dashboard
 *
 * All data from summary tables via /merchant/reporting/dashboard.
 * KPI tiles, Recharts charts, store breakdown, promotion table.
 */

import React from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { color, btn } from "../theme";
import { merchantGetDashboard, merchantGetReportingStores, merchantGetSimulatorData } from "../api/client";
import PromotionSimulator from "../components/PromotionSimulator";

// ── Colors ──
const C = {
  teal: "#00796B",
  tealLight: "#B2DFDB",
  tealDark: "#004D40",
  orange: "#FF6F00",
  orangeLight: "#FFE0B2",
  green: "#2E7D32",
  red: "#C62828",
  amber: "#FFB300",
  gray: "#9E9E9E",
  grayLight: "#F5F5F5",
  navy: color.navy || "#0B2A33",
  // Engagement donut
  freq1: "#E0F2F1", freq2: "#80CBC4", freq3: "#009688", freq4: "#004D40",
  // Churn
  churn30: "#FFB300", churn60: "#F57C00", churn90: "#C62828",
  // Progress
  p25: "#E0F2F1", p50: "#80CBC4", p75: "#26A69A", p100: "#00796B", pReady: "#FF6F00",
  // Flywheel
  stamps: "#4DD0E1", milestones: "#0097A7", staged: "#006064", redeemed: "#FF6F00",
};

const s = {
  page: { padding: "0 0 32px" },
  header: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "16px 0", borderBottom: `1px solid ${color.border}` },
  periodBtn: (active) => ({
    padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: `1px solid ${active ? C.teal : color.border}`,
    background: active ? C.teal : "#fff", color: active ? "#fff" : color.muted,
  }),
  storeSelect: { padding: "6px 10px", borderRadius: 6, border: `1px solid ${color.border}`, fontSize: 13 },
  tileRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, margin: "16px 0" },
  tile: { background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px", display: "flex", flexDirection: "column", gap: 4 },
  tileValue: { fontSize: 24, fontWeight: 700, color: C.navy },
  tileLabel: { fontSize: 12, color: color.muted, fontWeight: 500 },
  tileTrend: (dir) => ({
    fontSize: 12, fontWeight: 600,
    color: dir === "up" ? C.green : dir === "down" ? C.red : C.gray,
  }),
  section: { margin: "20px 0" },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 10 },
  chartBox: { background: "#fff", border: `1px solid ${color.border}`, borderRadius: 10, padding: "16px" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 12px", borderBottom: `2px solid ${color.border}`, color: color.muted, fontWeight: 600 },
  td: { padding: "8px 12px", borderBottom: `1px solid ${color.border}` },
  empty: { textAlign: "center", color: color.muted, padding: "40px 16px", fontSize: 14 },
  loading: { textAlign: "center", color: color.muted, padding: "48px", fontSize: 15 },
  insightCard: { background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: C.navy, lineHeight: 1.6 },
};

function fmtCurrency(cents) { return "$" + (cents / 100).toFixed(2); }
function trendArrow(dir) { return dir === "up" ? "\u2191" : dir === "down" ? "\u2193" : "\u2014"; }

function KpiTile({ label, value, format, trend, trendPct, invertTrend }) {
  const display = format === "pct" ? `${value}%` : format === "currency" ? fmtCurrency(value) : value;
  const dir = invertTrend ? (trend === "up" ? "down" : trend === "down" ? "up" : "flat") : trend;
  return (
    <div style={s.tile}>
      <div style={s.tileValue}>{value != null ? display : "\u2014"}</div>
      <div style={s.tileLabel}>{label}</div>
      <div style={s.tileTrend(dir)}>
        {trendArrow(dir)} {Math.abs(trendPct || 0)}% vs prior period
      </div>
    </div>
  );
}

function generateInsights(data) {
  const insights = [];
  if (data.kpis?.attributionRate?.value < 50) {
    insights.push(`Your attribution rate is ${data.kpis.attributionRate.value}%. Remind your team to ask every customer for their phone number at checkout.`);
  }
  if (data.engagement?.churnRisk?.inactiveDays30 > 5) {
    insights.push(`${data.engagement.churnRisk.inactiveDays30} members haven't visited in 30 days. Consider a "we miss you" promotion to bring them back.`);
  }
  if (data.engagement?.stampProgress?.rewardReady > 0) {
    insights.push(`${data.engagement.stampProgress.rewardReady} members have a reward ready to redeem. Make sure your team reminds customers to check their PerkValet app.`);
  }
  if (data.kpis?.newEnrollments?.value > 0 && data.kpis?.newEnrollments?.trend === "up") {
    insights.push(`New enrollments are up ${data.kpis.newEnrollments.trendPct}% — your loyalty program is growing!`);
  }
  return insights;
}

export default function MerchantDashboardReporting() {
  const [data, setData] = React.useState(null);
  const [stores, setStores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [period, setPeriod] = React.useState("30d");
  const [storeId, setStoreId] = React.useState("all");

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, storeList] = await Promise.all([
        merchantGetDashboard({ period, storeId }),
        merchantGetReportingStores(),
      ]);
      setData(dashData);
      setStores(storeList || []);
    } catch (e) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [period, storeId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={s.loading}>Loading dashboard...</div>;
  if (error) return <div style={{ ...s.empty, color: C.red }}>{error}</div>;
  if (!data) return <div style={s.empty}>No data available</div>;

  const kpis = data.kpis || {};
  const ts = data.timeSeries || [];
  const eng = data.engagement || {};
  const promos = data.promotions || [];
  const breakdown = data.storeBreakdown || [];
  const insights = generateInsights(data);

  // Engagement donut data
  const freqData = eng.visitFrequency ? [
    { name: "1 visit", value: eng.visitFrequency.visitedOnce, fill: C.freq1 },
    { name: "2-3 visits", value: eng.visitFrequency.visited2to3, fill: C.freq2 },
    { name: "4-7 visits", value: eng.visitFrequency.visited4to7, fill: C.freq3 },
    { name: "8+ visits", value: eng.visitFrequency.visited8plus, fill: C.freq4 },
  ].filter(d => d.value > 0) : [];

  // Stamp progress data
  const progressData = eng.stampProgress ? [
    { name: "0-25%", value: eng.stampProgress.progress0to25, fill: C.p25 },
    { name: "25-50%", value: eng.stampProgress.progress25to50, fill: C.p50 },
    { name: "50-75%", value: eng.stampProgress.progress50to75, fill: C.p75 },
    { name: "75-100%", value: eng.stampProgress.progress75to100, fill: C.p100 },
    { name: "Reward Ready", value: eng.stampProgress.rewardReady, fill: C.pReady },
  ].filter(d => d.value > 0) : [];

  const progressTotal = progressData.reduce((s, d) => s + d.value, 0);

  // Churn data
  const churnData = eng.churnRisk ? [
    { name: "30 days", value: eng.churnRisk.inactiveDays30, fill: C.churn30 },
    { name: "60 days", value: eng.churnRisk.inactiveDays60, fill: C.churn60 },
    { name: "90 days", value: eng.churnRisk.inactiveDays90, fill: C.churn90 },
  ] : [];

  return (
    <div style={s.page}>
      {/* Header controls */}
      <div style={s.header}>
        <select style={s.storeSelect} value={storeId} onChange={e => setStoreId(e.target.value)}>
          <option value="all">All Stores</option>
          {stores.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        {["7d", "30d", "90d"].map(p => (
          <button key={p} style={s.periodBtn(period === p)} onClick={() => setPeriod(p)}>
            {p === "7d" ? "7D" : p === "30d" ? "30D" : "90D"}
          </button>
        ))}
        <span style={{ fontSize: 12, color: color.muted }}>{data.period?.label}</span>
      </div>

      {/* KPI Tiles */}
      <div style={s.tileRow}>
        <KpiTile label="Total Visits" value={kpis.totalTransactions?.value} trend={kpis.totalTransactions?.trend} trendPct={kpis.totalTransactions?.trendPct} />
        <KpiTile label="Attribution Rate" value={kpis.attributionRate?.value} format="pct" trend={kpis.attributionRate?.trend} trendPct={kpis.attributionRate?.trendPct} />
        <KpiTile label="Active Members" value={kpis.activeMembers?.value} trend={kpis.activeMembers?.trend} trendPct={kpis.activeMembers?.trendPct} />
        <KpiTile label="Rewards Redeemed" value={kpis.rewardsRedeemed?.value} trend={kpis.rewardsRedeemed?.trend} trendPct={kpis.rewardsRedeemed?.trendPct} />
        <KpiTile label="New Enrollments" value={kpis.newEnrollments?.value} trend={kpis.newEnrollments?.trend} trendPct={kpis.newEnrollments?.trendPct} />
        <KpiTile label="Budget Used" value={kpis.budgetConsumedCents?.value} format="currency" trend={kpis.budgetConsumedCents?.trend} trendPct={kpis.budgetConsumedCents?.trendPct} invertTrend />
      </div>

      {/* Visit Volume + Attribution Rate */}
      {ts.length > 0 && (
        <div style={{ ...s.section, ...s.row2 }}>
          <div style={s.chartBox}>
            <div style={s.sectionTitle}>Visit Volume</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ts}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grayLight} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="totalTransactions" fill={C.tealLight} name="Total" radius={[3, 3, 0, 0]} />
                <Bar dataKey="attributedTransactions" fill={C.teal} name="Attributed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={s.chartBox}>
            <div style={s.sectionTitle}>Attribution Rate</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ts}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grayLight} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={70} stroke={C.amber} strokeDasharray="5 5" label={{ value: "Target 70%", fontSize: 10, fill: C.amber }} />
                <Area type="monotone" dataKey="attributionRate" stroke={C.teal} fill={C.tealLight} fillOpacity={0.3} name="Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Loyalty Flywheel */}
      {ts.length > 0 && (
        <div style={s.section}>
          <div style={s.chartBox}>
            <div style={s.sectionTitle}>Loyalty Flywheel</div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={ts}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grayLight} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="stampsIssued" stackId="1" stroke={C.stamps} fill={C.stamps} fillOpacity={0.6} name="Stamps" />
                <Area type="monotone" dataKey="newEnrollments" stackId="1" stroke={C.milestones} fill={C.milestones} fillOpacity={0.6} name="Enrollments" />
                <Area type="monotone" dataKey="rewardsRedeemed" stackId="1" stroke={C.redeemed} fill={C.redeemed} fillOpacity={0.6} name="Redeemed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Consumer Engagement + Churn Risk */}
      <div style={{ ...s.section, ...s.row2 }}>
        <div style={s.chartBox}>
          <div style={s.sectionTitle}>Consumer Engagement</div>
          {freqData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={freqData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {freqData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={s.empty}>No engagement data yet</div>}
        </div>

        <div style={s.chartBox}>
          <div style={s.sectionTitle}>Churn Risk</div>
          {churnData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={churnData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={C.grayLight} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="value" name="Inactive members" radius={[0, 4, 4, 0]}>
                  {churnData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={s.empty}>No churn data yet</div>}
        </div>
      </div>

      {/* Stamp Progress Distribution */}
      {progressData.length > 0 && (
        <div style={s.section}>
          <div style={s.chartBox}>
            <div style={s.sectionTitle}>Stamp Progress Distribution</div>
            <div style={{ display: "flex", height: 36, borderRadius: 6, overflow: "hidden", border: `1px solid ${color.border}` }}>
              {progressData.map((seg, i) => (
                <div
                  key={i}
                  style={{
                    width: `${(seg.value / progressTotal) * 100}%`,
                    background: seg.fill,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600, color: i >= 3 ? "#fff" : C.navy,
                    minWidth: seg.value > 0 ? 30 : 0,
                  }}
                  title={`${seg.name}: ${seg.value}`}
                >
                  {(seg.value / progressTotal) > 0.08 ? `${seg.name} (${seg.value})` : ""}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              {progressData.map((seg, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: color.muted }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.fill }} />
                  {seg.name}: {seg.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Promotion Performance Table */}
      {promos.length > 0 && (
        <div style={s.section}>
          <div style={s.chartBox}>
            <div style={s.sectionTitle}>Promotion Performance</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Promotion</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Enrolled</th>
                  <th style={s.th}>Redeemed</th>
                  <th style={s.th}>Value</th>
                  <th style={s.th}>Expired</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p.promotionId}>
                    <td style={s.td}>{p.name}</td>
                    <td style={s.td}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 8px",
                        background: p.status === "active" ? "#E0F2F1" : "#F5F5F5",
                        color: p.status === "active" ? C.teal : color.muted,
                      }}>{p.status}</span>
                    </td>
                    <td style={s.td}>{p.totalEnrolled}</td>
                    <td style={s.td}>{p.rewardsRedeemed}</td>
                    <td style={s.td}>{fmtCurrency(p.redemptionValueCents || 0)}</td>
                    <td style={s.td}>{p.rewardsExpired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Store Breakdown */}
      {breakdown.length > 1 && (
        <div style={s.section}>
          <div style={s.chartBox}>
            <div style={s.sectionTitle}>Store Breakdown</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grayLight} />
                <XAxis dataKey="storeName" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalTransactions" fill={C.teal} name="Visits" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rewardsRedeemed" fill={C.orange} name="Redeemed" radius={[3, 3, 0, 0]} />
                <Bar dataKey="activeMembers" fill={C.stamps} name="Active" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Growth Advisor Insights */}
      {insights.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Growth Advisor</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map((text, i) => (
              <div key={i} style={s.insightCard}>{text}</div>
            ))}
          </div>
        </div>
      )}

      {/* Promotion Simulator */}
      {promos.length > 0 && (
        <SimulatorSection promos={promos} />
      )}

      {/* Empty state */}
      {ts.length === 0 && (
        <div style={s.empty}>
          Your first transactions will appear here after your first day of sales.
        </div>
      )}
    </div>
  );
}

function SimulatorSection({ promos }) {
  const [selectedPromoId, setSelectedPromoId] = React.useState(null);
  const [simData, setSimData] = React.useState(null);
  const [simLoading, setSimLoading] = React.useState(false);

  const handleSelectPromo = async (promoId) => {
    if (promoId === selectedPromoId) {
      setSelectedPromoId(null);
      setSimData(null);
      return;
    }
    setSelectedPromoId(promoId);
    setSimLoading(true);
    try {
      const data = await merchantGetSimulatorData(promoId);
      setSimData(data);
    } catch (e) {
      console.error("Simulator load error:", e);
      setSimData(null);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div style={{ margin: "20px 0" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: color.navy || "#0B2A33", marginBottom: 10 }}>
        Promotion Simulator
      </div>
      <div style={{ fontSize: 13, color: color.muted, marginBottom: 12 }}>
        Select a promotion to project its impact with adjustable parameters.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {promos.map(p => (
          <button
            key={p.promotionId}
            onClick={() => handleSelectPromo(p.promotionId)}
            style={{
              padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${selectedPromoId === p.promotionId ? "#00796B" : (color.border || "#D9D3CA")}`,
              background: selectedPromoId === p.promotionId ? "#00796B" : "#fff",
              color: selectedPromoId === p.promotionId ? "#fff" : (color.muted || "#6B7A80"),
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      {simLoading && <div style={{ textAlign: "center", color: color.muted, padding: 20 }}>Loading simulator...</div>}
      {simData && !simLoading && <PromotionSimulator simulatorData={simData} mode="existing" />}
    </div>
  );
}
