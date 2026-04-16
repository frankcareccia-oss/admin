// admin/src/pages/MerchantStoreEdit.jsx
import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listMerchantStores, merchantUpdateStoreProfile, me } from "../api/client";
import useBreakpoint from "../hooks/useBreakpoint";
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

/* ---------------- UI palette (mapped to theme) ---------------- */

const COLORS = {
  primary: color.primary,
  neutral: color.textMuted,
  dangerBg: color.dangerSubtle,
  dangerBorder: color.dangerBorder,
  dangerText: color.danger,
  okBg: "rgba(22, 163, 74, 0.10)",
  okBorder: "rgba(22, 163, 74, 0.25)",
  okText: color.text,
};

const breadcrumbLink = {
  textDecoration: "none",
  color: color.primary,
  fontWeight: 700,
};

const sep = { color: "rgba(0,0,0,0.35)" };

/* Neutral pill styling */
const pill = (disabled = false) => ({
  padding: "10px 16px",
  borderRadius: 999,
  border: `1px solid ${color.border}`,
  background: disabled ? color.borderSubtle : color.cardBg,
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 800,
  color: color.text,
  opacity: disabled ? 0.55 : 1,
});

/* ---------------- helpers ---------------- */

function norm(v) {
  if (v == null) return "";
  return String(v);
}

function trimOrNull(s) {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

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
  } catch {}
  return null;
}

