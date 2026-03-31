/**
 * AdminMerchantInvoices.jsx
 * Merchant-scoped invoice list for pv_admin.
 * Route: /merchants/:merchantId/invoices
 */

import React from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import {
  getMerchant,
  adminListInvoices,
  adminGenerateInvoice,
  adminGetMerchantBillingPolicy,
} from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";

/* ── Shared helpers ── */

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
  return <span>${(Number(cents || 0) / 100).toFixed(2)}</span>;
}

function titleCaseStatus(value) {
  const s = String(value || "").trim().toLowerCase();
  if (!s) return "—";
  return s.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
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

const STATUS_COLORS = {
  active:    { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  suspended: { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  archived:  { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.50)",  border: "1px solid rgba(0,0,0,0.12)" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.archived;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

/* ── Component ── */

export default function AdminMerchantInvoices() {
  const { merchantId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const currentListUrl = location.pathname + (location.search || "");

  // Return-to-row focus
  const focusId = React.useMemo(() => {
    const v = new URLSearchParams(location.search || "").get("focus");
    const n = v ? Number(v) : null;
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [location.search]);
  const didFocusRef = React.useRef(false);
  const [highlightId, setHighlightId] = React.useState(null);
  const highlightTimerRef = React.useRef(null);

  // Merchant
  const [merchant, setMerchant] = React.useState(null);
  const [merchantLoading, setMerchantLoading] = React.useState(true);

  // Invoices
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // Status filter
  const [statusFilter, setStatusFilter] = React.useState("");

  // Generate form
  const [genOpen, setGenOpen] = React.useState(false);
  const [genTotalDollars, setGenTotalDollars] = React.useState("");
  const [genNetTermsDays, setGenNetTermsDays] = React.useState("");
  const [genNetTermsOptions, setGenNetTermsOptions] = React.useState([15, 30, 45]);
  const [genMsg, setGenMsg] = React.useState("");

  // Load merchant name once
  React.useEffect(() => {
    setMerchantLoading(true);
    getMerchant(merchantId)
      .then((m) => setMerchant(m))
      .catch(() => {})
      .finally(() => setMerchantLoading(false));
  }, [merchantId]);

  // Load net terms options for this merchant
  React.useEffect(() => {
    let cancelled = false;
    adminGetMerchantBillingPolicy(merchantId)
      .then((policy) => {
        if (cancelled) return;
        const opts = policy?.effective?.allowedNetTermsDays;
        if (Array.isArray(opts) && opts.length > 0) {
          setGenNetTermsOptions(opts);
          const def = policy?.effective?.defaultNetTermsDays;
          if (def != null) setGenNetTermsDays(String(def));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [merchantId]);

  async function load() {
    setError("");
    setGenMsg("");
    setLoading(true);
    try {
      const q = { merchantId: Number(merchantId) };
      if (statusFilter) q.status = statusFilter;
      const res = await adminListInvoices(q);
      setItems(res?.items || []);
    } catch (e) {
      setError(e?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  async function onApplyFilters(e) {
    e.preventDefault();
    setBusy(true);
    try { await load(); } finally { setBusy(false); }
  }

  function onClearFilters() {
    setStatusFilter("");
    // reload with cleared filter
    setLoading(true);
    setError("");
    adminListInvoices({ merchantId: Number(merchantId) })
      .then((res) => setItems(res?.items || []))
      .catch((e) => setError(e?.message || "Failed to load invoices"))
      .finally(() => setLoading(false));
  }

  async function onGenerate(e) {
    e.preventDefault();
    setError(""); setGenMsg("");

    const cents = dollarsToCents(genTotalDollars);
    if (!Number.isInteger(cents) || cents <= 0) {
      setError("Total must be a valid dollar amount greater than 0 (e.g. 100.00).");
      return;
    }
    const net = Number(String(genNetTermsDays || "").trim());
    if (!genNetTermsOptions.includes(net)) {
      setError(`Net terms must be one of: ${genNetTermsOptions.join(", ")}.`);
      return;
    }

    setBusy(true);
    try {
      const res = await adminGenerateInvoice({ merchantId: Number(merchantId), totalCents: cents, netTermsDays: net });
      setGenMsg(`Created draft invoice #${res?.invoiceId || "?"}.`);
      setGenTotalDollars("");
      setGenOpen(false);
      await load();
    } catch (e2) {
      setError(e2?.message || "Failed to generate invoice");
    } finally {
      setBusy(false);
    }
  }

  // Return-to-row focus restore
  React.useEffect(() => {
    if (loading || !focusId || didFocusRef.current) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`inv-row-${focusId}`);
      if (el) {
        el.scrollIntoView({ block: "center" });
        didFocusRef.current = true;
        setHighlightId(focusId);
        if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 1200);
        const sp = new URLSearchParams(location.search || "");
        sp.delete("focus");
        navigate(location.pathname + (sp.toString() ? `?${sp.toString()}` : ""), { replace: true });
      }
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, [loading, focusId, location.pathname, location.search, navigate]);

  const merchantName = merchant?.name || `Merchant ${merchantId}`;

  return (
    <PageContainer size="page">
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Invoices</span>
      </div>

      <PageHeader
        title="Invoices"
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {merchant && <StatusBadge status={merchant.status} />}
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
              {merchantLoading ? "" : merchantName}
              {merchant?.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
            </span>
          </span>
        }
        right={
          <button type="button" onClick={load} disabled={loading || busy} style={styles.btn}>
            {loading ? "Loading..." : "Reload"}
          </button>
        }
      />

      {/* Error / success banners */}
      {error && (
        <div style={{ ...styles.card, background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{error}</div>
        </div>
      )}
      {genMsg && (
        <div style={{ ...styles.card, background: "rgba(0,120,255,0.08)", border: "1px solid rgba(0,120,255,0.18)", marginBottom: 12 }}>
          {genMsg}
        </div>
      )}

      {/* Generate Draft Invoice — collapsible */}
      <div style={{
        ...styles.card,
        marginBottom: 12,
        maxWidth: 680,
        ...(genOpen ? { border: "1.5px solid rgba(0,80,200,0.35)", boxShadow: "0 2px 12px rgba(0,80,200,0.10)" } : {}),
      }}>
        <button
          type="button"
          onClick={() => setGenOpen((o) => !o)}
          style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%" }}
        >
          <span style={{ fontWeight: 900 }}>Generate Draft Invoice (dev)</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "rgba(0,0,0,0.45)" }}>{genOpen ? "Hide" : "Show"}</span>
        </button>

        {genOpen && (
          <form onSubmit={onGenerate} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginTop: 12 }}>
            <div>
              <label style={styles.label}>Total ($)</label>
              <input
                value={genTotalDollars}
                onChange={(e) => setGenTotalDollars(normalizeMoneyInput(e.target.value))}
                placeholder="e.g. 100.00"
                inputMode="decimal"
                disabled={busy || loading}
                style={styles.control}
              />
            </div>
            <div>
              <label style={styles.label}>Net terms</label>
              <select
                value={genNetTermsDays}
                onChange={(e) => setGenNetTermsDays(e.target.value)}
                disabled={busy || loading}
                style={styles.control}
              >
                <option value="">Select...</option>
                {genNetTermsOptions.map((d) => (
                  <option key={d} value={String(d)}>{d} days</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={busy || loading} style={styles.btn}>
              {busy ? "Working..." : "Generate"}
            </button>
            <div style={{ width: "100%", fontSize: 12, color: "rgba(0,0,0,0.55)", marginTop: 0 }}>
              Creates a <code>draft</code> invoice. Open it and click <b>Issue invoice</b>.
            </div>
          </form>
        )}
      </div>

      {/* Status filter */}
      <div style={{ ...styles.card, marginBottom: 12 }}>
        <form onSubmit={onApplyFilters} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={styles.label}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={busy || loading}
              style={styles.control}
            >
              <option value="">(Any)</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="past_due">Past Due</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
          <button type="submit" disabled={loading || busy} style={styles.btn}>
            {busy ? "Applying..." : "Apply"}
          </button>
          <button type="button" onClick={onClearFilters} disabled={loading || busy} style={styles.btn}>
            Clear
          </button>
        </form>
      </div>

      {/* Invoice table */}
      <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", gap: 8, alignItems: "baseline" }}>
          <div style={{ fontWeight: 900 }}>Invoices</div>
          <div style={{ color: "rgba(0,0,0,0.5)", fontSize: 13 }}>({items.length})</div>
        </div>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: genOpen ? "45vh" : "55vh", minHeight: 120 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "12%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={styles.th}>Invoice</th>
                <th style={styles.th}>Total</th>
                <th style={styles.th}>Due</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    {loading ? "Loading..." : "No invoices found."}
                  </td>
                </tr>
              ) : (
                items.map((inv) => (
                  <tr
                    key={inv.id}
                    id={`inv-row-${inv.id}`}
                    style={highlightId === inv.id ? { background: "rgba(0,120,255,0.06)" } : undefined}
                  >
                    <td style={styles.td}>
                      <Link
                        to={`/admin/invoices/${inv.id}?return=${encodeURIComponent(currentListUrl)}`}
                        style={{ fontWeight: 700, textDecoration: "none" }}
                      >
                        #{inv.id}
                      </Link>
                    </td>
                    <td style={styles.td}><Money cents={inv.totalCents} /></td>
                    <td style={styles.td}>{inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}</td>
                    <td style={styles.td}><Pill status={inv.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupportInfo context={{ page: "AdminMerchantInvoices", merchantId }} />
    </PageContainer>
  );
}

const styles = {
  btn: {
    padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 800,
  },
  card: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14, padding: 14, background: "white",
  },
  label: { display: "block", fontSize: 12, color: "rgba(0,0,0,0.65)", marginBottom: 6, fontWeight: 700 },
  control: {
    padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    outline: "none", width: 190,
  },
  th: { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.08)", position: "sticky", top: 0, background: "white", zIndex: 1, fontSize: 13, color: "rgba(0,0,0,0.55)", fontWeight: 700 },
  td: { padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 },
};
