/**
 * SuggestionBanner.jsx
 *
 * Dismissible quick-start panel shown to merchant owners/admins when they have a
 * merchantType set. Surfaces two pre-written suggestions for a given entity type
 * (products, promotions, or bundles) and pre-fills the create form on selection.
 *
 * Props:
 *   merchantType  {string}   — value from MERCHANT_TYPE_OPTIONS
 *   entityType    {string}   — "products" | "promotions" | "bundles"
 *   onFill        {function} — called with the selected suggestion object
 */

import React from "react";
import { color } from "../theme";
import { getSuggestions } from "../config/merchantSuggestions";
import { MERCHANT_TYPE_LABELS } from "../config/merchantTypes";

function lsKey(entityType) {
  return `perkvalet_suggestion_dismissed_${entityType}`;
}
function wasDismissed(entityType) {
  try { return localStorage.getItem(lsKey(entityType)) === "1"; } catch { return false; }
}
function saveDismissed(entityType) {
  try { localStorage.setItem(lsKey(entityType), "1"); } catch {}
}

function subtext(entityType, s) {
  if (entityType === "products")   return s.description;
  if (entityType === "promotions") return `${s.threshold} visits → ${s.rewardNote}`;
  if (entityType === "bundles")    return `Prepaid pack · $${s.price}`;
  return "";
}

export default function SuggestionBanner({ merchantType, entityType, onFill }) {
  const [selected, setSelected] = React.useState(0);
  const [visible, setVisible]   = React.useState(() => !wasDismissed(entityType));

  const suggestions = getSuggestions(merchantType, entityType);

  if (!visible || !suggestions) return null;

  function handleUse() {
    onFill(suggestions[selected]);
    saveDismissed(entityType);
    setVisible(false);
  }

  function handleSkip() {
    saveDismissed(entityType);
    setVisible(false);
  }

  const typeLabel = MERCHANT_TYPE_LABELS[merchantType] || merchantType;

  return (
    <div style={{
      border: `1px solid ${color.primaryBorder}`,
      borderRadius: 14,
      padding: "16px 18px",
      background: color.primarySubtle,
      marginBottom: 16,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: color.text, marginBottom: 3 }}>
        Quick start
      </div>
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 14 }}>
        Popular starting points for {typeLabel} businesses. Pick one to pre-fill the form — you can edit before saving.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {suggestions.map((s, i) => (
          <label
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${selected === i ? color.primaryBorder : color.border}`,
              background: selected === i ? "rgba(47,143,139,0.06)" : color.cardBg,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="radio"
              name={`pv_suggestion_${entityType}`}
              checked={selected === i}
              onChange={() => setSelected(i)}
              style={{ marginTop: 3, accentColor: color.primary }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: color.text }}>{s.name}</div>
              <div style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>
                {subtext(entityType, s)}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          onClick={handleUse}
          style={{
            padding: "8px 18px",
            borderRadius: 10,
            border: "none",
            background: color.primary,
            color: "#fff",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Use this suggestion
        </button>
        <button
          type="button"
          onClick={handleSkip}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: `1px solid ${color.border}`,
            background: color.cardBg,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            color: color.textMuted,
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
