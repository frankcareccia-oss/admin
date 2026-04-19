/**
 * GuidanceCard.jsx — Inline, dismissible writing guidance
 *
 * Shows contextual tips above creation forms. Dismissed state persisted
 * in localStorage. Always recoverable via "? Writing tips" link.
 */

import React from "react";
import { color } from "../theme";

const STORAGE_KEY_PREFIX = "pv_guidance_dismissed_";

const GUIDANCE = {
  product: {
    title: "What makes a great product description?",
    content: (
      <>
        <p style={{ margin: "0 0 8px", lineHeight: 1.6 }}>
          A great product description makes someone taste it before they order.
          Lead with the sensory experience — the smell, the warmth, the texture — not just the ingredients.
        </p>
        <div style={{ background: "rgba(0,0,0,0.03)", borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: 12 }}>
          <div style={{ color: "#999", marginBottom: 2 }}>Instead of:</div>
          <div style={{ color: "#666" }}>"Coffee drink with milk"</div>
          <div style={{ color: "#1D9E75", marginTop: 6, marginBottom: 2 }}>Try:</div>
          <div style={{ color: "#333" }}>"Warm milk and espresso, smooth and rich — the coffee that turns a morning into a ritual."</div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
          The "Write for me" button generates a draft. Edit it to sound like you, not like a menu template.
        </p>
      </>
    ),
  },
  promotion: {
    title: "Writing promotion descriptions that work",
    content: (
      <>
        <p style={{ margin: "0 0 6px", lineHeight: 1.6, fontWeight: 600 }}>
          Product descriptions sell the thing.<br />
          Promotion descriptions sell the journey.
        </p>
        <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
          Your goal: make joining feel like a no-brainer. Not a transaction — a good decision.
        </p>
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: "#1D9E75" }}>Stamp programs</strong> — tap the habit<br />
            <span style={{ color: "#666" }}>"Every visit gets you one step closer to a $5 reward. Just 8 stamps — that's your morning routine working for you."</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: "#1D9E75" }}>Bundles</strong> — value + convenience<br />
            <span style={{ color: "#666" }}>"Your morning essentials, bundled. A bold drip coffee and a fresh-baked croissant — grab both and earn toward your next reward faster."</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: "#1D9E75" }}>$ off promos</strong> — make the math effortless<br />
            <span style={{ color: "#666" }}>"Earn $5 off after just 8 visits. That's less than two weeks of your morning coffee run."</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ color: "#1D9E75" }}>Time-based</strong> — sell the moment, not the schedule<br />
            <span style={{ color: "#666" }}>"Tuesday mornings just got better. Double stamps before 10am — same coffee, twice the progress."</span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
          The "Write for me" button generates two versions — reward-led and experience-led. Pick the one that sounds like your place.
        </p>
      </>
    ),
  },
};

export default function GuidanceCard({ type }) {
  const storageKey = STORAGE_KEY_PREFIX + type;
  const [visible, setVisible] = React.useState(() => {
    try { return localStorage.getItem(storageKey) !== "true"; } catch { return true; }
  });

  const guidance = GUIDANCE[type];
  if (!guidance) return null;

  const handleDismiss = () => {
    setVisible(false);
    try { localStorage.setItem(storageKey, "true"); } catch { /* ok */ }
  };

  if (!visible) {
    return (
      <div style={{ textAlign: "right", marginBottom: 6 }}>
        <button
          onClick={() => setVisible(true)}
          style={{
            fontSize: 11, color: "#1D9E75", background: "none",
            border: "none", cursor: "pointer", fontWeight: 600,
          }}
        >
          ? Writing tips
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: "#F8FDFB",
      border: "0.5px solid #9FE1CB",
      borderRadius: 10,
      padding: "14px 16px",
      marginBottom: 16,
      position: "relative",
      fontSize: 13,
      color: "#333",
    }}>
      <button
        onClick={handleDismiss}
        style={{
          position: "absolute", top: 10, right: 12,
          fontSize: 11, color: "#888780", background: "none",
          border: "none", cursor: "pointer",
        }}
      >
        Got it — don't show again
      </button>
      <div style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 15 }}>&#128161;</span> {guidance.title}
      </div>
      {guidance.content}
    </div>
  );
}
