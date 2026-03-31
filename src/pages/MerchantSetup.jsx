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
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 12 }}>
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
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
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
        <form onSubmit={onSaveStatus} style={styles.statusForm}>
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
          <Link to={`/merchants/${merchantId}/team`} style={styles.manageLink}>Manage Team →</Link>
        </div>

        {!ownerUser && (
          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.5)" }}>
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
                    <Link to={`/merchants/${merchantId}/team`} style={{ textDecoration: "none" }}>view all</Link>
                  </div>
                )}
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
  refreshBtn: { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", background: "white", cursor: "pointer", fontWeight: 800 },
  card: { marginTop: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 16, background: "white" },
  cardTitle: { fontWeight: 800, marginBottom: 10 },
  statusForm: { display: "grid", gridTemplateColumns: "180px minmax(240px, 1fr) 100px", gap: 12, alignItems: "end" },
  saveCell: { display: "flex", justifyContent: "flex-end", alignItems: "end" },
  label: { display: "block", fontSize: 12, color: "rgba(0,0,0,0.65)", marginBottom: 6 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", boxSizing: "border-box", fontSize: 14 },
  saveBtn: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)", background: "white", cursor: "pointer", fontWeight: 900 },
  errBox: { background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)", padding: 10, borderRadius: 12 },
  okBox: { background: "rgba(0,128,0,0.06)", border: "1px solid rgba(0,128,0,0.18)", padding: 10, borderRadius: 12 },
  manageLink: { fontSize: 13, textDecoration: "none", fontWeight: 700, color: "rgba(0,0,150,0.7)" },
  contactCard: { border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, padding: 14, background: "rgba(0,0,0,0.015)" },
  contactBadge: { display: "inline-block", fontSize: 11, fontWeight: 700, color: "rgba(0,0,100,0.65)", background: "rgba(0,0,200,0.07)", padding: "2px 8px", borderRadius: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" },
  contactName: { fontWeight: 800, fontSize: 16, marginBottom: 4 },
  contactRow: { fontSize: 14, color: "rgba(0,0,0,0.7)", lineHeight: 1.5 },
  empty: { color: "rgba(0,0,0,0.35)", fontStyle: "italic", fontWeight: 400 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "rgba(0,0,0,0.5)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 },
  otherGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
  otherCard: { border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 10, background: "white" },
  otherBadge: { fontSize: 10, fontWeight: 700, color: "rgba(0,0,100,0.5)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 },
};
