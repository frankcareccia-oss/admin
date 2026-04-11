// src/pages/AdminPaymentEvents.jsx — Unified payment event audit view

import { useState, useEffect } from "react";
import { getAccessToken } from "../api/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function apiGet(path) {
  const token = getAccessToken();
  const res = await fetch(API_BASE + path, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("API error: " + res.status);
  return res.json();
}

const s = {
  page: { padding: "24px 32px", maxWidth: 1200, margin: "0 auto" },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 20 },
  filters: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" },
  select: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, background: "#fff" },
  input: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 },
  btn: { padding: "8px 14px", borderRadius: 6, border: "none", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  btnPrimary: { background: "#2563eb", color: "#fff" },
  btnOutline: { background: "#fff", color: "#374151", border: "1px solid #d1d5db" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", fontSize: 10, color: "#6b7280", textTransform: "uppercase", whiteSpace: "nowrap" },
  td: { padding: "7px 10px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" },
  badge: { display: "inline-block", padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 600 },
  sourceSquare: { background: "#dbeafe", color: "#1d4ed8" },
  sourceStripe: { background: "#ede9fe", color: "#7c3aed" },
  sourceGrocery: { background: "#dcfce7", color: "#16a34a" },
  sourceManual: { background: "#f3f4f6", color: "#374151" },
  typeBadge: { background: "#f3f4f6", color: "#374151", display: "inline-block", padding: "2px 6px", borderRadius: 4, fontSize: 10 },
  summary: { display: "flex", gap: 16, marginBottom: 20 },
  stat: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", minWidth: 120 },
  statNum: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 11, color: "#6b7280" },
  empty: { textAlign: "center", color: "#9ca3af", padding: 40, fontSize: 14 },
  mono: { fontFamily: "monospace", fontSize: 11, color: "#6b7280" },
};

const SOURCE_COLORS = {
  square: s.sourceSquare,
  stripe: s.sourceStripe,
  grocery: s.sourceGrocery,
  manual: s.sourceManual,
};

function fmt(cents) {
  return "$" + (cents / 100).toFixed(2);
}

function shortDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AdminPaymentEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("");
  const [eventType, setEventType] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [settlement, setSettlement] = useState(null);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (source) params.set("source", source);
      if (eventType) params.set("eventType", eventType);
      if (merchantId) params.set("merchantId", merchantId);
      params.set("limit", "200");
      const data = await apiGet("/admin/payment-events?" + params.toString());
      setEvents(data.items || []);
    } catch (e) {
      console.error("Failed to load events:", e);
      setEvents([]);
    }
    setLoading(false);
  }

  async function loadSettlement() {
    try {
      const params = new URLSearchParams();
      if (merchantId) params.set("merchantId", merchantId);
      const data = await apiGet("/admin/settlement-report?" + params.toString());
      setSettlement(data);
    } catch (e) {
      setSettlement(null);
    }
  }

  async function exportCsv() {
    try {
      const params = new URLSearchParams();
      if (merchantId) params.set("merchantId", merchantId);
      params.set("format", "csv");
      const token = localStorage.getItem("perkvalet_access_token");
      const res = await fetch(
        (import.meta.env.VITE_API_URL || "http://localhost:3001") + "/admin/settlement-report?" + params.toString(),
        { headers: { Authorization: "Bearer " + token } }
      );
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "settlement-report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV export failed:", e);
    }
  }

  useEffect(() => {
    loadEvents();
    loadSettlement();
  }, [source, eventType, merchantId]);

  const totalCents = events.reduce((s, e) => s + (e.amountCents || 0), 0);
  const sources = [...new Set(events.map(e => e.source))];

  return (
    <div style={s.page}>
      <div style={s.title}>Payment Event Audit Ledger</div>
      <div style={s.subtitle}>Immutable record of all payment and subsidy events across Square, Stripe, and Grocery</div>

      <div style={s.summary}>
        <div style={s.stat}>
          <div style={s.statNum}>{events.length}</div>
          <div style={s.statLabel}>Events</div>
        </div>
        <div style={s.stat}>
          <div style={s.statNum}>{fmt(totalCents)}</div>
          <div style={s.statLabel}>Total Amount</div>
        </div>
        <div style={s.stat}>
          <div style={s.statNum}>{sources.length}</div>
          <div style={s.statLabel}>Sources</div>
        </div>
        {settlement && (
          <div style={s.stat}>
            <div style={{ ...s.statNum, color: "#16a34a" }}>{fmt(settlement.totalSubsidyCents || 0)}</div>
            <div style={s.statLabel}>Total Subsidies</div>
          </div>
        )}
      </div>

      <div style={s.filters}>
        <div style={s.field}>
          <label style={s.label}>Source</label>
          <select style={s.select} value={source} onChange={e => setSource(e.target.value)}>
            <option value="">All Sources</option>
            <option value="square">Square</option>
            <option value="stripe">Stripe</option>
            <option value="grocery">Grocery</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Event Type</label>
          <select style={s.select} value={eventType} onChange={e => setEventType(e.target.value)}>
            <option value="">All Types</option>
            <option value="payment_created">Payment Created</option>
            <option value="payment_completed">Payment Completed</option>
            <option value="payment_failed">Payment Failed</option>
            <option value="payment_refunded">Payment Refunded</option>
            <option value="subsidy_applied">Subsidy Applied</option>
            <option value="subsidy_reversed">Subsidy Reversed</option>
            <option value="settlement_generated">Settlement Generated</option>
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Merchant ID</label>
          <input style={s.input} type="text" placeholder="All" value={merchantId}
            onChange={e => setMerchantId(e.target.value)} />
        </div>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => { loadEvents(); loadSettlement(); }}>
          Refresh
        </button>
        <button style={{ ...s.btn, ...s.btnOutline }} onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      {loading ? (
        <div style={s.empty}>Loading...</div>
      ) : events.length === 0 ? (
        <div style={s.empty}>No payment events found</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>ID</th>
              <th style={s.th}>Source</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Amount</th>
              <th style={s.th}>Merchant</th>
              <th style={s.th}>Store</th>
              <th style={s.th}>Phone</th>
              <th style={s.th}>Provider ID</th>
              <th style={s.th}>Transaction</th>
              <th style={s.th}>UPC</th>
              <th style={s.th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td style={s.td}>{e.id}</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, ...(SOURCE_COLORS[e.source] || s.sourceManual) }}>{e.source}</span>
                </td>
                <td style={s.td}><span style={s.typeBadge}>{e.eventType}</span></td>
                <td style={{ ...s.td, fontWeight: 600 }}>{fmt(e.amountCents)}</td>
                <td style={s.td}>{e.merchantId}</td>
                <td style={s.td}>{e.storeId || "-"}</td>
                <td style={{ ...s.td, ...s.mono }}>{e.phone || "-"}</td>
                <td style={{ ...s.td, ...s.mono }}>{e.providerEventId ? e.providerEventId.slice(0, 20) : "-"}</td>
                <td style={{ ...s.td, ...s.mono }}>{e.transactionId ? e.transactionId.slice(0, 16) : "-"}</td>
                <td style={{ ...s.td, ...s.mono }}>{e.upc || "-"}</td>
                <td style={{ ...s.td, whiteSpace: "nowrap" }}>{shortDate(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
