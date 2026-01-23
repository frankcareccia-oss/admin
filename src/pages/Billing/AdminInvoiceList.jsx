// admin/src/pages/Billing/AdminInvoiceList.jsx
import React from "react";
import { Link } from "react-router-dom";
import { adminListInvoices, adminGenerateInvoice, listMerchants } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";

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

const controlBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  outline: "none",
};

const controlSm = {
  ...controlBase,
  width: 190,
};

const controlMd = {
  ...controlBase,
  width: 220,
};

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const card = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  padding: 14,
  background: "white",
};

const NET_TERMS_OPTIONS = [15, 30, 45];

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

function Money({ cents }) {
  const v = Number(cents || 0) / 100;
  return <span>{v.toFixed(2)}</span>;
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
        fontWeight: 800,
        background: "rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.10)",
        textTransform: "lowercase",
      }}
    >
      {children}
    </span>
  );
}

export default function AdminInvoiceList() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // merchants for dropdowns
  const [merchants, setMerchants] = React.useState([]);
  const [merchantsLoading, setMerchantsLoading] = React.useState(true);

  // filters
  const [status, setStatus] = React.useState("");
  const [merchantId, setMerchantId] = React.useState(""); // dropdown value string

  // generate invoice form (DEV)
  const [genMerchantId, setGenMerchantId] = React.useState("");
  const [genTotalDollars, setGenTotalDollars] = React.useState(""); // blank by default
  const [genNetTermsDays, setGenNetTermsDays] = React.useState(""); // dropdown, blank by default
  const [genMsg, setGenMsg] = React.useState("");

  async function loadMerchantsOnce() {
    setMerchantsLoading(true);
    pvUiHook("billing.admin_invoices.merchants_load_started.ui", {
      tc: "TC-AIL-UI-01",
      sev: "info",
      stable: "adminInvoices:merchants",
    });

    try {
      const res = await listMerchants({ status: "active" });
      const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      const normalized = rows
        .map((m) => ({ id: m.id, name: m.name || `Merchant ${m.id}` }))
        .filter((m) => Number.isInteger(Number(m.id)))
        .sort((a, b) => Number(a.id) - Number(b.id));

      setMerchants(normalized);

      pvUiHook("billing.admin_invoices.merchants_load_succeeded.ui", {
        tc: "TC-AIL-UI-02",
        sev: "info",
        stable: "adminInvoices:merchants",
        count: normalized.length,
      });
    } catch (e) {
      setMerchants([]);
      pvUiHook("billing.admin_invoices.merchants_load_failed.ui", {
        tc: "TC-AIL-UI-03",
        sev: "warn",
        stable: "adminInvoices:merchants",
        error: e?.message || String(e),
      });
    } finally {
      setMerchantsLoading(false);
    }
  }

  async function load() {
    setError("");
    setGenMsg("");
    setLoading(true);

    pvUiHook("billing.admin_invoices.list_load_started.ui", {
      tc: "TC-AIL-UI-10",
      sev: "info",
      stable: "adminInvoices:list",
      status: status || null,
      merchantId: merchantId ? Number(merchantId) : null,
    });

    try {
      const q = {};
      if (status) q.status = status;
      if (merchantId) q.merchantId = Number(merchantId);

      const res = await adminListInvoices(q);
      const list = res?.items || [];
      setItems(list);

      pvUiHook("billing.admin_invoices.list_load_succeeded.ui", {
        tc: "TC-AIL-UI-11",
        sev: "info",
        stable: "adminInvoices:list",
        count: list.length,
      });
    } catch (e) {
      setError(e?.message || "Failed to load invoices");
      pvUiHook("billing.admin_invoices.list_load_failed.ui", {
        tc: "TC-AIL-UI-12",
        sev: "error",
        stable: "adminInvoices:list",
        error: e?.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    pvUiHook("billing.admin_invoices.page_loaded.ui", {
      tc: "TC-AIL-UI-00",
      sev: "info",
      stable: "adminInvoices:page",
    });
    loadMerchantsOnce();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onApplyFilters(e) {
    e.preventDefault();
    setBusy(true);

    pvUiHook("billing.admin_invoices.filters.apply.ui", {
      tc: "TC-AIL-UI-20",
      sev: "info",
      stable: "adminInvoices:filters",
      status: status || null,
      merchantId: merchantId ? Number(merchantId) : null,
    });

    // Back-compat alias (optional): keep old hook name if any tooling depends on it.
    pvUiHook("billing.admin_invoices.filters_applied.ui", {
      tc: "TC-AIL-UI-20A",
      sev: "info",
      stable: "adminInvoices:filters",
      status: status || null,
      merchantId: merchantId ? Number(merchantId) : null,
    });

    try {
      await load();
    } finally {
      setBusy(false);
    }
  }

  function onClearFilters() {
    const hadAny = Boolean(status || merchantId);
    setStatus("");
    setMerchantId("");

    pvUiHook("billing.admin_invoices.filters.clear.ui", {
      tc: "TC-AIL-UI-21",
      sev: "info",
      stable: "adminInvoices:filters",
      hadAny,
    });

    // Back-compat alias (optional)
    pvUiHook("billing.admin_invoices.filters_cleared.ui", {
      tc: "TC-AIL-UI-21A",
      sev: "info",
      stable: "adminInvoices:filters",
      hadAny,
    });

    // Trigger reload immediately to reflect cleared filters.
    load();
  }

  async function onGenerate(e) {
    e.preventDefault();
    setError("");
    setGenMsg("");

    pvUiHook("billing.admin_invoices.generate_draft.click.ui", {
      tc: "TC-AIL-UI-30C",
      sev: "info",
      stable: "adminInvoices:generateDraft",
      merchantId: genMerchantId ? Number(genMerchantId) : null,
      netTermsDays: genNetTermsDays ? Number(genNetTermsDays) : null,
      totalDollars: genTotalDollars || null,
    });

    const mid = Number(genMerchantId);
    if (!Number.isInteger(mid) || mid <= 0) {
      setError("Generate: select a merchant.");
      pvUiHook("billing.admin_invoices.generate_draft.blocked.ui", {
        tc: "TC-AIL-UI-31",
        sev: "warn",
        stable: "adminInvoices:generateDraft",
        blockedReason: "merchant_missing",
      });
      return;
    }

    const cents = dollarsToCents(genTotalDollars);
    if (!Number.isInteger(cents) || cents <= 0) {
      setError("Generate: total must be a valid dollar amount greater than 0 (e.g. 100.00).");
      pvUiHook("billing.admin_invoices.generate_draft.blocked.ui", {
        tc: "TC-AIL-UI-31",
        sev: "warn",
        stable: "adminInvoices:generateDraft",
        blockedReason: "total_invalid",
        totalDollars: genTotalDollars || null,
      });
      return;
    }

    const net = Number(String(genNetTermsDays || "").trim());
    if (!NET_TERMS_OPTIONS.includes(net)) {
      setError(`Generate: netTermsDays must be one of ${NET_TERMS_OPTIONS.join(", ")}.`);
      pvUiHook("billing.admin_invoices.generate_draft.blocked.ui", {
        tc: "TC-AIL-UI-31",
        sev: "warn",
        stable: "adminInvoices:generateDraft",
        blockedReason: "net_terms_invalid",
        netTermsDays: net || null,
      });
      return;
    }

    setBusy(true);
    pvUiHook("billing.admin_invoices.generate_draft.started.ui", {
      tc: "TC-AIL-UI-30",
      sev: "info",
      stable: "adminInvoices:generateDraft",
      merchantId: mid,
      totalCents: cents,
      netTermsDays: net,
    });

    try {
      const res = await adminGenerateInvoice({
        merchantId: mid,
        totalCents: cents,
        netTermsDays: net,
      });
      setGenMsg(`Created draft invoice #${res?.invoiceId || "?"} for merchant ${mid}.`);

      pvUiHook("billing.admin_invoices.generate_draft.success.ui", {
        tc: "TC-AIL-UI-32",
        sev: "info",
        stable: "adminInvoices:generateDraft",
        invoiceId: res?.invoiceId || null,
        merchantId: mid,
      });

      // Back-compat aliases (optional)
      pvUiHook("billing.admin_invoices.generate_started.ui", {
        tc: "TC-AIL-UI-30A",
        sev: "info",
        stable: "adminInvoices:generate",
        merchantId: mid,
        totalCents: cents,
        netTermsDays: net,
      });
      pvUiHook("billing.admin_invoices.generate_succeeded.ui", {
        tc: "TC-AIL-UI-32A",
        sev: "info",
        stable: "adminInvoices:generate",
        invoiceId: res?.invoiceId || null,
        merchantId: mid,
      });

      await load();
    } catch (e2) {
      setError(e2?.message || "Failed to generate invoice");
      pvUiHook("billing.admin_invoices.generate_draft.failure.ui", {
        tc: "TC-AIL-UI-33",
        sev: "error",
        stable: "adminInvoices:generateDraft",
        error: e2?.message || String(e2),
      });

      // Back-compat alias (optional)
      pvUiHook("billing.admin_invoices.generate_failed.ui", {
        tc: "TC-AIL-UI-33A",
        sev: "error",
        stable: "adminInvoices:generate",
        error: e2?.message || String(e2),
      });
    } finally {
      setBusy(false);
    }
  }

  const merchantLabel = (id) => {
    const m = merchants.find((x) => String(x.id) === String(id));
    if (!m) return `Merchant ${id}`;
    return `${m.name} (#${m.id})`;
  };

  return (
    <PageContainer size="page">
      <PageHeader
        title="Admin Invoices"
        subtitle="Search invoices, drill into details, and generate dev draft invoices."
        right={
          <button
            type="button"
            onClick={() => {
              pvUiHook("billing.admin_invoices.reload_clicked.ui", {
                tc: "TC-AIL-UI-40",
                sev: "info",
                stable: "adminInvoices:reload",
              });
              load();
            }}
            disabled={loading || busy}
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
            background: "rgba(255,0,0,0.06)",
            border: "1px solid rgba(255,0,0,0.15)",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      ) : null}

      {genMsg ? (
        <div
          style={{
            ...card,
            background: "rgba(0,120,255,0.08)",
            border: "1px solid rgba(0,120,255,0.18)",
            marginBottom: 12,
          }}
        >
          {genMsg}
        </div>
      ) : null}

      {/* Generate invoice panel */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Generate Draft Invoice (dev)</div>

        <form onSubmit={onGenerate} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
          <div>
            <label style={styles.label}>Merchant</label>
            <select
              value={genMerchantId}
              onChange={(e) => {
                setGenMerchantId(e.target.value);
                setError("");
              }}
              style={controlMd}
              disabled={busy || loading || merchantsLoading}
            >
              <option value="">{merchantsLoading ? "Loading merchants…" : "Select merchant…"}</option>
              {merchants.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name} (#{m.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={styles.label}>Total ($)</label>
            <input
              value={genTotalDollars}
              onChange={(e) => setGenTotalDollars(normalizeMoneyInput(e.target.value))}
              placeholder=""
              inputMode="decimal"
              style={controlMd}
              disabled={busy || loading}
            />
          </div>

          <div>
            <label style={styles.label}>Net terms</label>
            <select
              value={genNetTermsDays}
              onChange={(e) => setGenNetTermsDays(e.target.value)}
              style={controlSm}
              disabled={busy || loading}
            >
              <option value="">Select…</option>
              {NET_TERMS_OPTIONS.map((d) => (
                <option key={d} value={String(d)}>
                  {d} days
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={busy || loading} style={buttonBase}>
            {busy ? "Working…" : "Generate"}
          </button>
        </form>

        <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
          Creates a <code>draft</code> invoice with one “Platform fee” line item. Open it and click <b>Issue invoice</b>.
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Filters</div>

        <form onSubmit={onApplyFilters} style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <label style={styles.label}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={busy || loading}
              style={controlSm}
            >
              <option value="">(any)</option>
              <option value="draft">draft</option>
              <option value="issued">issued</option>
              <option value="past_due">past_due</option>
              <option value="paid">paid</option>
              <option value="void">void</option>
            </select>
          </div>

          <div>
            <label style={styles.label}>Merchant</label>
            <select
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              disabled={busy || loading || merchantsLoading}
              style={controlMd}
            >
              <option value="">{merchantsLoading ? "Loading merchants…" : "(any)"}</option>
              {merchants.map((m) => (
                <option key={m.id} value={String(m.id)}>
                  {m.name} (#{m.id})
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={loading || busy} style={buttonBase}>
            {busy ? "Applying…" : "Apply"}
          </button>

          <button type="button" onClick={onClearFilters} disabled={loading || busy} style={buttonBase}>
            Clear filters
          </button>
        </form>
      </div>

      {loading ? <div style={{ color: "rgba(0,0,0,0.65)", padding: "6px 2px" }}>Loading…</div> : null}

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
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
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>Merchant</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Due</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    No invoices found.
                  </td>
                </tr>
              ) : (
                items.map((inv) => {
                  const isPaid = inv.status === "paid";
                  return (
                    <tr key={inv.id}>
                      <td style={styles.td}>
                        <Link
                          to={`/admin/invoices/${inv.id}`}
                          style={{ textDecoration: "none" }}
                          onClick={() => {
                            pvUiHook("billing.admin_invoices.row_action.view.ui", {
                              tc: "TC-AIL-UI-50",
                              sev: "info",
                              stable: `invoice:${inv.id}`,
                              invoiceId: inv.id,
                            });

                            // Back-compat alias (optional)
                            pvUiHook("billing.admin_invoices.row_open_clicked.ui", {
                              tc: "TC-AIL-UI-50A",
                              sev: "info",
                              stable: `invoice:${inv.id}`,
                              invoiceId: inv.id,
                            });
                          }}
                        >
                          #{inv.id}
                        </Link>
                      </td>
                      <td style={styles.td}>{merchantLabel(inv.merchantId)}</td>
                      <td style={styles.td}>
                        <Pill>{inv.status}</Pill>
                      </td>
                      <td style={styles.td}>
                        <Money cents={inv.totalCents} />
                      </td>
                      <td style={styles.td}>{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {isPaid ? (
                          <span style={{ fontWeight: 800, color: "rgba(0,0,0,0.35)" }}>Paid</span>
                        ) : (
                          <Link
                            to={`/admin/invoices/${inv.id}`}
                            style={{ textDecoration: "none", fontWeight: 800 }}
                            onClick={() => {
                              pvUiHook("billing.admin_invoices.row_action.view.ui", {
                                tc: "TC-AIL-UI-51",
                                sev: "info",
                                stable: `invoice:${inv.id}`,
                                invoiceId: inv.id,
                              });

                              // Back-compat alias (optional): remove once consumers migrate
                              pvUiHook("billing.admin_invoices.pay_now_clicked.ui", {
                                tc: "TC-AIL-UI-51A",
                                sev: "info",
                                stable: `invoice:${inv.id}`,
                                invoiceId: inv.id,
                              });
                            }}
                          >
                            View
                          </Link>
                        )}
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
        Note: This is dev-friendly invoice generation. Real billing generation rules come after Step 3.
      </div>
    </PageContainer>
  );
}

const styles = {
  label: { display: "block", fontSize: 12, color: "rgba(0,0,0,0.65)", marginBottom: 6, fontWeight: 700 },
  th: { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)" },
  td: { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.06)" },
};
