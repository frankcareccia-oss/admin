// src/components/layout/PageContainer.jsx
import React from "react";
import useBreakpoint from "../../hooks/useBreakpoint";

/**
 * Global layout container for PerkValet admin UI.
 *
 * Centralizes page width + padding rules so individual pages
 * do NOT hardcode widths.
 *
 * Layout sizes:
 *   form    = 720px   (data entry screens)
 *   page    = 1200px  (standard admin pages)
 *   wide    = 1400px  (dashboards / multi-panel layouts)
 *
 * Padding scales with viewport:
 *   mobile  → 16px horizontal, 16px top
 *   tablet  → 20px horizontal, 20px top
 *   desktop → 24px horizontal, 24px top
 */

export default function PageContainer({ size = "page", children, style = {} }) {
  const { isMobile, isTablet } = useBreakpoint();

  let maxWidth;
  switch (size) {
    case "form":  maxWidth = 720;  break;
    case "wide":  maxWidth = 1400; break;
    default:      maxWidth = 1200;
  }

  const hPad = isMobile ? 12 : isTablet ? 16 : 20;
  const vPad = isMobile ? 16 : 24;

  const containerStyle = {
    width: "100%",
    maxWidth,
    margin: "0 auto",
    padding: `${vPad}px ${hPad}px 40px`,
    boxSizing: "border-box",
    ...style,
  };

  return <div style={containerStyle}>{children}</div>;
}
