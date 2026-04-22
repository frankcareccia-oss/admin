// admin/src/pages/MerchantStores.jsx
import React from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { listMerchantStores, me, getSystemRole, merchantUpdateStoreProfile } from "../api/client";
import { color, btn, inputStyle as themeInput } from "../theme";

/**
 * pvUiHook: structured UI events for QA/docs/chatbot.
 * Must never throw.
 */
function pvUiHook(event, fields = {}) {
  try {
    console.log(
      JSON.stringify({
        pvUiHook: event,
        ts: new Date().toISOString(),
        ...fields,
      })
    );
  } catch {
      // never break UI for logging
  }
}

const DEV_MODE = (() => {
  try {
    return Boolean(import.meta?.env?.DEV);
  } catch {
    return false;
  }
})();

function norm(v) {
  if (v == null) return "";
  return String(v);
}

function trimOrNull(s) {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

/**
 * normalizeZip5:
 * - keep digits only
 * - cap to 5
 */
function normalizeZip5(v) {
  const digits = String(v ?? "").replace(/\D+/g, "");
  return digits.slice(0, 5);
}

/**
 * Merchant role lives on me().user.merchantUsers[*].role in your current iterations.
 * We keep this tolerant so UI doesn't break if shape varies.
 */
function resolveMerchantRole(profile) {
  try {
    const role =
      profile?.user?.merchantUsers?.[0]?.role ??
      profile?.merchantRole ??
      profile?.user?.merchantRole ??
      null;
    return role ? String(role) : null;
  } catch {
    return null;
  }
}

/**
 * State selection (match Create Store):
 * - Dropdown shows state names
 * - Stored value is abbreviation (CA, NY, etc.)
 */
const US_STATES = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "DC", name: "District of Columbia" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

/**
 * Status mapping:
 * - Display uses business terms (Draft/Live/etc.)
 * - Values are what we send to the API.
 *
 * NOTE: We have seen "active" in the UI already; we treat that as "Live".
 */
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Live" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

const STATUS_LABEL_BY_VALUE = STATUS_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label;
  return acc;
}, {});

function normalizeStatusValue(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "live") return "active";
  return raw;
}

function displayStatusLabel(v) {
  const key = normalizeStatusValue(v);
  if (!key) return "—";
  return STATUS_LABEL_BY_VALUE[key] || String(v);
}

