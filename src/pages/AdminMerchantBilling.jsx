/**
 * Module: admin/src/pages/AdminMerchantBilling.jsx
 *
 * Billing Account tab for a merchant (pv_admin + pv_ar_clerk).
 *
 * Shows and edits:
 *  - PV Account # (admin only)
 *  - Billing contact name, email, phone
 *  - Billing address (flat fields)
 *  - Payment terms override (net days)
 *  - Account status (read-only)
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  getMerchant,
  adminGetBillingAccount,
  adminUpdateBillingAccount,
  getSystemRole,
} from "../api/client";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";


function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never break UI for logging
  }
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const ACCT_STATUS_COLORS = {
  active:    { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  suspended: { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  canceled:  { background: "rgba(180,0,0,0.08)",   color: "rgba(140,0,0,0.9)", border: "1px solid rgba(180,0,0,0.20)" },
};

function StatusBadge({ status }) {
  const s = ACCT_STATUS_COLORS[status] || ACCT_STATUS_COLORS.suspended;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

function isPlaceholderEmail(email) {
  return String(email || "").includes("@example.com");
}

const NET_TERMS_OPTIONS = [
  { value: "",   label: "Global default" },
  { value: "0",  label: "Net 0 (due on receipt)" },
  { value: "15", label: "Net 15" },
  { value: "30", label: "Net 30" },
  { value: "45", label: "Net 45" },
  { value: "60", label: "Net 60" },
  { value: "90", label: "Net 90" },
];

// Format raw digits to (XXX) XXX-XXXX
function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function validateFields(fields) {
  const errors = [];

  if (!String(fields.billingEmail || "").trim()) {
    errors.push("Billing email is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.billingEmail).trim())) {
    errors.push("Billing email is not a valid email address.");
  }

  const phoneDigits = String(fields.billingPhone || "").replace(/\D/g, "");
  if (phoneDigits && phoneDigits.length !== 10) {
    errors.push("Billing phone must be a 10-digit US number.");
  }

  const postal = String(fields.billingPostal || "").trim();
  if (postal && !/^\d{5}(-\d{4})?$/.test(postal)) {
    errors.push("Zip code must be 5 digits (or 5+4).");
  }

  // If any address field is provided, require city + state + postal
  const hasAnyAddress = fields.billingAddress1 || fields.billingCity || fields.billingState || fields.billingPostal;
  if (hasAnyAddress) {
    if (!String(fields.billingCity || "").trim())  errors.push("City is required when an address is provided.");
    if (!String(fields.billingState || "").trim()) errors.push("State is required when an address is provided.");
    if (!postal)                                   errors.push("Zip code is required when an address is provided.");
  }

  return errors;
}

export default function AdminMerchantBilling() {
  const { merchantId } = useParams();

  const [merchant, setMerchant] = React.useState(null);
  const [billingAccount, setBillingAccount] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState("");

  const [editing, setEditing] = React.useState(false);
  const [fields, setFields] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [saveErr, setSaveErr] = React.useState("");
  const [saveOk, setSaveOk] = React.useState("");

  const isAdmin = getSystemRole() === "pv_admin";

  async function load() {
    setLoading(true);
    setLoadErr("");
    pvUiHook("admin.merchant.billing.load_started.ui", {
      stable: "admin:merchant:billing", merchantId: Number(merchantId),
    });
    try {
      const [mResult, baResult] = await Promise.allSettled([
        getMerchant(merchantId),
        adminGetBillingAccount(merchantId),
      ]);
      if (mResult.status === "fulfilled") setMerchant(mResult.value);
      else throw new Error(mResult.reason?.message || "Failed to load merchant");
      if (baResult.status === "fulfilled") setBillingAccount(baResult.value?.billingAccount ?? null);
      pvUiHook("admin.merchant.billing.load_succeeded.ui", {
        stable: "admin:merchant:billing",
        merchantId: Number(merchantId),
        hasBillingAccount: baResult.status === "fulfilled" && !!baResult.value?.billingAccount,
      });
    } catch (e) {
      setLoadErr(e?.message || "Failed to load");
      pvUiHook("admin.merchant.billing.load_failed.ui", {
        stable: "admin:merchant:billing",
        merchantId: Number(merchantId),
        error: e?.message,
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  function onEdit() {
    pvUiHook("admin.merchant.billing.edit_opened.ui", {
      stable: "admin:merchant:billing:edit", merchantId: Number(merchantId),
    });
    const ba = billingAccount || {};
    setFields({
      pvAccountNumber:  ba.pvAccountNumber  || "",
      billingName:      ba.billingName      || "",
      billingEmail:     ba.billingEmail     || "",
      billingPhone:     formatPhone(ba.billingPhone || ""),
      billingAddress1:  ba.billingAddress1  || "",
      billingCity:      ba.billingCity      || "",
      billingState:     ba.billingState     || "",
      billingPostal:    ba.billingPostal    || "",
      netTermsDays:     ba.policyOverridesJson?.netTermsDays != null
                          ? String(ba.policyOverridesJson.netTermsDays)
                          : "",
    });
    setSaveErr("");
    setSaveOk("");
    setEditing(true);
  }

  function onCancel() {
    pvUiHook("admin.merchant.billing.edit_cancelled.ui", {
      stable: "admin:merchant:billing:edit", merchantId: Number(merchantId),
    });
    setEditing(false);
    setSaveErr("");
    setSaveOk("");
  }

  function setField(key, value) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function onSave(e) {
    e.preventDefault();
    setSaveErr("");
    setSaveOk("");

    const errors = validateFields(fields);
    if (errors.length > 0) {
      setSaveErr(errors.join("\n"));
      pvUiHook("admin.merchant.billing.save_validation_failed.ui", {
        stable: "admin:merchant:billing:save",
        merchantId: Number(merchantId),
        errors,
      });
      return;
    }

    setBusy(true);
    pvUiHook("admin.merchant.billing.save_started.ui", {
      stable: "admin:merchant:billing:save", merchantId: Number(merchantId),
    });

    try {
      // Store phone as raw digits only (E.164-ish), display formatting is UI-only
      const phoneDigits = String(fields.billingPhone || "").replace(/\D/g, "");

      const payload = {
        billingName:     fields.billingName     || null,
        billingEmail:    String(fields.billingEmail).trim().toLowerCase(),
        billingPhone:    phoneDigits || null,
        billingAddress1: fields.billingAddress1 || null,
        billingCity:     fields.billingCity     || null,
        billingState:    fields.billingState    || null,
        billingPostal:   fields.billingPostal   || null,
      };

      const terms = fields.netTermsDays !== "" ? Number(fields.netTermsDays) : null;
      if (terms !== null && !Number.isNaN(terms)) {
        payload.policyOverridesJson = {
          ...(billingAccount?.policyOverridesJson || {}),
          netTermsDays: terms,
        };
      } else {
        // Explicit clear of the override
        const existing = { ...(billingAccount?.policyOverridesJson || {}) };
        delete existing.netTermsDays;
        payload.policyOverridesJson = Object.keys(existing).length ? existing : null;
      }

      if (isAdmin) {
        payload.pvAccountNumber = fields.pvAccountNumber || null;
      }

      const result = await adminUpdateBillingAccount(merchantId, payload);
      setBillingAccount(result?.billingAccount ?? null);
      setSaveOk("Billing account updated.");
      setEditing(false);
      pvUiHook("admin.merchant.billing.save_succeeded.ui", {
        stable: "admin:merchant:billing:save", merchantId: Number(merchantId),
      });
    } catch (e2) {
      setSaveErr(e2?.message || "Failed to update billing account");
      pvUiHook("admin.merchant.billing.save_failed.ui", {
        stable: "admin:merchant:billing:save",
        merchantId: Number(merchantId),
        error: e2?.message,
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <PageContainer size="page"><div style={{ padding: 16 }}>Loading…</div></PageContainer>;
  }

  if (loadErr && !merchant) {
    return (
      <PageContainer size="page">
        <div style={styles.errBox}>{loadErr}</div>
      </PageContainer>
    );
  }

  const ba = billingAccount;
  const merchantName = merchant?.name || `Merchant ${merchantId}`;

  return (
    <PageContainer size="page">
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Billing</span>
      </div>

      <PageHeader
        title="Billing"
        subtitle={
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge status={merchant?.status} />
            <span style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
              {merchantName}
              {ba?.pvAccountNumber ? ` · ${ba.pvAccountNumber}` : ""}
            </span>
          </span>
        }
        right={
          <button onClick={() => { pvUiHook("admin.merchant.billing.refresh_clicked.ui", { stable: "admin:merchant:billing", merchantId: Number(merchantId) }); load(); }} disabled={busy} style={styles.refreshBtn}>Refresh</button>
        }
      />

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>Billing Account</div>
          {!editing && ba && (
            <button onClick={onEdit} style={styles.editBtn}>Edit</button>
          )}
        </div>

        {!ba && !loadErr && (
          <div style={{ color: "rgba(0,0,0,0.5)", fontSize: 13 }}>No billing account found.</div>
        )}

        {ba && !editing && (
          <>
            <div style={styles.viewGrid}>
              <div>
                <div style={styles.label}>PV Account #</div>
                <div style={styles.value}>{ba.pvAccountNumber || <span style={styles.empty}>—</span>}</div>
              </div>
              <div>
                <div style={styles.label}>Account Status</div>
                <div style={styles.value}><StatusBadge status={ba.status} /></div>
              </div>
              <div>
                <div style={styles.label}>Billing Contact</div>
                <div style={styles.value}>{ba.billingName || <span style={styles.empty}>—</span>}</div>
              </div>
              <div>
                <div style={styles.label}>Billing Email</div>
                <div style={styles.value}>
                  {ba.billingEmail || <span style={styles.empty}>—</span>}
                  {isPlaceholderEmail(ba.billingEmail) && (
                    <span style={styles.placeholderNote}> · placeholder</span>
                  )}
                </div>
              </div>
              <div>
                <div style={styles.label}>Billing Phone</div>
                <div style={styles.value}>{ba.billingPhone ? formatPhone(ba.billingPhone) : <span style={styles.empty}>—</span>}</div>
              </div>
              <div>
                <div style={styles.label}>Payment Terms</div>
                <div style={styles.value}>
                  {ba.policyOverridesJson?.netTermsDays != null
                    ? `Net ${ba.policyOverridesJson.netTermsDays}`
                    : <span style={styles.empty}>Global default</span>}
                </div>
              </div>
              {(ba.billingAddress1 || ba.billingCity) && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={styles.label}>Billing Address</div>
                  <div style={styles.value}>
                    {[ba.billingAddress1, ba.billingCity, ba.billingState, ba.billingPostal].filter(Boolean).join(", ")}
                  </div>
                </div>
              )}
            </div>
            {saveOk && <div style={{ ...styles.okBox, marginTop: 12 }}>{saveOk}</div>}
          </>
        )}

        {ba && editing && (
          <form onSubmit={onSave}>
            <div style={styles.editGrid}>
              {isAdmin && (
                <div>
                  <label style={styles.label}>PV Account # <span style={styles.adminBadge}>admin only</span></label>
                  <input
                    value={fields.pvAccountNumber}
                    onChange={(e) => setField("pvAccountNumber", e.target.value)}
                    disabled={busy}
                    placeholder="e.g. PV-2026-00001"
                    style={styles.input}
                  />
                </div>
              )}
              <div>
                <label style={styles.label}>Billing Contact Name</label>
                <input
                  value={fields.billingName}
                  onChange={(e) => setField("billingName", e.target.value)}
                  disabled={busy}
                  placeholder="e.g. Jane Smith"
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Billing Email</label>
                <input
                  type="email"
                  value={fields.billingEmail}
                  onChange={(e) => setField("billingEmail", e.target.value)}
                  disabled={busy}
                  placeholder="billing@merchant.com"
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Billing Phone</label>
                <input
                  type="tel"
                  value={fields.billingPhone}
                  onChange={(e) => setField("billingPhone", formatPhone(e.target.value))}
                  disabled={busy}
                  placeholder="(925) 555-0100"
                  maxLength={14}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Payment Terms</label>
                <select
                  value={fields.netTermsDays}
                  onChange={(e) => setField("netTermsDays", e.target.value)}
                  disabled={busy}
                  style={styles.input}
                >
                  {NET_TERMS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={styles.sectionDivider}>Billing Address</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Street Address</label>
                <input
                  value={fields.billingAddress1}
                  onChange={(e) => setField("billingAddress1", e.target.value)}
                  disabled={busy}
                  placeholder="123 Main St"
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>City</label>
                <input
                  value={fields.billingCity}
                  onChange={(e) => setField("billingCity", e.target.value)}
                  disabled={busy}
                  placeholder="Danville"
                  style={styles.input}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={styles.label}>State</label>
                  <select
                    value={fields.billingState}
                    onChange={(e) => setField("billingState", e.target.value)}
                    disabled={busy}
                    style={styles.input}
                  >
                    <option value="">Select…</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Zip Code</label>
                  <input
                    value={fields.billingPostal}
                    onChange={(e) => setField("billingPostal", e.target.value)}
                    disabled={busy}
                    placeholder="94526"
                    maxLength={10}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            {saveErr && <div style={{ ...styles.errBox, marginTop: 12 }}>{saveErr}</div>}

            <div style={styles.formActions}>
              <button type="button" onClick={onCancel} disabled={busy} style={styles.cancelBtn}>Cancel</button>
              <button type="submit" disabled={busy} style={styles.saveBtn}>
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={styles.tip}>
        Use the{" "}
        <Link to={`/admin/merchants/${merchantId}/billing-policy`} style={{ fontWeight: 700 }}>
          Billing Policy
        </Link>{" "}
        tab to set merchant-specific grace days, late fee amounts, or default net terms.
      </div>

      <SupportInfo context={{ page: "AdminMerchantBilling", merchantId }} />
    </PageContainer>
  );
}

const styles = {
  refreshBtn: {
    padding: "10px 12px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 800,
  },
  card: {
    marginTop: 16, border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14, padding: 16, background: "white",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  cardTitle: { fontWeight: 800, fontSize: 16 },
  editBtn: {
    padding: "6px 14px", borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 700, fontSize: 13,
  },
  viewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px 16px",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  label: {
    display: "block", fontSize: 11,
    color: "rgba(0,0,0,0.5)", textTransform: "uppercase",
    letterSpacing: "0.04em", marginBottom: 4,
  },
  value: { fontSize: 14, fontWeight: 500 },
  empty: { color: "rgba(0,0,0,0.35)", fontStyle: "italic" },
  adminBadge: {
    fontSize: 10, fontWeight: 700,
    color: "rgba(0,0,120,0.6)", marginLeft: 4,
    textTransform: "none", letterSpacing: 0,
  },
  input: {
    width: "100%", minWidth: 0, padding: "10px 12px",
    borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)",
    boxSizing: "border-box", fontSize: 14,
  },
  sectionDivider: {
    fontSize: 12, fontWeight: 700,
    color: "rgba(0,0,0,0.5)", borderBottom: "1px solid rgba(0,0,0,0.08)",
    paddingBottom: 4, marginTop: 4,
  },
  formActions: {
    display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "10px 16px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 700,
  },
  saveBtn: {
    padding: "10px 20px", borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)", background: "white",
    cursor: "pointer", fontWeight: 900,
  },
  errBox: {
    background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)",
    padding: 10, borderRadius: 12, whiteSpace: "pre-wrap",
  },
  okBox: {
    background: "rgba(0,128,0,0.06)", border: "1px solid rgba(0,128,0,0.18)",
    padding: 10, borderRadius: 12,
  },
  tip: {
    marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)",
  },
  placeholderNote: {
    fontSize: 11, fontWeight: 600,
    color: "rgba(180,100,0,0.8)", fontStyle: "italic",
  },
};
