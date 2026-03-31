// src/pages/Billing/AdminBillingPolicy.jsx

/**
 * PerkValet — Admin Billing Policy (PV Admin)
 * Route: /admin/billing-policy
 *
 * Thread N (UI scaffolding, Master Spec v2.02.1 locked)
 * ----------------------------------------------------
 * Purpose:
 * - PV Admin can view and update the *global* billing defaults used by:
 *   - invoice issuance (net terms / default net terms)
 *   - late-fee behavior (grace days, late fee amount, late-fee net days)
 *   - guest pay token expiration window (guestPayTokenDays)
 *
 * Rollout alignment:
 * - Step 1: Make billing policy persistent WITHOUT migrations (this page supports that)
 * - Step 2: Invoice UI (lists/details) consumes policy behavior via server responses
 * - Step 3: Migrations and full billing engine hardening (out of scope here)
 *
 * Data contracts (UI assumptions):
 * - GET getBillingPolicy():
 *   - returns: {
 *       graceDays: number,
 *       lateFeeCents: number,
 *       lateFeeNetDays: number,
 *       guestPayTokenDays: number,
 *       allowedNetTermsDays: number[],
 *       defaultNetTermsDays: number,
 *       updatedAt?: string
 *     }
 *
 * - POST/PATCH updateBillingPolicy(payload):
 *   - payload matches the fields above (cents as integers)
 *   - returns updated policy object (same shape as GET)
 *
 * Out of scope (Thread D / billing engine):
 * - Any invoice generation schedules, late-fee assessment jobs, Stripe reconciliation
 * - Merchant-specific billing policies (if later introduced) beyond existing UI stubs
 *
 * Notes:
 * - UI edits are validated client-side, but the server remains authoritative.
 * - Dollars are presented for late fee, but stored/transmitted as integer cents.
 */

import React from "react";
import { getBillingPolicy, updateBillingPolicy } from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";
import useBreakpoint from "../../hooks/useBreakpoint";

