// admin/src/pages/MerchantStoreDetail.jsx
import React from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { listMerchantStores, me, merchantUpdateStoreProfile } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import StoreTeamPanel from "./components/StoreTeamPanel";
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

function getSystemRoleLocal() {
  try {
    return localStorage.getItem("perkvalet_system_role") || "";
  } catch {
    return "";
  }
}

/* ---------------- UI palette (mapped to theme) ---------------- */

const COLORS = {
  primary: color.primary,
  primaryHover: color.primaryHover,
  text: color.text,
  neutral: color.textMuted,
  border: color.border,
  divider: color.borderSubtle,

  dangerBg: color.dangerSubtle,
  dangerBorder: color.dangerBorder,
  dangerText: color.danger,

  okBg: "rgba(0, 160, 80, 0.08)",
  okBorder: "rgba(0, 160, 80, 0.18)",
};

const cardBase = {
  marginTop: 12,
  padding: 16,
  borderRadius: 14,
  border: `1px solid ${color.border}`,
  background: color.cardBg,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const infoK = { fontSize: 12, color: color.textMuted, marginBottom: 4 };
const infoV = { fontSize: 14, fontWeight: 700, color: color.text };
const infoRow = { display: "flex", gap: 14, flexWrap: "wrap" };
const infoCell = { minWidth: 220, flex: "1 1 220px" };

const breadcrumbLink = {
  textDecoration: "none",
  color: color.primary,
  fontWeight: 800,
};

const sep = { color: color.textFaint };

const tabPill = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 999,
  border: `1px solid ${color.border}`,
  textDecoration: "none",
  color: "inherit",
  background: color.borderSubtle,
  fontWeight: 900,
};

const tabPillActive = {
  ...tabPill,
  border: `1px solid ${color.primaryBorder}`,
  background: color.primarySubtle,
};

const primaryPill = {
  ...btn.primary,
  padding: "10px 16px",
  borderRadius: 999,
};

const primaryPillDisabled = {
  ...primaryPill,
  opacity: 0.55,
  cursor: "not-allowed",
};

const mutedPill = {
  padding: "10px 16px",
  borderRadius: 999,
  border: `1px solid ${color.border}`,
  background: color.borderSubtle,
  fontWeight: 800,
  cursor: "pointer",
};

const mutedPillDisabled = {
  ...mutedPill,
  opacity: 0.55,
  cursor: "not-allowed",
};

/* ---------------- helpers ---------------- */

function pickDeep(obj, paths) {
  try {
    for (const p of paths) {
      const parts = p.split(".");
      let cur = obj;
      let ok = true;
      for (const part of parts) {
        if (!cur || typeof cur !== "object") {
          ok = false;
          break;
        }
        cur = cur[part];
      }
      if (ok && cur != null && String(cur).trim() !== "") return cur;
    }
  } catch { }
  return null;
}

function norm(v) {
  if (v == null) return "";
  return String(v);
}

