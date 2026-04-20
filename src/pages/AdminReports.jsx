/**
 * AdminReports.jsx — Thread R (platform view)
 *
 * PV Admin platform-wide analytics.
 * Route: /admin/reports
 * Access: pv_admin only
 */

import React from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { color, btn } from "../theme";
import { adminGetPlatformReport } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

function pvUiHook(event, fields = {}) {
  try { console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields })); } catch { }
}

const TEAL   = color.primary;
const ORANGE = "#F36A1D";

const RANGES = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: color.cardBg, border: `1px solid ${color.border}`,
      borderRadius: 14, padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 12, color: color.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent || color.text, lineHeight: 1.1 }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: 12, color: color.textFaint }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: color.text, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

const thTd = (head) => ({
  padding: "10px 14px", textAlign: "left", fontSize: 13,
  fontWeight: head ? 700 : 400,
  color: head ? color.textMuted : color.text,
  borderBottom: `1px solid ${color.border}`,
  whiteSpace: "nowrap",
});

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: color.cardBg, border: `1px solid ${color.border}`,
      borderRadius: 10, padding: "8px 12px", fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AdminReports() {
  const [range,       setRange]       = React.useState("30d");
  const [loading,     setLoading]     = React.useState(true);
  const [error,       setError]       = React.useState("");
  const [lastError,   setLastError]   = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");
  const [data,        setData]        = React.useState(null);

  async function load(r = range) {
    setLoading(true);
    setError("");
    pvUiHook("admin.reports.platform.load.started", { stable: "admin:reports:platform", range: r });
    try {
      const res = await adminGetPlatformReport({ range: r });
      setData(res);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("admin.reports.platform.load.succeeded", { stable: "admin:reports:platform", range: r });
    } catch (e) {
      const msg = e?.message || "Failed to load platform report";
      setError(msg);
      setLastError(msg);
      pvUiHook("admin.reports.platform.load.failed", { stable: "admin:reports:platform", range: r, error: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  function changeRange(r) {
    setRange(r);
    load(r);
    pvUiHook("admin.reports.range.changed", { stable: "admin:reports:range", range: r });
  }

  const btnFilter = {
    padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
    cursor: "pointer", border: `1px solid ${color.border}`, background: color.cardBg, color: color.text,
  };
  const btnFilterActive = {
    ...btnFilter,
    background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary,
  };

  // Top merchants chart
  const topChart = (data?.topMerchantsByVisits || []).map(m => ({
    name: m.merchantName.length > 16 ? m.merchantName.slice(0, 16) + "…" : m.merchantName,
    visits: m.visits,
    merchantId: m.merchantId,
  }));

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/admin" style={{ color: "inherit", textDecoration: "none" }}>Admin</Link>
        {" / "}
        <span>Reports</span>
      </div>

      <PageHeader
        title="Platform Reports"
        subtitle="Cross-merchant analytics — visits, rewards, and merchant health"
        right={
          <button type="button" style={{ ...btn.pill, padding: "8px 16px" }} onClick={() => load(range)}>
            Refresh
          </button>
        }
      />

      {/* Range toggle */}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {RANGES.map(r => (
          <button key={r.value} type="button"
            style={range === r.value ? btnFilterActive : btnFilter}
            onClick={() => changeRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: color.textFaint, padding: "40px 0" }}>Loading…</div>
      ) : error ? (
        <div style={{
          marginTop: 20, padding: "12px 16px", borderRadius: 12,
          background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`,
          color: color.danger, fontSize: 13,
        }}>
          {error}
        </div>
      ) : (
        <>
          {/* ── Platform stat cards ── */}
          <Section title="Platform Overview">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
              gap: 12,
            }}>
              <StatCard label="Active Merchants"  value={data?.merchants?.active}
                sub={`of ${data?.merchants?.total} total`} accent={TEAL} />
              <StatCard label="Active Stores"     value={data?.stores?.active}
                sub={`of ${data?.stores?.total} total`} />
              <StatCard label="Total Visits"      value={data?.visits?.total}        accent={TEAL} />
              <StatCard label="Identified Visits" value={data?.visits?.identified}
                sub={data?.visits?.total ? `${Math.round(data.visits.identified / data.visits.total * 100)}% of total` : null} />
              <StatCard label="Rewards Granted"   value={data?.redemptions}          accent={ORANGE} />
              <StatCard label="Active Entitlements" value={data?.activeEntitlements}
                sub="Outstanding rewards" />
            </div>
          </Section>

          {/* ── Visit identity split ── */}
          <Section title="Visit Identity Split">
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 420,
            }}>
              <div style={{
                background: color.primarySubtle, border: `1px solid ${color.primaryBorder}`,
                borderRadius: 14, padding: "14px 18px",
              }}>
                <div style={{ fontSize: 12, color: color.primary, fontWeight: 700 }}>Identified</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: color.primary }}>
                  {data?.visits?.identified ?? 0}
                </div>
                <div style={{ fontSize: 12, color: color.textFaint }}>Consumer linked</div>
              </div>
              <div style={{
                background: "rgba(0,0,0,0.03)", border: `1px solid ${color.border}`,
                borderRadius: 14, padding: "14px 18px",
              }}>
                <div style={{ fontSize: 12, color: color.textMuted, fontWeight: 700 }}>Anonymous</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: color.textMuted }}>
                  {data?.visits?.anonymous ?? 0}
                </div>
                <div style={{ fontSize: 12, color: color.textFaint }}>No identity</div>
              </div>
            </div>
          </Section>

          {/* ── Top merchants chart ── */}
          {topChart.length > 0 && (
            <Section title="Top Merchants by Visits">
              <div style={{
                background: color.cardBg, border: `1px solid ${color.border}`,
                borderRadius: 14, padding: "16px 8px 8px", marginBottom: 16,
              }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topChart} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: color.textMuted }} />
                    <YAxis tick={{ fontSize: 11, fill: color.textMuted }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="visits" name="Visits" radius={[6, 6, 0, 0]}>
                      {topChart.map((_, i) => (
                        <Cell key={i} fill={TEAL} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table with drill-down links */}
              <div style={{
                background: color.cardBg, border: `1px solid ${color.border}`,
                borderRadius: 14, overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thTd(true)}>Merchant</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Visits</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Reports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.topMerchantsByVisits || []).map(m => (
                      <tr key={m.merchantId}>
                        <td style={thTd(false)}>
                          <Link
                            to={`/merchants/${m.merchantId}`}
                            style={{ color: color.primary, textDecoration: "none", fontWeight: 600 }}
                          >
                            {m.merchantName}
                          </Link>
                        </td>
                        <td style={{ ...thTd(false), textAlign: "right", fontWeight: 700 }}>{m.visits}</td>
                        <td style={{ ...thTd(false), textAlign: "right" }}>
                          <Link
                            to={`/merchants/${m.merchantId}/reports`}
                            style={{ color: color.primary, fontSize: 12, textDecoration: "none" }}
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </>
      )}

    </PageContainer>
  );
}
