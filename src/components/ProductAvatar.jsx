/**
 * ProductAvatar.jsx
 *
 * Displays a product image if imageUrl is set, otherwise a colored
 * placeholder showing the product's initials (up to 2 chars).
 *
 * The placeholder color is deterministic — same product name always
 * gets the same color — so it looks intentional on the POS tile grid.
 *
 * Props:
 *   name      string   — product name (used for initials + color)
 *   imageUrl  string?  — optional image URL
 *   size      number   — width/height in px (default 48)
 *   radius    number   — border radius in px (default 10)
 */

import React from "react";
import { palette } from "../theme";

const PALETTE = [
  "#3B7DD8", // blue
  "#2EAB6E", // green
  "#E07C2A", // orange
  "#9B59B6", // purple
  "#E84393", // pink
  "#16A085", // teal
  "#C0392B", // red
  "#7F8C8D", // slate
  "#D4AC0D", // amber
  "#1A6B4A", // forest
];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name) {
  const words = String(name || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function ProductAvatar({ name = "", imageUrl, size = 48, radius = 10 }) {
  const [imgError, setImgError] = React.useState(false);

  // Reset error state when imageUrl changes
  const prevUrl = React.useRef(imageUrl);
  if (prevUrl.current !== imageUrl) {
    prevUrl.current = imageUrl;
    if (imgError) setImgError(false);
  }

  const showImage = imageUrl && !imgError;
  const bg = colorForName(name);
  const fontSize = Math.round(size * 0.36);

  const base = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  };

  if (showImage) {
    return (
      <div style={base}>
        <img
          src={imageUrl}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  // URL was provided but failed to load — show broken indicator
  if (imageUrl && imgError) {
    return (
      <div
        style={{ ...base, background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.25)" }}
        title="Image failed to load — check the URL is a direct image link"
      >
        <span style={{ fontSize: Math.round(size * 0.45), lineHeight: 1, userSelect: "none" }}>🖼️</span>
      </div>
    );
  }

  // No URL — show initials placeholder
  return (
    <div style={{ ...base, background: bg }}>
      <span style={{ color: palette.white, fontWeight: 800, fontSize, letterSpacing: "0.02em", userSelect: "none" }}>
        {initials(name)}
      </span>
    </div>
  );
}