function trimOrNull(s) {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

function digitsOnly(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

function normalizeZip5(v) {
  const digits = digitsOnly(v);
  return digits.slice(0, 5);
}

function normalizePhoneRaw(v) {
  return digitsOnly(v).slice(0, 10);
}

function formatNanp10(digits) {
  const d = normalizePhoneRaw(digits);
  if (!d) return "";
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length <= 3) return `(${a}`;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

/** Country (US/CA for now) */
const PHONE_COUNTRIES = [
  { code: "US", label: "United States", dial: "+1" },
  { code: "CA", label: "Canada", dial: "+1" },
];

function normalizeCountry2(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "CA" ? "CA" : "US";
}

function getPhoneCountryMeta(code2) {
  const c = normalizeCountry2(code2);
  return PHONE_COUNTRIES.find((x) => x.code === c) || PHONE_COUNTRIES[0];
}

function isPlausibleEmail(v) {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
}

function splitName(full) {
  const s = String(full ?? "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/g);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function fullName(person) {
  const first = String(person?.firstName ?? "").trim();
  const last = String(person?.lastName ?? "").trim();
  return [first, last].filter(Boolean).join(" ").trim();
}

/**
 * State selection:
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

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
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

/* --- prefix UI styles --- */

function phonePrefixBtn(open) {
  return {
    padding: "0 10px",
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    border: "1px solid rgba(0,0,0,0.16)",
    background: open ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.015)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    minWidth: 62,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    color: "rgba(0,0,0,0.65)",
  };
}

const phonePrefixMenu = {
  position: "absolute",
  zIndex: 50,
  left: 0,
  top: "calc(100% + 6px)",
  minWidth: 240,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.14)",
  background: "white",
  boxShadow: "0 10px 24px rgba(0,0,0,0.12)",
  padding: 6,
};

function phonePrefixItem(active) {
  return {
    width: "100%",
    textAlign: "left",
    padding: "10px 10px",
    borderRadius: 10,
    background: active ? "rgba(0,0,0,0.04)" : "transparent",
    border: "1px solid rgba(0,0,0,0)",
    cursor: "pointer",
    fontWeight: active ? 700 : 600,
  };
}

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

/* ---------------- component ---------------- */

export default function MerchantStoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const q = useQuery();

  const [store, setStore] = React.useState(null);
  const [merchantRole, setMerchantRole] = React.useState(null);
  const [merchantRolePath, setMerchantRolePath] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  const [primaryContact, setPrimaryContact] = React.useState(null);

  const [initial, setInitial] = React.useState(null);
  const [fields, setFields] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [saveErr, setSaveErr] = React.useState("");

  const tab = (q.get("tab") || "settings").toLowerCase();

  const sid = Number(storeId) || null;

  React.useEffect(() => {
    setPrimaryContact(null);
  }, [sid]);

  const canManage = merchantRole === "merchant_admin" || merchantRole === "owner";
  const systemRole = getSystemRoleLocal();

  const cancelledRef = React.useRef(false);

  const handlePrimaryResolved = React.useCallback((pc) => {
    setPrimaryContact(pc || null);
  }, []);

  const [openPrefix, setOpenPrefix] = React.useState(null); // "store" | "contact" | null
  const storePrefixBtnRef = React.useRef(null);
  const storeMenuRef = React.useRef(null);
  const contactPrefixBtnRef = React.useRef(null);
  const contactMenuRef = React.useRef(null);

  React.useEffect(() => {
    if (!openPrefix) return;

    function onDown(e) {
      const t = e.target;

      const storeHit = storeMenuRef.current?.contains(t) || storePrefixBtnRef.current?.contains(t);
      const contactHit = contactMenuRef.current?.contains(t) || contactPrefixBtnRef.current?.contains(t);

      if (openPrefix === "store" && !storeHit) setOpenPrefix(null);
      if (openPrefix === "contact" && !contactHit) setOpenPrefix(null);
    }

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openPrefix]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr("");

    pvUiHook("merchant.store.detail.load_started.ui", {
      stable: "merchant:store:detail",
      storeId: sid,
      systemRole,
    });

    if (systemRole === "pv_admin" || systemRole === "pv_ar_clerk") {
      if (!cancelledRef.current) {
        setStore(null);
        setMerchantRole(null);
        setMerchantRolePath(null);
        setErr(`${systemRole} session: merchant portal is not available.`);
        setLoading(false);
      }
      pvUiHook("merchant.store.detail.load_blocked_pv_admin.ui", {
        stable: "merchant:store:detail",
        storeId: sid,
        systemRole,
      });
      return;
    }

    try {
      const prof = await me();
      const rolePath = "user.merchantUsers.0.role";
      const mr = pickDeep(prof, [rolePath, "merchantUser.role", "membership.role", "role"]) || null;

      if (!cancelledRef.current) {
        setMerchantRole(mr ? String(mr) : null);
        setMerchantRolePath(mr ? rolePath : null);
      }

      pvUiHook("merchant.store.detail.role_resolved.ui", {
        stable: "merchant:store:detail:role",
        storeId: sid,
        merchantRole: mr ? String(mr) : null,
        merchantRolePath: mr ? rolePath : null,
      });

      const data = await listMerchantStores();
      const found = (data?.items || []).find((s) => s.id === sid);

      if (!found) throw new Error("Store not found (not in your merchant scope).");

      if (!cancelledRef.current) {
        setStore(found);

        const split = splitName(found.contactName);

        const nextInitial = {
          name: norm(found.name),
          address1: norm(found.address1),
          city: norm(found.city),
          state: norm(found.state),
          postal: norm(found.postal),
          status: normalizeStatusValue(found.status),

          phoneRaw: normalizePhoneRaw(found.phoneRaw),
          phoneCountry: normalizeCountry2(found.phoneCountry),

          contactFirstName: norm(split.first),
          contactLastName: norm(split.last),
          contactEmail: norm(found.contactEmail),
          contactPhoneRaw: normalizePhoneRaw(found.contactPhoneRaw),
          contactPhoneCountry: normalizeCountry2(found.contactPhoneCountry),
        };

        setInitial(nextInitial);
        setFields({ ...nextInitial });
        setMsg("");
        setSaveErr("");
      }

      pvUiHook("merchant.store.detail.load_succeeded.ui", {
        stable: "merchant:store:detail",
        storeId: sid,
      });
    } catch (e) {
      const m = e?.message || "Failed to load store";
      if (!cancelledRef.current) setErr(m);

      pvUiHook("merchant.store.detail.load_failed.ui", {
        stable: "merchant:store:detail",
        storeId: sid,
        error: m,
      });
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [sid, systemRole]);

  React.useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  function computeDirty() {
    if (!initial || !fields) return false;

    return (
      norm(fields.name) !== norm(initial.name) ||
      norm(fields.address1) !== norm(initial.address1) ||
      norm(fields.city) !== norm(initial.city) ||
      norm(fields.state) !== norm(initial.state) ||
      norm(fields.postal) !== norm(initial.postal) ||
      normalizeStatusValue(fields.status) !== normalizeStatusValue(initial.status) ||
      normalizeCountry2(fields.phoneCountry) !== normalizeCountry2(initial.phoneCountry) ||
      normalizePhoneRaw(fields.phoneRaw) !== normalizePhoneRaw(initial.phoneRaw) ||
      norm(fields.contactFirstName) !== norm(initial.contactFirstName) ||
      norm(fields.contactLastName) !== norm(initial.contactLastName) ||
      norm(fields.contactEmail) !== norm(initial.contactEmail) ||
      normalizeCountry2(fields.contactPhoneCountry) !== normalizeCountry2(initial.contactPhoneCountry) ||
      normalizePhoneRaw(fields.contactPhoneRaw) !== normalizePhoneRaw(initial.contactPhoneRaw)
    );
  }

  function setField(key, value) {
    setFields((cur) => ({ ...(cur || {}), [key]: value }));
    setMsg("");
    setSaveErr("");
  }

  function revert() {
    if (!initial) return;
    setFields({ ...initial });
    setMsg("Reverted.");
    setSaveErr("");

    pvUiHook("merchant.stores.list.edit_reverted.ui", {
      stable: "merchant:stores:list",
      storeId: sid,
      surface: "detail",
    });
  }

  async function save() {
    if (!fields || !initial) return;

    const dirty = computeDirty();
    if (!dirty) {
      setMsg("No changes.");
      setSaveErr("");
      return;
    }

    const nm = String(fields?.name || "").trim();
    if (!nm) {
      setSaveErr("Store name is required.");
      setMsg("");
      return;
    }

    const zip = String(fields?.postal || "").trim();
    if (zip && !/^\d{5}$/.test(zip)) {
      setSaveErr("Postal must be a 5-digit ZIP code.");
      setMsg("");
      return;
    }

    const phoneRawV = normalizePhoneRaw(fields?.phoneRaw);
    if (phoneRawV && phoneRawV.length !== 10) {
      setSaveErr("Location phone must be exactly 10 digits.");
      setMsg("");
      return;
    }

    const contactPhoneRawV = normalizePhoneRaw(fields?.contactPhoneRaw);
    if (contactPhoneRawV && contactPhoneRawV.length !== 10) {
      setSaveErr("Primary contact phone must be exactly 10 digits.");
      setMsg("");
      return;
    }

    const cEmail = String(fields?.contactEmail || "").trim();
    if (cEmail && !isPlausibleEmail(cEmail)) {
      setSaveErr("Store contact email must be a valid email address.");
      setMsg("");
      return;
    }

    const statusVal = normalizeStatusValue(fields?.status);
    if (statusVal && !STATUS_LABEL_BY_VALUE[statusVal]) {
      setSaveErr("Select a valid status.");
      setMsg("");
      return;
    }

    const combinedContactName = [fields?.contactFirstName, fields?.contactLastName]
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .join(" ");

    const payload = {
      name: trimOrNull(fields?.name),
      address1: trimOrNull(fields?.address1),
      city: trimOrNull(fields?.city),
      state: trimOrNull(fields?.state ? String(fields.state).toUpperCase() : null),
      postal: trimOrNull(fields?.postal),
      status: statusVal ? statusVal : null,

      phoneCountry: normalizeCountry2(fields?.phoneCountry),
      phoneRaw: trimOrNull(normalizePhoneRaw(fields?.phoneRaw)),

      contactName: trimOrNull(combinedContactName),
      contactEmail: trimOrNull(fields?.contactEmail),
      contactPhoneCountry: normalizeCountry2(fields?.contactPhoneCountry),
      contactPhoneRaw: trimOrNull(normalizePhoneRaw(fields?.contactPhoneRaw)),
    };

    setSaving(true);
    setMsg("");
    setSaveErr("");

    pvUiHook("merchant.stores.list.edit_save_started.ui", {
      stable: "merchant:stores:list",
      storeId: sid,
      surface: "detail",
    });

    try {
      pvUiHook("merchant.stores.list.edit_save_payload.ui", {
        stable: "merchant:stores:list",
        storeId: sid,
        surface: "detail",
        keys: Object.keys(payload || {}).join(","),
      });

      await merchantUpdateStoreProfile(sid, payload);
      await load();

      if (!cancelledRef.current) {
        setSaving(false);
        setMsg("Saved.");
        setSaveErr("");
      }

      pvUiHook("merchant.stores.list.edit_save_succeeded.ui", {
        stable: "merchant:stores:list",
        storeId: sid,
        surface: "detail",
      });
    } catch (e) {
      const m = e?.message || "Save failed";
      setSaving(false);
      setSaveErr(m);
      setMsg("");

      pvUiHook("merchant.stores.list.edit_save_failed.ui", {
        stable: "merchant:stores:list",
        storeId: sid,
        surface: "detail",
        error: m,
      });
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (err) return <div style={{ padding: 20, color: color.danger }}>{err}</div>;
  if (!store) return <div style={{ padding: 20 }}>Store not loaded</div>;

  const displayName = store.name || `Store #${store.id}`;
  const addressLine = [store.address1, store.city, store.state, store.postal].filter(Boolean).join(", ");

  const dirty = computeDirty();
  const primaryDisplayName = fullName(primaryContact);

  return (
    <PageContainer size="wide">
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <Link to="/merchant/stores" style={breadcrumbLink}>
            ← My Stores
          </Link>
          <span style={sep}>›</span>
          <span style={{ fontSize: 13, color: COLORS.neutral }}>Store</span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: COLORS.text }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: COLORS.neutral, marginTop: 4 }}>
              Manage store profile, contact details, and team access.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "nowrap",
            }}
          >
            <Link
              to={`/merchant/stores/${store.id}?tab=team`}
              style={primaryPill}
              onClick={() =>
                pvUiHook("merchant.store.detail.tab_change.ui", {
                  stable: "merchant:store:detail:tab",
                  storeId: store.id,
                  tab: "team",
                })
              }
            >
              Team & Access
            </Link>

            <button
              type="button"
              onClick={() => navigate(`/merchant/stores/${store.id}/qr`)}
              style={mutedPill}
            >
              QR Code
            </button>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              style={loading ? mutedPillDisabled : mutedPill}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {tab === "team" ? (
            <Link to={`/merchant/stores/${store.id}`} style={breadcrumbLink}>
              Store settings
            </Link>
          ) : null}
        </div>
      </div>
      
      {addressLine ? (
        <div style={{ color: COLORS.neutral, marginBottom: 10 }}>
          {addressLine}
        </div>
      ) : (
        <div style={{ color: COLORS.dangerText, marginBottom: 10 }}>
          Address not available in merchant payload.
        </div>
      )}

      {tab === "team" ? (
        <div>
          <div style={cardBase}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 12, color: COLORS.text }}>
              Primary Contact
            </div>

            {primaryContact ? (
              <div style={infoRow}>
                <div style={infoCell}>
                  <div style={infoK}>Name</div>
                  <div style={infoV}>{primaryDisplayName || "—"}</div>
                </div>

                <div style={infoCell}>
                  <div style={infoK}>Phone</div>
                  <div style={infoV}>
                    {primaryContact.phone ? formatNanp10(primaryContact.phone) : "—"}
                  </div>
                </div>

                <div style={infoCell}>
                  <div style={infoK}>Email</div>
                  <div style={infoV}>{primaryContact.email || "—"}</div>
                </div>
              </div>
            ) : (
              <div style={{ color: COLORS.neutral }}>
                No primary contact is set for this store yet.
              </div>
            )}
          </div>

          <StoreTeamPanel
            storeId={sid}
            canManage={canManage}
            primaryContactStoreUserId={store?.primaryContactStoreUserId ?? store?.primaryContactStoreUserID ?? null}
            onPrimaryContactChanged={() => load()}
            onPrimaryContactResolved={handlePrimaryResolved}
          />
        </div>
      ) : (
        <div style={{ ...cardBase, marginTop: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 900, color: COLORS.text }}>Store settings</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, color: COLORS.neutral }}>
                {canManage ? (dirty ? "Unsaved changes" : "No changes") : ""}
                {saving ? " · Saving…" : ""}
              </div>

              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={revert}
                    disabled={!dirty || saving}
                    style={!dirty || saving ? mutedPillDisabled : mutedPill}
                  >
                    Revert
                  </button>

                  <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || saving}
                    style={!dirty || saving ? primaryPillDisabled : primaryPill}
                  >
                    Save
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {!canManage ? (
            <div style={{ marginTop: 10, fontSize: 12, color: COLORS.neutral }}>
              You can view stores, but you don’t have permission to edit store profile fields.
            </div>
          ) : (
            <>
              {saveErr ? <div style={{ ...errorBox, marginTop: 10 }}>{saveErr}</div> : null}
              {msg ? <div style={{ ...okBox, marginTop: 10 }}>{msg}</div> : null}

              <div style={{ marginTop: 10 }}>
                <div style={row}>
                  <div style={label}>Status</div>
                  <select
                    value={normalizeStatusValue(fields?.status ?? store.status)}
                    onChange={(e) => setField("status", normalizeStatusValue(e.target.value))}
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
                    className="pvInput"
                    value={fields?.name ?? norm(store.name)}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g., Main Store"
                    style={input}
                    autoComplete="off"
                  />
                </div>

                <div style={row}>
                  <div style={label}>Address1</div>
                  <input
                    className="pvInput"
                    value={fields?.address1 ?? norm(store.address1)}
                    onChange={(e) => setField("address1", e.target.value)}
                    placeholder="Street address"
                    style={input}
                    autoComplete="off"
                  />
                </div>

                <div style={grid3}>
                  <div style={cell}>
                    <div style={label}>City</div>
                    <input
                      className="pvInput"
                      value={fields?.city ?? norm(store.city)}
                      onChange={(e) => setField("city", e.target.value)}
                      placeholder="City"
                      style={input}
                      autoComplete="off"
                    />
                  </div>

                  <div style={cell}>
                    <div style={label}>State</div>
                    <select
                      value={String(fields?.state ?? store.state ?? "").toUpperCase()}
                      onChange={(e) => setField("state", String(e.target.value || "").toUpperCase())}
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
                      className="pvInput"
                      value={fields?.postal ?? norm(store.postal)}
                      onChange={(e) => setField("postal", normalizeZip5(e.target.value))}
                      placeholder="e.g., 94586"
                      style={input}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={5}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${color.border}`,
                    background: color.pageBg,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8, color: COLORS.text }}>Location phone</div>

                  <div style={row}>
                    <div style={label}>Location phone</div>

                    <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
                      <button
                        type="button"
                        ref={storePrefixBtnRef}
                        onClick={() => setOpenPrefix((cur) => (cur === "store" ? null : "store"))}
                        style={phonePrefixBtn(openPrefix === "store")}
                        title="Select country"
                      >
                        {getPhoneCountryMeta(fields?.phoneCountry).dial} ▾
                      </button>

                      <input
                        className="pvInput"
                        style={{
                          ...input,
                          borderTopLeftRadius: 0,
                          borderBottomLeftRadius: 0,
                          borderLeft: "none",
                        }}
                        value={formatNanp10(fields?.phoneRaw)}
                        placeholder="(415) 555-1212"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        onChange={(e) => setField("phoneRaw", normalizePhoneRaw(e.target.value))}
                      />

                      {openPrefix === "store" ? (
                        <div ref={storeMenuRef} style={phonePrefixMenu}>
                          {PHONE_COUNTRIES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              style={phonePrefixItem(normalizeCountry2(fields?.phoneCountry) === c.code)}
                              onClick={() => {
                                setField("phoneCountry", c.code);
                                setOpenPrefix(null);
                              }}
                            >
                              {c.label} ({c.dial})
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${color.border}`,
                    background: color.pageBg,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8, color: COLORS.text }}>Primary contact</div>

                  <div style={{ fontSize: 13, color: COLORS.neutral, lineHeight: 1.5 }}>
                    The primary contact for this location is managed from the{" "}
                    <strong>Team &amp; Access</strong> panel for the store.
                  </div>

                  <div style={{ fontSize: 12, marginTop: 8, color: color.textMuted }}>
                    Assign an employee to this store and mark them as the primary contact there.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )
      }
    </PageContainer >
  );
}

/* ---------------- form styles ---------------- */

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

const errorBox = {
  background: color.dangerSubtle,
  border: `1px solid ${color.dangerBorder}`,
  color: color.danger,
  padding: 10,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
};

const okBox = {
  background: COLORS.okBg,
  border: `1px solid ${COLORS.okBorder}`,
  padding: 10,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
};

