/**
 * MerchantDetail.jsx — Merchant Hub
 *
 * Hub-and-spoke landing page for a merchant.
 * Each domain (Setup, Team, Stores, Products, Billing) is a card.
 * Future domains (Rewards, Reporting) shown grayed out.
 */

import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { getMerchant, adminListMerchantUsers, adminListMerchantProducts, getSystemRole, updateMerchantType, adminUpdateTeamSetup } from "../api/client";
import { MERCHANT_TYPE_OPTIONS, MERCHANT_TYPE_LABELS } from "../config/merchantTypes";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import useBreakpoint from "../hooks/useBreakpoint";
import { color, btn } from "../theme";

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

function HubCard({ to, icon, title, description, meta, disabled }) {
  const inner = (
    <div style={{
      border: `1px solid ${disabled ? color.borderSubtle : color.border}`,
      borderRadius: 16,
      padding: "20px 22px",
      background: disabled ? "rgba(0,0,0,0.02)" : color.cardBg,
      cursor: disabled ? "default" : "pointer",
      transition: "box-shadow 0.15s",
      height: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      opacity: disabled ? 0.55 : 1,
    }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: disabled ? color.textFaint : color.text }}>
        {title}
        {disabled && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: color.border, borderRadius: 999, padding: "2px 8px", verticalAlign: "middle" }}>Coming soon</span>}
      </div>
      <div style={{ fontSize: 13, color: color.textMuted, lineHeight: 1.4 }}>{description}</div>
      {meta != null && !disabled && (
        <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 12, fontWeight: 700, color: color.textFaint }}>{meta}</div>
      )}
    </div>
  );

  if (disabled) return <div>{inner}</div>;

  return (
    <Link
      to={to}
      style={{ textDecoration: "none", color: "inherit" }}
      onClick={() => pvUiHook("merchant.hub.card.click", { card: title, to })}
    >
      {inner}
    </Link>
  );
}

