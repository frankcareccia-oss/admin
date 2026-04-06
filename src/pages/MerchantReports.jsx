/**
 * MerchantReports.jsx — Thread R
 *
 * Loyalty & visit analytics for a merchant.
 * Route: /merchants/:merchantId/reports
 * Access: pv_admin + merchant_admin / owner
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { color, btn, inputStyle as themeInput } from "../theme";
import {
  getMerchant,
  me,
  getSystemRole,
  merchantGetReportOverview,
  merchantGetReportStores,
  merchantGetReportPromotions,
  adminGetMerchantReportOverview,
  adminGetMerchantReportStores,
  adminGetMerchantReportPromotions,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";

// ── pvUiHook ──────────────────────────────────────────────────
function pvUiHook(event, fields = {}) {
  try { console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields })); } catch { }
}

// ── Design tokens ─────────────────────────────────────────────
const TEAL   = color.primary;     // #2F8F8B
const ORANGE = "#F36A1D";

const RANGES = [
  { value: "30d",  label: "Last 30 days" },
  { value: "90d",  label: "Last 90 days" },
  { value: "all",  label: "All time" },
];

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: color.cardBg,
      border: `1px solid ${color.border}`,
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: 12, color: color.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: accent || color.text, lineHeight: 1.1 }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: 12, color: color.textFaint }}>{sub}</div>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: color.text, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────
const thTd = (head) => ({
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: head ? 700 : 400,
  color: head ? color.textMuted : color.text,
  borderBottom: `1px solid ${color.border}`,
  whiteSpace: "nowrap",
});

// ── Custom Recharts tooltip ───────────────────────────────────
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

// ── Main component ────────────────────────────────────────────
export default function MerchantReports() {
  const { merchantId } = useParams();
  const systemRole = getSystemRole();
  const isPvAdmin  = systemRole === "pv_admin";

  const [merchant,    setMerchant]    = React.useState(null);
  const [range,       setRange]       = React.useState("30d");
  const [loading,     setLoading]     = React.useState(true);
  const [error,       setError]       = React.useState("");
  const [lastError,   setLastError]   = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");

  const [overview,    setOverview]    = React.useState(null);
  const [stores,      setStores]      = React.useState([]);
  const [promotions,  setPromotions]  = React.useState([]);

  // ── Load ────────────────────────────────────────────────────
  async function load(r = range) {
    setLoading(true);
    setError("");
    pvUiHook("merchant.reports.load.started", { stable: "reports:load", merchantId, range: r });
    try {
      const [mRes, ovRes, stRes, prRes] = await Promise.all([
        isPvAdmin ? getMerchant(merchantId) : me(),
        isPvAdmin
          ? adminGetMerchantReportOverview(merchantId, { range: r })
          : merchantGetReportOverview({ range: r }),
        isPvAdmin
          ? adminGetMerchantReportStores(merchantId, { range: r })
          : merchantGetReportStores({ range: r }),
        isPvAdmin
          ? adminGetMerchantReportPromotions(merchantId, { range: r })
          : merchantGetReportPromotions({ range: r }),
      ]);
      const merchantObj = isPvAdmin
        ? (mRes?.merchant || mRes)
        : (mRes?.user?.merchantUsers?.[0]?.merchant || null);
      setMerchant(merchantObj);
      setOverview(ovRes);
      setStores(stRes?.stores || []);
      setPromotions(prRes?.promotions || []);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.reports.load.succeeded", { stable: "reports:load", merchantId, range: r });
    } catch (e) {
      const msg = e?.message || "Failed to load reports";
      setError(msg);
      setLastError(msg);
      pvUiHook("merchant.reports.load.failed", { stable: "reports:load", merchantId, range: r, error: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [merchantId]);

  function changeRange(r) {
    setRange(r);
    load(r);
    pvUiHook("merchant.reports.range.changed", { stable: "reports:range", merchantId, range: r });
  }

  const merchantName = merchant?.name || `Merchant ${merchantId}`;

  // ── Store chart data ─────────────────────────────────────────
  const storeChartData = stores
    .filter(s => s.visits > 0)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10)
    .map(s => ({
      name:        s.storeName.length > 18 ? s.storeName.slice(0, 18) + "…" : s.storeName,
      visits:      s.visits,
      identified:  s.identifiedVisits,
      redemptions: s.redemptions,
    }));

  // ── Promotion chart data ─────────────────────────────────────
  const promoChartData = promotions
    .filter(p => p.participants > 0 || p.redemptions > 0)
    .sort((a, b) => b.participants - a.participants)
    .slice(0, 8)
    .map(p => ({
      name:         p.promotionName.length > 20 ? p.promotionName.slice(0, 20) + "…" : p.promotionName,
      participants: p.participants,
      redemptions:  p.redemptions,
    }));

  // ── Range toggle ─────────────────────────────────────────────
  const btnFilter = {
    padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
    cursor: "pointer", border: `1px solid ${color.border}`, background: color.cardBg, color: color.text,
  };
  const btnFilterActive = {
    ...btnFilter,
    background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary,
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        {isPvAdmin ? (
          <>
            <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
            {" / "}
            <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
          </>
        ) : (
          <span>{merchantName}</span>
        )}
        {" / "}
        <span>Reports</span>
      </div>

      <PageHeader
        title="Reports"
        subtitle={`Loyalty & visit analytics for ${merchantName}`}
        right={
          <button
            type="button"
            style={{ ...btn.pill, padding: "8px 16px" }}
            onClick={() => load(range)}
          >
            Refresh
          </button>
        }
      />

      {/* Range toggle */}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {RANGES.map(r => (
          <button
            key={r.value}
            type="button"
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
          {/* ── Overview stat cards ── */}
          <Section title="Overview">
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 12,
            }}>
              <StatCard label="Total Visits"       value={overview?.totalVisits}       accent={TEAL} />
              <StatCard label="Identified Visits"  value={overview?.identifiedVisits}
                sub={`${overview?.totalVisits ? Math.round(overview.identifiedVisits / overview.totalVisits * 100) : 0}% of total`} />
              <StatCard label="Unique Consumers"   value={overview?.uniqueConsumers}   accent={TEAL} />
              <StatCard label="Stamps Issued"      value={overview?.stampsIssued} />
              <StatCard label="Rewards Granted"    value={overview?.totalRedemptions}  accent={ORANGE} />
              <StatCard label="Active Entitlements" value={overview?.activeEntitlements}
                sub="Outstanding rewards" />
            </div>
          </Section>

          {/* ── Store breakdown chart + table ── */}
          {stores.length > 0 && (
            <Section title="Visits by Store">
              {storeChartData.length > 0 && (
                <div style={{
                  background: color.cardBg, border: `1px solid ${color.border}`,
                  borderRadius: 14, padding: "16px 8px 8px", marginBottom: 16,
                }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={storeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: color.textMuted }} />
                      <YAxis tick={{ fontSize: 11, fill: color.textMuted }} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="visits" name="Visits" radius={[6, 6, 0, 0]}>
                        {storeChartData.map((_, i) => (
                          <Cell key={i} fill={TEAL} fillOpacity={0.8} />
                        ))}
                      </Bar>
                      <Bar dataKey="redemptions" name="Redemptions" radius={[6, 6, 0, 0]}>
                        {storeChartData.map((_, i) => (
                          <Cell key={i} fill={ORANGE} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{
                background: color.cardBg, border: `1px solid ${color.border}`,
                borderRadius: 14, overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thTd(true)}>Store</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Visits</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Identified</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.sort((a, b) => b.visits - a.visits).map(s => (
                      <tr key={s.storeId}>
                        <td style={thTd(false)}>
                          {s.storeName}
                          {s.storeStatus !== "active" && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: color.textFaint }}>
                              ({s.storeStatus})
                            </span>
                          )}
                        </td>
                        <td style={{ ...thTd(false), textAlign: "right", fontWeight: 700 }}>{s.visits}</td>
                        <td style={{ ...thTd(false), textAlign: "right" }}>{s.identifiedVisits}</td>
                        <td style={{ ...thTd(false), textAlign: "right", color: s.redemptions > 0 ? ORANGE : color.textFaint, fontWeight: s.redemptions > 0 ? 700 : 400 }}>
                          {s.redemptions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── Promotion funnel chart + table ── */}
          {promotions.length > 0 && (
            <Section title="Promotion Funnel">
              {promoChartData.length > 0 && (
                <div style={{
                  background: color.cardBg, border: `1px solid ${color.border}`,
                  borderRadius: 14, padding: "16px 8px 8px", marginBottom: 16,
                }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={promoChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: color.textMuted }} />
                      <YAxis tick={{ fontSize: 11, fill: color.textMuted }} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="participants" name="Participants" radius={[6, 6, 0, 0]}>
                        {promoChartData.map((_, i) => (
                          <Cell key={i} fill={TEAL} fillOpacity={0.8} />
                        ))}
                      </Bar>
                      <Bar dataKey="redemptions" name="Redemptions" radius={[6, 6, 0, 0]}>
                        {promoChartData.map((_, i) => (
                          <Cell key={i} fill={ORANGE} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div style={{
                background: color.cardBg, border: `1px solid ${color.border}`,
                borderRadius: 14, overflow: "hidden",
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thTd(true)}>Program</th>
                      <th style={thTd(true)}>Category</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Threshold</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Participants</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Stamps</th>
                      <th style={{ ...thTd(true), textAlign: "right" }}>Rewards</th>
                      <th style={{ ...thTd(true), textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotions.sort((a, b) => b.participants - a.participants).map(p => (
                      <tr key={p.promotionId}>
                        <td style={thTd(false)}>{p.promotionName}</td>
                        <td style={{ ...thTd(false), color: color.textMuted }}>{p.categoryName ?? "—"}</td>
                        <td style={{ ...thTd(false), textAlign: "right" }}>{p.threshold}</td>
                        <td style={{ ...thTd(false), textAlign: "right", fontWeight: 700 }}>{p.participants}</td>
                        <td style={{ ...thTd(false), textAlign: "right" }}>{p.stampsIssued}</td>
                        <td style={{ ...thTd(false), textAlign: "right", color: p.redemptions > 0 ? ORANGE : color.textFaint, fontWeight: p.redemptions > 0 ? 700 : 400 }}>
                          {p.redemptions}
                        </td>
                        <td style={{ ...thTd(false), textAlign: "center" }}>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: p.status === "active" ? "rgba(0,150,80,0.10)" : "rgba(0,0,0,0.06)",
                            color: p.status === "active" ? "rgba(0,110,50,1)" : color.textMuted,
                          }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {stores.length === 0 && promotions.length === 0 && (
            <div style={{
              marginTop: 32, padding: "24px", borderRadius: 14, textAlign: "center",
              background: color.cardBg, border: `1px solid ${color.border}`,
              color: color.textMuted, fontSize: 14,
            }}>
              No activity data yet for this period. Visits and rewards will appear here once consumers engage.
            </div>
          )}
        </>
      )}

      <SupportInfo context={{ page: "MerchantReports", merchantId, lastError, lastSuccessTs }} />
    </PageContainer>
  );
}
