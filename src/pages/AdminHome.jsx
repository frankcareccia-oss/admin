/**
 * AdminHome.jsx — PV Admin Dashboard
 *
 * Top-level card hub for pv_admin.
 * Each major platform capability is a card.
 * Future capabilities shown grayed out with "Coming soon".
 */

import React from "react";
import { Link } from "react-router-dom";
import SupportInfo from "../components/SupportInfo";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

function AdminCard({ to, icon, title, description, meta, disabled }) {
  const inner = (
    <div style={{
      border: `1px solid ${disabled ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.12)"}`,
      borderRadius: 16,
      padding: "24px 24px 20px",
      background: disabled ? "rgba(0,0,0,0.02)" : "#fff",
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
      <div style={{ fontWeight: 800, fontSize: 16, color: disabled ? "rgba(0,0,0,0.40)" : "#0B2A33" }}>
        {title}
        {disabled && (
          <span style={{
            marginLeft: 8, fontSize: 11, fontWeight: 700,
            background: "rgba(0,0,0,0.07)", borderRadius: 999,
            padding: "2px 8px", verticalAlign: "middle",
            color: "rgba(0,0,0,0.40)",
          }}>
            Coming soon
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.50)", lineHeight: 1.5, flex: 1 }}>
        {description}
      </div>
      {meta && !disabled && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.35)", marginTop: 4 }}>
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
      onClick={() => pvUiHook("admin.home.card.click", { card: title, to })}
    >
      {inner}
    </Link>
  );
}

const CARDS = [
  {
    to: "/merchants",
    icon: "🏢",
    title: "Merchants",
    description: "Onboard and manage merchant accounts. View stores, teams, products, and billing per merchant.",
  },
  {
    to: "/admin/billing-policy",
    icon: "📋",
    title: "Billing Policy",
    description: "Set platform-wide fee schedules, net terms, and late fee rules that apply to all merchants.",
  },
  {
    to: "/admin/invoices",
    icon: "🧾",
    title: "Invoices",
    description: "View, generate, issue, and void invoices across all merchants. Monitor payment status.",
  },
  {
    to: null,
    icon: "📊",
    title: "Reporting",
    description: "Platform-wide analytics — visit volume, reward activity, revenue rollups, and merchant health.",
    disabled: true,
  },
  {
    to: null,
    icon: "🔔",
    title: "Alerts",
    description: "Automated alerts for past-due invoices, suspended merchants, and system health events.",
    disabled: true,
  },
  {
    to: null,
    icon: "🛠️",
    title: "Platform Settings",
    description: "System configuration, integrations, and platform-level access control.",
    disabled: true,
  },
];

export default function AdminHome() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="PerkValet Admin"
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

      <SupportInfo context={{ page: "AdminHome" }} />
    </PageContainer>
  );
}
