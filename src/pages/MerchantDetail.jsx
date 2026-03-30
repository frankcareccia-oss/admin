/**
 * Module: admin/src/pages/MerchantDetail.jsx
 *
 * Overview tab for a merchant (pv_admin).
 *
 * Responsibilities:
 *  - Merchant status management
 *  - Read-only owner/contact summary
 */

import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getMerchant, updateMerchantStatus, adminListMerchantUsers } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SectionTabs from "../components/layout/SectionTabs";

const STATUS_COLORS = {
  active:    { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  suspended: { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  archived:  { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.50)",  border: "1px solid rgba(0,0,0,0.12)" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.archived;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function buildTabs(merchantId, pathname) {
  const base = `/merchants/${merchantId}`;
  return [
    { key: "overview",      label: "Overview",       to: base,                                            active: pathname === base },
    { key: "billing",       label: "Billing",        to: `${base}/billing`,                               active: pathname === `${base}/billing` },
    { key: "stores",        label: "Stores",         to: `${base}/stores`,                                active: pathname === `${base}/stores` },
    { key: "team",          label: "Team",           to: `${base}/users`,                                 active: pathname === `${base}/users` },
    { key: "invoices",      label: "Invoices",       to: `${base}/invoices`,                              active: pathname === `${base}/invoices` },
    { key: "billingPolicy", label: "Billing Policy", to: `/admin/merchants/${merchantId}/billing-policy`, active: pathname.startsWith(`/admin/merchants/${merchantId}/billing-policy`) },
  ];
}

export default function MerchantDetail() {
  const { merchantId } = useParams();
  const location = useLocation();

  const [merchant, setMerchant] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [saveOk, setSaveOk] = React.useState("");

  const [newStatus, setNewStatus] = React.useState("active");
  const [statusReason, setStatusReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [mResult, uResult] = await Promise.allSettled([
        getMerchant(merchantId),
        adminListMerchantUsers(merchantId),
      ]);

      if (mResult.status === "fulfilled") {
        const m = mResult.value;
        setMerchant(m);
        setNewStatus(m?.status || "active");
        setStatusReason(m?.statusReason || "");
      } else {
        throw new Error(mResult.reason?.message || "Failed to load merchant");
      }

      if (uResult.status === "fulfilled") {
        setUsers(uResult.value?.users || []);
      }
    } catch (e) {
      setErr(e?.message || "Failed to load merchant");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  async function onSaveStatus(e) {
    e.preventDefault();
    setErr("");
    setSaveOk("");
    setBusy(true);
    try {
      await updateMerchantStatus(merchantId, {
        status: newStatus,
        statusReason: statusReason || undefined,
      });
      // Reload to reflect new status in header
      await load();
      setSaveOk("Status updated.");
    } catch (e2) {
      setErr(e2?.message || "Failed to update merchant status");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <PageContainer size="page"><div style={{ padding: 16 }}>Loading…</div></PageContainer>;
  }

  if (err && !merchant) {
    return (
      <PageContainer size="page">
        <div style={styles.errBox}>{err}</div>
      </PageContainer>
    );
  }

  if (!merchant) {
    return <PageContainer size="page"><div style={{ padding: 16 }}>Merchant not loaded</div></PageContainer>;
  }

  const tabs = buildTabs(merchantId, location.pathname);

  // Owner contact: prefer merchant_admin, fall back to first user
  const ownerUser =
    users.find((u) => u.role === "owner") ||
    users.find((u) => u.role === "merchant_admin") ||
    users[0] ||
    null;

  const otherContacts = users.filter((u) => u !== ownerUser);

  return (
    <PageContainer size="page">
      <div style={{ marginBottom: 10 }}>
        <Link to="/merchants" style={{ textDecoration: "none" }}>Back to Merchants</Link>
      </div>

      <PageHeader
        title={merchant.name}
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge status={merchant.status} />
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
              ID: {merchant.id}
              {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
            </span>
          </span>
        }
        right={
          <button onClick={load} disabled={busy} style={styles.refreshBtn}>Refresh</button>
        }
      >
        <SectionTabs title="Sections" items={tabs} />
      </PageHeader>

      {/* Status */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Merchant Status</div>
        <form onSubmit={onSaveStatus} style={styles.statusForm}>
          <div>
            <label style={styles.label}>Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              disabled={busy}
              style={styles.input}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>Status reason (optional)</label>
            <input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              disabled={busy}
              placeholder="e.g. Past due, Contract ended"
              style={styles.input}
            />
          </div>
          <div style={styles.saveCell}>
            <button type="submit" disabled={busy} style={styles.saveBtn}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
        {err    && <div style={{ ...styles.errBox, marginTop: 10 }}>{err}</div>}
        {saveOk && <div style={{ ...styles.okBox,  marginTop: 10 }}>{saveOk}</div>}
      </div>

      {/* Owner / Contact */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={styles.cardTitle}>Business Contact</div>
          <Link to={`/merchants/${merchantId}/users`} style={styles.manageLink}>
            Manage Team →
          </Link>
        </div>

        {!ownerUser && (
          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.5)" }}>
            No users on this merchant yet.{" "}
            <Link to={`/merchants/${merchantId}/users`} style={{ textDecoration: "none" }}>Add one →</Link>
          </div>
        )}

        {ownerUser && (
          <>
            <div style={styles.contactCard}>
              <div style={styles.contactBadge}>{ownerUser.role}</div>
              <div style={styles.contactName}>
                {[ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(" ") || <span style={styles.empty}>Name not set</span>}
              </div>
              <div style={styles.contactRow}>{ownerUser.email}</div>
              {ownerUser.phone && <div style={styles.contactRow}>{formatPhone(ownerUser.phone)}</div>}
            </div>

            {otherContacts.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.sectionLabel}>Additional contacts</div>
                <div style={styles.otherGrid}>
                  {otherContacts.slice(0, 4).map((u) => (
                    <div key={u.id || u.userId} style={styles.otherCard}>
                      <div style={styles.otherBadge}>{u.role}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                      </div>
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") && (
                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{u.email}</div>
                      )}
                    </div>
                  ))}
                </div>
                {otherContacts.length > 4 && (
                  <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", marginTop: 6 }}>
                    +{otherContacts.length - 4} more —{" "}
                    <Link to={`/merchants/${merchantId}/users`} style={{ textDecoration: "none" }}>view all</Link>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}

const styles = {
  refreshBtn: {
    padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 800,
  },
  card: {
    marginTop: 16, border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14, padding: 16, background: "white",
  },
  cardTitle: { fontWeight: 800, marginBottom: 10 },
  statusForm: {
    display: "grid",
    gridTemplateColumns: "180px minmax(240px, 1fr) 100px",
    gap: 12, alignItems: "end",
  },
  saveCell: { display: "flex", justifyContent: "flex-end", alignItems: "end" },
  label: {
    display: "block", fontSize: 12,
    color: "rgba(0,0,0,0.65)", marginBottom: 6,
  },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", boxSizing: "border-box", fontSize: 14,
  },
  saveBtn: {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 900,
  },
  errBox: {
    background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)",
    padding: 10, borderRadius: 12, whiteSpace: "pre-wrap",
  },
  okBox: {
    background: "rgba(0,128,0,0.06)", border: "1px solid rgba(0,128,0,0.18)",
    padding: 10, borderRadius: 12,
  },
  manageLink: {
    fontSize: 13, textDecoration: "none", fontWeight: 700,
    color: "rgba(0,0,150,0.7)",
  },
  contactCard: {
    border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12,
    padding: 14, background: "rgba(0,0,0,0.015)",
  },
  contactBadge: {
    display: "inline-block", fontSize: 11, fontWeight: 700,
    color: "rgba(0,0,100,0.65)", background: "rgba(0,0,200,0.07)",
    padding: "2px 8px", borderRadius: 6, marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.04em",
  },
  contactName: { fontWeight: 800, fontSize: 16, marginBottom: 4 },
  contactRow: { fontSize: 14, color: "rgba(0,0,0,0.7)", lineHeight: 1.5 },
  empty: { color: "rgba(0,0,0,0.35)", fontStyle: "italic", fontWeight: 400 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.5)",
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8,
  },
  otherGrid: {
    display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10,
  },
  otherCard: {
    border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10,
    padding: 10, background: "white",
  },
  otherBadge: {
    fontSize: 10, fontWeight: 700, color: "rgba(0,0,100,0.5)",
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4,
  },
};