export default function MerchantDetail() {
  const { merchantId } = useParams();
  const { isMobile, isTablet } = useBreakpoint();

  // Merchant users should not access this admin-only page
  if (getSystemRole() !== "pv_admin") {
    return <Navigate to="/merchant/dashboard" replace />;
  }

  const [merchant, setMerchant] = React.useState(null);
  const [userCount, setUserCount] = React.useState(null);
  const [productCount, setProductCount] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [lastError, setLastError] = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");

  const [editingType, setEditingType] = React.useState(false);
  const [typeVal, setTypeVal] = React.useState("");
  const [typeSaving, setTypeSaving] = React.useState(false);
  const [typeSaveErr, setTypeSaveErr] = React.useState("");

  const [editingTeam, setEditingTeam] = React.useState(false);
  const [teamVal, setTeamVal] = React.useState("");
  const [teamSaving, setTeamSaving] = React.useState(false);
  const [teamSaveErr, setTeamSaveErr] = React.useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const [mRes, uRes, pRes] = await Promise.allSettled([
        getMerchant(merchantId),
        adminListMerchantUsers(merchantId),
        adminListMerchantProducts(merchantId),
      ]);

      if (mRes.status === "fulfilled") {
        setMerchant(mRes.value);
        setLastSuccessTs(new Date().toISOString());
        pvUiHook("merchant.hub.loaded", { merchantId, status: mRes.value?.status });
      } else {
        throw new Error(mRes.reason?.message || "Failed to load merchant");
      }

      if (uRes.status === "fulfilled") setUserCount((uRes.value?.users || []).length);
      if (pRes.status === "fulfilled") setProductCount((pRes.value?.items || []).length);
    } catch (e) {
      const msg = e?.message || "Failed to load merchant";
      setErr(msg);
      setLastError(msg);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [merchantId]);

  React.useEffect(() => {
    if (merchant) {
      setTypeVal(merchant.merchantType || "");
      setTeamVal(merchant.teamSetupMode || "");
    }
  }, [merchant]);

  async function handleTeamSave() {
    setTeamSaving(true);
    setTeamSaveErr("");
    try {
      await adminUpdateTeamSetup(merchantId, teamVal);
      setMerchant(m => ({ ...m, teamSetupMode: teamVal, teamSetupComplete: true }));
      setEditingTeam(false);
    } catch (e) {
      setTeamSaveErr(e?.message || "Save failed");
    } finally {
      setTeamSaving(false);
    }
  }

  async function handleTypeSave() {
    setTypeSaving(true);
    setTypeSaveErr("");
    try {
      await updateMerchantType(merchantId, typeVal || null);
      setMerchant(m => ({ ...m, merchantType: typeVal || null }));
      setEditingType(false);
    } catch (e) {
      setTypeSaveErr(e?.message || "Save failed");
    } finally {
      setTypeSaving(false);
    }
  }

  if (loading) return <PageContainer><div style={{ padding: 16 }}>Loading…</div></PageContainer>;
  if (err && !merchant) return <PageContainer><div style={styles.errBox}>{err}</div></PageContainer>;
  if (!merchant) return <PageContainer><div style={{ padding: 16 }}>Merchant not found</div></PageContainer>;

  const base = `/merchants/${merchantId}`;
  const storeCount = merchant.storeCount ?? merchant.stores?.length ?? null;

  const cards = [
    {
      to: `${base}/setup`,
      icon: "⚙️",
      title: "Setup",
      description: "Merchant profile, status, and primary contact.",
      meta: merchant.status ? `Status: ${merchant.status}` : null,
    },
    {
      to: `${base}/users`,
      icon: "👥",
      title: "Team",
      description: "Manage users, roles, and merchant-level access.",
      meta: userCount != null ? `${userCount} user${userCount !== 1 ? "s" : ""}` : null,
    },
    {
      to: `${base}/stores`,
      icon: "🏪",
      title: "Stores",
      description: "Store locations, QR codes, and store-level settings.",
      meta: storeCount != null ? `${storeCount} store${storeCount !== 1 ? "s" : ""}` : null,
    },
    {
      to: `${base}/products`,
      icon: "📦",
      title: "Products",
      description: "Product and service catalog. SKUs, names, and status.",
      meta: productCount != null ? `${productCount} product${productCount !== 1 ? "s" : ""}` : null,
    },
    {
      to: `${base}/billing`,
      icon: "💳",
      title: "Billing",
      description: "Billing account, contact, and payment policy.",
      meta: null,
    },
    {
      to: `${base}/invoices`,
      icon: "🧾",
      title: "Invoices",
      description: "Invoice history, payment status, and draft generation.",
      meta: null,
    },
    {
      to: `${base}/promotions`,
      icon: "🎁",
      title: "Promotions",
      description: "Define earn items, promotion rules, and publish offer sets.",
      meta: null,
    },
    {
      to: `${base}/bundles`,
      icon: "🎫",
      title: "Bundles",
      description: "Prepaid credit packs. Sell 10 coffees upfront, redeem 1 per visit.",
      meta: null,
    },
    {
      to: `/merchants/${merchantId}/reports`,
      icon: "📊",
      title: "Reports",
      description: "Visit analytics, reward redemption, and promotion funnel.",
    },
  ];

  return (
    <PageContainer size="wide">
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <span>{merchant.name}</span>
      </div>

      <PageHeader
        title={merchant.name}
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge status={merchant.status} />
            <span style={{ fontSize: 12, color: color.textFaint }}>
              ID: {merchant.id}
              {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
            </span>
          </span>
        }
        right={<button onClick={load} style={styles.refreshBtn}>Refresh</button>}
      />

      <div style={{ marginTop: 20 }} />

      {/* Business Type row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginBottom: 20,
        padding: "10px 14px",
        border: `1px solid ${color.border}`,
        borderRadius: 12,
        background: color.cardBg,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: color.textMuted, whiteSpace: "nowrap" }}>Business type</span>
        {editingType ? (
          <>
            <select
              value={typeVal}
              onChange={e => setTypeVal(e.target.value)}
              disabled={typeSaving}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${color.borderInput}`, fontSize: 13 }}
            >
              <option value="">Not specified</option>
              {MERCHANT_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button onClick={handleTypeSave} disabled={typeSaving} style={{ ...styles.smallBtn, background: color.primary, color: "#fff", border: "none" }}>
              {typeSaving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditingType(false); setTypeVal(merchant?.merchantType || ""); setTypeSaveErr(""); }}
              disabled={typeSaving}
              style={styles.smallBtn}
            >
              Cancel
            </button>
            {typeSaveErr && <span style={{ fontSize: 13, color: color.danger }}>{typeSaveErr}</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: merchant?.merchantType ? color.text : color.textFaint }}>
              {merchant?.merchantType ? MERCHANT_TYPE_LABELS[merchant.merchantType] || merchant.merchantType : "Not set"}
            </span>
            <button onClick={() => { setTypeVal(merchant?.merchantType || ""); setEditingType(true); }} style={styles.smallBtn}>
              Edit
            </button>
          </>
        )}
      </div>

      {/* Team setup mode row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        marginBottom: 20,
        padding: "10px 14px",
        border: `1px solid ${color.border}`,
        borderRadius: 12,
        background: color.cardBg,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: color.textMuted, whiteSpace: "nowrap" }}>Team setup</span>
        {editingTeam ? (
          <>
            <select
              value={teamVal}
              onChange={e => setTeamVal(e.target.value)}
              disabled={teamSaving}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${color.borderInput}`, fontSize: 13 }}
            >
              <option value="" disabled>Select mode…</option>
              <option value="individual">Individual — per-associate tracking</option>
              <option value="shared">Shared — one register login</option>
              <option value="solo">Solo — single operator</option>
              <option value="external">External — managed elsewhere</option>
            </select>
            <button onClick={handleTeamSave} disabled={teamSaving || !teamVal} style={{ ...styles.smallBtn, background: color.primary, color: "#fff", border: "none" }}>
              {teamSaving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditingTeam(false); setTeamVal(merchant?.teamSetupMode || ""); setTeamSaveErr(""); }}
              disabled={teamSaving}
              style={styles.smallBtn}
            >
              Cancel
            </button>
            {teamSaveErr && <span style={{ fontSize: 13, color: color.danger }}>{teamSaveErr}</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: 13, color: merchant?.teamSetupMode ? color.text : color.textFaint }}>
              {merchant?.teamSetupMode
                ? { individual: "Individual", shared: "Shared register", solo: "Solo operator", external: "External" }[merchant.teamSetupMode] || merchant.teamSetupMode
                : "Not configured"}
            </span>
            <button onClick={() => { setTeamVal(merchant?.teamSetupMode || ""); setEditingTeam(true); }} style={styles.smallBtn}>
              Edit
            </button>
          </>
        )}
      </div>

      {/* Hub card grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}>
        {cards.map((c) => (
          <HubCard key={c.title} {...c} />
        ))}
      </div>

    </PageContainer>
  );
}

const styles = {
  refreshBtn: { padding: "10px 12px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 800 },
  errBox: { background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`, padding: 10, borderRadius: 12 },
  smallBtn: { padding: "5px 12px", borderRadius: 8, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 700, fontSize: 13 },
};
