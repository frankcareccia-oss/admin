// src/components/layout/PageContainer.jsx
import React from "react";

export default function PageContainer({ size = "page", children }) {
  const maxWidth =
    size === "form" ? 560 :
    size === "wide" ? 1200 :
    980;

  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding: "18px 22px 34px",
      }}
    >
      {children}
    </div>
  );
}
