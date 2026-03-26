/**
 * Module: admin/src/pages/MerchantDetail.jsx
 *
 * Merchant Detail page (pv_admin)
 *
 * Responsibilities:
 *  - Load merchant detail
 *  - Display merchant overview/status
 *  - Allow pv_admin to update merchant status
 *  - Navigate back to merchant list after successful status save
 *
 * Notes:
 *  - Fixes stale list-state issue after status mutation
 *  - Fixes status form layout so Save button does not overlap reason input
 *  - Preserves existing layout/tabs/store section behavior
 */

import React from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getMerchant, updateMerchantStatus } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SectionTabs from "../components/layout/SectionTabs";

export default function MerchantDetail() {
  const { merchantId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [merchant, setMerchant] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const [newStatus, setNewStatus] = React.useState("active");
  const [statusReason, setStatusReason] = React.useState("");

  const storesRef = React.useRef(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const m = await getMerchant(merchantId);
      setMerchant(m);
      setNewStatus(m?.status || "active");
      setStatusReason(m?.statusReason || "");
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
    setBusy(true);
    try {
      await updateMerchantStatus(merchantId, {
        status: newStatus,
        statusReason: statusReason || undefined,
      });
      navigate("/merchants");
    } catch (e2) {
      setErr(e2?.message || "Failed to update merchant status");
    } finally {
      setBusy(false);
    }
  }

  function scrollToStores() {
    try {
      storesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <PageContainer size="page">
        <div style={{ padding: 16 }}>Loading...</div>
      </PageContainer>
    );
  }

  if (err && !merchant) {
    return (
      <PageContainer size="page">
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,0,0,0.06)",
            border: "1px solid rgba(255,0,0,0.15)",
            color: "crimson",
          }}
        >
          {err}
        </div>
      </PageContainer>
    );
  }

  if (!merchant) {
    return (
      <PageContainer size="page">
        <div style={{ padding: 16 }}>Merchant not loaded</div>
      </PageContainer>
    );
  }

  const storesCount = (merchant.stores || []).length;

  const path = location.pathname || "";
  const overviewPath = `/merchants/${merchant.id}`;
  const teamPath = `/merchants/${merchant.id}/users`;
  const invoicesPath = `/merchants/${merchant.id}/invoices`;
  const billingPolicyPath = `/admin/merchants/${merchant.id}/billing-policy`;

  const overviewActive = path === overviewPath;
  const teamActive = path === teamPath;
  const invoicesActive = path === invoicesPath;

  return (
    <PageContainer size="page">
      <div style={{ marginBottom: 10 }}>
        <Link to="/merchants" style={{ textDecoration: "none" }}>
          Back to Merchants
        </Link>
      </div>

      <PageHeader
        title={merchant.name}
        subtitle={
          <span>
            Status: <code>{merchant.status}</code>
          </span>
        }
        right={
          <button onClick={load} disabled={busy} style={styles.refreshBtn}>
            Refresh
          </button>
        }
      >
        <SectionTabs
          title="Sections"
          items={[
            {
              key: "overview",
              label: "Overview",
              to: overviewPath,
              active: overviewActive,
            },
            {
              key: "team",
              label: "Team",
              to: teamPath,
              active: teamActive,
            },
            {
              key: "invoices",
              label: "Invoices",
              to: invoicesPath,
              active: invoicesActive,
            },
            {
              key: "stores",
              label: "Stores",
              onClick: scrollToStores,
              count: storesCount,
              active: false,
            },
            {
              key: "billing",
              label: "Billing Policy",
              to: billingPolicyPath,
              active: path === billingPolicyPath,
            },
          ]}
        />
      </PageHeader>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Status</div>

        <form onSubmit={onSaveStatus} style={styles.statusForm}>
          <div style={styles.statusField}>
            <label style={styles.label}>Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              disabled={busy}
              style={styles.select}
            >
              <option value="active">active</option>
              <option value="suspended">suspended</option>
              <option value="archived">archived</option>
            </select>
          </div>

          <div style={styles.reasonField}>
            <label style={styles.label}>Status reason (optional)</label>
            <input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              disabled={busy}
              placeholder="e.g. Past due, Contract ended, etc."
              style={styles.input}
            />
          </div>

          <div style={styles.saveCell}>
            <button type="submit" disabled={busy} style={styles.saveBtn}>
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </form>

        {err ? (
          <div style={styles.errBox}>
            {err}
          </div>
        ) : null}
      </div>

      <div ref={storesRef} style={styles.storesCard}>
        <div style={styles.storesHeader}>
          <div style={{ fontWeight: 800 }}>Stores</div>
          <div style={{ color: "rgba(0,0,0,0.6)" }}>
            ({storesCount} store{storesCount === 1 ? "" : "s"})
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>ID</th>
                <th style={th}>Name</th>
                <th style={th}>City</th>
                <th style={th}>State</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(merchant.stores || []).map((s) => (
                <tr key={s.id}>
                  <td style={td}>{s.id}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                      {s.address1 || ""}
                    </div>
                  </td>
                  <td style={td}>{s.city || ""}</td>
                  <td style={td}>{s.state || ""}</td>
                  <td style={td}>
                    <Link to={`/stores/${s.id}`} style={{ textDecoration: "none" }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}

              {storesCount === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    No stores for this merchant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.tip}>
        Tip: Use <b>Billing Policy</b> to apply merchant-specific grace days, late fee amounts, or default net terms.
        <br />
        Tip: Use the <b>Invoices</b> tab to create and manage invoices for this merchant without selecting Merchant ID.
      </div>
    </PageContainer>
  );
}

const styles = {
  refreshBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },

  card: {
    marginTop: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  cardTitle: {
    fontWeight: 800,
    marginBottom: 10,
  },

  statusForm: {
    display: "grid",
    gridTemplateColumns: "180px minmax(260px, 1fr) 120px",
    gap: 12,
    alignItems: "end",
  },
  statusField: {
    minWidth: 0,
  },
  reasonField: {
    minWidth: 0,
  },
  saveCell: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "end",
  },

  label: {
    display: "block",
    fontSize: 12,
    color: "rgba(0,0,0,0.65)",
    marginBottom: 6,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
  },
  input: {
    width: "100%",
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    boxSizing: "border-box",
  },
  saveBtn: {
    width: "100%",
    minWidth: 96,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  errBox: {
    marginTop: 10,
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },

  storesCard: {
    marginTop: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    overflow: "hidden",
    background: "white",
  },
  storesHeader: {
    padding: 12,
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    display: "flex",
    gap: 10,
    alignItems: "baseline",
  },

  tip: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(0,0,0,0.55)",
  },
};

const th = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const td = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};