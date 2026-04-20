/**
 * MerchantDashboard.jsx — Three-section merchant home
 *
 * Section 1: Last week summary (past — final numbers)
 * Section 2: This week (present/future — scheduled + in motion)
 * Section 3: Needs your attention (timeless — action required)
 *
 * Section order persisted in localStorage. Three preset buttons.
 */

import React from "react";
import { Link } from "react-router-dom";
import { color } from "../theme";
import { merchantGetDashboardHome } from "../api/client";
import PageContainer from "../components/layout/PageContainer";

const C = {
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75", tealBg: "#E1F5EE", tealDark: "#0F6E56",
  amber: "#EF9F27", amberBg: "#FAEEDA", amberDark: "#854F0B",
  red: "#E24B4A", redBg: "#FCEBEB",
  blue: "#3B82F6", blueBg: "#E6F1FB",
  muted: "#888780", border: "#E5E5E0", bg: "#F4F4F0",
  green: "#1D9E75", greenBg: "#F8FDFB",
};

const PRESETS = {
  default: ["lastweek", "thisweek", "alerts"],
  alertsFirst: ["alerts", "thisweek", "lastweek"],
  weekFirst: ["thisweek", "alerts", "lastweek"],
};
const STORAGE_KEY = "pv_dashboard_section_order";

function getOrder() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || PRESETS.default; }
  catch { return PRESETS.default; }
}
function saveOrder(order) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch {}
}
function matchesPreset(order) {
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (order.join(",") === preset.join(",")) return name;
  }
  return null;
}

// ── KPI Tile ─────────────────────────────────────────────────

function KpiTile({ label, value, trend, suffix, detail }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", flex: 1 }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: C.navy }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
        {suffix && <span style={{ fontSize: 13, color: C.muted }}>{suffix}</span>}
      </div>
      {trend != null && (
        <div style={{ fontSize: 11, fontWeight: 600, color: trend > 0 ? C.teal : trend < 0 ? C.red : C.muted, marginTop: 2 }}>
          {trend > 0 ? "+" : ""}{trend}% vs prior week
        </div>
      )}
      {detail && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{detail}</div>}
    </div>
  );
}

