// admin/src/pages/MerchantStoreCreate.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { me, merchantCreateStore } from "../api/client";

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

function trimOrNull(v) {
  const t = String(v ?? "").trim();
  return t ? t : null;
}

function pickFirstMerchantId(profile) {
  try {
    const mu = profile?.user?.merchantUsers;
    if (Array.isArray(mu) && mu[0]?.merchantId) return Number(mu[0].merchantId) || null;
  } catch {}
  return null;
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

const STATE_ABBR_SET = new Set(US_STATES.map((s) => s.abbr));

/**
 * Status mapping:
 * Display uses business terms; values are sent to API.
 */
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Live" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

const STATUS_VALUE_SET = new Set(STATUS_OPTIONS.map((o) => o.value));

function normalizeStatusValue(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (raw.toLowerCase() === "live") return "active";
  return raw;
}

/* Neutral pill styling (no surprise-blue) */
const pill = (disabled = false) => ({
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.18)",
  background: disabled ? "rgba(0,0,0,0.03)" : "white",
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 800,
  color: "rgba(0,0,0,0.85)",
  opacity: disabled ? 0.55 : 1,
});

const label = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(0,0,0,0.65)",
  marginBottom: 6,
};

const inputBase = {
  width: "100%",
  maxWidth: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  outline: "none",
  boxSizing: "border-box",
  minWidth: 0,
};

const helpText = {
  marginTop: 6,
  fontSize: 12,
  color: "rgba(0,0,0,0.55)",
};

const errorText = {
  marginTop: 6,
  fontSize: 12,
  color: "rgba(180, 0, 0, 0.85)",
  fontWeight: 700,
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 12,
  marginBottom: 10,
  minWidth: 0,
};

const crumbLink = {
  textDecoration: "none",
  fontWeight: 800,
  color: "#2563EB",
};

function fieldStyle(hasError) {
  return {
    ...inputBase,
    border: hasError ? "1px solid rgba(200, 0, 0, 0.40)" : inputBase.border,
    background: hasError ? "rgba(255, 0, 0, 0.03)" : inputBase.background,
  };
}

function validateAll({ name, address1, city, state, postal, status }) {
  const errors = {};

  const nm = String(name ?? "").trim();
  const a1 = String(address1 ?? "").trim();
  const c = String(city ?? "").trim();
  const st = String(state ?? "").trim().toUpperCase();
  const zip = String(postal ?? "").trim();
  const statusVal = normalizeStatusValue(status);

  if (!statusVal) errors.status = "Status is required.";
  else if (!STATUS_VALUE_SET.has(statusVal)) errors.status = "Select a valid status.";

  if (!nm) errors.name = "Store name is required.";
  else if (nm.length > 200) errors.name = "Store name is too long.";

  if (!a1) errors.address1 = "Address1 is required.";
  else if (a1.length > 200) errors.address1 = "Address1 is too long.";

  if (!c) errors.city = "City is required.";
  else if (c.length > 100) errors.city = "City is too long.";

  if (!st) errors.state = "State is required.";
  else if (!STATE_ABBR_SET.has(st)) errors.state = "Select a valid state.";

  if (!zip) errors.postal = "Postal (ZIP) is required.";
  else if (!/^\d{5}$/.test(zip)) errors.postal = "Postal must be a 5-digit ZIP code.";

  return { errors };
}

/**
 * ✅ EXACT expanded-box scheme from MerchantStores.jsx (expandInner)
 * Apply to the Create Store panel wrapper.
 */
const expandedBoxScheme = {
  padding: 14,
  borderRadius: 16,
  border: "2px solid rgba(0,0,0,0.18)",
  background: "rgba(0,0,0,0.02)",
  boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
  boxSizing: "border-box",
};

