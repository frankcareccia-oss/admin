// src/pages/Settings/AdminKey.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import { color, btn } from "../../theme";

/**
 * Admin API Key page (legacy).
 *
 * Security-V1 uses email device verification for pv_admin sessions.
 * Admin API keys may still be used for scripts/automation, but the UI no longer
 * requires users to manage them during normal sign-in.
 */
export default function AdminKey() {
  const [show, setShow] = React.useState(false);

  // Keep route for now, but steer humans back to Merchants.
  if (!show) {
    return (
      <PageContainer>
        <PageHeader
          title="Admin Key (legacy)"
          subtitle="PerkValet admin access now uses email device verification during sign-in."
        />
        <div style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 12, color: color.textMuted, lineHeight: 1.45 }}>
            If you were sent here by an old link or bookmark, go back to Merchants.
          </div>

          <button
            type="button"
            onClick={() => setShow(true)}
            style={{
              ...btn.secondary,
              padding: "10px 12px",
              borderRadius: 12,
              cursor: "pointer",
              fontWeight: 800,
            }}
            title="Only needed for scripts/automation; not required for normal UI sign-in"
          >
            I still need this page (advanced)
          </button>

          <div style={{ marginTop: 12 }}>
            <a href="/merchants" style={{ textDecoration: "none", fontWeight: 800 }}>
              ← Back to Merchants
            </a>
          </div>
        </div>
      </PageContainer>
    );
  }

  // If they really want it, keep the old settings page available by navigating to the original route handler
  // In this trimmed replacement, we simply redirect back; if you want the full legacy UI back,
  // restore the previous module.
  return <Navigate to="/merchants" replace />;
}