function parseCsvInts(text) {
  const raw = String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const nums = raw.map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0);

  // unique + sorted
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function centsToDollarsString(cents) {
  const n = Number(cents || 0);
  return (n / 100).toFixed(2);
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

export default function AdminBillingPolicy() {
  const { isMobile } = useBreakpoint();
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [savedMsg, setSavedMsg] = React.useState("");

  // Form state
  const [graceDays, setGraceDays] = React.useState(5);

  // UI shows dollars, backend stores cents
  const [lateFeeDollars, setLateFeeDollars] = React.useState("15.00");

  const [lateFeeNetDays, setLateFeeNetDays] = React.useState(7);
  const [guestPayTokenDays, setGuestPayTokenDays] = React.useState(7);
  const [allowedNetTermsCsv, setAllowedNetTermsCsv] = React.useState("15,30,45");
  const [defaultNetTermsDays, setDefaultNetTermsDays] = React.useState(30);

  const [updatedAt, setUpdatedAt] = React.useState("");

  async function load() {
    setError("");
    setSavedMsg("");
    setLoading(true);
    try {
      const p = await getBillingPolicy();

      setGraceDays(p.graceDays ?? 0);
      setLateFeeDollars(centsToDollarsString(p.lateFeeCents ?? 0));
      setLateFeeNetDays(p.lateFeeNetDays ?? 7);
      setGuestPayTokenDays(p.guestPayTokenDays ?? 7);

      const allowed = Array.isArray(p.allowedNetTermsDays) ? p.allowedNetTermsDays : [15, 30, 45];
      setAllowedNetTermsCsv(allowed.join(","));

      setDefaultNetTermsDays(p.defaultNetTermsDays ?? (allowed.includes(30) ? 30 : allowed[0] || 30));
      setUpdatedAt(p.updatedAt || "");
    } catch (e) {
      setError(e?.message || "Failed to load billing policy");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  function validateClient() {
    const allowed = parseCsvInts(allowedNetTermsCsv);

    if (!Number.isInteger(graceDays) || graceDays < 0) return "graceDays must be an integer >= 0";

    const lateFeeCents = dollarsStringToCents(lateFeeDollars);
    if (!Number.isInteger(lateFeeCents) || lateFeeCents < 0) return "late fee must be a valid USD amount >= 0";

    if (!Number.isInteger(lateFeeNetDays) || lateFeeNetDays < 1) return "lateFeeNetDays must be an integer >= 1";
    if (!Number.isInteger(guestPayTokenDays) || guestPayTokenDays < 1)
      return "guestPayTokenDays must be an integer >= 1";

    if (!allowed.length) return "allowedNetTermsDays must contain at least one positive integer (e.g., 15,30,45)";
    if (!Number.isInteger(defaultNetTermsDays)) return "defaultNetTermsDays must be an integer";
    if (!allowed.includes(defaultNetTermsDays))
      return "defaultNetTermsDays must be one of the allowedNetTermsDays values";

    return "";
  }

  async function onSave(e) {
    e.preventDefault();
    setError("");
    setSavedMsg("");

    const clientErr = validateClient();
    if (clientErr) {
      setError(clientErr);
      return;
    }

    const allowed = parseCsvInts(allowedNetTermsCsv);
    const lateFeeCents = dollarsStringToCents(lateFeeDollars);

    setBusy(true);
    try {
      const payload = {
        graceDays: Number(graceDays),
        lateFeeCents,
        lateFeeNetDays: Number(lateFeeNetDays),
        guestPayTokenDays: Number(guestPayTokenDays),
        allowedNetTermsDays: allowed,
        defaultNetTermsDays: Number(defaultNetTermsDays),
      };

      const updated = await updateBillingPolicy(payload);
      setUpdatedAt(updated.updatedAt || "");
      setAllowedNetTermsCsv((updated.allowedNetTermsDays || allowed).join(","));
      setLateFeeDollars(centsToDollarsString(updated.lateFeeCents ?? lateFeeCents));
      setSavedMsg("Saved.");
    } catch (e2) {
      setError(e2?.message || "Failed to save billing policy");
    } finally {
      setBusy(false);
    }
  }

  const allowedParsed = parseCsvInts(allowedNetTermsCsv);

  return (
    <PageContainer size="form">
      <PageHeader
        title="Admin Billing Policy"
        subtitle="Global billing defaults for invoice terms, late fees, and guest payments."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button type="button" onClick={load} disabled={busy} style={buttonBase}>
              Reload
            </button>
            <button type="button" onClick={onSave} disabled={loading || busy} style={buttonBase}>
              {busy ? "Saving…" : "Save policy"}
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

      {savedMsg ? (
        <div
          style={{
            ...card,
            background: "rgba(0,120,255,0.08)",
            border: "1px solid rgba(0,120,255,0.18)",
            marginBottom: 12,
          }}
        >
          {savedMsg}
        </div>
      ) : null}

      <form onSubmit={onSave} style={{ display: "grid", gap: 12 }}>
        <div style={{ ...card, opacity: loading || busy ? 0.75 : 1 }}>
          <div style={styles.cardHeader}>Late Fee Policy</div>

          <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? "1fr" : "220px 1fr" }}>
            <label style={styles.label}>Grace days</label>
            <input
              type="number"
              min={0}
              step={1}
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value))}
              disabled={loading || busy}
              style={controlBase}
            />

            <label style={styles.label}>Late fee (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={lateFeeDollars}
              onChange={(e) => setLateFeeDollars(e.target.value)}
              disabled={loading || busy}
              style={controlBase}
            />

            <label style={styles.label}>Late-fee invoice net days</label>
            <input
              type="number"
              min={1}
              step={1}
              value={lateFeeNetDays}
              onChange={(e) => setLateFeeNetDays(Number(e.target.value))}
              disabled={loading || busy}
              style={controlBase}
            />

            <label style={styles.label}>Guest pay token days</label>
            <input
              type="number"
              min={1}
              step={1}
              value={guestPayTokenDays}
              onChange={(e) => setGuestPayTokenDays(Number(e.target.value))}
              disabled={loading || busy}
              style={controlBase}
            />
          </div>

          <div style={styles.note}>Note: Amounts are stored internally as cents to avoid rounding bugs.</div>
        </div>

        <div style={{ ...card, opacity: loading || busy ? 0.75 : 1 }}>
          <div style={styles.cardHeader}>Invoice Net Terms</div>

          <div style={{ ...styles.grid, gridTemplateColumns: isMobile ? "1fr" : "220px 1fr" }}>
            <label style={styles.label}>Allowed net terms (days)</label>
            <input
              type="text"
              placeholder="15,30,45"
              value={allowedNetTermsCsv}
              onChange={(e) => setAllowedNetTermsCsv(e.target.value)}
              disabled={loading || busy}
              style={controlBase}
            />

            <label style={styles.label}>Default net terms (days)</label>
            <select
              value={defaultNetTermsDays}
              onChange={(e) => setDefaultNetTermsDays(Number(e.target.value))}
              disabled={loading || busy}
              style={controlBase}
            >
              {allowedParsed.map((n) => (
                <option key={n} value={n}>
                  Net {n}
                </option>
              ))}
              {!allowedParsed.includes(defaultNetTermsDays) ? (
                <option value={defaultNetTermsDays}>Net {defaultNetTermsDays}</option>
              ) : null}
            </select>
          </div>

          <div style={styles.note}>
            Note: “Past due” is derived from due date. Net terms sets the due date at invoice issuance.
          </div>
        </div>

        {updatedAt ? (
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
            Last updated: <code>{updatedAt}</code>
          </div>
        ) : null}
      </form>
    </PageContainer>
  );
}

const styles = {
  cardHeader: {
    fontWeight: 900,
    fontSize: 14,
    marginBottom: 10,
    color: "rgba(0,0,0,0.78)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: "rgba(0,0,0,0.65)",
    fontWeight: 800,
  },
  note: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(0,0,0,0.60)",
  },
};
