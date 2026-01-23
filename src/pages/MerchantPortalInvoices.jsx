// admin/src/pages/MerchantPortalInvoices.jsx

/**
 * PerkValet — Merchant Invoice List (Merchant Portal)
 * Route: /merchant/invoices
 *
 * Thread N (UI scaffolding, Master Spec v2.02.1 locked)
 * ----------------------------------------------------
 * Purpose:
 * - Merchant user can view invoices for their own merchant account
 * - Merchant user can open invoice detail at /merchant/invoices/:invoiceId
 *
 * Thread Q (Admin UX Consistency & Operability)
 * ---------------------------------------------
 * - Replace "Open" with "View" for detail pages
 * - Add Pay Now behavior (opens public pay page /p/:code in new tab)
 * - State gating:
 *   - paid -> Pay Now disabled/grey (never clickable)
 *   - draft -> no Pay Now
 *   - issued/past_due with balance -> Pay Now enabled
 * - Add pvUiHook events for QA/Docs/Support/Chatbot
 */

import React from "react";
import { Link } from "react-router-dom";
import { merchantListInvoices } from "../api/client";

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

function calcAmountDueCents(inv) {
  const total = typeof inv?.totalCents === "number" ? inv.totalCents : 0;
  const paid = typeof inv?.amountPaidCents === "number" ? inv.amountPaidCents : 0;
  return Math.max(0, total - paid);
}

export default function MerchantPortalInvoices() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");

    pvUiHook("billing.merchant_invoices.list_load_started.ui", {
      tc: "TC-MIL-UI-01",
      sev: "info",
      stable: "merchantInvoices:list",
    });

    try {
      const res = await merchantListInvoices();
      const list = res?.items || [];
      setItems(list);

      pvUiHook("billing.merchant_invoices.list_load_succeeded.ui", {
        tc: "TC-MIL-UI-02",
        sev: "info",
        stable: "merchantInvoices:list",
        count: list.length,
      });
    } catch (e) {
      setError(e?.message || "Failed to load invoices");

      pvUiHook("billing.merchant_invoices.list_load_failed.ui", {
        tc: "TC-MIL-UI-03",
        sev: "error",
        stable: "merchantInvoices:list",
        error: e?.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    pvUiHook("billing.merchant_invoices.page_loaded.ui", {
      tc: "TC-MIL-UI-00",
      sev: "info",
      stable: "merchantInvoices:page",
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openPublicPay(code, invoiceId) {
    const url = `${window.location.origin}/p/${encodeURIComponent(String(code))}`;

    pvUiHook("billing.merchant_invoices.pay_now.open_public_pay.ui", {
      tc: "TC-MIL-UI-20",
      sev: "info",
      stable: `invoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
      payCodePresent: Boolean(code),
    });

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <PageContainer size="page">
      <PageHeader
        title="My Invoices"
        subtitle="Invoices for your merchant account."
        right={
          <button
            onClick={() => {
              pvUiHook("billing.merchant_invoices.reload.click.ui", {
                tc: "TC-MIL-UI-10",
                sev: "info",
                stable: "merchantInvoices:reload",
              });
              load();
            }}
            disabled={loading}
            style={buttonBase}
          >
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
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            gap: 10,
          }}
        >
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
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
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
                items.map((inv) => {
                  const amountDueCents = calcAmountDueCents(inv);
                  const status = inv?.status || "";
                  const isPaid = status === "paid" || amountDueCents <= 0;
                  const canPayNow = (status === "issued" || status === "past_due") && amountDueCents > 0;

                  // Canonical pay link code is expected to be present on invoice list rows
                  // (or included as inv.payCode / inv.shortPayCode / inv.code depending on backend).
                  // If not present, we block and emit a hook so QA can catch contract mismatch.
                  const payCode =
                    inv?.payCode || inv?.shortPayCode || inv?.code || inv?.payLinkCode || "";

                  return (
                    <tr key={inv.id}>
                      <td style={td}>
                        <Link
                          to={`/merchant/invoices/${inv.id}`}
                          style={{ textDecoration: "none" }}
                          onClick={() => {
                            pvUiHook("billing.merchant_invoices.row_action.view.ui", {
                              tc: "TC-MIL-UI-30",
                              sev: "info",
                              stable: `invoice:${String(inv.id)}`,
                              invoiceId: Number(inv.id),
                            });
                          }}
                        >
                          #{inv.id}
                        </Link>
                      </td>
                      <td style={td}>
                        <Pill>{status}</Pill>
                      </td>
                      <td style={td}>{usd(inv.totalCents)}</td>
                      <td style={td}>{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {/* Paid label */}
                        {isPaid ? (
                          <span style={{ fontWeight: 900, color: "rgba(0,0,0,0.35)" }}>Paid</span>
                        ) : null}

                        {/* Draft invoices: no Pay Now */}
                        {status === "draft" ? null : null}

                        {/* Pay Now for issued/past_due with balance */}
                        {canPayNow ? (
                          <button
                            type="button"
                            style={{
                              ...actionLinkBtn,
                              ...(payCode ? null : actionLinkBtnDisabled),
                            }}
                            onClick={() => {
                              pvUiHook("billing.merchant_invoices.pay_now.click.ui", {
                                tc: "TC-MIL-UI-21",
                                sev: "info",
                                stable: `invoice:${String(inv.id)}`,
                                invoiceId: Number(inv.id),
                                status,
                                amountDueCents,
                                payCodePresent: Boolean(payCode),
                              });

                              if (!payCode) {
                                pvUiHook("billing.merchant_invoices.pay_now.blocked.ui", {
                                  tc: "TC-MIL-UI-22",
                                  sev: "warn",
                                  stable: `invoice:${String(inv.id)}`,
                                  invoiceId: Number(inv.id),
                                  blockedReason: "missing_pay_code",
                                  status,
                                  amountDueCents,
                                });
                                return;
                              }

                              openPublicPay(payCode, inv.id);
                            }}
                            disabled={!payCode}
                            title={!payCode ? "Pay link not available yet" : "Opens the public pay page in a new tab"}
                          >
                            Pay Now
                          </button>
                        ) : null}

                        {/* Always allow merchant to view detail */}
                        <span style={{ marginLeft: 10 }} />
                        <Link
                          to={`/merchant/invoices/${inv.id}`}
                          style={{ textDecoration: "none", fontWeight: 900 }}
                          onClick={() => {
                            pvUiHook("billing.merchant_invoices.row_action.view.ui", {
                              tc: "TC-MIL-UI-31",
                              sev: "info",
                              stable: `invoice:${String(inv.id)}`,
                              invoiceId: Number(inv.id),
                            });
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
        Read-only view. Payments are handled via the public pay page when a pay link is available.
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

const actionLinkBtn = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  fontWeight: 900,
  cursor: "pointer",
  textDecoration: "none",
};

const actionLinkBtnDisabled = {
  cursor: "not-allowed",
  color: "rgba(0,0,0,0.35)",
};
