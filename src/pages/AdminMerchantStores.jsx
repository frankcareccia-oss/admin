/**
 * Module: admin/src/pages/AdminMerchantStores.jsx
 *
 * Stores tab for a merchant (pv_admin).
 * Shows create store form and store list.
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { getMerchant, createStore } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { color, btn, inputStyle as themeInput } from "../theme";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never break UI for logging
  }
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

  const [merchant, setMerchant] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState("");

  const [addOpen, setAddOpen] = React.useState(false);
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
    pvUiHook("admin.merchant.stores.load_started.ui", {
      stable: "admin:merchant:stores:list", merchantId: Number(merchantId),
    });
    try {
      const m = await getMerchant(merchantId);
      setMerchant(m);
      pvUiHook("admin.merchant.stores.load_succeeded.ui", {
        stable: "admin:merchant:stores:list",
        merchantId: Number(merchantId),
        storeCount: m?.stores?.length ?? 0,
      });
    } catch (e) {
      setLoadErr(e?.message || "Failed to load merchant");
      pvUiHook("admin.merchant.stores.load_failed.ui", {
        stable: "admin:merchant:stores:list",
        merchantId: Number(merchantId),
        error: e?.message,
      });
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
    if (errors.length > 0) {
      setCreateErr(errors.join("\n"));
      pvUiHook("admin.merchant.stores.create_validation_failed.ui", {
        stable: "admin:merchant:stores:create",
        merchantId: Number(merchantId),
        errors,
      });
      return;
    }

    setCreateBusy(true);
    pvUiHook("admin.merchant.stores.create_started.ui", {
      stable: "admin:merchant:stores:create", merchantId: Number(merchantId),
    });
    try {
      const created = await createStore({ merchantId: Number(merchantId), name, address1, city, state, postal });
      setCreateOk("Store created.");
      resetForm();
      setAddOpen(false);
      pvUiHook("admin.merchant.stores.create_succeeded.ui", {
        stable: "admin:merchant:stores:create",
        merchantId: Number(merchantId),
        storeId: created?.id ?? null,
      });
      await load();
    } catch (e2) {
      setCreateErr(e2?.message || "Failed to create store");
      pvUiHook("admin.merchant.stores.create_failed.ui", {
        stable: "admin:merchant:stores:create",
        merchantId: Number(merchantId),
        error: e2?.message,
      });
    } finally {
      setCreateBusy(false);
    }
  }

  if (loading) {
    return <PageContainer size="page"><div style={{ padding: 16 }}>Loading...</div></PageContainer>;
  }

  if (loadErr && !merchant) {
    return (
      <PageContainer size="page">
        <div style={styles.errBox}>{loadErr}</div>
      </PageContainer>
    );
  }

  const merchantName = merchant?.name || `Merchant ${merchantId}`;
  const stores = merchant?.stores || [];

  return (
    <PageContainer size="page">
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Stores</span>
      </div>

      <PageHeader
        title="Stores"
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge status={merchant.status} />
            <span style={{ fontSize: 12, color: color.textMuted }}>
              {merchantName}
              {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
            </span>
          </span>
        }
        right={
          <button onClick={() => { pvUiHook("admin.merchant.stores.refresh_clicked.ui", { stable: "admin:merchant:stores:list", merchantId: Number(merchantId) }); load(); }} disabled={createBusy} style={styles.refreshBtn}>Refresh</button>
        }
      />

      {/* Add Store Location — collapsible */}
      <div style={{
        ...styles.card,
        ...(addOpen ? { border: "1.5px solid rgba(0,80,200,0.35)", boxShadow: "0 2px 12px rgba(0,80,200,0.10)" } : {}),
      }}>
        <button
          type="button"
          onClick={() => {
            const next = !addOpen;
            setAddOpen(next);
            setCreateErr("");
            setCreateOk("");
            pvUiHook("admin.merchant.stores.add_toggle.ui", {
              stable: "admin:merchant:stores:add_form",
              merchantId: Number(merchantId),
              open: next,
            });
          }}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%" }}
        >
          <span style={{ fontWeight: 900 }}>Add Store Location</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: color.textMuted }}>
            {addOpen ? "Hide" : "Show"}
          </span>
        </button>

        {addOpen && (
          <form onSubmit={onCreateStore} style={{ marginTop: 16 }}>
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
                    <option value="">Select...</option>
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
                {createBusy ? "Creating..." : "Create Store"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Store list */}
      <div style={styles.storesCard}>
        <div style={styles.storesHeader}>
          <div style={{ fontWeight: 800 }}>Store Locations</div>
          <div style={{ color: color.textMuted }}>
            ({stores.length} store{stores.length === 1 ? "" : "s"})
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "6%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
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
                    <div style={{ fontSize: 12, color: color.textMuted }}>{s.address1 || ""}</div>
                  </td>
                  <td style={td}>{s.city || ""}</td>
                  <td style={td}>{s.state || ""}</td>
                  <td style={td}><StatusBadge status={s.status || "active"} /></td>
                  <td style={td}>
                    <Link to={`/merchants/${merchantId}/stores/${s.id}`} style={{ textDecoration: "none", fontWeight: 700 }}>
                      View &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: color.textMuted }}>
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
    border: `1px solid ${color.border}`, background: color.cardBg,
    cursor: "pointer", fontWeight: 800, color: color.text,
  },
  card: {
    marginTop: 16, border: `1px solid ${color.border}`,
    borderRadius: 14, padding: 16, background: color.cardBg,
  },
  label: {
    display: "block", fontSize: 12,
    color: color.textMuted, marginBottom: 6,
  },
  input: {
    ...themeInput,
    minWidth: 0,
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
    ...btn.primary,
  },
  errBox: {
    background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`,
    padding: 10, borderRadius: 12, whiteSpace: "pre-wrap", color: color.danger,
  },
  okBox: {
    background: "rgba(0,128,0,0.06)", border: "1px solid rgba(0,128,0,0.18)",
    padding: 10, borderRadius: 12,
  },
  storesCard: {
    marginTop: 16, border: `1px solid ${color.border}`,
    borderRadius: 14, overflow: "hidden", background: color.cardBg,
  },
  storesHeader: {
    padding: "14px 16px", borderBottom: `1px solid ${color.borderSubtle}`,
    display: "flex", gap: 10, alignItems: "baseline",
  },
};

const th = { padding: "10px 12px", borderBottom: `1px solid ${color.borderSubtle}`, fontSize: 13, color: color.textMuted, fontWeight: 700 };
const td = { padding: "10px 12px", borderBottom: `1px solid ${color.borderSubtle}`, verticalAlign: "middle" };
