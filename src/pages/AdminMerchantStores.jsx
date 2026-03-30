/**
 * Module: admin/src/pages/AdminMerchantStores.jsx
 *
 * Stores tab for a merchant (pv_admin).
 * Shows create store form and store list.
 */

import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getMerchant, createStore } from "../api/client";

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

function buildTabs(merchantId, pathname) {
  const base = `/merchants/${merchantId}`;
  return [
    { key: "overview",       label: "Overview",       to: base,                                        active: pathname === base },
    { key: "billing",        label: "Billing",        to: `${base}/billing`,                           active: pathname === `${base}/billing` },
    { key: "stores",         label: "Stores",         to: `${base}/stores`,                            active: pathname === `${base}/stores` },
    { key: "team",           label: "Team",           to: `${base}/users`,                             active: pathname === `${base}/users` },
    { key: "invoices",       label: "Invoices",       to: `${base}/invoices`,                          active: pathname === `${base}/invoices` },
    { key: "billingPolicy",  label: "Billing Policy", to: `/admin/merchants/${merchantId}/billing-policy`, active: pathname.startsWith(`/admin/merchants/${merchantId}/billing-policy`) },
  ];
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function validateStoreFields({ name, address1, city, state, postal }) {
  const errors = [];
  if (!name)     errors.push("Store name is required.");
  if (!address1) errors.push("Street address is required.");
  if (!city)     errors.push("City is required.");
  if (!state)    errors.push("State is required.");
  if (!postal)   errors.push("Zip code is required.");
  else if (!/^\d{5}(-\d{4})?$/.test(postal)) errors.push("Zip code must be 5 digits (or 5+4).");
  return errors;
}

export default function AdminMerchantStores() {
  const { merchantId } = useParams();
  const location = useLocation();

  const [merchant, setMerchant] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState("");

  const [storeName, setStoreName] = React.useState("");
  const [storeAddress1, setStoreAddress1] = React.useState("");
  const [storeCity, setStoreCity] = React.useState("");
  const [storeState, setStoreState] = React.useState("");
  const [storePostal, setStorePostal] = React.useState("");
  const [createBusy, setCreateBusy] = React.useState(false);
  const [createErr, setCreateErr] = React.useState("");
  const [createOk, setCreateOk] = React.useState("");

  async function load() {
    setLoading(true);
    setLoadErr("");
    try {
      const m = await getMerchant(merchantId);
      setMerchant(m);
    } catch (e) {
      setLoadErr(e?.message || "Failed to load merchant");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  function resetForm() {
    setStoreName(""); setStoreAddress1(""); setStoreCity("");
    setStoreState(""); setStorePostal("");
  }

  async function onCreateStore(e) {
    e.preventDefault();
    setCreateErr(""); setCreateOk("");

    const name     = storeName.trim();
    const address1 = storeAddress1.trim();
    const city     = storeCity.trim();
    const state    = storeState.trim().toUpperCase();
    const postal   = storePostal.trim();

    const errors = validateStoreFields({ name, address1, city, state, postal });
    if (errors.length > 0) { setCreateErr(errors.join("\n")); return; }

    setCreateBusy(true);
    try {
      await createStore({ merchantId: Number(merchantId), name, address1, city, state, postal });
      setCreateOk("Store created.");
      resetForm();
      await load();
    } catch (e2) {
      setCreateErr(e2?.message || "Failed to create store");
    } finally {
      setCreateBusy(false);
    }
  }

  if (loading) {
    return <PageContainer size="page"><div style={{ padding: 16 }}>Loading…</div></PageContainer>;
  }

  if (loadErr && !merchant) {
    return (
      <PageContainer size="page">
        <div style={styles.errBox}>{loadErr}</div>
      </PageContainer>
    );
  }

  const stores = merchant?.stores || [];
  const tabs = buildTabs(merchantId, location.pathname);

  return (
    <PageContainer size="page">
      <div style={{ marginBottom: 10 }}>
        <Link to="/merchants" style={{ textDecoration: "none" }}>Back to Merchants</Link>
      </div>

      <PageHeader
        title={merchant?.name || `Merchant ${merchantId}`}
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
          <button onClick={load} disabled={createBusy} style={styles.refreshBtn}>Refresh</button>
        }
      >
        <SectionTabs title="Sections" items={tabs} />
      </PageHeader>

      {/* Create Store */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Add Store Location</div>
        <form onSubmit={onCreateStore}>
          <div style={styles.formGrid}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.label}>Store name</label>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={createBusy}
                placeholder="e.g. Acme - Danville"
                style={styles.input}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={styles.label}>Street address</label>
              <input
                value={storeAddress1}
                onChange={(e) => setStoreAddress1(e.target.value)}
                disabled={createBusy}
                placeholder="123 Main St"
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>City</label>
              <input
                value={storeCity}
                onChange={(e) => setStoreCity(e.target.value)}
                disabled={createBusy}
                placeholder="Danville"
                style={styles.input}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={styles.label}>State</label>
                <select
                  value={storeState}
                  onChange={(e) => setStoreState(e.target.value)}
                  disabled={createBusy}
                  style={styles.input}
                >
                  <option value="">Select…</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>Zip code</label>
                <input
                  value={storePostal}
                  onChange={(e) => setStorePostal(e.target.value)}
                  disabled={createBusy}
                  placeholder="94526"
                  maxLength={10}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {createErr && <div style={{ ...styles.errBox, marginTop: 10 }}>{createErr}</div>}
          {createOk  && <div style={{ ...styles.okBox,  marginTop: 10 }}>{createOk}</div>}

          <div style={styles.formActions}>
            <button type="submit" disabled={createBusy} style={styles.saveBtn}>
              {createBusy ? "Creating…" : "Create Store"}
            </button>
          </div>
        </form>
      </div>

      {/* Store list */}
      <div style={styles.storesCard}>
        <div style={styles.storesHeader}>
          <div style={{ fontWeight: 800 }}>Store Locations</div>
          <div style={{ color: "rgba(0,0,0,0.6)" }}>
            ({stores.length} store{stores.length === 1 ? "" : "s"})
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
                <th style={th}>Status</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.id}>
                  <td style={td}>{s.id}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{s.address1 || ""}</div>
                  </td>
                  <td style={td}>{s.city || ""}</td>
                  <td style={td}>{s.state || ""}</td>
                  <td style={td}><StatusBadge status={s.status || "active"} /></td>
                  <td style={td}>
                    <Link to={`/merchants/${merchantId}/stores/${s.id}`} style={{ textDecoration: "none", fontWeight: 700 }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    No stores yet. Use the form above to add the first location.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
  cardTitle: { fontWeight: 800, marginBottom: 14 },
  label: {
    display: "block", fontSize: 12,
    color: "rgba(0,0,0,0.65)", marginBottom: 6,
  },
  input: {
    width: "100%", minWidth: 0, padding: "10px 12px",
    borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)",
    boxSizing: "border-box", fontSize: 14,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  formActions: {
    display: "flex", justifyContent: "flex-end", marginTop: 14,
  },
  saveBtn: {
    padding: "10px 24px", borderRadius: 10,
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
  storesCard: {
    marginTop: 16, border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14, overflow: "hidden", background: "white",
  },
  storesHeader: {
    padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)",
    display: "flex", gap: 10, alignItems: "baseline",
  },
};

const th = { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" };
const td = { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.06)" };
