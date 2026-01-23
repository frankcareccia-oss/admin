// admin/src/pages/Billing/AdminMerchantBillingPolicy.jsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminGetMerchantBillingPolicy,
  adminUpdateMerchantBillingPolicy,
} from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";

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
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  outline: "none",
};

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
  padding: 14,
  background: "white",
};

export default function AdminMerchantBillingPolicy() {
  const { merchantId } = useParams();

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
      const data = await adminGetMerchantBillingPolicy(merchantId);
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

  return (
    <PageContainer size="page">
      <div style={{ marginBottom: 10 }}>
        <Link to={`/merchants/${merchantId}`} style={{ textDecoration: "none" }}>
          ← Back to Merchant
        </Link>
      </div>

      <PageHeader
        title="Merchant Billing Policy"
        subtitle={<span>Merchant ID: <code>{merchantId}</code></span>}
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
      />

      {loading ? <div style={{ color: "rgba(0,0,0,0.65)", padding: "6px 2px" }}>Loading…</div> : null}

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

      {msg ? (
        <div
          style={{
            ...card,
            background: "rgba(0,120,255,0.08)",
            border: "1px solid rgba(0,120,255,0.18)",
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
            <div style={styles.grid}>
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
                <div style={styles.gridForm}>
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
                  <input
                    value={defaultNetTermsDays}
                    onChange={(e) => setDefaultNetTermsDays(e.target.value)}
                    placeholder={`(inherit) allowed: ${allowedNetTerms.join(", ")}`}
                    style={controlBase}
                  />
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
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
  k: { color: "rgba(0,0,0,0.65)", fontWeight: 800, fontSize: 12 },
  gridForm: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 10,
    alignItems: "center",
  },
  label: { fontSize: 12, color: "rgba(0,0,0,0.65)", fontWeight: 900 },
  pre: {
    margin: 0,
    padding: 10,
    background: "rgba(0,0,0,0.04)",
    overflowX: "auto",
    borderRadius: 12,
  },
};
