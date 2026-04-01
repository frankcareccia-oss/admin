/**
 * MerchantSetup.jsx
 *
 * Merchant profile, status management, and primary contact.
 * Moved here from MerchantDetail when hub-and-spoke nav was introduced.
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { getMerchant, updateMerchantStatus, adminListMerchantUsers } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";
import useBreakpoint from "../hooks/useBreakpoint";
import { color, btn, inputStyle as themeInput } from "../theme";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

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

export default function MerchantSetup() {
  const { merchantId } = useParams();
  const { isMobile } = useBreakpoint();

  const [merchant, setMerchant] = React.useState(null);
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [saveOk, setSaveOk] = React.useState("");
  const [newStatus, setNewStatus] = React.useState("active");
  const [statusReason, setStatusReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [lastError, setLastError] = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");

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
        setLastSuccessTs(new Date().toISOString());
        pvUiHook("merchant.setup.loaded", { merchantId, status: m?.status });
      } else {
        throw new Error(mResult.reason?.message || "Failed to load merchant");
      }
      if (uResult.status === "fulfilled") setUsers(uResult.value?.users || []);
    } catch (e) {
      const msg = e?.message || "Failed to load merchant";
      setErr(msg);
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [merchantId]);

  async function onSaveStatus(e) {
    e.preventDefault();
    setErr(""); setSaveOk(""); setBusy(true);
    pvUiHook("merchant.setup.status.submit", { merchantId, newStatus });
    try {
      await updateMerchantStatus(merchantId, { status: newStatus, statusReason: statusReason || undefined });
      await load();
      setSaveOk("Status updated.");
      pvUiHook("merchant.setup.status.success", { merchantId, newStatus });
    } catch (e2) {
      const msg = e2?.message || "Failed to update status";
      setErr(msg);
      setLastError(msg);
      pvUiHook("merchant.setup.status.error", { merchantId, error: msg });
    } finally {
      setBusy(false);
    }
  }

  const merchantName = merchant?.name || `Merchant ${merchantId}`;

  if (loading) return <PageContainer><div style={{ padding: 16 }}>Loading…</div></PageContainer>;
  if (err && !merchant) return <PageContainer><div style={styles.errBox}>{err}</div></PageContainer>;

  const ownerUser =
    users.find((u) => u.role === "owner") ||
    users.find((u) => u.role === "merchant_admin") ||
    users[0] || null;
  const otherContacts = users.filter((u) => u !== ownerUser);

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Setup</span>
      </div>

      <PageHeader
        title="Setup"
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge status={merchant.status} />
            <span style={{ fontSize: 12, color: color.textFaint }}>
              {merchantName} · ID: {merchant.id}
              {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
            </span>
          </span>
        }
        right={<button onClick={load} disabled={busy} style={styles.refreshBtn}>Refresh</button>}
      />

      {/* Status */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Merchant Status</div>
        <form onSubmit={onSaveStatus} style={{ ...styles.statusForm, gridTemplateColumns: isMobile ? "1fr" : "180px minmax(240px, 1fr) 100px" }}>
          <div>
            <label style={styles.label}>Status</label>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} disabled={busy} style={styles.input}>
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
            <button type="submit" disabled={busy} style={styles.saveBtn}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
        {err    && <div style={{ ...styles.errBox, marginTop: 10 }}>{err}</div>}
        {saveOk && <div style={{ ...styles.okBox,  marginTop: 10 }}>{saveOk}</div>}
      </div>

      {/* Contact */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={styles.cardTitle}>Business Contact</div>
          <Link to={`/merchants/${merchantId}/users`} style={styles.manageLink}>Manage Team →</Link>
        </div>

        {!ownerUser && (
          <div style={{ fontSize: 13, color: color.textMuted }}>
            No users yet.{" "}
            <Link to={`/merchants/${merchantId}/team`} style={{ textDecoration: "none" }}>Add one →</Link>
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
              <div style={{ fontSize: 12, color: color.textMuted, marginTop: 10 }}>
                +{otherContacts.length} more team member{otherContacts.length !== 1 ? "s" : ""} —{" "}
                <Link to={`/merchants/${merchantId}/users`} style={{ textDecoration: "none" }}>view all</Link>
              </div>
            )}
          </>
        )}
      </div>

      <SupportInfo context={{ page: "MerchantSetup", merchantId, lastError, lastSuccessTs }} />
    </PageContainer>
  );
}

const styles = {
  refreshBtn: { padding: "10px 12px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 800 },
  card: { marginTop: 16, border: `1px solid ${color.border}`, borderRadius: 14, padding: 16, background: color.cardBg },
  cardTitle: { fontWeight: 800, marginBottom: 10 },
  statusForm: { display: "grid", gridTemplateColumns: "180px minmax(240px, 1fr) 100px", gap: 12, alignItems: "end" },
  saveCell: { display: "flex", justifyContent: "flex-end", alignItems: "end" },
  label: { display: "block", fontSize: 12, color: color.textMuted, marginBottom: 6 },
  input: { ...themeInput },
  saveBtn: { width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 900 },
  errBox: { background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`, padding: 10, borderRadius: 12 },
  okBox: { background: "rgba(0,128,0,0.06)", border: "1px solid rgba(0,128,0,0.18)", padding: 10, borderRadius: 12 },
  manageLink: { fontSize: 13, textDecoration: "none", fontWeight: 700, color: color.primary },
  contactCard: { border: `1px solid ${color.borderSubtle}`, borderRadius: 12, padding: 14, background: "rgba(0,0,0,0.015)" },
  contactBadge: { display: "inline-block", fontSize: 11, fontWeight: 700, color: color.primary, background: color.primarySubtle, padding: "2px 8px", borderRadius: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" },
  contactName: { fontWeight: 800, fontSize: 16, marginBottom: 4 },
  contactRow: { fontSize: 14, color: color.textMuted, lineHeight: 1.5 },
  empty: { color: color.textFaint, fontStyle: "italic", fontWeight: 400 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 },
  otherGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  otherCard: { border: `1px solid ${color.borderSubtle}`, borderRadius: 10, padding: 10, background: color.cardBg },
  otherBadge: { fontSize: 10, fontWeight: 700, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 },
};
