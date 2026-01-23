// admin/src/components/layout/SectionTabs.jsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * SectionTabs
 * Props:
 * - title: string (default "Sections")
 * - items: array of
 *    { key, label, to?, onClick?, count?, active? }
 *   Exactly one of (to | onClick) is required per item.
 */
export default function SectionTabs({ title = "Sections", items = [] }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.title}>{title}</div>

      <div style={styles.panel}>
        <div style={styles.row}>
          {items.map((it) => {
            const pillStyle = it.active ? { ...styles.pill, ...styles.pillActive } : styles.pill;

            const content = (
              <>
                <span>{it.label}</span>
                {typeof it.count === "number" ? <span style={styles.count}>{it.count}</span> : null}
              </>
            );

            if (it.to) {
              return (
                <Link key={it.key} to={it.to} style={pillStyle}>
                  {content}
                </Link>
              );
            }

            return (
              <button
                key={it.key}
                type="button"
                onClick={it.onClick}
                style={pillStyle}
              >
                {content}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    marginTop: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(0,0,0,0.55)",
    marginBottom: 8,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  panel: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(0,0,0,0.03)",
    border: "1px solid rgba(0,0,0,0.10)",
  },
  row: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  pill: {
    textDecoration: "none",
    color: "inherit",
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    font: "inherit",
  },
  pillActive: {
    background: "rgba(0,0,0,0.08)",
    borderColor: "rgba(0,0,0,0.30)",
  },
  count: {
    display: "inline-flex",
    minWidth: 22,
    height: 20,
    padding: "0 6px",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(0,0,0,0.08)",
  },
};
