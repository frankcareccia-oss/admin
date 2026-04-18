/**
 * MerchantLeaderboard.jsx — Break room / TV display
 *
 * Large numbers, minimal text. Auto-refreshes.
 * Route: /merchant/leaderboard
 */

import React from "react";
import { color } from "../theme";
import { merchantGetDashboard } from "../api/client";

const C = {
  bg: "#0B2A33",
  card: "#163842",
  teal: "#1D9E75",
  white: "#fff",
  muted: "rgba(255,255,255,0.4)",
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  green: "#66BB6A",
  red: "#EF5350",
};

const s = {
  page: { minHeight: "100vh", background: C.bg, padding: "30px", color: C.white },
  header: { textAlign: "center", marginBottom: 30 },
  brand: { fontSize: 14, color: C.muted, textTransform: "uppercase", letterSpacing: "2px" },
  title: { fontSize: 28, fontWeight: 700, marginTop: 4 },

  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 30 },
  stat: { background: C.card, borderRadius: 20, padding: "24px", textAlign: "center" },
  statValue: { fontSize: 48, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 10, textTransform: "uppercase", letterSpacing: "1px" },

  streakCard: {
    background: `linear-gradient(135deg, ${C.card}, #1a4a56)`,
    borderRadius: 20, padding: "24px 30px", textAlign: "center", marginBottom: 30,
    border: `1px solid rgba(255,255,255,0.1)`,
  },
  streakValue: { fontSize: 64, fontWeight: 700, color: C.teal },
  streakLabel: { fontSize: 14, color: C.muted, marginTop: 8 },

  promoRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 30 },
  promoCard: { background: C.card, borderRadius: 20, padding: "20px" },
  promoLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 },
  promoValue: { fontSize: 24, fontWeight: 600 },

  footer: { textAlign: "center", color: C.muted, fontSize: 12, marginTop: 20 },
};

export default function MerchantLeaderboard() {
  const [data, setData] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const d = await merchantGetDashboard({ period: "7d" });
      setData(d);
    } catch {}
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Auto-refresh every 2 minutes
  React.useEffect(() => {
    const timer = setInterval(load, 120000);
    return () => clearInterval(timer);
  }, [load]);

  const kpis = data?.kpis || {};
  const engagement = data?.engagement || {};
  const promos = data?.promotions || [];

  const totalVisits = kpis.totalTransactions?.value || 0;
  const attributionRate = kpis.attributionRate?.value || 0;
  const rewardsRedeemed = kpis.rewardsRedeemed?.value || 0;
  const newEnrollments = kpis.newEnrollments?.value || 0;

  // Streak logic — days above 70% attribution
  const ts = data?.timeSeries || [];
  let streak = 0;
  for (let i = ts.length - 1; i >= 0; i--) {
    if (ts[i].attributionRate >= 70) streak++;
    else break;
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.brand}>PerkValet</div>
        <div style={s.title}>{data?.store?.name || "Team Dashboard"}</div>
      </div>

      {/* Main Stats */}
      <div style={s.statsRow}>
        <div style={s.stat}>
          <div style={{ ...s.statValue, color: C.teal }}>{attributionRate}%</div>
          <div style={s.statLabel}>Attribution This Week</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statValue, color: C.white }}>{totalVisits}</div>
          <div style={s.statLabel}>Total Visits</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statValue, color: C.gold }}>{rewardsRedeemed}</div>
          <div style={s.statLabel}>Rewards Redeemed</div>
        </div>
        <div style={s.stat}>
          <div style={{ ...s.statValue, color: C.green }}>{newEnrollments}</div>
          <div style={s.statLabel}>New Members</div>
        </div>
      </div>

      {/* Streak */}
      <div style={s.streakCard}>
        <div style={s.streakValue}>{streak}</div>
        <div style={s.streakLabel}>
          {streak > 0
            ? `consecutive day${streak > 1 ? "s" : ""} above 70% attribution — keep it going!`
            : "Let's start a streak — aim for 70% attribution today!"
          }
        </div>
      </div>

      {/* Active Promos */}
      <div style={s.promoRow}>
        {promos.filter(p => p.status === "active").slice(0, 2).map(p => (
          <div key={p.promotionId} style={s.promoCard}>
            <div style={s.promoLabel}>Active Program</div>
            <div style={s.promoValue}>{p.name}</div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
              {p.totalEnrolled} enrolled · {p.rewardsRedeemed} redeemed this week
            </div>
          </div>
        ))}
      </div>

      {/* Stamp Progress Snapshot */}
      {engagement.stampProgress && (
        <div style={{ ...s.streakCard, padding: "16px 24px" }}>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>Customer Progress</div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.muted }}>{engagement.stampProgress.progress0to25 + engagement.stampProgress.progress25to50}</div>
              <div style={{ fontSize: 10, color: C.muted }}>Getting Started</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.teal }}>{engagement.stampProgress.progress50to75 + engagement.stampProgress.progress75to100}</div>
              <div style={{ fontSize: 10, color: C.muted }}>Almost There</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.gold }}>{engagement.stampProgress.rewardReady}</div>
              <div style={{ fontSize: 10, color: C.gold }}>Reward Ready!</div>
            </div>
          </div>
        </div>
      )}

      <div style={s.footer}>
        Auto-refreshes every 2 minutes · Powered by PerkValet
      </div>
    </div>
  );
}
