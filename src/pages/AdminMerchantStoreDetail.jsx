// admin/src/pages/AdminMerchantStoreDetail.jsx
// Read + edit store detail page for pv_admin accessed via /merchants/:merchantId/stores/:storeId

import React from "react";
import { Link, useParams } from "react-router-dom";
import { getStore, updateStore } from "../api/client";
import PageContainer from "../components/layout/PageContainer";

function validateStoreFields({ name, address1, city, state, postal }) {
  const errors = [];
  if (!name)     errors.push("Store name is required.");
  if (!address1) errors.push("Street address is required.");
  if (!city)     errors.push("City is required.");
  if (!state)    errors.push("State is required.");
  if (postal && !/^\d{5}(-\d{4})?$/.test(postal)) errors.push("Zip code must be 5 digits (or 5+4).");
  return errors;
}

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never throw
  }
}

const COLORS = {
  primary: "#2F8F8B",
  text: "#0B2A33",
  neutral: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.10)",
};

const card = {
  marginTop: 16,
  padding: 20,
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "#FFFFFF",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const labelStyle = { fontSize: 12, fontWeight: 800, color: COLORS.neutral, marginBottom: 4 };
const valueStyle = { fontSize: 14, fontWeight: 700, color: COLORS.text };
const fieldWrap = { minWidth: 180, flex: "1 1 180px" };

const statusPill = (status) => ({
  display: "inline-block",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: status === "active" ? "rgba(47,143,139,0.10)" : "rgba(0,0,0,0.06)",
  border: status === "active" ? "1px solid rgba(47,143,139,0.30)" : "1px solid rgba(0,0,0,0.12)",
  color: status === "active" ? "#1a6e6a" : COLORS.neutral,
});

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND",
  "OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

export default function AdminMerchantStoreDetail() {
  const { merchantId, storeId } = useParams();

  const [store, setStore] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // Edit form state
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editAddress1, setEditAddress1] = React.useState("");
  const [editCity, setEditCity] = React.useState("");
  const [editState, setEditState] = React.useState("");
  const [editPostal, setEditPostal] = React.useState("");
  const [saveBusy, setSaveBusy] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState("");
  const [saveOk, setSaveOk] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      pvUiHook("admin.merchant.store.detail.load_started.ui", {
        stable: "admin:merchant:store:detail",
        storeId: Number(storeId),
        merchantId: Number(merchantId),
      });

      try {
        const data = await getStore(storeId);
        if (!cancelled) {
          setStore(data);
          setEditName(data.name || "");
          setEditAddress1(data.address1 || "");
          setEditCity(data.city || "");
          setEditState(data.state || "");
          setEditPostal(data.postal || "");
        }
        pvUiHook("admin.merchant.store.detail.load_succeeded.ui", {
          stable: "admin:merchant:store:detail",
          storeId: Number(storeId),
        });
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load store");
        pvUiHook("admin.merchant.store.detail.load_failed.ui", {
          stable: "admin:merchant:store:detail",
          storeId: Number(storeId),
          error: e?.message,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [storeId, merchantId]);

  function startEdit() {
    setSaveErr("");
    setSaveOk("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveErr("");
    setSaveOk("");
    // Reset fields to current store values
    setEditName(store?.name || "");
    setEditAddress1(store?.address1 || "");
    setEditCity(store?.city || "");
    setEditState(store?.state || "");
    setEditPostal(store?.postal || "");
  }

  async function onSave(e) {
    e.preventDefault();
    setSaveErr("");
    setSaveOk("");

    const name = String(editName || "").trim();
    const address1 = String(editAddress1 || "").trim();
    const city = String(editCity || "").trim();
    const state = String(editState || "").trim();
    const postal = String(editPostal || "").trim();

    const errors = validateStoreFields({ name, address1, city, state, postal });
    if (errors.length > 0) { setSaveErr(errors.join("\n")); return; }

    setSaveBusy(true);
    pvUiHook("admin.merchant.store.detail.save_started.ui", {
      stable: "admin:merchant:store:detail",
      storeId: Number(storeId),
    });

    try {
      const updated = await updateStore(Number(storeId), { name, address1, city, state, postal: postal || null });
      setStore(updated);
      setEditing(false);
      setSaveOk("Store updated.");
      pvUiHook("admin.merchant.store.detail.save_succeeded.ui", {
        stable: "admin:merchant:store:detail",
        storeId: Number(storeId),
      });
    } catch (e) {
      setSaveErr(e?.message || "Failed to save store");
      pvUiHook("admin.merchant.store.detail.save_failed.ui", {
        stable: "admin:merchant:store:detail",
        storeId: Number(storeId),
        error: e?.message,
      });
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link to="/merchants" style={{ textDecoration: "none", fontWeight: 800, color: COLORS.primary }}>
          Merchants
        </Link>
        <span style={{ margin: "0 6px", color: COLORS.neutral }}>/</span>
        <Link to={`/merchants/${merchantId}`} style={{ textDecoration: "none", fontWeight: 800, color: COLORS.primary }}>
          {store?.merchant?.name || `Merchant #${merchantId}`}
        </Link>
        <span style={{ margin: "0 6px", color: COLORS.neutral }}>/</span>
        <span style={{ color: COLORS.neutral }}>{store?.name || `Store #${storeId}`}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ margin: 0, color: COLORS.text }}>
          {loading ? `Store #${storeId}` : (store?.name || `Store #${storeId}`)}
        </h2>
        {!loading && store && !editing && (
          <button
            onClick={startEdit}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "#fff",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              color: COLORS.text,
            }}
          >
            Edit
          </button>
        )}
      </div>
      <div style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 8 }}>
        Store detail — pv_admin
      </div>

      {err ? (
        <div style={{ borderRadius: 12, border: "1px solid rgba(255,0,0,0.15)", background: "rgba(255,0,0,0.06)", padding: "12px 16px", marginTop: 16 }}>
          <span style={{ fontSize: 13, color: "rgba(180,0,0,0.85)" }}>{err}</span>
        </div>
      ) : null}

      {saveOk && !editing ? (
        <div style={{ borderRadius: 12, border: "1px solid rgba(0,128,0,0.18)", background: "rgba(0,128,0,0.06)", padding: "12px 16px", marginTop: 16 }}>
          <span style={{ fontSize: 13, color: "rgba(0,100,0,0.85)" }}>{saveOk}</span>
        </div>
      ) : null}

      {loading ? (
        <div style={{ ...card, color: COLORS.neutral, fontSize: 13 }}>Loading…</div>
      ) : null}

      {!loading && store ? (
        <>
          {/* Store Info — view or edit */}
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 15, color: COLORS.text }}>
              Store Information
            </div>

            {editing ? (
              <form onSubmit={onSave}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 16 }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={labelStyle}>Store Name</div>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={saveBusy}
                      placeholder="Store name"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Address</div>
                    <input
                      value={editAddress1}
                      onChange={(e) => setEditAddress1(e.target.value)}
                      disabled={saveBusy}
                      placeholder="123 Main St"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>City</div>
                    <input
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      disabled={saveBusy}
                      placeholder="City"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>State</div>
                    <select
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      disabled={saveBusy}
                      style={inputStyle}
                    >
                      <option value="">Select a state…</option>
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>Zip code</div>
                    <input
                      value={editPostal}
                      onChange={(e) => setEditPostal(e.target.value)}
                      disabled={saveBusy}
                      placeholder="e.g. 94526"
                      maxLength={10}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {saveErr ? (
                  <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)", fontSize: 13, color: "rgba(180,0,0,0.85)" }}>
                    {saveErr}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saveBusy}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.18)",
                      background: "#fff",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: "pointer",
                      color: COLORS.text,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveBusy}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 999,
                      border: "none",
                      background: COLORS.primary,
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: saveBusy ? "not-allowed" : "pointer",
                      opacity: saveBusy ? 0.7 : 1,
                    }}
                  >
                    {saveBusy ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 16 }}>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>Store Name</div>
                    <div style={valueStyle}>{store.name}</div>
                  </div>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>Status</div>
                    <div><span style={statusPill(store.status)}>{store.status}</span></div>
                  </div>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>Store ID</div>
                    <div style={{ ...valueStyle, fontFamily: "monospace", fontSize: 12 }}>{store.id}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>Address</div>
                    <div style={valueStyle}>{store.address1 || "—"}</div>
                  </div>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>City</div>
                    <div style={valueStyle}>{store.city || "—"}</div>
                  </div>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>State</div>
                    <div style={valueStyle}>{store.state || "—"}</div>
                  </div>
                  <div style={fieldWrap}>
                    <div style={labelStyle}>Zip code</div>
                    <div style={valueStyle}>{store.postal || "—"}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Merchant Info */}
          {store.merchant ? (
            <div style={card}>
              <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 15, color: COLORS.text }}>
                Merchant
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                <div style={fieldWrap}>
                  <div style={labelStyle}>Merchant Name</div>
                  <div style={valueStyle}>{store.merchant.name}</div>
                </div>
                <div style={fieldWrap}>
                  <div style={labelStyle}>Merchant ID</div>
                  <div style={{ ...valueStyle, fontFamily: "monospace", fontSize: 12 }}>{store.merchant.id}</div>
                </div>
                <div style={fieldWrap}>
                  <div style={labelStyle}>Merchant Status</div>
                  <div><span style={statusPill(store.merchant.status)}>{store.merchant.status}</span></div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Timestamps */}
          <div style={card}>
            <div style={{ fontWeight: 800, marginBottom: 16, fontSize: 15, color: COLORS.text }}>
              Timestamps
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              <div style={fieldWrap}>
                <div style={labelStyle}>Created</div>
                <div style={valueStyle}>{store.createdAt ? new Date(store.createdAt).toLocaleString() : "—"}</div>
              </div>
              <div style={fieldWrap}>
                <div style={labelStyle}>Last Updated</div>
                <div style={valueStyle}>{store.updatedAt ? new Date(store.updatedAt).toLocaleString() : "—"}</div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}
