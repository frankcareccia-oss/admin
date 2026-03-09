// src/components/layout/PageContainer.jsx
import React from "react";

/**
 * Global layout container for PerkValet admin UI
 *
 * Centralizes page width rules so individual pages
 * do NOT hardcode widths.
 *
 * Layout sizes:
 * form  = 720px   (data entry screens)
 * page  = 1200px  (standard admin pages)
 * wide  = 1400px  (dashboards / multi-panel layouts)
 */

export default function PageContainer({ size = "page", children, style = {} }) {
  let maxWidth;

  switch (size) {
    case "form":
      maxWidth = 720;
      break;

    case "wide":
      maxWidth = 1400;
      break;

    default:
      maxWidth = 1200;
  }

  const containerStyle = {
    width: "100%",
    maxWidth,
    margin: "0 auto",
    padding: "24px 20px 40px",
    boxSizing: "border-box",
    ...style,
  };

  return <div style={containerStyle}>{children}</div>;
}