// admin/src/pages/Billing/AdminInvoiceList.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { adminListInvoices, adminGenerateInvoice, listMerchants, adminGetMerchantBillingPolicy } from "../../api/client";

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
  return <span>${v.toFixed(2)}</span>;
}

function titleCaseStatus(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "—";
  return s
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const INVOICE_STATUS_STYLES = {
  draft:    { background: "rgba(0,0,0,0.05)",      color: "rgba(0,0,0,0.55)",  border: "1px solid rgba(0,0,0,0.12)" },
  issued:   { background: "rgba(0,80,200,0.08)",   color: "rgba(0,60,160,1)",  border: "1px solid rgba(0,80,200,0.20)" },
  paid:     { background: "rgba(0,150,80,0.10)",   color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  void:     { background: "rgba(0,0,0,0.04)",      color: "rgba(0,0,0,0.35)",  border: "1px solid rgba(0,0,0,0.10)" },
  past_due: { background: "rgba(200,120,0,0.10)",  color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  overdue:  { background: "rgba(200,120,0,0.10)",  color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
};

function Pill({ status }) {
  const s = INVOICE_STATUS_STYLES[status] || INVOICE_STATUS_STYLES.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {titleCaseStatus(status)}
    </span>
  );
}

export default function AdminInvoiceList() {
  const location = useLocation();
  const navigate = useNavigate();

  // Return-to-row focus restore: when coming back from detail, we append ?focus=<invoiceId>
  const focusId = React.useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    const v = sp.get("focus");
    const n = v ? Number(v) : null;
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [location.search]);

  const didFocusRef = React.useRef(false);

  const [highlightId, setHighlightId] = React.useState(null);
  const highlightTimerRef = React.useRef(null);

  const currentListUrl = React.useMemo(() => {
    return location.pathname + (location.search || "");
  }, [location.pathname, location.search]);

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
  const [genOpen, setGenOpen] = React.useState(false);
  const [genMerchantId, setGenMerchantId] = React.useState("");
  const [genTotalDollars, setGenTotalDollars] = React.useState(""); // blank by default
  const [genNetTermsDays, setGenNetTermsDays] = React.useState(""); // dropdown, blank by default
  const [genNetTermsOptions, setGenNetTermsOptions] = React.useState([15, 30, 45]);
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

  React.useEffect(() => {
    if (!genMerchantId) {
      setGenNetTermsOptions([15, 30, 45]);
      return;
    }
    let cancelled = false;
    adminGetMerchantBillingPolicy(genMerchantId)
      .then((policy) => {
        if (cancelled) return;
        const opts = policy?.effective?.allowedNetTermsDays;
        if (Array.isArray(opts) && opts.length > 0) {
          setGenNetTermsOptions(opts);
          const def = policy?.effective?.defaultNetTermsDays;
          if (def != null) setGenNetTermsDays(String(def));
        } else {
          setGenNetTermsOptions([15, 30, 45]);
        }
      })
      .catch(() => {
        if (!cancelled) setGenNetTermsOptions([15, 30, 45]);
      });
    return () => { cancelled = true; };
  }, [genMerchantId]);

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
    if (!genNetTermsOptions.includes(net)) {
      setError(`Generate: netTermsDays must be one of ${genNetTermsOptions.join(", ")}.`);
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
      setGenOpen(false);

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
    if (!m) return `Merchant #${id}`;
    return m.name;
  };


  React.useEffect(() => {
    if (loading) return;
    if (!focusId) return;
    if (didFocusRef.current) return;

    const t = window.setTimeout(() => {
      const el = document.getElementById(`inv-row-${focusId}`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        didFocusRef.current = true;

        // Brief highlight so the user can visually re-orient.
        setHighlightId(focusId);
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 1200);


        // Remove focus param so refresh doesn't keep jumping.
        const sp = new URLSearchParams(location.search || "");
        sp.delete("focus");
        const next = location.pathname + (sp.toString() ? `?${sp.toString()}` : "");
        navigate(next, { replace: true });

        pvUiHook("billing.admin_invoices.return_focus.applied.ui", {
          tc: "TC-AIL-UI-56",
          sev: "info",
          stable: "adminInvoices:returnFocus",
          focusId,
        });
      }
    }, 0);

    return () => {
      window.clearTimeout(t);
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, [loading, focusId, location.pathname, location.search, navigate]);
  return (
    <PageContainer size="page" >
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
            {loading ? "Loading..." : "Reload"}
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

      {/* Generate invoice panel - collapsible */}
      <div style={{ ...card, marginBottom: 12, maxWidth: 800, ...(genOpen ? { border: "1.5px solid rgba(0,80,200,0.35)", boxShadow: "0 2px 12px rgba(0,80,200,0.10)" } : {}) }}>
        <button
          type="button"
          onClick={() => setGenOpen((o) => !o)}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%" }}
        >
          <span style={{ fontWeight: 900 }}>Generate Draft Invoice (dev)</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "rgba(0,0,0,0.45)" }}>{genOpen ? "▲ Hide" : "▼ Show"}</span>
        </button>

        {genOpen && (
          <form onSubmit={onGenerate} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginTop: 12 }}>
            <div>
              <label style={styles.label}>Merchant</label>
              <select
                value={genMerchantId}
                onChange={(e) => {
                  setGenMerchantId(e.target.value);
                  setGenNetTermsDays("");
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
                {genNetTermsOptions.map((d) => (
                  <option key={d} value={String(d)}>
                    {d} days
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={busy || loading} style={buttonBase}>
              {busy ? "Working…" : "Generate"}
            </button>

            <div style={{ width: "100%", fontSize: 12, color: "rgba(0,0,0,0.60)", marginTop: 0 }}>
              Creates a <code>draft</code> invoice with one "Platform fee" line item. Open it and click <b>Issue invoice</b>.
            </div>
          </form>
        )}
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
              <option value="">(Any)</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="past_due">Past Due</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
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

      {loading ? <div style={{ color: "rgba(0,0,0,0.65)", padding: "6px 2px" }}>Loading...</div> : null}

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Results</div>
          <div style={{ color: "rgba(0,0,0,0.6)" }}>
            ({items.length} invoice{items.length === 1 ? "" : "s"})
          </div>
        </div>

        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: genOpen ? "45vh" : "55vh", minHeight: 120 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>Merchant</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Due</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    No invoices found.
                  </td>
                </tr>
              ) : (
                items.map((inv) => (
                  <tr
                      key={inv.id}
                      id={`inv-row-${inv.id}`}
                      style={
                        highlightId === inv.id
                          ? { background: "rgba(0,120,255,0.06)" }
                          : undefined
                      }
                    >
                    <td style={styles.td}>
                      <Link
                        to={`/admin/invoices/${inv.id}?return=${encodeURIComponent(currentListUrl)}`}
                        style={styles.invoiceLink}
                        onClick={() => {
                          pvUiHook("billing.admin_invoices.row_nav.click.ui", {
                            tc: "TC-AIL-UI-55",
                            sev: "info",
                            stable: `invoice:${String(inv.id)}`,
                            invoiceId: inv.id,
                          });
                        }}
                        title="View invoice details"
                      >
                        #{inv.id}
                      </Link>
                    </td>

                    <td style={styles.td}>
                      {inv.merchantId ? (
                        <Link to={`/merchants/${inv.merchantId}`} style={{ textDecoration: "none", fontWeight: 700 }}>
                          {merchantLabel(inv.merchantId)}
                        </Link>
                      ) : "—"}
                    </td>

                    <td style={styles.td}>
                      <Money cents={inv.totalCents} />
                    </td>

                    <td style={styles.td}>{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>

                    <td style={styles.td}>
                      <Pill status={inv.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </PageContainer>
  );
}

const styles = {
  label: { display: "block", fontSize: 12, color: "rgba(0,0,0,0.65)", marginBottom: 6, fontWeight: 700 },

  th: { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.08)", position: "sticky", top: 0, background: "white", zIndex: 1 },
  td: { padding: 12, borderBottom: "1px solid rgba(0,0,0,0.06)" },

  // Navigation link (blue comes from Link / theme; we do NOT force a non-blue color here).
  invoiceLink: { fontWeight: 700, textDecoration: "none" },

  code: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
  },
};