export default function MerchantStoreCreate() {
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [okMsg, setOkMsg] = React.useState("");

  const [merchantId, setMerchantId] = React.useState(null);

  // Form
  const [status, setStatus] = React.useState("");
  const [name, setName] = React.useState("");
  const [address1, setAddress1] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(""); // abbreviation only
  const [postal, setPostal] = React.useState("");

  // Field-level UX
  const [touched, setTouched] = React.useState({
    status: false,
    name: false,
    address1: false,
    city: false,
    state: false,
    postal: false,
  });
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const { errors } = React.useMemo(() => validateAll({ status, name, address1, city, state, postal }), [
    status,
    name,
    address1,
    city,
    state,
    postal,
  ]);

  const canSubmit = !loading && !creating && Boolean(merchantId) && Object.keys(errors).length === 0;

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      setOkMsg("");

      pvUiHook("merchant.store.create.load_started.ui", {
        stable: "merchant:store:create",
      });

      try {
        const profile = await me();
        const mid = pickFirstMerchantId(profile);

        if (!mid) {
          throw new Error("No merchant scope found for this user (missing merchantUsers[0].merchantId).");
        }

        if (!cancelled) setMerchantId(mid);

        pvUiHook("merchant.store.create.load_succeeded.ui", {
          stable: "merchant:store:create",
          merchantId: mid,
        });
      } catch (e) {
        const msg = e?.message || "Failed to load merchant scope";
        if (!cancelled) setErr(msg);

        pvUiHook("merchant.store.create.load_failed.ui", {
          stable: "merchant:store:create",
          error: msg,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function showFieldError(key) {
    return Boolean(errors[key]) && (submitAttempted || touched[key]);
  }

  async function onCreate() {
    setErr("");
    setOkMsg("");
    setSubmitAttempted(true);

    const { errors: e2 } = validateAll({ status, name, address1, city, state, postal });
    if (Object.keys(e2).length > 0) {
      setTouched({ status: true, name: true, address1: true, city: true, state: true, postal: true });
      return setErr("Please complete all required fields.");
    }
    if (!merchantId) return setErr("Missing merchant scope (merchantId).");

    setCreating(true);
    try {
      pvUiHook("merchant.store.create.submit_started.ui", {
        stable: "merchant:store:create",
        merchantId,
      });

      const created = await merchantCreateStore({
        merchantId,
        status: trimOrNull(normalizeStatusValue(status)),
        name: trimOrNull(name),
        address1: trimOrNull(address1),
        city: trimOrNull(city),
        state: trimOrNull(String(state || "").toUpperCase()),
        postal: trimOrNull(postal),
      });

      const newId = Number(created?.id) || null;

      pvUiHook("merchant.store.create.submit_succeeded.ui", {
        stable: "merchant:store:create",
        merchantId,
        storeId: newId,
      });

      setOkMsg("Store created.");

      if (newId) navigate(`/merchant/stores/${newId}`, { replace: true });
      else navigate(`/merchant`, { replace: true });
    } catch (e) {
      const msg = e?.message || "Create failed";
      setErr(msg);

      pvUiHook("merchant.store.create.submit_failed.ui", {
        stable: "merchant:store:create",
        merchantId: merchantId || null,
        error: msg,
      });
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 12 }}>
        <Link to="/merchant" style={crumbLink}>
          ← Back to My Stores
        </Link>
      </div>

      <h2 style={{ marginTop: 0, marginBottom: 10 }}>Create Store</h2>

      {DEV_MODE ? (
        <div style={{ color: "rgba(0,0,0,0.45)", marginBottom: 12, fontSize: 12 }}>
          Scope <code>{merchantId ?? "unknown"}</code>
        </div>
      ) : null}

      {err ? (
        <div
          style={{
            marginTop: 10,
            background: "rgba(255,0,0,0.06)",
            border: "1px solid rgba(255,0,0,0.15)",
            padding: 10,
            borderRadius: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      ) : null}

      {okMsg ? (
        <div
          style={{
            marginTop: 10,
            background: "rgba(0, 160, 80, 0.08)",
            border: "1px solid rgba(0, 160, 80, 0.18)",
            padding: 10,
            borderRadius: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {okMsg}
        </div>
      ) : null}

      {/* ✅ Panel wrapper now matches expanded box scheme */}
      <div style={{ ...expandedBoxScheme, marginTop: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Store profile</div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>Status</div>
          <select
            value={normalizeStatusValue(status)}
            onChange={(e) => setStatus(normalizeStatusValue(e.target.value))}
            onBlur={() => setTouched((t) => ({ ...t, status: true }))}
            style={fieldStyle(showFieldError("status"))}
          >
            <option value="">Select status…</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {showFieldError("status") ? <div style={errorText}>{errors.status}</div> : null}
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>Store name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            style={fieldStyle(showFieldError("name"))}
            placeholder="e.g., Main Store"
            autoComplete="organization"
          />
          {showFieldError("name") ? <div style={errorText}>{errors.name}</div> : null}
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>Address1</div>
          <input
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, address1: true }))}
            style={fieldStyle(showFieldError("address1"))}
            placeholder="Street address"
            autoComplete="street-address"
          />
          {showFieldError("address1") ? <div style={errorText}>{errors.address1}</div> : null}
        </div>

        <div style={grid2}>
          <div style={{ minWidth: 0 }}>
            <div style={label}>City</div>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, city: true }))}
              style={fieldStyle(showFieldError("city"))}
              placeholder="City"
              autoComplete="address-level2"
            />
            {showFieldError("city") ? <div style={errorText}>{errors.city}</div> : null}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={label}>State</div>
            <select
              value={String(state || "").toUpperCase()}
              onChange={(e) => setState(String(e.target.value || "").toUpperCase())}
              onBlur={() => setTouched((t) => ({ ...t, state: true }))}
              style={fieldStyle(showFieldError("state"))}
              autoComplete="address-level1"
            >
              <option value="">Select a state…</option>
              {US_STATES.map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.name}
                </option>
              ))}
            </select>
            {showFieldError("state") ? <div style={errorText}>{errors.state}</div> : null}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>Postal</div>
          <input
            value={postal}
            onChange={(e) => setPostal(normalizeZip5(e.target.value))}
            onBlur={() => setTouched((t) => ({ ...t, postal: true }))}
            style={{ ...fieldStyle(showFieldError("postal")), maxWidth: 220 }}
            placeholder="e.g., 94586"
            inputMode="numeric"
            maxLength={5}
            autoComplete="postal-code"
          />
          {showFieldError("postal") ? (
            <div style={errorText}>{errors.postal}</div>
          ) : (
            <div style={helpText}>ZIP code (5 digits).</div>
          )}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            style={pill(creating)}
            disabled={creating}
            onClick={() => {
              pvUiHook("merchant.store.create.cancel_click.ui", { stable: "merchant:store:create" });
              navigate("/merchant", { replace: false });
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            style={pill(!canSubmit)}
            disabled={!canSubmit}
            onClick={onCreate}
            title={!canSubmit ? "Complete all required fields to create a store." : ""}
          >
            {creating ? "Creating…" : "Create Store"}
          </button>
        </div>
      </div>

      {DEV_MODE ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
          Screen <code>MerchantStoreCreate</code>
        </div>
      ) : null}
    </div>
  );
}
