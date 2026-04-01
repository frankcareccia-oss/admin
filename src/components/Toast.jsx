import React from "react";
import { color } from "../theme";

export default function Toast({ message, type = "success", onClose, ms = 2500 }) {
  React.useEffect(() => {
    const t = setTimeout(() => onClose?.(), ms);
    return () => clearTimeout(t);
  }, [onClose, ms]);

  const isSuccess = type === "success";

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
        padding: "12px 16px",
        borderRadius: 12,
        minWidth: 240,
        background: isSuccess ? "#f6ffed" : "#fff1f0",
        border: isSuccess ? "1px solid #52c41a" : "1px solid #ff4d4f",
        color: color.text,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
      }}
    >
      <div style={{ fontSize: 18, lineHeight: 1 }}>{isSuccess ? "✓" : "⚠"}</div>
      <div style={{ flex: 1 }}>{message}</div>
      <button
        type="button"
        onClick={() => onClose?.()}
        aria-label="Close notification"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          opacity: 0.65,
        }}
      >
        ×
      </button>
    </div>
  );
}
