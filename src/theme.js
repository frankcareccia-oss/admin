/**
 * PerkValet Design Tokens
 * Source of truth: PerkValet Color Usage Contract (LOCKED)
 *
 * Do not introduce colors outside this file.
 * Do not use pure black (#000) or arbitrary greys for text.
 */

// ── Raw palette ────────────────────────────────────────────────
export const palette = {
  teal:        "#2F8F8B",
  tealHover:   "#277D79",
  navy:        "#0B2A33",
  navyMuted:   "#35545E",
  orange:      "#F36A1D",
  pageBg:      "#FEFCF7",
  white:       "#FFFFFF",
  inputBg:     "#F9FAFA",
};

// ── Semantic tokens ────────────────────────────────────────────
export const color = {
  // Text
  text:           palette.navy,
  textMuted:      "rgba(11,42,51,0.60)",
  textFaint:      "rgba(11,42,51,0.40)",
  textPlaceholder:"rgba(11,42,51,0.35)",

  // Surfaces
  pageBg:         palette.pageBg,
  cardBg:         palette.white,
  inputBg:        palette.inputBg,

  // Borders
  border:         "rgba(0,0,0,0.10)",
  borderSubtle:   "rgba(0,0,0,0.06)",
  borderInput:    "rgba(11,42,51,0.22)",

  // Primary — Teal
  primary:        palette.teal,
  primaryHover:   palette.tealHover,
  primarySubtle:  "rgba(47,143,139,0.10)",
  primaryBorder:  "rgba(47,143,139,0.30)",
  primaryFocus:   "rgba(47,143,139,0.45)",

  // Reward / Accent — Orange
  reward:         palette.orange,
  rewardSubtle:   "rgba(243,106,29,0.10)",
  rewardBorder:   "rgba(243,106,29,0.30)",

  // Status
  danger:         "rgba(180,0,0,1)",
  dangerSubtle:   "rgba(255,0,0,0.06)",
  dangerBorder:   "rgba(255,0,0,0.18)",
};

// ── Reusable button shapes ──────────────────────────────────────
// Usage: spread into inline style, add padding/width as needed.

export const btn = {
  // Primary action (Save, Register, Confirm)
  primary: {
    background: palette.teal,
    color:      palette.white,
    border:     "none",
    borderRadius: 14,
    fontWeight: 950,
    cursor:     "pointer",
  },
  primaryDisabled: {
    background: "rgba(47,143,139,0.18)",
    color:      "rgba(47,143,139,0.50)",
    border:     "none",
    borderRadius: 14,
    fontWeight: 950,
    cursor:     "not-allowed",
  },

  // Reward CTA — Orange (Grant Reward when earned, reward confirmation)
  reward: {
    background: palette.orange,
    color:      palette.white,
    border:     "none",
    borderRadius: 14,
    fontWeight: 950,
    cursor:     "pointer",
  },

  // Secondary — outlined
  secondary: {
    background: palette.white,
    color:      palette.navy,
    border:     "1px solid rgba(0,0,0,0.18)",
    borderRadius: 14,
    fontWeight: 900,
    cursor:     "pointer",
  },
  secondaryDisabled: {
    background: "rgba(0,0,0,0.02)",
    color:      "rgba(11,42,51,0.40)",
    border:     "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    fontWeight: 900,
    cursor:     "not-allowed",
  },

  // Pill — rounded secondary (nav, back buttons)
  pill: {
    background:   palette.white,
    color:        palette.navy,
    border:       "1px solid rgba(0,0,0,0.18)",
    borderRadius: 999,
    fontWeight:   850,
    cursor:       "pointer",
    textDecoration: "none",
  },

  // Ghost — very subtle
  ghost: {
    background: "rgba(0,0,0,0.02)",
    color:      palette.navy,
    border:     "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    fontWeight: 900,
    cursor:     "pointer",
  },

  // Danger
  danger: {
    background: "rgba(255,0,0,0.06)",
    color:      "rgba(180,0,0,1)",
    border:     "1px solid rgba(255,0,0,0.22)",
    borderRadius: 999,
    fontWeight: 950,
    cursor:     "pointer",
  },
};

// ── Card / panel ───────────────────────────────────────────────
export const surface = {
  card: {
    background:   palette.white,
    border:       "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
  },
  panel: {
    background:   palette.white,
    border:       "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
  },

  // Teal-tinted — confirmation / positive state
  tealSubtle: {
    background: "rgba(47,143,139,0.08)",
    border:     "1px solid rgba(47,143,139,0.28)",
    borderRadius: 14,
  },

  // Orange-tinted — reward moment
  rewardSubtle: {
    background: "rgba(243,106,29,0.09)",
    border:     "1px solid rgba(243,106,29,0.28)",
    borderRadius: 14,
  },

  // Error
  errorSubtle: {
    background: "rgba(255,0,0,0.05)",
    border:     "1px solid rgba(255,0,0,0.18)",
    borderRadius: 12,
  },
};

// ── Input ──────────────────────────────────────────────────────
export const inputStyle = {
  background:   palette.inputBg,
  border:       `1px solid ${color.borderInput}`,
  borderRadius: 10,
  outline:      "none",
  color:        palette.navy,
  fontSize:     14,
  padding:      "11px 12px",
  width:        "100%",
  boxSizing:    "border-box",
};
