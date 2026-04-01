// admin/src/pages/MerchantInvoices.jsx
import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  adminListInvoices,
  adminGenerateInvoice,
  adminIssueInvoice,
  adminVoidInvoice,
  getMerchant,
  adminGetMerchantBillingPolicy,
} from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SectionTabs from "../components/layout/SectionTabs";
import { color, btn, inputStyle as themeInput } from "../theme";

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
  } catch {
    // never break UI for logging
  }
}

function usd(cents) {
  const n = Number(cents || 0) / 100;
  return `$${n.toFixed(2)}`;
}

const MERCHANT_STATUS_COLORS = {
  active:    { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  suspended: { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  archived:  { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.50)",  border: "1px solid rgba(0,0,0,0.12)" },
};

function StatusBadge({ status }) {
  const s = MERCHANT_STATUS_COLORS[status] || MERCHANT_STATUS_COLORS.archived;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

function buildTabs(merchantId, pathname) {
  const base = `/merchants/${merchantId}`;
  return [
    { key: "overview",      label: "Overview",       to: base,                                            active: pathname === base },
    { key: "billing",       label: "Billing",        to: `${base}/billing`,                               active: pathname === `${base}/billing` },
    { key: "stores",        label: "Stores",         to: `${base}/stores`,                                active: pathname === `${base}/stores` },
    { key: "team",          label: "Team",           to: `${base}/users`,                                 active: pathname === `${base}/users` },
    { key: "invoices",      label: "Invoices",       to: `${base}/invoices`,                              active: pathname === `${base}/invoices` },
    { key: "billingPolicy", label: "Billing Policy", to: `/admin/merchants/${merchantId}/billing-policy`, active: pathname.startsWith(`/admin/merchants/${merchantId}/billing-policy`) },
  ];
}

const INVOICE_STATUS_STYLES = {
  draft:   { background: "rgba(0,0,0,0.05)",       color: "rgba(0,0,0,0.55)",   border: "1px solid rgba(0,0,0,0.12)" },
  issued:  { background: "rgba(0,80,200,0.08)",    color: "rgba(0,60,160,1)",   border: "1px solid rgba(0,80,200,0.20)" },
  paid:    { background: "rgba(0,150,80,0.10)",    color: "rgba(0,110,50,1)",   border: "1px solid rgba(0,150,80,0.25)" },
  void:    { background: "rgba(0,0,0,0.04)",       color: "rgba(0,0,0,0.35)",   border: "1px solid rgba(0,0,0,0.10)" },
  overdue: { background: "rgba(200,0,0,0.08)",     color: "rgba(160,0,0,1)",    border: "1px solid rgba(200,0,0,0.20)" },
};

function InvoiceStatusPill({ status }) {
  const s = INVOICE_STATUS_STYLES[status] || INVOICE_STATUS_STYLES.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "—"}
    </span>
  );
}

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${color.border}`,
  background: color.cardBg,
  cursor: "pointer",
  fontWeight: 900,
};

const buttonDanger = {
  ...buttonBase,
  border: `1px solid ${color.dangerBorder}`,
  background: color.dangerSubtle,
};

const card = {
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  background: color.cardBg,
};

function normalizeMoneyInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function dollarsToCents(dollarsStr) {
  const n = Number.parseFloat(String(dollarsStr || "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export default function MerchantInvoices() {
  const { merchantId } = useParams();
  const location = useLocation();

  const [merchant, setMerchant] = React.useState(null);
  const [netTermsOptions, setNetTermsOptions] = React.useState([15, 30, 45]);
  const [policyDefaultNetTerms, setPolicyDefaultNetTerms] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const [showCreate, setShowCreate] = React.useState(false);

  const [totalDollars, setTotalDollars] = React.useState("");
  const [netTermsDays, setNetTermsDays] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const m = await getMerchant(merchantId);
      setMerchant(m || null);
    } catch {
      // Non-fatal: merchant name missing is OK, invoices still load
    }

    try {
      const policy = await adminGetMerchantBillingPolicy(merchantId);
      const opts = policy?.effective?.allowedNetTermsDays;
      if (Array.isArray(opts) && opts.length > 0) setNetTermsOptions(opts);
      const def = policy?.effective?.defaultNetTermsDays;
      setPolicyDefaultNetTerms(def != null ? String(def) : "");
    } catch {
      // Non-fatal: fall back to default [15, 30, 45]
    }

    pvUiHook("billing.merchant_invoices.list_load_started.ui", {
      tc: "TC-MIL-UI-10",
      sev: "info",
      stable: "merchantInvoices:list",
      merchantId: Number(merchantId),
    });

    try {
      const res = await adminListInvoices({ merchantId: Number(merchantId) });
      const list = res?.items || [];
      setItems(list);

      pvUiHook("billing.merchant_invoices.list_load_succeeded.ui", {
        tc: "TC-MIL-UI-11",
        sev: "info",
        stable: "merchantInvoices:list",
        merchantId: Number(merchantId),
        count: list.length,
      });
    } catch (e) {
      setError(e?.message || "Failed to load invoices");

      pvUiHook("billing.merchant_invoices.list_load_failed.ui", {
        tc: "TC-MIL-UI-12",
        sev: "error",
        stable: "merchantInvoices:list",
        merchantId: Number(merchantId),
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
      merchantId: Number(merchantId),
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  function openCreateModal() {
    setError("");
    setShowCreate(true);
    setTotalDollars("");
    setNetTermsDays(policyDefaultNetTerms || "");

    pvUiHook("billing.merchant_invoices.create_modal_opened.ui", {
      tc: "TC-MIL-UI-20",
      sev: "info",
      stable: "merchantInvoices:create_modal",
      merchantId: Number(merchantId),
    });
  }

  async function onCreateDraft() {
    setBusy(true);
    setError("");

    const cents = dollarsToCents(totalDollars);
    if (!Number.isInteger(cents) || cents <= 0) {
      setBusy(false);
      setError("Total ($) must be a valid dollar amount greater than 0 (e.g. 125.00)");
      pvUiHook("billing.merchant_invoices.create_failed.ui", {
        tc: "TC-MIL-UI-23",
        sev: "warn",
        stable: "merchantInvoices:create",
        merchantId: Number(merchantId),
        reason: "total_invalid",
      });
      return;
    }

    const nt = Number(String(netTermsDays || "").trim());
    if (!netTermsOptions.includes(nt)) {
      setBusy(false);
      setError(`Net terms must be one of: ${netTermsOptions.join(", ")} days`);
      pvUiHook("billing.merchant_invoices.create_failed.ui", {
        tc: "TC-MIL-UI-23",
        sev: "warn",
        stable: "merchantInvoices:create",
        merchantId: Number(merchantId),
        reason: "net_terms_invalid",
        netTermsDays: nt || null,
      });
      return;
    }

    pvUiHook("billing.merchant_invoices.create_started.ui", {
      tc: "TC-MIL-UI-21",
      sev: "info",
      stable: "merchantInvoices:create",
      merchantId: Number(merchantId),
      totalCents: cents,
      netTermsDays: nt,
    });

    try {
      await adminGenerateInvoice({
        merchantId: Number(merchantId),
        totalCents: cents,
        netTermsDays: nt,
      });

      pvUiHook("billing.merchant_invoices.create_succeeded.ui", {
        tc: "TC-MIL-UI-22",
        sev: "info",
        stable: "merchantInvoices:create",
        merchantId: Number(merchantId),
      });

      setShowCreate(false);
      await load();
    } catch (e) {
      setError(e?.message || "Failed to create invoice");
      pvUiHook("billing.merchant_invoices.create_failed.ui", {
        tc: "TC-MIL-UI-24",
        sev: "error",
        stable: "merchantInvoices:create",
        merchantId: Number(merchantId),
        error: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onIssue(invoiceId) {
    setBusy(true);
    setError("");

    pvUiHook("billing.merchant_invoices.issue_clicked.ui", {
      tc: "TC-MIL-UI-30",
      sev: "info",
      stable: `invoice:${invoiceId}`,
      invoiceId,
      merchantId: Number(merchantId),
    });

    try {
      await adminIssueInvoice(invoiceId, {});
      pvUiHook("billing.merchant_invoices.issue_succeeded.ui", {
        tc: "TC-MIL-UI-31",
        sev: "info",
        stable: `invoice:${invoiceId}`,
        invoiceId,
      });
      await load();
    } catch (e) {
      setError(e?.message || "Failed to issue invoice");
      pvUiHook("billing.merchant_invoices.issue_failed.ui", {
        tc: "TC-MIL-UI-32",
        sev: "error",
        stable: `invoice:${invoiceId}`,
        invoiceId,
        error: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function onVoid(invoiceId) {
    setBusy(true);
    setError("");

    pvUiHook("billing.merchant_invoices.void_clicked.ui", {
      tc: "TC-MIL-UI-40",
      sev: "info",
      stable: `invoice:${invoiceId}`,
      invoiceId,
      merchantId: Number(merchantId),
    });

    try {
      await adminVoidInvoice(invoiceId);
      pvUiHook("billing.merchant_invoices.void_succeeded.ui", {
        tc: "TC-MIL-UI-41",
        sev: "info",
        stable: `invoice:${invoiceId}`,
        invoiceId,
      });
      await load();
    } catch (e) {
      setError(e?.message || "Failed to void invoice");
      pvUiHook("billing.merchant_invoices.void_failed.ui", {
        tc: "TC-MIL-UI-42",
        sev: "error",
        stable: `invoice:${invoiceId}`,
        invoiceId,
        error: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  const rows = Array.isArray(items) ? items.slice().sort((a, b) => b.id - a.id) : [];
  const tabs = buildTabs(merchantId, location.pathname);

  return (
    <PageContainer size="page">
      <div style={{ marginBottom: 10 }}>
        <Link to="/merchants" style={{ textDecoration: "none" }}>Back to Merchants</Link>
      </div>

      <PageHeader
        title={merchant?.name || `Merchant ${merchantId}`}
        subtitle={
          merchant ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={merchant.status} />
              <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
                ID: {merchant.id}
                {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
              </span>
            </span>
          ) : null
        }
        right={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={openCreateModal}
              disabled={loading || busy}
              style={buttonBase}
              title="Create a draft invoice for this merchant"
            >
              Create Draft
            </button>

            <button
              onClick={() => {
                pvUiHook("billing.merchant_invoices.reload_clicked.ui", {
                  tc: "TC-MIL-UI-06",
                  sev: "info",
                  stable: "merchantInvoices:reload",
                  merchantId: Number(merchantId),
                });
                load();
              }}
              disabled={loading || busy}
              style={buttonBase}
            >
              {loading ? "Loading…" : "Reload"}
            </button>
          </div>
        }
      >
        <SectionTabs title="Sections" items={tabs} />
      </PageHeader>

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
            alignItems: "baseline",
          }}
        >
          <div style={{ fontWeight: 900 }}>Results</div>
          <div style={{ color: color.textMuted }}>
            ({rows.length} invoice{rows.length === 1 ? "" : "s"})
          </div>
          <div style={{ marginLeft: "auto", color: color.textMuted, fontSize: 12 }}>
            Tip: Draft → Issue sets due date
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Invoice</th>
                <th style={th}>Status</th>
                <th style={th}>Total</th>
                <th style={th}>Paid</th>
                <th style={th}>Due</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: color.textMuted }}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: color.textMuted }}>
                    No invoices for this merchant yet.
                  </td>
                </tr>
              ) : (
                rows.map((inv) => {
                  const canIssue = inv.status === "draft";
                  const canVoid = inv.status !== "paid" && inv.status !== "void";
                  const isPaid = inv.status === "paid";

                  return (
                    <tr key={inv.id}>
                      <td style={td}>
                        <Link
                          to={`/admin/invoices/${inv.id}?return=${encodeURIComponent(`/merchants/${merchantId}/invoices`)}`}
                          style={{ textDecoration: "none" }}
                          onClick={() => {
                            pvUiHook("billing.merchant_invoices.row_action.view.ui", {
                              tc: "TC-MIL-UI-50",
                              sev: "info",
                              stable: `invoice:${inv.id}`,
                              invoiceId: inv.id,
                              merchantId: Number(merchantId),
                            });
                          }}
                        >
                          #{inv.id}
                        </Link>
                      </td>

                      <td style={td}>
                        <InvoiceStatusPill status={inv.status} />
                      </td>

                      <td style={td}>{usd(inv.totalCents)}</td>
                      <td style={td}>{usd(inv.amountPaidCents)}</td>
                      <td style={td}>{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>

                      <td style={{ ...td, textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {isPaid ? (
                            <span
                              title="Invoice is already paid"
                              style={{
                                fontWeight: 900,
                                color: color.textFaint,
                                cursor: "not-allowed",
                                userSelect: "none",
                              }}
                              onClick={() => {
                                pvUiHook("billing.merchant_invoices.row_action.blocked_paid.ui", {
                                  tc: "TC-MIL-UI-60",
                                  sev: "info",
                                  stable: `invoice:${inv.id}`,
                                  invoiceId: inv.id,
                                });
                              }}
                            >
                              Paid
                            </span>
                          ) : (
                            <Link
                              to={`/admin/invoices/${inv.id}?return=${encodeURIComponent(`/merchants/${merchantId}/invoices`)}`}
                              style={{ textDecoration: "none", fontWeight: 900 }}
                              onClick={() => {
                                pvUiHook("billing.merchant_invoices.row_action.view.ui", {
                                  tc: "TC-MIL-UI-61",
                                  sev: "info",
                                  stable: `invoice:${inv.id}`,
                                  invoiceId: inv.id,
                                });
                              }}
                            >
                              View
                            </Link>
                          )}

                          <button onClick={() => onIssue(inv.id)} disabled={!canIssue || busy} style={buttonBase}>
                            {busy ? "Working…" : "Issue"}
                          </button>

                          <button onClick={() => onVoid(inv.id)} disabled={!canVoid || busy} style={buttonDanger}>
                            {busy ? "Working…" : "Void"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) {
              pvUiHook("billing.merchant_invoices.create_modal_cancelled.ui", {
                tc: "TC-MIL-UI-26",
                sev: "info",
                stable: "merchantInvoices:create_modal",
                merchantId: Number(merchantId),
                via: "backdrop",
              });
              setShowCreate(false);
            }
          }}
        >
          <div style={{ background: color.cardBg, padding: 16, width: 440, borderRadius: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>
              Create Draft Invoice — {merchant?.name || `Merchant #${merchantId}`}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label style={label}>
                Total ($)
                <input
                  value={totalDollars}
                  onChange={(e) => setTotalDollars(normalizeMoneyInput(e.target.value))}
                  style={input}
                  disabled={busy}
                  inputMode="decimal"
                  placeholder=""
                />
              </label>

              <label style={label}>
                Net terms (days)
                <select
                  value={netTermsDays}
                  onChange={(e) => setNetTermsDays(e.target.value)}
                  style={{ ...input, appearance: "auto" }}
                  disabled={busy}
                >
                  <option value="">Select…</option>
                  {netTermsOptions.map((d) => (
                    <option key={d} value={String(d)}>
                      {d} days
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  pvUiHook("billing.merchant_invoices.create_modal_cancelled.ui", {
                    tc: "TC-MIL-UI-26",
                    sev: "info",
                    stable: "merchantInvoices:create_modal",
                    merchantId: Number(merchantId),
                    via: "cancel_button",
                  });
                  setShowCreate(false);
                }}
                disabled={busy}
                style={buttonBase}
              >
                Cancel
              </button>

              <button
                onClick={onCreateDraft}
                disabled={busy}
                style={buttonBase}
                title="Total is in dollars; it will be converted to cents automatically."
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
              Enter totals in <b>dollars</b> (e.g. 85.50). Net terms are limited to {netTermsOptions.join("/")} days.
            </div>
          </div>
        </div>
      ) : null}
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
  verticalAlign: "top",
};

const label = {
  display: "block",
  fontSize: 12,
  color: color.textMuted,
};

const input = {
  ...themeInput,
  marginTop: 6,
};
