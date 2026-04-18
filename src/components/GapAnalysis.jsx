/**
 * GapAnalysis.jsx — Before/after comparison of POS vs PerkValet capabilities
 *
 * Shows: "What you have" (existing POS promotions/discounts)
 *        "What PerkValet adds" (features not available in POS alone)
 *
 * Used in onboarding flow and as standalone merchant view.
 */

import React from "react";
import { color } from "../theme";
import { ingestPosPromotions } from "../api/client";

const C = {
  teal: "#1D9E75",
  navy: color.navy || "#0B2A33",
  muted: "#999",
  border: "#E5E5E0",
  greenBg: "#F0FDF4",
  greenBorder: "#BBF7D0",
  blueBg: "#EFF6FF",
  blueBorder: "#BFDBFE",
};

const s = {
  container: { maxWidth: 700, margin: "0 auto" },
  title: { fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 16 },
  subtitle: { fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 },
  sectionDot: (c) => ({ width: 10, height: 10, borderRadius: "50%", background: c }),

  card: (borderColor) => ({
    background: "#fff", borderRadius: 10, padding: "14px 16px", marginBottom: 8,
    borderLeft: `4px solid ${borderColor}`, border: `1px solid ${C.border}`,
  }),
  cardTitle: { fontSize: 14, fontWeight: 600, color: C.navy },
  cardSource: { fontSize: 11, color: C.muted, marginTop: 2 },
  cardDetail: { fontSize: 13, color: C.navy, marginTop: 6, lineHeight: 1.5 },
  cardChanges: { fontSize: 12, color: C.teal, marginTop: 4, fontStyle: "italic" },

  featureCard: {
    background: C.greenBg, borderRadius: 10, padding: "12px 16px", marginBottom: 8,
    borderLeft: `4px solid ${C.teal}`,
  },
  featureName: { fontSize: 14, fontWeight: 600, color: C.navy },
  featureDesc: { fontSize: 13, color: C.muted, marginTop: 2 },

  emptyState: { textAlign: "center", color: C.muted, padding: "24px", fontSize: 14, lineHeight: 1.6, background: C.blueBg, borderRadius: 10, border: `1px solid ${C.blueBorder}` },

  loading: { textAlign: "center", padding: 40, color: C.muted },
};

const SOURCE_LABELS = {
  square_loyalty: "Square Loyalty",
  square_catalog: "Square Catalog",
  clover_discount: "Clover Discount",
};

export default function GapAnalysis({ data: preloadedData }) {
  const [data, setData] = React.useState(preloadedData || null);
  const [loading, setLoading] = React.useState(!preloadedData);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (preloadedData) return;
    setLoading(true);
    ingestPosPromotions()
      .then(d => setData(d))
      .catch(e => setError(e?.message || "Could not load POS data"))
      .finally(() => setLoading(false));
  }, [preloadedData]);

  if (loading) return <div style={s.loading}>Scanning your POS for existing promotions...</div>;
  if (error) return <div style={{ ...s.loading, color: "#C62828" }}>{error}</div>;
  if (!data) return null;

  const { ingested, gapAnalysis, pvPromotions } = data;
  const hasExisting = (ingested?.posPromotions?.length || 0) + (ingested?.posDiscounts?.length || 0) > 0;

  return (
    <div style={s.container}>
      <div style={s.title}>Your Loyalty & Promotions</div>
      <div style={s.subtitle}>
        Here's what we found on your POS account, and what PerkValet adds on top.
      </div>

      {/* What You Have */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <div style={s.sectionDot("#1565C0")} />
          What you have today
        </div>

        {!hasExisting && (
          <div style={s.emptyState}>
            No existing loyalty programs or discounts found on your POS.
            This is actually great news — PerkValet will be your first loyalty program, with no migration needed!
          </div>
        )}

        {ingested?.posPromotions?.map((promo, i) => (
          <div key={`promo-${i}`} style={s.card("#1565C0")}>
            <div style={s.cardTitle}>{promo.name}</div>
            <div style={s.cardSource}>{SOURCE_LABELS[promo.source] || promo.source}</div>
            {promo.description && <div style={s.cardDetail}>{promo.description}</div>}
            <div style={s.cardChanges}>
              {promo.mechanic === "stamps"
                ? "✓ PerkValet handles this the same way — visit-based stamps"
                : "PerkValet uses visit-based stamps. Your spend-based points will be converted to visit tracking."}
            </div>
          </div>
        ))}

        {ingested?.posDiscounts?.map((disc, i) => (
          <div key={`disc-${i}`} style={s.card("#F57C00")}>
            <div style={s.cardTitle}>{disc.name}</div>
            <div style={s.cardSource}>{SOURCE_LABELS[disc.source] || disc.source}</div>
            <div style={s.cardDetail}>
              {disc.percentage ? `${disc.percentage}% off` : disc.amountCents ? `$${(disc.amountCents / 100).toFixed(2)} off` : "Discount"}
            </div>
            <div style={s.cardChanges}>
              ✓ Can be used as a reward in PerkValet — applied automatically at checkout
            </div>
          </div>
        ))}
      </div>

      {/* What PV Adds */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <div style={s.sectionDot(C.teal)} />
          What PerkValet adds
        </div>

        {gapAnalysis?.whatPvAdds?.map((feature, i) => (
          <div key={i} style={s.featureCard}>
            <div style={s.featureName}>{feature.feature}</div>
            <div style={s.featureDesc}>{feature.description}</div>
          </div>
        ))}
      </div>

      {/* Existing PV Promotions */}
      {pvPromotions?.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>
            <div style={s.sectionDot(C.teal)} />
            Already set up in PerkValet
          </div>
          {pvPromotions.map(p => (
            <div key={p.id} style={s.card(C.teal)}>
              <div style={s.cardTitle}>{p.name}</div>
              <div style={s.cardSource}>
                {p.status === "active" ? "✓ Active" : p.status === "draft" ? "Draft" : p.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
