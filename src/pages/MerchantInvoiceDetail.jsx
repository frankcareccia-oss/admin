// admin/src/pages/MerchantInvoiceDetail.jsx

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

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const buttonPrimaryGreen = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#1f7a3a",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

function calcAmountDueCents(inv) {
  const total = typeof inv?.totalCents === "number" ? inv.totalCents : 0;
  const paid = typeof inv?.amountPaidCents === "number" ? inv.amountPaidCents : 0;
  return Math.max(0, total - paid);
}

function getPayCode(inv) {
  return inv?.payCode || inv?.shortPayCode || inv?.code || inv?.payLinkCode || "";
}

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

  const inv = detail?.invoice || null;

  // Normalize status for comparisons (prevents "Paid"/"PAID"/etc from slipping through)
  const statusNorm = String(inv?.status || "").trim().toLowerCase();

  // Amount due (source of truth for "payable" gating)
  const amountDueCents = calcAmountDueCents(inv);

  // Keep original status string for hooks/UI, but gate using normalized
  const status = inv?.status || "";

  const isDraft = statusNorm === "draft";

  // Paid-like should be true if:
  // - status says paid, OR
  // - computed due is 0, OR
  // - paid >= total (defensive)
  const totalCents = typeof inv?.totalCents === "number" ? inv.totalCents : 0;
  const paidCents = typeof inv?.amountPaidCents === "number" ? inv.amountPaidCents : 0;
  const isPaidLike = statusNorm === "paid" || amountDueCents <= 0 || (totalCents > 0 && paidCents >= totalCents);

  // Payable statuses (normalized)
  const isPayableStatus = statusNorm === "issued" || statusNorm === "past_due";

  // Final gating for Pay Now
  const canPayNow = Boolean(inv) && !isDraft && !isPaidLike && isPayableStatus && amountDueCents > 0;

  const payCode = getPayCode(inv);
  const payLinkAvailable = Boolean(payCode);

  function openPublicPay(code) {
    const url = `${window.location.origin}/p/${encodeURIComponent(String(code))}`;

    pvUiHook("billing.merchant_invoice.pay_now.open_public_pay.ui", {
      tc: "TC-MID-UI-30",
      sev: "info",
      stable: `merchantInvoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
      payCodePresent: Boolean(code),
    });

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <PageContainer size="page">
      {/* Back link (navigation only) */}
      <div style={{ marginBottom: 10 }}>
        <Link
          to="/merchant/invoices"
          style={{ textDecoration: "none", fontWeight: 900 }}
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
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Actions only on the right: Pay Now (if available) + Reload */}
            {inv && canPayNow && payLinkAvailable ? (
              <button
                type="button"
                style={buttonPrimaryGreen}
                onClick={() => {
                  pvUiHook("billing.merchant_invoice.pay_now.click.ui", {
                    tc: "TC-MID-UI-31",
                    sev: "info",
                    stable: `merchantInvoice:${String(invoiceId)}`,
                    invoiceId: Number(invoiceId),
                    status,
                    statusNorm,
                    amountDueCents,
                    totalCents,
                    paidCents,
                    payCodePresent: true,
                  });
                  openPublicPay(payCode);
                }}
                title="Opens the public pay page in a new tab"
              >
                Pay Now
              </button>
            ) : null}

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
                ...buttonBase,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading…" : "Reload"}
            </button>
          </div>
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
          {/* “Billing feel” hero: Amount Due */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ color: "rgba(0,0,0,0.65)", fontWeight: 900, fontSize: 12 }}>
                  Amount Due
                </div>
                <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: "-0.02em" }}>
                  {usd(amountDueCents)}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ color: "rgba(0,0,0,0.65)", fontWeight: 900, fontSize: 12 }}>
                  Due Date
                </div>
                <div style={{ fontWeight: 900 }}>{fmtDate(inv.dueAt)}</div>
              </div>
            </div>

            {/* If payable but missing pay link, make it explicit here (not in header actions). */}
            {canPayNow && !payLinkAvailable ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 900,
                  color: "rgba(0,0,0,0.60)",
                }}
              >
                Payment link not available yet. Pay links appear when an invoice is ready for payment.
              </div>
            ) : null}

            {/* If invoice is paid-like, help explain why Pay Now is not shown */}
            {!canPayNow && isPaidLike ? (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 900,
                  color: "rgba(0,0,0,0.55)",
                }}
              >
                Payment already received. This invoice is no longer payable.
              </div>
            ) : null}
          </div>

          {/* Summary */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <div style={styles.k}>Status</div>
              <div>{inv.status}</div>

              <div style={styles.k}>Issued</div>
              <div>{fmtDate(inv.issuedAt)}</div>

              <div style={styles.k}>Total</div>
              <div>{usd(inv.totalCents)}</div>

              <div style={styles.k}>Paid</div>
              <div>{usd(inv.amountPaidCents)}</div>

              <div style={styles.k}>Amount due</div>
              <div style={{ fontWeight: 900 }}>{usd(amountDueCents)}</div>

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
