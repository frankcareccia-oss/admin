/**
 * MerchantDetail.jsx — Merchant Hub
 *
 * Hub-and-spoke landing page for a merchant.
 * Each domain (Setup, Team, Stores, Products, Billing) is a card.
 * Future domains (Rewards, Reporting) shown grayed out.
 */

import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { getMerchant, adminListMerchantUsers, adminListMerchantProducts, getSystemRole } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";
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

      <div style={{ marginTop: 24 }} />

      {/* Hub card grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
        gap: 16,
      }}>
        {cards.map((c) => (
          <HubCard key={c.title} {...c} />
        ))}
      </div>

      <SupportInfo context={{ page: "MerchantHub", merchantId, lastError, lastSuccessTs }} />
    </PageContainer>
  );
}

const styles = {
  refreshBtn: { padding: "10px 12px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontWeight: 800 },
  errBox: { background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`, padding: 10, borderRadius: 12 },
};
