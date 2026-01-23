// src/components/layout/PageHeader.jsx
import React from "react";

/**
 * Minimal PageHeader component (compat layer).
 * Keeps older pages working after layout refactors.
 *
 * Props:
 * - title: string
 * - subtitle: string (optional)
 * - right: ReactNode (optional)  // actions on the right
 * - children: ReactNode (optional) // extra content under subtitle
 */
export default function PageHeader({ title, subtitle, right, children }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ color: "rgba(0,0,0,0.65)", marginTop: 4 }}>
            {subtitle}
          </div>
        ) : null}
        {children ? <div style={{ marginTop: 8 }}>{children}</div> : null}
      </div>

      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  );
}
