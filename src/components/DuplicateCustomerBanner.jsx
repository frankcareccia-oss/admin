/**
 * DuplicateCustomerBanner.jsx
 *
 * Shows a warning banner on the merchant dashboard when duplicate
 * Square customers are detected (same phone number).
 * Associate can resolve or dismiss each alert.
 */

import React from "react";
import { color, btn } from "../theme";
import {
  merchantListDuplicateAlerts,
  merchantResolveDuplicateAlert,
} from "../api/client";

const s = {
  banner: {
    background: "#FFF8F0",
    border: `1px solid ${color.rewardBorder}`,
    borderRadius: 12,
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: color.text,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    background: color.reward,
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 999,
    padding: "2px 8px",
    minWidth: 18,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: color.textMuted,
    lineHeight: 1.5,
  },
  alertCard: {
    background: "#fff",
    border: `1px solid ${color.border}`,
    borderRadius: 10,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  phone: {
    fontSize: 14,
    fontWeight: 600,
    color: color.text,
  },
  customerList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  customerRow: {
    fontSize: 13,
    color: color.textMuted,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  dot: (i) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: i === 0 ? color.primary : color.reward,
    flexShrink: 0,
  }),
  actions: {
    display: "flex",
    gap: 8,
    marginTop: 4,
  },
  resolveBtn: {
    ...btn.primary,
    fontSize: 12,
    padding: "6px 14px",
    borderRadius: 8,
  },
  dismissBtn: {
    background: "none",
    border: `1px solid ${color.border}`,
    color: color.textMuted,
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },
  processingBtn: {
    fontSize: 12,
    padding: "6px 14px",
    borderRadius: 8,
    background: "rgba(0,0,0,0.04)",
    border: `1px solid ${color.borderSubtle}`,
    color: color.textFaint,
    cursor: "not-allowed",
  },
};

function AlertCard({ alert, onResolve, onDismiss, processing }) {
  const customers = alert.squareCustomerIds || [];
  return (
    <div style={s.alertCard}>
      <div style={s.phone}>{alert.phoneE164}</div>
      <div style={s.customerList}>
        {customers.map((c, i) => (
          <div key={c.id} style={s.customerRow}>
            <div style={s.dot(i)} />
            <span style={{ fontWeight: i === 0 ? 600 : 400 }}>{c.name}</span>
            {i === 0 && (
              <span style={{ fontSize: 11, color: color.primary, fontWeight: 600 }}>
                (original)
              </span>
            )}
            {i > 0 && (
              <span style={{ fontSize: 11, color: color.reward, fontWeight: 600 }}>
                (duplicate)
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={s.actions}>
        {processing ? (
          <button style={s.processingBtn} disabled>Updating...</button>
        ) : (
          <>
            <button style={s.resolveBtn} onClick={() => onResolve(alert.id)}>
              Resolved
            </button>
            <button style={s.dismissBtn} onClick={() => onDismiss(alert.id)}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DuplicateCustomerBanner() {
  const [alerts, setAlerts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    merchantListDuplicateAlerts()
      .then((data) => {
        if (!cancelled) setAlerts(data.alerts || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleAction(alertId, status) {
    setProcessing(alertId);
    setError(null);
    try {
      await merchantResolveDuplicateAlert(alertId, status);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e) {
      const msg = e?.message || "Failed to merge customers";
      setError(msg);
      console.error("Failed to update alert:", msg);
    } finally {
      setProcessing(null);
    }
  }

  if (loading || alerts.length === 0) return null;

  return (
    <div style={s.banner}>
      <div style={s.headerRow}>
        <div style={s.title}>
          Duplicate Customers Detected
          <span style={s.badge}>{alerts.length}</span>
        </div>
      </div>
      <div style={s.subtitle}>
        These customers have duplicate entries in your Square directory with the same phone number.
        Merge them in{" "}
        <a href="https://squareup.com/dashboard/customers" target="_blank" rel="noopener noreferrer"
          style={{ color: color.primary, fontWeight: 600 }}>
          Square Dashboard → Customers
        </a>
        , then click "Resolved".
      </div>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#b91c1c" }}>
          {error}
        </div>
      )}
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          onResolve={(id) => handleAction(id, "resolved")}
          onDismiss={(id) => handleAction(id, "dismissed")}
          processing={processing === alert.id}
        />
      ))}
    </div>
  );
}
