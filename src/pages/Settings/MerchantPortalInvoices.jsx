// admin/src/pages/MerchantPortalInvoices.jsx
import React from "react";
import { Link } from "react-router-dom";
import { merchantListInvoices } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

function usd(cents) {
  const n = Number(cents || 0) / 100;
  return `$${n.toFixed(2)}`;
}

function Pill({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: "rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.10)",
        textTransform: "lowercase",
      }}
    >
      {children}
    </span>
  );
}

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const card = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  background: "white",
};

export default function MerchantPortalInvoices() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await merchantListInvoices();
      setItems(res?.items || []);
    } catch (e) {
      setError(e?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <PageContainer size="page">
      <PageHeader
        title="My Invoices"
        subtitle="Read-only invoice view for merchants."
        right={
          <button onClick={load} disabled={loading} style={buttonBase}>
            {loading ? "Loading…" : "Reload"}
          </button>
        }
      />

      {error ? (
        <div
          style={{
            ...card,
            padding: 14,
            marginBottom: 12,
            background: "rgba(255,0,0,0.06)",
            border: "1px solid rgba(255,0,0,0.15)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Results</div>
          <div style={{ color: "rgba(0,0,0,0.6)" }}>
            ({items.length} invoice{items.length === 1 ? "" : "s"})
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Invoice</th>
                <th style={th}>Status</th>
                <th style={th}>Total</th>
                <th style={th}>Due</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    No invoices.
                  </td>
                </tr>
              ) : (
                items.map((inv) => (
                  <tr key={inv.id}>
                    <td style={td}>
                      <Link to={`/merchant/invoices/${inv.id}`} style={{ textDecoration: "none" }}>
                        #{inv.id}
                      </Link>
                    </td>
                    <td style={td}>
                      <Pill>{inv.status}</Pill>
                    </td>
                    <td style={td}>{usd(inv.totalCents)}</td>
                    <td style={td}>{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>
                    <td style={td}>
                      <Link to={`/merchant/invoices/${inv.id}`} style={{ textDecoration: "none" }}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
        Read-only view. Payments and guest pay will come later.
      </div>
    </PageContainer>
  );
}

const th = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const td = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};
