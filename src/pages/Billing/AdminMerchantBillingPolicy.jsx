// admin/src/pages/Billing/AdminMerchantBillingPolicy.jsx
import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  adminGetMerchantBillingPolicy,
  adminUpdateMerchantBillingPolicy,
  getMerchant,
} from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import SectionTabs from "../../components/layout/SectionTabs";
import useBreakpoint from "../../hooks/useBreakpoint";
import { color, btn, inputStyle as themeInput } from "../../theme";

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

function intOrEmpty(v) {
  return v === null || v === undefined ? "" : String(v);
}

function parseIntOrNull(s) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : NaN;
}

function centsToUsd(cents) {
  const n = Number(cents || 0);
  return `$${(n / 100).toFixed(2)}`;
}

function dollarsStringToCents(dollarsStr) {
  const n = Number(dollarsStr);
  if (Number.isNaN(n) || n < 0) return NaN;
  return Math.round(n * 100);
}

const controlBase = {
  ...themeInput,
  padding: "10px 12px",
  borderRadius: 10,
};

const buttonBase = {
  padding: "10px 12px",
  ...btn.secondary,
  borderRadius: 10,
};

const card = {
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: 14,
  background: color.cardBg,
};

export default function AdminMerchantBillingPolicy() {
  const { merchantId } = useParams();
  const location = useLocation();
  const { isMobile } = useBreakpoint();

  const [merchant, setMerchant] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [msg, setMsg] = React.useState("");

  const [bundle, setBundle] = React.useState(null);

  // override form fields (nullable => inherit)
  const [graceDays, setGraceDays] = React.useState("");
  const [lateFeeDollars, setLateFeeDollars] = React.useState("");
  const [lateFeeNetDays, setLateFeeNetDays] = React.useState("");
  const [guestPayTokenDays, setGuestPayTokenDays] = React.useState("");
  const [defaultNetTermsDays, setDefaultNetTermsDays] = React.useState("");

  async function load() {
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const [data] = await Promise.all([
        adminGetMerchantBillingPolicy(merchantId),
        getMerchant(merchantId).then(setMerchant).catch(() => {}),
      ]);
      setBundle(data);

      const o = data?.overrides || {};
      setGraceDays(intOrEmpty(o.graceDays));
      setLateFeeDollars(o.lateFeeCents == null ? "" : (Number(o.lateFeeCents) / 100).toFixed(2));
      setLateFeeNetDays(intOrEmpty(o.lateFeeNetDays));
      setGuestPayTokenDays(intOrEmpty(o.guestPayTokenDays));
      setDefaultNetTermsDays(intOrEmpty(o.defaultNetTermsDays));
    } catch (e) {
      setError(e?.message || "Failed to load merchant billing policy");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  const allowedNetTerms = bundle?.global?.allowedNetTermsDays || [];

  function validate() {
    const g = parseIntOrNull(graceDays);
    if (Number.isNaN(g)) return "graceDays must be an integer (or blank).";
    if (g !== null && g < 0) return "graceDays must be >= 0.";

    if (String(lateFeeDollars ?? "").trim()) {
      const cents = dollarsStringToCents(lateFeeDollars);
      if (!Number.isInteger(cents) || cents < 0) return "Late fee (USD) must be a valid amount >= 0.";
    }

    const lfn = parseIntOrNull(lateFeeNetDays);
    if (Number.isNaN(lfn)) return "lateFeeNetDays must be an integer (or blank).";
    if (lfn !== null && lfn < 1) return "lateFeeNetDays must be >= 1.";

    const gpt = parseIntOrNull(guestPayTokenDays);
    if (Number.isNaN(gpt)) return "guestPayTokenDays must be an integer (or blank).";
    if (gpt !== null && gpt < 1) return "guestPayTokenDays must be >= 1.";

    const dnt = parseIntOrNull(defaultNetTermsDays);
    if (Number.isNaN(dnt)) return "defaultNetTermsDays must be an integer (or blank).";
    if (dnt !== null && !allowedNetTerms.includes(dnt)) {
      return `defaultNetTermsDays must be one of: ${allowedNetTerms.join(", ")} (or blank).`;
    }

    return "";
  }

  async function onSave(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const body = {};
    const g = parseIntOrNull(graceDays);
    const lfn = parseIntOrNull(lateFeeNetDays);
    const gpt = parseIntOrNull(guestPayTokenDays);
    const dnt = parseIntOrNull(defaultNetTermsDays);

    if (g !== null) body.graceDays = g;

    if (String(lateFeeDollars ?? "").trim()) {
      const cents = dollarsStringToCents(lateFeeDollars);
      body.lateFeeCents = cents;
    }

    if (lfn !== null) body.lateFeeNetDays = lfn;
    if (gpt !== null) body.guestPayTokenDays = gpt;
    if (dnt !== null) body.defaultNetTermsDays = dnt;

    setBusy(true);
    try {
      await adminUpdateMerchantBillingPolicy(merchantId, body);
      setMsg("Saved.");
      await load();
    } catch (e2) {
      setError(e2?.message || "Failed to save merchant billing overrides");
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      await adminUpdateMerchantBillingPolicy(merchantId, { clear: true });
      setMsg("Overrides cleared (merchant now inherits global defaults).");
      await load();
    } catch (e2) {
      setError(e2?.message || "Failed to clear overrides");
    } finally {
      setBusy(false);
    }
  }

  const eff = bundle?.effective;
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
              <span style={{ fontSize: 12, color: color.textMuted }}>
                ID: {merchant.id}
                {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
              </span>
            </span>
          ) : null
        }
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={load} disabled={busy} style={buttonBase}>
              Reload
            </button>
            <button type="button" onClick={onClear} disabled={busy || loading} style={buttonBase}>
              Clear overrides
            </button>
            <button type="button" onClick={onSave} disabled={busy || loading} style={buttonBase}>
              {busy ? "Saving…" : "Save overrides"}
            </button>
          </div>
        }
      >
        <SectionTabs title="Sections" items={tabs} />
      </PageHeader>

      {loading ? <div style={{ color: color.textMuted, padding: "6px 2px" }}>Loading…</div> : null}

      {error ? (
        <div
          style={{
            ...card,
            background: color.dangerSubtle,
            border: `1px solid ${color.dangerBorder}`,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: color.danger }}>Error</div>
          <div style={{ whiteSpace: "pre-wrap", color: color.danger }}>{error}</div>
        </div>
      ) : null}

      {msg ? (
        <div
          style={{
            ...card,
            background: color.primarySubtle,
            border: `1px solid ${color.primaryBorder}`,
            marginBottom: 12,
          }}
        >
          {msg}
        </div>
      ) : null}

      {!loading && bundle ? (
        <>
          {/* Effective */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Effective Policy</div>
            <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? "1fr" : "220px 1fr" }}>
              <div style={styles.k}>Grace days</div>
              <div>{eff?.graceDays ?? "—"}</div>

              <div style={styles.k}>Late fee</div>
              <div>{eff ? centsToUsd(eff.lateFeeCents) : "—"}</div>

              <div style={styles.k}>Late-fee invoice net days</div>
              <div>{eff?.lateFeeNetDays ?? "—"}</div>

              <div style={styles.k}>Guest pay token days</div>
              <div>{eff?.guestPayTokenDays ?? "—"}</div>

              <div style={styles.k}>Allowed net terms</div>
              <div>{Array.isArray(eff?.allowedNetTermsDays) ? eff.allowedNetTermsDays.join(", ") : "—"}</div>

              <div style={styles.k}>Default net terms</div>
              <div>{eff?.defaultNetTermsDays ?? "—"}</div>
            </div>
          </div>

          {/* Overrides form */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Overrides</div>

            <form onSubmit={onSave}>
              <fieldset disabled={busy} style={{ border: "none", padding: 0, margin: 0 }}>
                <div style={{ ...styles.gridForm, gridTemplateColumns: isMobile ? "1fr" : "220px 1fr" }}>
                  <label style={styles.label}>Grace days</label>
                  <input
                    value={graceDays}
                    onChange={(e) => setGraceDays(e.target.value)}
                    placeholder="(inherit)"
                    style={controlBase}
                  />

                  <label style={styles.label}>Late fee (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lateFeeDollars}
                    onChange={(e) => setLateFeeDollars(e.target.value)}
                    placeholder="(inherit)"
                    style={controlBase}
                  />

                  <label style={styles.label}>Late-fee invoice net days</label>
                  <input
                    value={lateFeeNetDays}
                    onChange={(e) => setLateFeeNetDays(e.target.value)}
                    placeholder="(inherit)"
                    style={controlBase}
                  />

                  <label style={styles.label}>Guest pay token days</label>
                  <input
                    value={guestPayTokenDays}
                    onChange={(e) => setGuestPayTokenDays(e.target.value)}
                    placeholder="(inherit)"
                    style={controlBase}
                  />

                  <label style={styles.label}>Default net terms (days)</label>
                  <select
                    value={defaultNetTermsDays}
                    onChange={(e) => setDefaultNetTermsDays(e.target.value)}
                    style={controlBase}
                  >
                    <option value="">(inherit global default)</option>
                    {(allowedNetTerms.length > 0 ? allowedNetTerms : [15, 30, 45]).map((d) => (
                      <option key={d} value={String(d)}>Net {d}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
                  Leave a field blank to inherit from global policy. Money values are stored as cents internally.
                </div>
              </fieldset>
            </form>
          </div>

          {/* Raw JSON */}
          <details style={{ ...card }}>
            <summary style={{ cursor: "pointer", fontWeight: 900 }}>Show raw policy JSON</summary>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Effective</div>
              <pre style={styles.pre}>{JSON.stringify(bundle.effective, null, 2)}</pre>

              <div style={{ fontWeight: 900, marginTop: 10, marginBottom: 6 }}>Overrides</div>
              <pre style={styles.pre}>{JSON.stringify(bundle.overrides, null, 2)}</pre>

              <div style={{ fontWeight: 900, marginTop: 10, marginBottom: 6 }}>Global</div>
              <pre style={styles.pre}>{JSON.stringify(bundle.global, null, 2)}</pre>
            </div>
          </details>
        </>
      ) : null}
    </PageContainer>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 8,
  },
  k: { color: color.textMuted, fontWeight: 800, fontSize: 12 },
  gridForm: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 10,
    alignItems: "center",
  },
  label: { fontSize: 12, color: color.textMuted, fontWeight: 900 },
  pre: {
    margin: 0,
    padding: 10,
    background: "rgba(0,0,0,0.04)",
    overflowX: "auto",
    borderRadius: 12,
  },
};
