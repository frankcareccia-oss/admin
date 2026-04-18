/**
 * MerchantAssociateDisplay.jsx — Counter-friendly associate view
 *
 * Glanceable in 2 seconds. Shows:
 * - Today's active promotion (what to say)
 * - Shift attribution rate
 * - Personal capture count today
 * - Milestone alert
 *
 * Route: /merchant/associate
 */

import React from "react";
import { color } from "../theme";
import { merchantGetDashboard } from "../api/client";

const C = {
  bg: "#0B2A33",
  card: "#163842",
  teal: "#1D9E75",
  white: "#fff",
  muted: "rgba(255,255,255,0.5)",
  amber: "#FFB300",
  green: "#66BB6A",
};

const s = {
  page: { minHeight: "100vh", background: C.bg, padding: "20px", color: C.white, fontFamily: "inherit" },
  header: { textAlign: "center", marginBottom: 24 },
  storeName: { fontSize: 14, color: C.muted, textTransform: "uppercase", letterSpacing: "1px" },
  time: { fontSize: 36, fontWeight: 200, marginTop: 4 },

  kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 },
  kpiCard: { background: C.card, borderRadius: 16, padding: "20px", textAlign: "center" },
  kpiValue: { fontSize: 42, fontWeight: 700, lineHeight: 1 },
  kpiLabel: { fontSize: 12, color: C.muted, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.5px" },

  promoCard: { background: C.card, borderRadius: 16, padding: "20px", marginBottom: 12 },
  promoLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 },
  promoName: { fontSize: 18, fontWeight: 600 },
  promoScript: { fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 1.5, fontStyle: "italic" },

  alertCard: { background: C.amber, borderRadius: 16, padding: "16px 20px", marginBottom: 12, color: "#000" },
  alertText: { fontSize: 15, fontWeight: 600, lineHeight: 1.4 },

  refreshBtn: {
    position: "fixed", bottom: 20, right: 20,
    width: 48, height: 48, borderRadius: "50%",
    background: C.teal, color: C.white, border: "none",
    fontSize: 20, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center",
  },
};

export default function MerchantAssociateDisplay() {
  const [data, setData] = React.useState(null);
  const [time, setTime] = React.useState(new Date());
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const d = await merchantGetDashboard({ period: "7d" });
      setData(d);
    } catch {}
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Update clock every minute
  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh every 5 minutes
  React.useEffect(() => {
    const timer = setInterval(load, 300000);
    return () => clearInterval(timer);
  }, [load]);

  const kpis = data?.kpis || {};
  const promos = data?.promotions || [];
  const activePromo = promos.find(p => p.status === "active");
  const todayTs = data?.timeSeries?.slice(-1)?.[0];

  const attributionRate = todayTs?.attributionRate || kpis.attributionRate?.value || 0;
  const todayVisits = todayTs?.totalTransactions || 0;
  const todayAttributed = todayTs?.attributedTransactions || 0;

  const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.storeName}>{data?.store?.name || "Your Store"}</div>
        <div style={s.time}>{timeStr}</div>
      </div>

      {/* KPIs */}
      <div style={s.kpiRow}>
        <div style={s.kpiCard}>
          <div style={{ ...s.kpiValue, color: C.teal }}>{attributionRate}%</div>
          <div style={s.kpiLabel}>Attribution Rate</div>
        </div>
        <div style={s.kpiCard}>
          <div style={{ ...s.kpiValue, color: C.green }}>{todayAttributed}/{todayVisits}</div>
          <div style={s.kpiLabel}>Captured Today</div>
        </div>
      </div>

      {/* Active Promo */}
      {activePromo && (
        <div style={s.promoCard}>
          <div style={s.promoLabel}>Today's Program</div>
          <div style={s.promoName}>{activePromo.name}</div>
          <div style={s.promoScript}>
            "Have you joined our loyalty program? I just need your phone number — takes 3 seconds."
          </div>
        </div>
      )}

      {/* Milestone Alert */}
      {data?.engagement?.stampProgress?.rewardReady > 0 && (
        <div style={s.alertCard}>
          <div style={s.alertText}>
            🎉 {data.engagement.stampProgress.rewardReady} customer{data.engagement.stampProgress.rewardReady > 1 ? "s" : ""} may be hitting a reward today — make it a moment!
          </div>
        </div>
      )}

      {/* Attribution goal */}
      <div style={s.promoCard}>
        <div style={s.promoLabel}>Team Goal</div>
        <div style={{ fontSize: 16 }}>
          {attributionRate >= 70
            ? `Great job! ${attributionRate}% — above the 70% target.`
            : `${attributionRate}% — let's push for 70%. Ask every customer for their phone number!`
          }
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Loading...</div>}

      <button style={s.refreshBtn} onClick={load} title="Refresh">↻</button>
    </div>
  );
}