export default function MerchantStores() {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [profile, setProfile] = React.useState(null);

  // caret-expand state
  const [expandedId, setExpandedId] = React.useState(null);

  // per-store edit state: { [storeId]: { initial, fields, saving, msg, err } }
  const [editById, setEditById] = React.useState({});

  const systemRole = getSystemRole(); // "merchant" or "pv_admin" etc
  const merchantRole = resolveMerchantRole(profile); // "owner" | "merchant_admin" | ...
  const canManageStores = merchantRole === "merchant_admin" || merchantRole === "owner";

  async function load() {
    setLoading(true);
    setErr("");

    pvUiHook("merchant.stores.list.load_started.ui", {
      stable: "merchant:stores:list",
      systemRole,
    });

    // Hard guard: pv_admin should never call merchant portal APIs
    if (systemRole === "pv_admin" || systemRole === "pv_ar_clerk") {
      setItems([]);
      setProfile(null);
      setExpandedId(null);
      setEditById({});
      setErr(`${systemRole} session: merchant portal is not available.`);
      setLoading(false);

      pvUiHook("merchant.stores.list.load_blocked_pv_admin.ui", {
        stable: "merchant:stores:list",
        systemRole,
      });
      return;
    }

    try {
      const m = await me();
      setProfile(m);

      const r = await listMerchantStores();
      const nextItems = Array.isArray(r?.items) ? r.items : [];
      setItems(nextItems);

      pvUiHook("merchant.stores.list.load_succeeded.ui", {
        stable: "merchant:stores:list",
        systemRole,
        merchantRole: resolveMerchantRole(m),
        count: nextItems.length,
      });

      // If expanded store disappeared (scope change), collapse.
      setExpandedId((cur) => (cur && !nextItems.find((s) => s.id === cur) ? null : cur));
    } catch (e) {
      const msg = e?.message || "Failed to load stores";
      setErr(msg);

      pvUiHook("merchant.stores.list.load_failed.ui", {
        stable: "merchant:stores:list",
        systemRole,
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  function ensureEditStateForStore(s) {
    const sid = s?.id;
    if (!sid) return;

    setEditById((cur) => {
      if (cur[sid]) return cur;

      const initial = {
        name: norm(s.name),
        address1: norm(s.address1),
        city: norm(s.city),
        state: norm(s.state),
        postal: norm(s.postal),
        status: normalizeStatusValue(s.status),
      };

      return {
        ...cur,
        [sid]: {
          initial,
          fields: { ...initial },
          saving: false,
          msg: "",
          err: "",
        },
      };
    });
  }

  function toggleExpanded(s) {
    const sid = s?.id || null;
    if (!sid) return;

    pvUiHook("merchant.stores.list.expand_toggle.ui", {
      stable: "merchant:stores:list",
      storeId: sid,
      nextExpanded: expandedId === sid ? false : true,
    });

    if (expandedId !== sid) ensureEditStateForStore(s);
    setExpandedId((cur) => (cur === sid ? null : sid));
  }

  function setField(storeId, key, value) {
    setEditById((cur) => {
      const st = cur[storeId];
      if (!st) return cur;
      return {
        ...cur,
        [storeId]: {
          ...st,
          fields: { ...st.fields, [key]: value },
          msg: "",
          err: "",
        },
      };
    });
  }

  function computeDirty(storeId) {
    const st = editById[storeId];
    if (!st) return false;
    const a = st.initial || {};
    const b = st.fields || {};
    return (
      norm(b.name) !== norm(a.name) ||
      norm(b.address1) !== norm(a.address1) ||
      norm(b.city) !== norm(a.city) ||
      norm(b.state) !== norm(a.state) ||
      norm(b.postal) !== norm(a.postal) ||
      normalizeStatusValue(b.status) !== normalizeStatusValue(a.status)
    );
  }

  function revert(storeId) {
    setEditById((cur) => {
      const st = cur[storeId];
      if (!st) return cur;
      return {
        ...cur,
        [storeId]: {
          ...st,
          fields: { ...st.initial },
          msg: "Reverted.",
          err: "",
        },
      };
    });

    pvUiHook("merchant.stores.list.edit_reverted.ui", {
      stable: "merchant:stores:list",
      storeId,
    });
  }

  async function save(storeId) {
    const st = editById[storeId];
    if (!st) return;

    const dirty = computeDirty(storeId);
    if (!dirty) {
      setEditById((cur) => ({
        ...cur,
        [storeId]: { ...cur[storeId], msg: "No changes.", err: "" },
      }));
      return;
    }

    const nm = String(st.fields?.name || "").trim();
    if (!nm) {
      setEditById((cur) => ({
        ...cur,
        [storeId]: { ...cur[storeId], err: "Store name is required.", msg: "" },
      }));
      return;
    }

    const zip = String(st.fields?.postal || "").trim();
    if (zip && !/^\d{5}$/.test(zip)) {
      setEditById((cur) => ({
        ...cur,
        [storeId]: { ...cur[storeId], err: "Postal must be a 5-digit ZIP code.", msg: "" },
      }));
      return;
    }

    const statusVal = normalizeStatusValue(st.fields?.status);
    if (statusVal && !STATUS_LABEL_BY_VALUE[statusVal]) {
      setEditById((cur) => ({
        ...cur,
        [storeId]: { ...cur[storeId], err: "Select a valid status.", msg: "" },
      }));
      return;
    }

    const payload = {
      name: trimOrNull(st.fields?.name),
      address1: trimOrNull(st.fields?.address1),
      city: trimOrNull(st.fields?.city),
      state: trimOrNull(st.fields?.state ? String(st.fields.state).toUpperCase() : null),
      postal: trimOrNull(st.fields?.postal),
      status: statusVal ? statusVal : null,
    };

    setEditById((cur) => ({
      ...cur,
      [storeId]: { ...cur[storeId], saving: true, msg: "", err: "" },
    }));

    pvUiHook("merchant.stores.list.edit_save_started.ui", {
      stable: "merchant:stores:list",
      storeId,
    });

    try {
      const updated = await merchantUpdateStoreProfile(storeId, payload);

      setItems((cur) => cur.map((s) => (s.id === storeId ? { ...s, ...(updated || {}) } : s)));

      const nextInitial = {
        name: norm(updated?.name),
        address1: norm(updated?.address1),
        city: norm(updated?.city),
        state: norm(updated?.state),
        postal: norm(updated?.postal),
        status: normalizeStatusValue(updated?.status),
      };

      setEditById((cur) => ({
        ...cur,
        [storeId]: {
          ...cur[storeId],
          saving: false,
          initial: nextInitial,
          fields: { ...nextInitial },
          msg: "Saved.",
          err: "",
        },
      }));

      pvUiHook("merchant.stores.list.edit_save_succeeded.ui", {
        stable: "merchant:stores:list",
        storeId,
      });
    } catch (e) {
      const msg = e?.message || "Save failed";
      setEditById((cur) => ({
        ...cur,
        [storeId]: { ...cur[storeId], saving: false, err: msg, msg: "" },
      }));

      pvUiHook("merchant.stores.list.edit_save_failed.ui", {
        stable: "merchant:stores:list",
        storeId,
        error: msg,
      });
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageContainer size="wide">
      <div style={breadcrumbRow}>
        <span>Merchant</span>
      </div>

      <div style={headerRow}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6, color: TOKENS.text }}>Stores</h2>
          <div style={headerSub}>Manage the locations where your business operates.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={load} disabled={loading} style={pillButtonMuted(loading)}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div style={pageBody}>
        {canManageStores ? (
          <div style={{ ...card, overflow: "visible" }}>
          <div style={cardHeader}>
            <div>
              <div style={{ fontWeight: 900, color: TOKENS.text }}>Create Store</div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: TOKENS.muted }}>
                Add a new location for your business.
              </div>
            </div>

            <Link to="/merchant/stores/new" style={pillLinkMuted}>
              Create Store
            </Link>
          </div>
        </div>
        ) : null}

        {/* Error */}
        {err && <div style={errorBox}>{err}</div>}

        {/* List */}
        <div style={card}>
          <div style={cardHeader}>
            <div>
              <div style={{ fontWeight: 900, color: TOKENS.text }}>Store Locations</div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: TOKENS.muted }}>
                View and update your existing store locations.
              </div>
            </div>
            <div style={{ color: color.textMuted }}>
              ({items.length} store{items.length === 1 ? "" : "s"})
            </div>
          </div>

          <div style={listBody}>
            {items.map((s) => {
              const sid = s.id;
              const isExpanded = expandedId === sid;
              const st = editById[sid];
              const dirty = st ? computeDirty(sid) : false;
              const saving = Boolean(st?.saving);

              return (
                <div key={sid} style={rowWrap}>
                  <div style={rowTopGrid}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(s)}
                      style={caretBtn}
                      aria-label={isExpanded ? "Close" : "Open"}
                      title={isExpanded ? "Close" : canManageStores ? "Open (view/edit)" : "Open (view)"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>

                    <div style={{ minWidth: 0 }}>
                      <div style={rowTitle}>{s.name || `Store #${s.id}`}</div>

                      <div style={rowMetaGrid}>
                        <div style={rowMetaCell}>
                          <div style={rowMetaLabel}>City</div>
                          <div style={rowMetaValue}>{s.city ? String(s.city) : "—"}</div>
                        </div>
                        <div style={rowMetaCell}>
                          <div style={rowMetaLabel}>State</div>
                          <div style={rowMetaValue}>{s.state ? String(s.state) : "—"}</div>
                        </div>
                      </div>

                      <div style={rowSubLine}>
                        <span style={{ color: color.textMuted }}>
                          {[s.address1 ? String(s.address1) : "", s.postal ? String(s.postal) : ""]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </div>
                    </div>

                    <div style={statusCol}>
                      {s.status ? (
                        <span style={statusChip}>{displayStatusLabel(s.status)}</span>
                      ) : (
                        <span style={statusPlaceholder}>—</span>
                      )}
                    </div>

                    <div style={actionsCol}>
                      <Link
                        to={`/merchant/stores/${sid}`}
                        style={pillLinkMuted}
                        onClick={() =>
                          pvUiHook("merchant.stores.list.open_store_detail.ui", {
                            stable: "merchant:stores:list",
                            storeId: sid,
                          })
                        }
                      >
                        {canManageStores ? "Manage" : "View"}
                      </Link>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div style={expandOuter}>
                      <div style={expandInner}>
                        <div style={expandHeader}>
                          <div style={{ fontWeight: 900, color: TOKENS.text }}>Store settings</div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, color: color.textMuted }}>
                              {canManageStores ? (dirty ? "Unsaved changes" : "No changes") : "View only"}
                              {saving ? " · Saving…" : ""}
                            </div>

                            {canManageStores ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => revert(sid)}
                                  disabled={saving || !dirty}
                                  style={pillButtonMuted(saving || !dirty)}
                                >
                                  Revert
                                </button>

                                <button
                                  type="button"
                                  onClick={() => save(sid)}
                                  disabled={saving || !dirty}
                                  style={pillButtonMuted(saving || !dirty)}
                                >
                                  {saving ? "Saving…" : "Save"}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {!canManageStores ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
                            You can view stores, but you don’t have permission to edit store profile fields.
                          </div>
                        ) : (
                          <>
                            {st?.err ? <div style={{ ...errorBox, marginTop: 10 }}>{st.err}</div> : null}
                            {st?.msg ? <div style={{ ...okBox, marginTop: 10 }}>{st.msg}</div> : null}

                            <div style={{ marginTop: 10 }}>
                              <div style={row}>
                                <div style={label}>Status</div>
                                <select
                                  value={normalizeStatusValue(st?.fields?.status ?? s.status)}
                                  onChange={(e) => setField(sid, "status", normalizeStatusValue(e.target.value))}
                                  style={input}
                                >
                                  <option value="">Select status…</option>
                                  {STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div style={row}>
                                <div style={label}>Store name</div>
                                <input
                                  value={st?.fields?.name ?? norm(s.name)}
                                  onChange={(e) => setField(sid, "name", e.target.value)}
                                  placeholder="e.g., Main Store"
                                  style={input}
                                  autoComplete="off"
                                />
                              </div>

                              <div style={row}>
                                <div style={label}>Address1</div>
                                <input
                                  value={st?.fields?.address1 ?? norm(s.address1)}
                                  onChange={(e) => setField(sid, "address1", e.target.value)}
                                  placeholder="Street address"
                                  style={input}
                                  autoComplete="off"
                                />
                              </div>

                              <div style={grid3}>
                                <div style={cell}>
                                  <div style={label}>City</div>
                                  <input
                                    value={st?.fields?.city ?? norm(s.city)}
                                    onChange={(e) => setField(sid, "city", e.target.value)}
                                    placeholder="City"
                                    style={input}
                                    autoComplete="off"
                                  />
                                </div>

                                <div style={cell}>
                                  <div style={label}>State</div>
                                  <select
                                    value={String(st?.fields?.state ?? s.state ?? "").toUpperCase()}
                                    onChange={(e) =>
                                      setField(sid, "state", String(e.target.value || "").toUpperCase())
                                    }
                                    style={input}
                                    autoComplete="address-level1"
                                  >
                                    <option value="">Select a state…</option>
                                    {US_STATES.map((opt) => (
                                      <option key={opt.abbr} value={opt.abbr}>
                                        {opt.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div style={cell}>
                                  <div style={label}>Postal</div>
                                  <input
                                    value={st?.fields?.postal ?? norm(s.postal)}
                                    onChange={(e) => setField(sid, "postal", normalizeZip5(e.target.value))}
                                    placeholder="e.g., 94586"
                                    style={input}
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                    maxLength={5}
                                  />
                                </div>
                              </div>

                              <div style={actionsRow}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(null)}
                                  style={pillButtonMuted(false)}
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {DEV_MODE ? (
                          <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
                            Screen <code>MerchantStores</code> · StoreId <code>{sid}</code> · SystemRole{" "}
                            <code>{systemRole || "?"}</code> · MerchantRole <code>{merchantRole || "unknown"}</code>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {!loading && items.length === 0 && !err ? (
              <div style={{ padding: 14, color: color.textMuted }}>
                No stores available for this user.
                {canManageStores ? (
                  <>
                    {" "}
                    You can <Link to="/merchant/stores/new">create a store</Link>.
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {profile ? (
          <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
            Logged in as <code>{profile?.user?.email}</code> (system role <code>{profile?.user?.systemRole}</code>,
            merchant role <code>{merchantRole || "unknown"}</code>)
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}

/* -----------------------------
   Styles (tight + neutral)
-------------------------------- */

const TOKENS = {
  text: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
};

const breadcrumbRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
  fontSize: 13,
  color: TOKENS.muted,
};

const breadcrumbLink = {
  color: "#2F8F8B",
  textDecoration: "none",
  fontWeight: 800,
};

const headerRow = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const headerSub = {
  marginTop: 6,
  fontSize: 13,
  color: color.textMuted,
  maxWidth: 760,
  lineHeight: 1.45,
};

const pageBody = {
  display: "grid",
  gap: 14,
  width: "100%",
  alignItems: "stretch",
};

const listBody = {
  width: "100%",
};

const card = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(0,0,0,0.015)",
  justifySelf: "stretch",
};

const cardHeader = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  borderBottom: `1px solid ${color.borderSubtle}`,
  display: "flex",
  gap: 10,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  background: color.cardBg,
};

const rowWrap = {
  width: "100%",
  boxSizing: "border-box",
  borderBottom: `1px solid ${color.borderSubtle}`,
  background: color.cardBg,
};

const rowTopGrid = {
  width: "100%",
  boxSizing: "border-box",
  display: "grid",
  gridTemplateColumns: "38px minmax(0, 1fr) 128px 110px",
  gap: 10,
  alignItems: "center",
  padding: "10px 12px",
  background: color.cardBg,
};

const caretBtn = {
  width: 28,
  height: 28,
  borderRadius: 10,
  border: `1px solid ${color.border}`,
  background: color.borderSubtle,
  cursor: "pointer",
  fontWeight: 900,
  lineHeight: "26px",
  textAlign: "center",
  padding: 0,
  justifySelf: "start",
};

const rowTitle = {
  fontWeight: 900,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: TOKENS.text,
};

const rowMetaGrid = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  marginTop: 4,
};

const rowMetaCell = {
  minWidth: 72,
};

const rowMetaLabel = {
  fontSize: 11,
  color: color.textMuted,
  fontWeight: 800,
};

const rowMetaValue = {
  marginTop: 2,
  fontSize: 12,
  color: TOKENS.text,
  fontWeight: 700,
};

const rowSubLine = {
  marginTop: 6,
  fontSize: 12,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const statusCol = {
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "center",
  minWidth: 0,
};

const statusPlaceholder = {
  fontSize: 12,
  color: color.textFaint,
};

const statusChip = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 10px",
  borderRadius: 999,
  border: `1px solid ${color.border}`,
  background: color.borderSubtle,
  fontSize: 12,
  fontWeight: 800,
  color: color.textMuted,
  maxWidth: "100%",
};

const actionsCol = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
};

const expandOuter = {
  padding: "0 12px 12px 12px",
  background: color.cardBg,
};

const expandInner = {
  marginLeft: 38,
  padding: 14,
  borderRadius: 16,
  border: `2px solid ${color.border}`,
  background: color.pageBg,
  boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
};

const expandHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const row = { marginBottom: 10, minWidth: 0 };

const label = {
  fontSize: 12,
  fontWeight: 800,
  color: color.textMuted,
  marginBottom: 6,
};

const input = {
  ...themeInput,
  maxWidth: "100%",
  minWidth: 0,
};

const grid3 = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.9fr)",
  gap: 12,
  marginBottom: 10,
  minWidth: 0,
};

const cell = { minWidth: 0 };

const actionsRow = {
  marginTop: 10,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const pillLinkMuted = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 999,
  border: `1px solid ${color.border}`,
  textDecoration: "none",
  color: "inherit",
  background: color.borderSubtle,
  fontWeight: 800,
};

function pillButtonMuted(disabled) {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${color.border}`,
    background: color.borderSubtle,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 800,
    opacity: disabled ? 0.55 : 1,
  };
}

const errorBox = {
  marginTop: 14,
  background: color.dangerSubtle,
  border: `1px solid ${color.dangerBorder}`,
  padding: 10,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
};

const okBox = {
  background: "rgba(0, 160, 80, 0.08)",
  border: "1px solid rgba(0, 160, 80, 0.18)",
  padding: 10,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
};
