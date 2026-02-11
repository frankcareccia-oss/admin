// admin/src/pages/MerchantStoreDetail.jsx
import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listMerchantStores, me } from "../api/client";

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

/* ---------------- UI palette ---------------- */

const COLORS = {
  primary: "#2563EB",
  neutral: "rgba(0,0,0,0.55)",

  success: "#16A34A",
  warning: "#D97706",
  muted: "#6B7280",

  dangerBg: "rgba(254, 226, 226, 0.85)",
  dangerBorder: "rgba(252, 165, 165, 0.9)",
  dangerText: "#991B1B",
};

const breadcrumbLink = {
  textDecoration: "underline",
  color: COLORS.primary,
  fontWeight: 700,
};

const sep = { color: "rgba(0,0,0,0.35)" };

const primaryPill = {
  padding: "10px 16px",
  borderRadius: 999,
  border: "none",
  background: COLORS.primary,
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryPillDisabled = {
  ...primaryPill,
  opacity: 0.55,
  cursor: "not-allowed",
};

/* ---------------- helpers ---------------- */

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v !== null && v !== undefined && typeof v !== "object") return String(v);
  }
  return "";
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

function statusBadgeStyle(status) {
  const s = String(status || "").toLowerCase();
  const color =
    s === "active" ? COLORS.success : s === "suspended" ? COLORS.warning : COLORS.muted;

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
  };
}

/* ---------------- component ---------------- */

export default function MerchantStoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = React.useState(null);
  const [merchantRole, setMerchantRole] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  const sid = Number(storeId) || null;
  const canManage = merchantRole === "merchant_admin" || merchantRole === "owner";

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      pvUiHook("merchant.store.detail.load_started.ui", {
        stable: "merchant:store:detail",
        storeId: sid,
      });

      try {
        // Resolve merchant membership role (NOT systemRole)
        const prof = await me();
        const mr =
          pickDeep(prof, ["user.merchantUsers.0.role", "merchantUser.role", "membership.role", "role"]) || null;

        if (!cancelled) setMerchantRole(mr ? String(mr) : null);

        pvUiHook("merchant.store.detail.role_resolved.ui", {
          stable: "merchant:store:detail:role",
          storeId: sid,
          merchantRole: mr ? String(mr) : null,
          merchantRolePath: mr ? "user.merchantUsers[0].role" : null,
        });

        const data = await listMerchantStores();
        const found = (data?.items || []).find((s) => s.id === sid);

        if (!found) throw new Error("Store not found (not in your merchant scope).");

        if (!cancelled) setStore(found);

        pvUiHook("merchant.store.detail.load_succeeded.ui", {
          stable: "merchant:store:detail",
          storeId: sid,
        });
      } catch (e) {
        const msg = e?.message || "Failed to load store";
        if (!cancelled) setErr(msg);

        pvUiHook("merchant.store.detail.load_failed.ui", {
          stable: "merchant:store:detail",
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
  }, [storeId]);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (err) return <div style={{ padding: 20, color: "crimson" }}>{err}</div>;
  if (!store) return <div style={{ padding: 20 }}>Store not loaded</div>;

  const displayName =
    firstNonEmpty(store.name, store.storeName, store.displayName, store.title) || `Store #${store.id}`;

  const address1 = firstNonEmpty(store.address1, store.address, store.street1, store.line1);
  const city = firstNonEmpty(store.city, store.town);
  const state = firstNonEmpty(store.state, store.region);
  const postal = firstNonEmpty(store.postal, store.zip, store.postalCode);
  const addressLine = [address1, city, state, postal].filter(Boolean).join(", ");

  const phone = firstNonEmpty(
    store.phone,
    store.mainPhone,
    store.contactPhone,
    store.phoneE164,
    store.phoneRaw,
    store.phoneNumber
  );

  const status = firstNonEmpty(store.status, store.storeStatus);

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Breadcrumbs (links) */}
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/merchant/stores" style={breadcrumbLink}>
          ← Back to My Stores
        </Link>

        <span style={sep}>·</span>

        <Link to={`/merchant/stores/${store.id}`} style={breadcrumbLink}>
          Refresh
        </Link>
      </div>

      {/* Title row + primary action (pill) */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>{displayName}</h2>
          <div style={{ color: COLORS.neutral }}>
            StoreId <code>{store.id}</code>
          </div>
        </div>

        <button
          type="button"
          style={canManage ? primaryPill : primaryPillDisabled}
          disabled={!canManage}
          onClick={() => {
            pvUiHook("merchant.store.detail.edit_click.ui", {
              stable: "merchant:store:detail:edit",
              storeId: store.id,
              merchantRole: merchantRole || "unknown",
            });
            navigate(`/merchant/stores/${store.id}/edit`);
          }}
          title={canManage ? "Edit store profile" : "Only merchant_admin/owner can edit store profile"}
        >
          Edit Store Profile
        </button>
      </div>

      {/* Status */}
      {status ? (
        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <span style={statusBadgeStyle(status)}>{status}</span>
        </div>
      ) : (
        <div style={{ marginTop: 10 }} />
      )}

      {/* Address */}
      {addressLine ? (
        <div style={{ color: "rgba(0,0,0,0.70)", marginBottom: 8 }}>{addressLine}</div>
      ) : (
        <div style={{ color: COLORS.dangerText, marginBottom: 8 }}>Address not available in merchant payload.</div>
      )}

      {/* Phone warning (current known gap) */}
      {!phone ? (
        <div
          style={{
            marginTop: 10,
            background: COLORS.dangerBg,
            border: `1px solid ${COLORS.dangerBorder}`,
            color: COLORS.dangerText,
            padding: 10,
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          Main phone not available in merchant payload.
        </div>
      ) : (
        <div style={{ marginTop: 10, color: "rgba(0,0,0,0.70)" }}>
          Main phone: <b>{phone}</b>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: COLORS.neutral }}>
        Screen <code>MerchantStoreDetail</code> · SystemRole <code>merchant</code> · MerchantRole{" "}
        <code>{merchantRole || "unknown"}</code> · StoreId <code>{store.id}</code>
      </div>
    </div>
  );
}
