// src/pages/MerchantInvoiceDetail.jsx

import React from "react";
import { Link, useParams } from "react-router-dom";
import { merchantGetInvoice } from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

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
  } catch {}
}

function usd(cents) {
  const n = Number(cents || 0) / 100;
  return `$${n.toFixed(2)}`;
}

function fmtDate(iso) {
  try {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
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

const card = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  padding: 14,
  background: "white",
};

export default function MerchantInvoiceDetail() {
  const { invoiceId } = useParams();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [detail, setDetail] = React.useState(null);

  async function load(reason = "auto") {
    setLoading(true);
    setError("");

    pvUiHook("billing.merchant_invoice.load_started.ui", {
      tc: "TC-MID-UI-01",
      sev: "info",
      stable: `merchantInvoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
      reason,
    });

    try {
      const d = await merchantGetInvoice(invoiceId);
      setDetail(d);

      pvUiHook("billing.merchant_invoice.load_succeeded.ui", {
        tc: "TC-MID-UI-02",
        sev: "info",
        stable: `merchantInvoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        status: d?.invoice?.status || null,
      });
    } catch (e) {
      setError(e?.message || "Failed to load invoice");

      pvUiHook("billing.merchant_invoice.load_failed.ui", {
        tc: "TC-MID-UI-03",
        sev: "error",
        stable: `merchantInvoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        error: e?.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    pvUiHook("billing.merchant_invoice.page_loaded.ui", {
      tc: "TC-MID-UI-00",
      sev: "info",
      stable: `merchantInvoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
    });

    load("route_change");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const inv = detail?.invoice;

  return (
    <PageContainer size="page">
      {/* Q0: Back link top-left above PageHeader */}
      <div style={{ marginBottom: 10 }}>
        <Link
          to="/merchant/invoices"
          style={{ textDecoration: "none" }}
          onClick={() => {
            pvUiHook("billing.merchant_invoice.back.click.ui", {
              tc: "TC-MID-UI-10",
              sev: "info",
              stable: `merchantInvoice:${String(invoiceId)}`,
              invoiceId: Number(invoiceId),
            });
          }}
        >
          ← Back to My Invoices
        </Link>
      </div>

      <PageHeader
        title={`Invoice #${invoiceId}`}
        subtitle={inv?.status ? <Pill>{inv.status}</Pill> : " "}
        right={
          <button
            onClick={() => {
              pvUiHook("billing.merchant_invoice.reload.click.ui", {
                tc: "TC-MID-UI-20",
                sev: "info",
                stable: `merchantInvoice:${String(invoiceId)}`,
                invoiceId: Number(invoiceId),
              });
              load("manual_reload");
            }}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 900,
            }}
          >
            {loading ? "Loading…" : "Reload"}
          </button>
        }
      />

      {loading ? <div style={{ color: "rgba(0,0,0,0.65)", padding: "6px 2px" }}>Loading…</div> : null}

      {error ? (
        <div
          style={{
            ...card,
            marginBottom: 12,
            background: "rgba(255,0,0,0.06)",
            border: "1px solid rgba(255,0,0,0.15)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      {!loading && !error && inv ? (
        <>
          {/* Summary */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <div style={styles.k}>Status</div>
              <div>{inv.status}</div>

              <div style={styles.k}>Issued</div>
              <div>{fmtDate(inv.issuedAt)}</div>

              <div style={styles.k}>Due</div>
              <div>{fmtDate(inv.dueAt)}</div>

              <div style={styles.k}>Total</div>
              <div>{usd(inv.totalCents)}</div>

              <div style={styles.k}>Paid</div>
              <div>{usd(inv.amountPaidCents)}</div>

              {inv.relatedToInvoiceId ? (
                <>
                  <div style={styles.k}>Related to</div>
                  <div>Invoice #{inv.relatedToInvoiceId}</div>
                </>
              ) : null}
            </div>
          </div>

          {/* Line Items */}
          <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)", fontWeight: 900 }}>
              Line items
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={styles.th}>Description</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Qty</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lineItems || []).map((li) => (
                    <tr key={li.id}>
                      <td style={styles.td}>{li.description}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{li.quantity}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{usd(li.amountCents)}</td>
                    </tr>
                  ))}

                  {(detail.lineItems || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                        No line items.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div style={{ ...card }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Payments</div>
            {(detail.payments || []).length === 0 ? (
              <div style={{ color: "rgba(0,0,0,0.6)" }}>No payments.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(detail.payments || []).map((p) => (
                  <li key={p.id}>
                    <b>{p.status}</b> — {usd(p.amountCents)} — {p.payerEmail || "—"} — {fmtDate(p.createdAt)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}

const styles = {
  k: { color: "rgba(0,0,0,0.65)", fontWeight: 800, fontSize: 12 },
  th: { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" },
  td: { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.06)" },
};