export default function MerchantStoreEdit() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();

  const sid = Number(storeId) || null;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [okMsg, setOkMsg] = React.useState("");

  const [store, setStore] = React.useState(null);
  const [merchantRole, setMerchantRole] = React.useState(null);

  // Form fields
  const [name, setName] = React.useState("");
  const [address1, setAddress1] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [postal, setPostal] = React.useState("");
  const [posTimeoutMin, setPosTimeoutMin] = React.useState("5");
  const [geofenceRadius, setGeofenceRadius] = React.useState("150");
  const [latitude, setLatitude] = React.useState(null);
  const [longitude, setLongitude] = React.useState(null);
  const [discoverability, setDiscoverability] = React.useState(true);
  const [storeCategory, setStoreCategory] = React.useState(“”);
  const [hoursJson, setHoursJson] = React.useState(“”);

  // Snapshot for “dirty” detection
  const initialRef = React.useRef(null);

  const canManage = merchantRole === "merchant_admin" || merchantRole === "owner";

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setSaving(false);
      setErr("");
      setOkMsg("");

      if (!sid) {
        setErr("Invalid storeId");
        setLoading(false);
        return;
      }

      pvUiHook("merchant.store.edit.load_started.ui", {
        stable: "merchant:store:edit",
        storeId: sid,
      });

      try {
        // Resolve merchant role from /me (membership role, not systemRole)
        const prof = await me();
        const mr =
          pickDeep(prof, ["user.merchantUsers.0.role", "merchantUser.role", "membership.role", "role"]) || null;

        if (!cancelled) setMerchantRole(mr ? String(mr) : null);

        pvUiHook("merchant.store.edit.role_resolved.ui", {
          stable: "merchant:store:edit:role",
          storeId: sid,
          merchantRole: mr ? String(mr) : null,
          merchantRolePath: mr ? "user.merchantUsers[0].role" : null,
        });

        if (!(mr === "merchant_admin" || mr === "owner")) {
          if (!cancelled) {
            setStore(null);
            setErr("Store profile editing is available only to merchant_admin (or owner).");
          }

          pvUiHook("merchant.store.edit.forbidden.ui", {
            stable: "merchant:store:edit:forbidden",
            storeId: sid,
            merchantRole: mr ? String(mr) : "unknown",
          });

          return;
        }

        const data = await listMerchantStores();
        const found = (data?.items || []).find((s) => s.id === sid);

        if (!found) throw new Error("Store not found (not in your merchant scope).");

        if (cancelled) return;

        setStore(found);

        const next = {
          name: norm(found.name),
          address1: norm(found.address1),
          city: norm(found.city),
          state: norm(found.state),
          postal: norm(found.postal),
          posTimeoutMin: norm(found.posSessionTimeoutMinutes ?? 5),
          geofenceRadius: norm(found.geofenceRadiusMeters ?? 150),
        };

        setName(next.name);
        setAddress1(next.address1);
        setCity(next.city);
        setState(next.state);
        setPostal(next.postal);
        setPosTimeoutMin(next.posTimeoutMin);
        setGeofenceRadius(next.geofenceRadius);
        setLatitude(found.latitude || null);
        setLongitude(found.longitude || null);
        setDiscoverability(found.discoverability !== false);
        setStoreCategory(norm(found.category || ""));
        setHoursJson(norm(found.hoursJson || ""));

        initialRef.current = { ...next, discoverability: found.discoverability !== false, storeCategory: norm(found.category || ""), hoursJson: norm(found.hoursJson || "") };

        pvUiHook("merchant.store.edit.load_succeeded.ui", {
          stable: "merchant:store:edit",
          storeId: sid,
        });
      } catch (e) {
        const msg = e?.message || "Failed to load store";
        if (!cancelled) setErr(msg);

        pvUiHook("merchant.store.edit.load_failed.ui", {
          stable: "merchant:store:edit",
          storeId: sid,
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
  }, [sid]);

  const initial = initialRef.current || {
    name: "",
    address1: "",
    city: "",
    state: "",
    postal: "",
    posTimeoutMin: "5",
    geofenceRadius: "150",
  };

  const dirty =
    name !== initial.name ||
    address1 !== initial.address1 ||
    city !== initial.city ||
    state !== initial.state ||
    postal !== initial.postal ||
    posTimeoutMin !== initial.posTimeoutMin ||
    geofenceRadius !== initial.geofenceRadius ||
    discoverability !== initial.discoverability ||
    storeCategory !== initial.storeCategory ||
    hoursJson !== initial.hoursJson;

  function validate() {
    const nm = String(name || "").trim();
    if (!nm) return "Store name is required.";
    if (nm.length > 200) return "Store name is too long.";
    if (String(state || "").trim().length > 8) return "State is too long.";
    if (String(postal || "").trim().length > 20) return "Postal is too long.";
    const t = parseInt(posTimeoutMin, 10);
    if (!Number.isInteger(t) || t < 1 || t > 120) return "POS session timeout must be between 1 and 120 minutes.";
    const g = parseInt(geofenceRadius, 10);
    if (!Number.isInteger(g) || g < 50 || g > 500) return "Geofence radius must be between 50 and 500 meters.";
    return "";
  }

  async function onSave() {
    setErr("");
    setOkMsg("");

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    if (!sid) {
      setErr("Invalid storeId");
      return;
    }

    if (!dirty) {
      setOkMsg("No changes to save.");
      return;
    }

    const payload = {
      name: trimOrNull(name),
      address1: trimOrNull(address1),
      city: trimOrNull(city),
      state: trimOrNull(state),
      postal: trimOrNull(postal),
      posSessionTimeoutMinutes: parseInt(posTimeoutMin, 10),
      geofenceRadiusMeters: parseInt(geofenceRadius, 10),
      discoverability,
      category: storeCategory || null,
      hoursJson: hoursJson || null,
    };

    setSaving(true);
    try {
      pvUiHook("merchant.store.edit.save_started.ui", {
        stable: "merchant:store:edit",
        storeId: sid,
      });

      const updated = await merchantUpdateStoreProfile(sid, payload);

      const next = {
        name: norm(updated?.name),
        address1: norm(updated?.address1),
        city: norm(updated?.city),
        state: norm(updated?.state),
        postal: norm(updated?.postal),
        posTimeoutMin: norm(updated?.posSessionTimeoutMinutes ?? 5),
        geofenceRadius: norm(updated?.geofenceRadiusMeters ?? 150),
      };

      setStore(updated || store);
      setName(next.name);
      setAddress1(next.address1);
      setCity(next.city);
      setState(next.state);
      setPostal(next.postal);
      setPosTimeoutMin(next.posTimeoutMin);
      setGeofenceRadius(next.geofenceRadius);
      if (updated?.latitude) setLatitude(updated.latitude);
      if (updated?.longitude) setLongitude(updated.longitude);
      initialRef.current = next;

      setOkMsg("Saved.");

      pvUiHook("merchant.store.edit.save_succeeded.ui", {
        stable: "merchant:store:edit",
        storeId: sid,
      });
    } catch (e) {
      const msg = e?.message || "Save failed";
      setErr(msg);

      pvUiHook("merchant.store.edit.save_failed.ui", {
        stable: "merchant:store:edit",
        storeId: sid,
        error: msg,
      });
    } finally {
      setSaving(false);
    }
  }

  function onRevert() {
    setErr("");
    setOkMsg("");
    pvUiHook("merchant.store.edit.revert_click.ui", {
      stable: "merchant:store:edit:revert",
      storeId: sid,
      dirty: Boolean(dirty),
    });

    const base = initialRef.current;
    if (base) {
      setName(base.name);
      setAddress1(base.address1);
      setCity(base.city);
      setState(base.state);
      setPostal(base.postal);
      setPosTimeoutMin(base.posTimeoutMin);
      setGeofenceRadius(base.geofenceRadius);
      setOkMsg("Reverted.");
      return;
    }
    navigate(`/merchant/stores/${sid}`, { replace: false });
  }

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;

  // Forbidden block (role gate)
  if (!canManage) {
    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to={`/merchant/stores/${sid}`} style={breadcrumbLink}>
            ← Back to Store
          </Link>
          <span style={sep}>·</span>
          <Link to="/merchant/stores" style={breadcrumbLink}>
            My Stores
          </Link>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: COLORS.dangerBg,
            border: `1px solid ${COLORS.dangerBorder}`,
            color: COLORS.dangerText,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Forbidden</div>
          <div style={{ marginBottom: 10 }}>
            Store profile editing is available only to <code>merchant_admin</code> (or <code>owner</code>).
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Merchant role: <code>{merchantRole || "unknown"}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Breadcrumbs */}
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to={`/merchant/stores/${sid}`} style={breadcrumbLink}>
          ← Back to Store
        </Link>
        <span style={sep}>·</span>
        <Link to="/merchant/stores" style={breadcrumbLink}>
          My Stores
        </Link>
      </div>

      {/* Title row */}
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Edit Store Profile</h2>
          <div style={{ color: COLORS.neutral, marginBottom: 4 }}>
            StoreId <code>{sid}</code>
            {store?.name ? (
              <>
                {" "}
                · Current <code>{store.name}</code>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Messages */}
      {err ? (
        <div style={alertError}>
          {err}
        </div>
      ) : null}

      {okMsg ? (
        <div style={alertOk}>
          {okMsg}
        </div>
      ) : null}

      {/* Card */}
      <div style={card}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Profile</div>

        <div style={row}>
          <div style={label}>Store name</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Main Store"
            style={input}
            autoComplete="off"
          />
        </div>

        <div style={row}>
          <div style={label}>Address1</div>
          <input
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
            placeholder="Street address"
            style={input}
            autoComplete="off"
          />
        </div>

        <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)" }}>
          <div style={cell}>
            <div style={label}>City</div>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              style={input}
              autoComplete="off"
            />
          </div>

          <div style={cell}>
            <div style={label}>State</div>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="CA"
              style={input}
              autoComplete="off"
            />
          </div>
        </div>

        <div style={row}>
          <div style={label}>Postal</div>
          <input
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
            placeholder="Postal / ZIP"
            style={input}
            autoComplete="off"
          />
        </div>

        <div style={row}>
          <div style={label}>POS session timeout (minutes)</div>
          <input
            value={posTimeoutMin}
            onChange={(e) => setPosTimeoutMin(e.target.value)}
            type="number"
            min="1"
            max="120"
            placeholder="5"
            style={{ ...input, maxWidth: 120 }}
            autoComplete="off"
          />
          <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4 }}>
            How long a POS associate session stays active without any interaction. Default: 5 min. Range: 1–120.
          </div>
        </div>

        {/* Geofencing */}
        <div style={{ ...row, borderTop: `1px solid ${color.border}`, paddingTop: 16, marginTop: 8 }}>
          <div style={{ ...label, fontSize: 15, fontWeight: 700 }}>Geofencing</div>
        </div>

        {latitude && longitude ? (
          <div style={row}>
            <div style={label}>Store coordinates</div>
            <div style={{ fontSize: 13, color: color.textMuted }}>
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </div>
          </div>
        ) : (
          <div style={row}>
            <div style={label}>Store coordinates</div>
            <div style={{ fontSize: 13, color: color.textMuted, fontStyle: "italic" }}>
              Not set — coordinates will be geocoded from the store address when a POS is connected.
            </div>
          </div>
        )}

        <div style={row}>
          <div style={label}>Geofence radius (meters)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(e.target.value)}
              style={{ flex: 1, maxWidth: 200 }}
            />
            <input
              value={geofenceRadius}
              onChange={(e) => setGeofenceRadius(e.target.value)}
              type="number"
              min="50"
              max="500"
              style={{ ...input, maxWidth: 80 }}
            />
            <span style={{ fontSize: 13, color: color.textMuted }}>m</span>
          </div>
          <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4 }}>
            How close a consumer must be for automatic check-in. Default: 150m. Range: 50–500m.
          </div>
        </div>

        {/* Discover */}
        <div style={{ ...row, borderTop: `1px solid ${color.border}`, paddingTop: 16, marginTop: 8 }}>
          <div style={{ ...label, fontSize: 15, fontWeight: 700 }}>Discover</div>
        </div>

        <div style={row}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={discoverability}
              onChange={(e) => setDiscoverability(e.target.checked)}
            />
            <span style={{ fontSize: 14, color: color.text }}>Show this store in PerkValet Discover</span>
          </label>
          <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4 }}>
            When enabled, consumers can find this store on the Discover map and join your loyalty programs.
          </div>
        </div>

        <div style={row}>
          <div style={label}>Business category</div>
          <select
            value={storeCategory}
            onChange={(e) => setStoreCategory(e.target.value)}
            style={{ ...input, maxWidth: 220 }}
          >
            <option value="">Select...</option>
            <option value="cafe">Cafe / Coffee Shop</option>
            <option value="restaurant">Restaurant</option>
            <option value="salon">Salon / Spa</option>
            <option value="retail">Retail</option>
            <option value="auto">Automotive</option>
            <option value="pet">Pet Services</option>
            <option value="fitness">Fitness / Gym</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Footer actions */}
        <div style={footerRow}>
          <div style={{ fontSize: 12, color: COLORS.neutral }}>
            {dirty ? "Unsaved changes" : "No changes"}
            {saving ? " · Saving…" : ""}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onRevert}
              disabled={saving || !dirty}
              style={pill(saving || !dirty)}
            >
              Revert
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              style={pill(saving || !dirty)}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: COLORS.neutral }}>
        Screen <code>MerchantStoreEdit</code> · StoreId <code>{sid}</code>
      </div>
    </div>
  );
}

/* ---------------- styles ---------------- */

const alertError = {
  marginTop: 10,
  background: color.dangerSubtle,
  border: `1px solid ${color.dangerBorder}`,
  padding: 10,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
  color: color.danger,
};

const alertOk = {
  marginTop: 10,
  background: COLORS.okBg,
  border: `1px solid ${COLORS.okBorder}`,
  padding: 10,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
  color: color.text,
};

const card = {
  marginTop: 12,
  width: "100%",
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: 14,
  background: color.cardBg,
  boxSizing: "border-box",
  overflow: "hidden",
};

const row = { marginBottom: 10, minWidth: 0 };

const label = {
  fontSize: 12,
  fontWeight: 900,
  color: color.textMuted,
  marginBottom: 6,
};

const input = {
  ...themeInput,
  maxWidth: "100%",
  minWidth: 0,
  display: "block",
};

const grid2 = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 12,
  marginBottom: 10,
  minWidth: 0,
};

const cell = { minWidth: 0 };

const footerRow = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
};
