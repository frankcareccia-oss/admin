// src/pages/GroceryPosSimulator.jsx — Grocery POS Simulator (MVP Demo Mode B)

import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const s = {
  page: { maxWidth: 800, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  row: { display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" },
  field: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  label: { fontSize: 12, fontWeight: 600, color: "#374151" },
  input: { padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 },
  btn: { padding: "10px 18px", borderRadius: 6, border: "none", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  btnPrimary: { background: "#2563eb", color: "#fff" },
  btnSuccess: { background: "#16a34a", color: "#fff" },
  btnDanger: { background: "#dc2626", color: "#fff" },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", fontSize: 11, color: "#6b7280", textTransform: "uppercase" },
  td: { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" },
  subsidy: { color: "#16a34a", fontWeight: 600 },
  noSubsidy: { color: "#9ca3af" },
  totals: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 },
  totalRow: { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 15 },
  totalLabel: { color: "#374151" },
  totalValue: { fontWeight: 600 },
  subsidyLine: { color: "#16a34a", fontWeight: 700 },
  receipt: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 16, marginBottom: 16 },
  error: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 12, color: "#b91c1c", fontSize: 14, marginBottom: 16 },
};

function fmt(cents) {
  return "$" + (cents / 100).toFixed(2);
}

export default function GroceryPosSimulator() {
  const [upc, setUpc] = useState("");
  const [phone, setPhone] = useState("");
  const [storeId] = useState(1);
  const [merchantId] = useState(1);
  const [basket, setBasket] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);

  async function handleScan() {
    if (!upc.trim()) return;
    setError(null);
    setBusy(true);

    try {
      const res = await fetch(API_BASE + "/grocery/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upc: upc.trim(), quantity: 1, phone: phone.trim() || "0000000000", storeId }),
      });
      const data = await res.json();

      // Check for duplicate
      if (basket.some(item => item.upc === upc.trim())) {
        setError("Item already scanned. Duplicate subsidy prevented.");
        setBusy(false);
        return;
      }

      setBasket(prev => [...prev, {
        upc: upc.trim(),
        productName: data.productName || "Unknown Item",
        priceCents: data.eligible ? Math.round(data.subsidyAmount * 100 + 200 + Math.random() * 300) : 399,
        subsidyCents: data.eligible ? data.subsidyAmountCents : 0,
        eligible: data.eligible,
        promotionId: data.promotionId,
      }]);
      setUpc("");
    } catch (err) {
      setError("Scan failed: " + (err?.message || "Network error"));
    } finally {
      setBusy(false);
    }
  }

  function removeItem(index) {
    setBasket(prev => prev.filter((_, i) => i !== index));
  }

  const subtotalCents = basket.reduce((s, i) => s + i.priceCents, 0);
  const totalSubsidyCents = basket.reduce((s, i) => s + i.subsidyCents, 0);
  const finalCents = subtotalCents - totalSubsidyCents;

  async function handleComplete() {
    if (!phone.trim() || phone.replace(/\D/g, "").length !== 10) {
      setError("Enter a valid 10-digit phone number to complete.");
      return;
    }
    if (basket.length === 0) {
      setError("Scan at least one item.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      const res = await fetch(API_BASE + "/grocery/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          storeId,
          merchantId,
          items: basket.map(i => ({
            upc: i.upc,
            quantity: 1,
            priceCents: i.priceCents,
            subsidyCents: i.subsidyCents,
            productName: i.productName,
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message || "Transaction failed");
        return;
      }

      setReceipt(data);
    } catch (err) {
      setError("Transaction failed: " + (err?.message || "Network error"));
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setBasket([]);
    setReceipt(null);
    setError(null);
    setUpc("");
    setPhone("");
  }

  if (receipt) {
    return (
      <div style={s.page}>
        <div style={s.title}>Transaction Complete</div>
        <div style={s.receipt}>
          <div style={s.totalRow}><span>Transaction ID</span><span style={{ fontFamily: "monospace" }}>{receipt.transactionId}</span></div>
          <div style={s.totalRow}><span>Subtotal</span><span>{fmt(receipt.totalCents)}</span></div>
          <div style={{ ...s.totalRow, ...s.subsidyLine }}><span>PV Subsidy Applied</span><span>-{fmt(receipt.totalSubsidyCents)}</span></div>
          <div style={{ ...s.totalRow, fontSize: 18, fontWeight: 700, borderTop: "2px solid #16a34a", paddingTop: 8, marginTop: 8 }}>
            <span>Total Charged</span><span>{fmt(receipt.finalCents)}</span>
          </div>
          <div style={{ ...s.totalRow, color: "#6b7280", fontSize: 12, marginTop: 8 }}>
            <span>{receipt.eventCount} subsidy event(s) recorded</span>
          </div>
        </div>
        <button style={{ ...s.btn, ...s.btnPrimary }} onClick={handleReset}>New Transaction</button>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.title}>PerkValet Grocery — POS Simulator</div>
      <div style={s.subtitle}>Demo Mode B — UPC Validation + Subsidy</div>

      {error && <div style={s.error}>{error}</div>}

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Phone Number</label>
          <input style={s.input} type="tel" placeholder="10-digit phone" value={phone}
            onChange={e => setPhone(e.target.value)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={{ ...s.field, flex: 2 }}>
          <label style={s.label}>Scan UPC</label>
          <input style={s.input} placeholder="Enter UPC barcode" value={upc}
            onChange={e => setUpc(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleScan()} autoFocus />
        </div>
        <button style={{ ...s.btn, ...s.btnPrimary, ...(busy ? s.btnDisabled : {}) }}
          onClick={handleScan} disabled={busy}>
          {busy ? "Scanning..." : "Add Item"}
        </button>
      </div>

      {basket.length > 0 && (
        <>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>UPC</th>
                <th style={s.th}>Product</th>
                <th style={s.th}>Price</th>
                <th style={s.th}>Subsidy</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {basket.map((item, i) => (
                <tr key={i}>
                  <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12 }}>{item.upc}</td>
                  <td style={s.td}>{item.productName}</td>
                  <td style={s.td}>{fmt(item.priceCents)}</td>
                  <td style={s.td}>
                    {item.subsidyCents > 0
                      ? <span style={s.subsidy}>-{fmt(item.subsidyCents)}</span>
                      : <span style={s.noSubsidy}>—</span>}
                  </td>
                  <td style={s.td}>
                    <button style={{ ...s.btn, ...s.btnDanger, padding: "4px 10px", fontSize: 12 }}
                      onClick={() => removeItem(i)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={s.totals}>
            <div style={s.totalRow}><span style={s.totalLabel}>Subtotal</span><span style={s.totalValue}>{fmt(subtotalCents)}</span></div>
            {totalSubsidyCents > 0 && (
              <div style={{ ...s.totalRow, ...s.subsidyLine }}>
                <span>PV Subsidy Applied</span><span>-{fmt(totalSubsidyCents)}</span>
              </div>
            )}
            <div style={{ ...s.totalRow, fontSize: 18, fontWeight: 700, borderTop: "1px solid #d1d5db", paddingTop: 8, marginTop: 8 }}>
              <span>Total</span><span>{fmt(finalCents)}</span>
            </div>
          </div>

          <button style={{ ...s.btn, ...s.btnSuccess, width: "100%", padding: 14, fontSize: 16, ...(busy ? s.btnDisabled : {}) }}
            onClick={handleComplete} disabled={busy}>
            {busy ? "Processing..." : "Complete Transaction"}
          </button>
        </>
      )}
    </div>
  );
}
