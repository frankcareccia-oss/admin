/**
 * MerchantDashboard.jsx
 *
 * Merchant portal hub — mirrors the AdminHome card layout exactly.
 * Route: /merchant/dashboard
 */

import React from "react";
import { Link } from "react-router-dom";
import { color } from "../theme";
import {
  me,
  listMerchantStores,
  merchantListUsers,
  merchantListProducts,
  merchantListPromotions,
  merchantListBundles,
  merchantListInvoices,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

// ── Exact copy of AdminCard from AdminHome.jsx ─────────────────────────────────
function AdminCard({ to, icon, title, description, meta, disabled }) {
  const inner = (
    <div style={{
      border: `1px solid ${disabled ? color.borderSubtle : color.border}`,
      borderRadius: 16,
      padding: "24px 24px 20px",
      background: disabled ? "rgba(0,0,0,0.02)" : color.cardBg,
      cursor: disabled ? "default" : "pointer",
      height: "100%",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      opacity: disabled ? 0.50 : 1,
      transition: "box-shadow 0.15s, border-color 0.15s",
    }}>
      <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 16, color: disabled ? color.textFaint : color.text }}>
        {title}
        {disabled && (
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 700,
            background: "rgba(0,0,0,0.07)", borderRadius: 999,
            padding: "2px 8px", verticalAlign: "middle",
            color: color.textFaint,
          }}>
            Coming soon
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: color.textMuted, lineHeight: 1.5, flex: 1 }}>
        {description}
      </div>
      {meta && !disabled && (
        <div style={{ fontSize: 12, fontWeight: 700, color: color.textFaint, marginTop: 4 }}>
          {meta}
        </div>
      )}
    </div>
  );

  if (disabled) return <div style={{ cursor: "default" }}>{inner}</div>;

  return (
    <Link
      to={to}
      style={{ textDecoration: "none", color: "inherit" }}
      onClick={() => pvUiHook("merchant.dashboard.card.click", { card: title, to })}
    >
      {inner}
    </Link>
  );
}

// ── Count helpers ──────────────────────────────────────────────────────────────

function resolveCount(result, keys) {
  if (result.status !== "fulfilled") return null;
  const v = result.value;
  for (const k of keys) {
    if (Array.isArray(v?.[k])) return v[k].length;
  }
  if (Array.isArray(v)) return v.length;
  return null;
}

function countLabel(n, singular, plural) {
  if (n === null) return null;
  return `${n} ${n === 1 ? singular : (plural || singular + "s")}`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function MerchantDashboard() {
  const [merchantName, setMerchantName] = React.useState("");
  const [merchantId, setMerchantId]     = React.useState(null);
  const [loading, setLoading]           = React.useState(true);
  const [err, setErr]                   = React.useState(null);
  const [counts, setCounts]             = React.useState({
    stores: null, team: null, products: null,
    promotions: null, bundles: null, invoices: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const profile = await me();
        if (cancelled) return;

        const mid =
          profile?.user?.merchantUsers?.[0]?.merchantId ??
          profile?.user?.merchantUsers?.[0]?.merchant?.id ??
          null;
        const name =
          profile?.user?.merchantUsers?.[0]?.merchant?.name ??
          "";

        if (!mid) {
          setErr("Could not determine your merchant account.");
          setLoading(false);
          return;
        }

        setMerchantId(mid);
        setMerchantName(name);
        setLoading(false);

        const [storesR, teamR, productsR, promosR, bundlesR, invoicesR] =
          await Promise.allSettled([
            listMerchantStores(),
            merchantListUsers({ merchantId: mid }),
            merchantListProducts(),
            merchantListPromotions(),
            merchantListBundles(),
            merchantListInvoices(),
          ]);

        if (cancelled) return;

        setCounts({
          stores:     resolveCount(storesR,   ["stores"]),
          team:       resolveCount(teamR,      ["users"]),
          products:   resolveCount(productsR,  ["products"]),
          promotions: resolveCount(promosR,    ["promotions"]),
          bundles:    resolveCount(bundlesR,   ["bundles"]),
          invoices:   resolveCount(invoicesR,  ["invoices"]),
        });
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load dashboard.");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.textMuted }}>Loading…</div>
      </PageContainer>
    );
  }

  if (err) {
    return (
      <PageContainer>
        <div style={{ padding: 24, color: color.danger }}>{err}</div>
      </PageContainer>
    );
  }

  const CARDS = [
    {
      to: "/merchant/stores",
      icon: "🏪",
      title: "My Stores",
      description: "Manage your store locations, hours, and QR codes.",
      meta: countLabel(counts.stores, "store"),
    },
    {
      to: "/merchant/invoices",
      icon: "🧾",
      title: "Billing",
      description: "View invoices and payment history for your account.",
      meta: countLabel(counts.invoices, "invoice"),
    },
    {
      to: "/merchant/users",
      icon: "👥",
      title: "Team",
      description: "Invite and manage staff members and their portal access.",
      meta: countLabel(counts.team, "member"),
    },
    {
      to: "/merchant/products",
      icon: "📦",
      title: "Products",
      description: "Set up categories and items for use in promotions and bundles.",
      meta: countLabel(counts.products, "product"),
    },
    {
      to: "/merchant/promotions",
      icon: "🎯",
      title: "Promotions",
      description: "Create stamp cards, points programs, and loyalty rewards for your customers.",
      meta: countLabel(counts.promotions, "promotion"),
    },
    {
      to: "/merchant/bundles",
      icon: "🎁",
      title: "Bundles",
      description: "Package products and services into bundles customers can purchase upfront.",
      meta: countLabel(counts.bundles, "bundle"),
    },
    {
      to: "/merchant/reports",
      icon: "📊",
      title: "Reports",
      description: "Visit volume, loyalty activity, and redemption trends for your business.",
      meta: null,
    },
    {
      to: "/merchant/settings",
      icon: "⚙️",
      title: "Settings",
      description: "Manage your profile, change your password, and configure account preferences.",
      meta: null,
    },
  ];

  return (
    <PageContainer size="wide">
      <PageHeader
        title={merchantName || "My Dashboard"}
        subtitle="Select a section to get started."
      />

      <div style={{ marginTop: 24 }} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 20,
      }}>
        {CARDS.map((c) => (
          <AdminCard key={c.title} {...c} />
        ))}
      </div>
    </PageContainer>
  );
}