// ── Section Headers ──────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, bgColor, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>
          {title}
          {count != null && (
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: count === 0 ? C.teal : C.amberDark }}>
              {count === 0 ? "All clear" : `${count} item${count === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: C.muted }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Alert Card ───────────────────────────────────────────────

function AlertCard({ alert }) {
  const styles = {
    critical: { bg: C.redBg, border: "#F09595", color: "#A32D2D", badge: "Critical" },
    billing: { bg: C.redBg, border: "#F09595", color: "#A32D2D", badge: "Billing" },
    watch: { bg: C.amberBg, border: "#FAC775", color: C.amberDark, badge: "Watch" },
    action: { bg: C.amberBg, border: "#FAC775", color: C.amberDark, badge: "Action" },
    info: { bg: C.blueBg, border: "#85B7EB", color: "#0C447C", badge: "Info" },
  };
  const s = styles[alert.severity] || styles.info;

  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, position: "relative" }}>
      <span style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 700, padding: "1px 8px", borderRadius: 4, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>{s.badge}</span>
      <div style={{ fontSize: 13, fontWeight: 500, color: s.color, marginBottom: 4, paddingRight: 60 }}>{alert.title}</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{alert.description}</div>
      {alert.action && (
        <Link to={alert.action.to} style={{ fontSize: 11, fontWeight: 500, color: C.teal, textDecoration: "none", marginTop: 6, display: "inline-block" }}>
          {alert.action.label}
        </Link>
      )}
    </div>
  );
}

// ── Capture Rate Bar ─────────────────────────────────────────

function CaptureBar({ store }) {
  const barColor = store.captureRate >= 70 ? C.teal : store.captureRate >= 50 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: barColor, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500, color: C.navy, flex: 1, minWidth: 120 }}>{store.storeName}</span>
      <span style={{ fontSize: 12, color: C.muted, width: 50, textAlign: "right" }}>{store.transactions}</span>
      <div style={{ width: 70, height: 4, borderRadius: 2, background: "#eee", position: "relative" }}>
        <div style={{ width: `${Math.min(100, store.captureRate)}%`, height: "100%", borderRadius: 2, background: barColor }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: barColor, width: 36, textAlign: "right" }}>{store.captureRate}%</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function MerchantDashboard() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [order, setOrder] = React.useState(getOrder);

  React.useEffect(() => {
    merchantGetDashboardHome()
      .then(d => setData(d))
      .catch(e => console.error("[MerchantDashboard]", e?.message))
      .finally(() => setLoading(false));
  }, []);

  const handlePreset = (name) => {
    const newOrder = PRESETS[name];
    setOrder(newOrder);
    saveOrder(newOrder);
  };

  if (loading) return <PageContainer><div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading dashboard...</div></PageContainer>;
  if (!data) return <PageContainer><div style={{ padding: 40, textAlign: "center", color: C.muted }}>Could not load dashboard data.</div></PageContainer>;

  const activePreset = matchesPreset(order);

  const presetBtn = (name, label) => ({
    padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "0.5px solid",
    background: activePreset === name ? C.teal : "transparent",
    borderColor: activePreset === name ? C.teal : C.border,
    color: activePreset === name ? "#fff" : C.muted,
  });

  // ── Section renderers ──────────────────────────────────────

  const renderLastWeek = () => {
    const lw = data.lastWeek;
    if (!lw) return null;
    return (
      <div key="lastweek" style={{ marginBottom: 28 }}>
        <SectionHeader icon="&#128197;" title="Last Week" subtitle={lw.period.label} bgColor={C.bg} />
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <KpiTile label="Transactions" value={lw.kpis.transactions.value} trend={lw.kpis.transactions.trend} />
          <KpiTile label="Phone Captures" value={lw.kpis.phoneCaptures.value} detail={`${lw.kpis.phoneCaptures.rate}% capture rate`} />
          <KpiTile label="Stamps Earned" value={lw.kpis.stampsEarned.value} trend={lw.kpis.stampsEarned.trend} />
          <KpiTile label="New Members" value={lw.kpis.newMembers.value} detail={lw.kpis.newMembers.change > 0 ? `+${lw.kpis.newMembers.change} vs prior` : lw.kpis.newMembers.change < 0 ? `${lw.kpis.newMembers.change} vs prior` : "Same as prior"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Capture by store */}
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Capture Rate by Location</div>
            {lw.captureByStore.length > 0 ? lw.captureByStore.map(s => <CaptureBar key={s.storeId} store={s} />) : (
              <div style={{ fontSize: 12, color: C.muted }}>No store-level data yet.</div>
            )}
          </div>
          {/* Reward pipeline */}
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Reward Pipeline</div>
            {[
              { label: "Stamps toward milestone", value: lw.rewardPipeline.stampsTowardMilestone },
              { label: "Milestones reached", value: lw.rewardPipeline.milestonesReached, color: C.teal },
              { label: "Rewards redeemed", value: lw.rewardPipeline.rewardsRedeemed },
              { label: "Total enrolled members", value: lw.rewardPipeline.totalEnrolled },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                <span style={{ color: C.navy }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color || C.navy }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderThisWeek = () => {
    const tw = data.thisWeek;
    if (!tw) return null;
    return (
      <div key="thisweek" style={{ marginBottom: 28 }}>
        <SectionHeader icon="&#128339;" title="This Week" subtitle={tw.period.label} bgColor={C.tealBg} />

        {/* Event cards */}
        {(tw.events.goingLive.length > 0 || tw.events.expiringRewards.count > 0) && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {tw.events.goingLive.map(p => (
              <div key={p.id} style={{ flex: 1, background: C.greenBg, border: `1px solid #5DCAA5`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.tealDark, marginBottom: 4 }}>Going Live</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.navy }}>{p.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{p.date}</div>
              </div>
            ))}
            {tw.events.expiringRewards.count > 0 && (
              <div style={{ flex: 1, background: "#FFFBF2", border: `1px solid #FAC775`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.amberDark, marginBottom: 4 }}>Expiring</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.navy }}>{tw.events.expiringRewards.count} rewards expiring within 7 days</div>
              </div>
            )}
          </div>
        )}

        {/* Promotions + Rewards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Active Promotions</div>
            {tw.promotions.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.bg}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.navy }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{p.promotionType} · {p.enrolledCount} enrolled</div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: p.status === "active" ? C.tealBg : p.status === "staged" ? C.amberBg : C.bg,
                  color: p.status === "active" ? C.tealDark : p.status === "staged" ? C.amberDark : C.muted,
                }}>{p.status}</span>
              </div>
            ))}
            {tw.promotions.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>No promotions yet.</div>}
            <Link to="/merchant/promotions" style={{ fontSize: 11, color: C.teal, textDecoration: "none", marginTop: 8, display: "inline-block" }}>+ Create promotion</Link>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Rewards Status</div>
            {[
              { label: "Ready at counter", value: tw.rewardsPipeline.ready, color: tw.rewardsPipeline.ready > 0 ? C.teal : null },
              { label: "Expiring within 14 days", value: tw.rewardsPipeline.expiring14d, color: tw.rewardsPipeline.expiring14d > 0 ? C.amber : null },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                <span style={{ color: C.navy }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color || C.navy }}>{r.value}</span>
              </div>
            ))}
            <Link to="/merchant/reports" style={{ fontSize: 11, color: C.teal, textDecoration: "none", marginTop: 8, display: "inline-block" }}>View reward pipeline →</Link>
          </div>
        </div>
      </div>
    );
  };

  const renderAlerts = () => {
    const alerts = data.alerts;
    return (
      <div key="alerts" style={{ marginBottom: 28 }}>
        <SectionHeader icon="&#9888;" title="Needs Your Attention" bgColor={C.amberBg} count={alerts.count} />
        {alerts.count === 0 ? (
          <div style={{ background: C.tealBg, border: `0.5px solid #5DCAA5`, borderRadius: 10, padding: "20px", textAlign: "center", fontSize: 13, color: C.tealDark }}>
            Everything looks good — nothing needs your attention right now.
          </div>
        ) : (
          alerts.items.map((a, i) => <AlertCard key={i} alert={a} />)
        )}
      </div>
    );
  };

  const sectionRenderers = { lastweek: renderLastWeek, thisweek: renderThisWeek, alerts: renderAlerts };

  return (
    <PageContainer>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>Dashboard</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={presetBtn("default", "Default")} onClick={() => handlePreset("default")}>Default</button>
          <button style={presetBtn("alertsFirst", "Alerts first")} onClick={() => handlePreset("alertsFirst")}>Alerts first</button>
          <button style={presetBtn("weekFirst", "Week first")} onClick={() => handlePreset("weekFirst")}>Week first</button>
        </div>
      </div>

      {order.map(sectionId => sectionRenderers[sectionId]?.())}
    </PageContainer>
  );
}
