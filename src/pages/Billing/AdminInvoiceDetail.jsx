// admin/src/pages/Billing/AdminInvoiceDetail.jsx
import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  adminGetInvoice,
  adminIssueInvoice,
  adminLateFeePreview,
  adminVoidInvoice,
} from "../../api/client";

import PageContainer from "../../components/layout/PageContainer";
import PageHeader from "../../components/layout/PageHeader";

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

function money(cents) {
  const n = Number(cents || 0) / 100;
  return n.toFixed(2);
}
function moneyUsd(cents) {
  return `$${money(cents)}`;
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

function Badge({ text }) {
  const bg =
    text === "paid"
      ? "rgba(0,160,0,0.12)"
      : text === "past_due"
      ? "rgba(200,120,0,0.12)"
      : text === "issued"
      ? "rgba(0,90,200,0.12)"
      : text === "void"
      ? "rgba(120,120,120,0.12)"
      : "rgba(0,0,0,0.06)";

  const border =
    text === "paid"
      ? "rgba(0,160,0,0.25)"
      : text === "past_due"
      ? "rgba(200,120,0,0.25)"
      : text === "issued"
      ? "rgba(0,90,200,0.25)"
      : text === "void"
      ? "rgba(120,120,120,0.25)"
      : "rgba(0,0,0,0.12)";

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        fontSize: 12,
        fontWeight: 800,
        textTransform: "lowercase",
      }}
    >
      {text}
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

const inputSm = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  width: 160,
};

// same keys as src/api/client.js
const ADMIN_KEY_STORAGE = "perkvalet_admin_api_key";
const JWT_STORAGE = "perkvalet_access_token";
const API_BASE = "http://localhost:3001";

function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || "";
}
function getAccessToken() {
  return localStorage.getItem(JWT_STORAGE) || "";
}

/**
 * Thread P: build /p/:code without exposing token hashes.
 * We generate a short code from GuestPayToken.id (base62 + HMAC signature).
 *
 * NOTE: In a perfect world, backend would return the short code directly.
 * For now (no schema changes), we compute it client-side if a secret is available.
 */
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function base62Encode(num) {
  if (!Number.isFinite(num) || num < 0) throw new Error("bad_num");
  if (num === 0) return "0";
  let n = Math.floor(num);
  let out = "";
  while (n > 0) {
    out = BASE62[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out;
}

async function hmacSig6(idPart, secret) {
  // Browser HMAC via WebCrypto
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await window.crypto.subtle.sign("HMAC", key, enc.encode(idPart));
  const bytes = new Uint8Array(sigBuf);
  // take first 4 bytes as uint32
  const n = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  // convert to unsigned
  const u = n >>> 0;
  const sig = base62Encode(u).slice(-6).padStart(6, "0");
  return sig;
}

async function buildShortPayCodeFromTokenId(tokenId) {
  const idNum = Number(tokenId);
  if (!Number.isInteger(idNum) || idNum <= 0) return "";

  const idPart = base62Encode(idNum);

  // Prefer a dedicated env var; fallback to Vite env if you set it.
  // You can add VITE_SHORTPAY_SECRET in admin/.env.local for dev.
  const secret =
    (import.meta?.env?.VITE_SHORTPAY_SECRET || "").trim() ||
    (import.meta?.env?.VITE_JWT_SECRET || "").trim();

  if (!secret) return ""; // fallback to legacy behavior (but still not display token)

  const sig = await hmacSig6(idPart, secret);
  return `${idPart}${sig}`;
}

const NET_TERMS_OPTIONS = [15, 30, 45];

export default function AdminInvoiceDetail() {
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = (searchParams.get("return") || "/admin/invoices").trim();

  // On "Back", return to the originating list URL and ask it to focus this invoice row.
  const backUrl =
    returnTo +
    (returnTo.includes("?") ? "&" : "?") +
    `focus=${encodeURIComponent(String(invoiceId))}`;


  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [detail, setDetail] = React.useState(null);

  // Action panel state
  const [actionBusy, setActionBusy] = React.useState(false);
  const [actionMsg, setActionMsg] = React.useState("");
  const [netTermsDays, setNetTermsDays] = React.useState(""); // dropdown, default blank
  const [lateFeePreview, setLateFeePreview] = React.useState(null);

  // Pay Link state
  const [payBusy, setPayBusy] = React.useState(false);
  const [payErr, setPayErr] = React.useState("");
  const [payLink, setPayLink] = React.useState(null); // { payUrl, expiresAt } (do not expose token/tokenHash)

  async function load() {
    setError("");
    setActionMsg("");
    setLateFeePreview(null);
    setPayErr("");
    setLoading(true);

    pvUiHook("billing.admin_invoice.page.load_started.ui", {
      tc: "TC-AID-UI-00",
      sev: "info",
      stable: `invoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
    });

    try {
      const d = await adminGetInvoice(invoiceId);
      setDetail(d);

      const inv = d?.invoice;
      const net = inv?.netTermsDays != null ? Number(inv.netTermsDays) : null;
      setNetTermsDays(NET_TERMS_OPTIONS.includes(net) ? String(net) : "");

      pvUiHook("billing.admin_invoice.page.load_succeeded.ui", {
        tc: "TC-AID-UI-01",
        sev: "info",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        status: inv?.status || null,
      });
    } catch (e) {
      pvUiHook("billing.admin_invoice.page.load_failed.ui", {
        tc: "TC-AID-UI-02",
        sev: "error",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        error: e?.message || String(e),
      });
      setError(e?.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const inv = detail?.invoice;
  const status = inv?.status || "";

  const canIssue = status === "draft";
  const canVoid = status !== "paid" && status !== "void";

  const amountDueCents =
    inv && typeof inv.totalCents === "number"
      ? Math.max(0, (inv.totalCents || 0) - (inv.amountPaidCents || 0))
      : 0;

  const canMintPay = (status === "issued" || status === "past_due") && amountDueCents > 0;
  const isPaid = status === "paid" || amountDueCents <= 0;

  async function onIssue() {
    setActionMsg("");
    setError("");
    setLateFeePreview(null);

    const net = Number(String(netTermsDays || "").trim());
    if (!NET_TERMS_OPTIONS.includes(net)) {
      setError(`Net terms is required (${NET_TERMS_OPTIONS.join("/")}).`);
      pvUiHook("billing.admin_invoice.issue.blocked.ui", {
        tc: "TC-AID-UI-03B",
        sev: "warn",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        blockedReason: "net_terms_missing_or_invalid",
        netTermsDays: netTermsDays || null,
      });
      return;
    }

    setActionBusy(true);

    pvUiHook("billing.admin_invoice.issue.click.ui", {
      tc: "TC-AID-UI-03",
      sev: "info",
      stable: `invoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
      netTermsDays: net,
    });

    try {
      const res = await adminIssueInvoice(invoiceId, { netTermsDays: net });
      setActionMsg(`Issued invoice. Due: ${fmtDate(res?.invoice?.dueAt)}`);

      pvUiHook("billing.admin_invoice.issue.success.ui", {
        tc: "TC-AID-UI-04",
        sev: "info",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        dueAt: res?.invoice?.dueAt || null,
      });

      await load();
    } catch (e) {
      pvUiHook("billing.admin_invoice.issue.failure.ui", {
        tc: "TC-AID-UI-05",
        sev: "error",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        error: e?.message || String(e),
      });
      setError(e?.message || "Failed to issue invoice");
    } finally {
      setActionBusy(false);
    }
  }

  async function onPreviewLateFee() {
    setActionMsg("");
    setError("");
    setLateFeePreview(null);
    setActionBusy(true);

    pvUiHook("billing.admin_invoice.late_fee.preview.click.ui", {
      tc: "TC-AID-LFP-01",
      sev: "info",
      stable: `invoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
    });

    try {
      const p = await adminLateFeePreview(invoiceId);
      setLateFeePreview(p);

      pvUiHook("billing.admin_invoice.late_fee.preview.success.ui", {
        tc: "TC-AID-LFP-02",
        sev: "info",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        eligible: Boolean(p?.eligible),
        reason: p?.reason || null,
      });

      if (p?.eligible) setActionMsg("Late fee eligible (preview loaded).");
      else if (p?.reason) setActionMsg(`Late fee not eligible: ${p.reason}`);
      else setActionMsg("Late fee not eligible.");
    } catch (e) {
      pvUiHook("billing.admin_invoice.late_fee.preview.failure.ui", {
        tc: "TC-AID-LFP-03",
        sev: "error",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        error: e?.message || String(e),
      });
      setError(e?.message || "Failed to preview late fee");
    } finally {
      setActionBusy(false);
    }
  }

  async function onVoid() {
    setActionMsg("");
    setError("");
    setLateFeePreview(null);
    setActionBusy(true);

    pvUiHook("billing.admin_invoice.void.click.ui", {
      tc: "TC-AID-VOID-01",
      sev: "info",
      stable: `invoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
    });

    try {
      const r = await adminVoidInvoice(invoiceId);
      setActionMsg(`Voided. Status: ${r?.status || "void"}`);

      pvUiHook("billing.admin_invoice.void.success.ui", {
        tc: "TC-AID-VOID-02",
        sev: "info",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        status: r?.status || null,
      });

      await load();
    } catch (e) {
      pvUiHook("billing.admin_invoice.void.failure.ui", {
        tc: "TC-AID-VOID-03",
        sev: "error",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        error: e?.message || String(e),
      });
      setError(e?.message || "Failed to void invoice");
    } finally {
      setActionBusy(false);
    }
  }

  async function onGeneratePayLink() {
    setPayErr("");
    setActionMsg("");
    setPayBusy(true);

    pvUiHook("billing.admin_invoice.pay_link.generate.click.ui", {
      tc: "TC-AID-PL-01",
      sev: "info",
      stable: `invoice:${String(invoiceId)}`,
      invoiceId: Number(invoiceId),
      canMintPay,
      amountDueCents,
      status: status || null,
    });

    try {
      const tok = getAccessToken();
      const key = getAdminKey();
      if (!tok) throw new Error("Missing access token. Please re-login.");
      if (!key) throw new Error("Missing admin key. Set it in Settings → Admin Key.");

      // Backend endpoint mints GuestPayToken. We then compute /p/:code from tokenId.
      const url = `${API_BASE}/admin/invoices/${encodeURIComponent(String(invoiceId))}/guest-pay-token`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${tok}`,
          "x-api-key": key,
        },
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = payload?.error?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      // Prefer tokenId if present; fallback to token string (legacy).
      const tokenId = payload?.tokenId ?? payload?.id ?? payload?.guestPayTokenId ?? null;
      const expiresAt = payload?.expiresAt || null;

      let code = "";
      if (tokenId != null) {
        code = await buildShortPayCodeFromTokenId(tokenId);
      }

      // If we could compute a code: canonical /p/:code
      // Else: fallback to legacy /pay/:token (but never display token itself)
      const uiPayUrl = code
        ? `${window.location.origin}/p/${encodeURIComponent(code)}`
        : payload?.token
        ? `${window.location.origin}/pay/${encodeURIComponent(String(payload.token))}`
        : "";

      setPayLink({
        payUrl: uiPayUrl || null,
        expiresAt,
      });

      setActionMsg("Pay link generated.");

      pvUiHook("billing.admin_invoice.pay_link.generate.success.ui", {
        tc: "TC-AID-PL-02",
        sev: "info",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        payUrlPresent: Boolean(uiPayUrl),
        expiresAt: expiresAt || null,
        // NOTE: deliberately do not emit token/tokenId/code
      });
    } catch (e) {
      pvUiHook("billing.admin_invoice.pay_link.generate.failure.ui", {
        tc: "TC-AID-PL-03",
        sev: "error",
        stable: `invoice:${String(invoiceId)}`,
        invoiceId: Number(invoiceId),
        error: e?.message || String(e),
      });
      setPayErr(e?.message || "Failed to generate pay link");
    } finally {
      setPayBusy(false);
    }
  }

  async function copyToClipboard(text) {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setActionMsg("Copied to clipboard.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setActionMsg("Copied to clipboard.");
      } catch {
        setPayErr("Copy failed. Please copy manually.");
      }
    }
  }

  const preview = lateFeePreview;
  const previewPolicy = preview?.policy;
  const previewWould = preview?.wouldCreate;
  const previewLine = previewWould?.lineItem;

  const payUrl = payLink?.payUrl || "";

  const emailText = payUrl
    ? `Invoice #${invoiceId} is ready.\n\nPay now: ${payUrl}\n\nAmount due: ${moneyUsd(amountDueCents)}`
    : "";

  return (
    <PageContainer size="page">
      {/* Q0: Back link top-left above PageHeader */}
      <div style={{ marginBottom: 10 }}>
        <Link to={backUrl} style={{ textDecoration: "none" }}>Back to invoices</Link>
      </div>

      <PageHeader
        title={`Invoice #${invoiceId}`}
        subtitle={status ? <Badge text={status} /> : null}
        right={
          <div style={{ paddingRight: 80 }}>
            <button
                        onClick={() => {
                          pvUiHook("billing.admin_invoice.reload.click.ui", {
                            tc: "TC-AID-UI-40",
                            sev: "info",
                            stable: `invoice:${String(invoiceId)}`,
                            invoiceId: Number(invoiceId),
                          });
                          load();
                        }}
                        disabled={actionBusy || loading || payBusy}
                        style={buttonBase}
                      >
                        Reload
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

      {actionMsg ? (
        <div
          style={{
            ...card,
            background: "rgba(0,120,255,0.08)",
            border: "1px solid rgba(0,120,255,0.18)",
            marginBottom: 12,
          }}
        >
          {actionMsg}
        </div>
      ) : null}

      {!loading && !error && inv ? (
        <>
          {/* Actions */}
          <div style={{ ...card, marginBottom: 12, fontSize: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Actions</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "rgba(0,0,0,0.65)", fontWeight: 800 }}>Net terms</span>
                <select
                  value={netTermsDays}
                  onChange={(e) => setNetTermsDays(e.target.value)}
                  style={inputSm}
                  disabled={!canIssue || actionBusy}
                  title={!canIssue ? "Only editable while draft" : "Required to issue invoice"}
                >
                  <option value="">Select…</option>
                  {NET_TERMS_OPTIONS.map((d) => (
                    <option key={d} value={String(d)}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={onIssue}
                disabled={!canIssue || actionBusy}
                style={buttonBase}
                title={!canIssue ? "Only draft invoices can be issued" : ""}
              >
                {actionBusy ? "Working…" : "Issue invoice"}
              </button>

              <button onClick={onPreviewLateFee} disabled={actionBusy} style={buttonBase}>
                {actionBusy ? "Working…" : "Preview late fee"}
              </button>

              <button onClick={onVoid} disabled={!canVoid || actionBusy} style={buttonBase}>
                {actionBusy ? "Working…" : "Void invoice"}
              </button>

              <div style={{ flex: 1 }} />

              <div style={{ color: "rgba(0,0,0,0.60)" }}>Server enforces rules.</div>
            </div>

            {/* Pay Link (Thread Q) */}
            <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Pay Link</div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button
                  onClick={onGeneratePayLink}
                  disabled={!canMintPay || payBusy}
                  style={buttonBase}
                  title={
                    canMintPay
                      ? "Generate a pay link for this invoice"
                      : "Pay link can be generated only for issued/past_due invoices with amount due"
                  }
                >
                  {payBusy ? "Generating…" : "Generate Pay Link"}
                </button>

                <button
                  onClick={() => {
                    pvUiHook("billing.admin_invoice.pay_link.copy_link.ui", {
                      tc: "TC-AID-PL-04",
                      sev: "info",
                      stable: `invoice:${String(invoiceId)}`,
                      invoiceId: Number(invoiceId),
                      payUrlPresent: Boolean(payUrl),
                    });
                    if (!payUrl) {
                      pvUiHook("billing.admin_invoice.pay_link.blocked.ui", {
                        tc: "TC-AID-PL-04B",
                        sev: "warn",
                        stable: `invoice:${String(invoiceId)}`,
                        invoiceId: Number(invoiceId),
                        blockedReason: "no_pay_link",
                      });
                      return;
                    }
                    copyToClipboard(payUrl);
                  }}
                  style={buttonBase}
                  disabled={!payUrl}
                >
                  Copy Pay Link
                </button>

                <button
                  onClick={() => {
                    pvUiHook("billing.admin_invoice.pay_link.copy_email_text.ui", {
                      tc: "TC-AID-PL-05",
                      sev: "info",
                      stable: `invoice:${String(invoiceId)}`,
                      invoiceId: Number(invoiceId),
                      payUrlPresent: Boolean(payUrl),
                    });
                    if (!emailText) {
                      pvUiHook("billing.admin_invoice.pay_link.blocked.ui", {
                        tc: "TC-AID-PL-05B",
                        sev: "warn",
                        stable: `invoice:${String(invoiceId)}`,
                        invoiceId: Number(invoiceId),
                        blockedReason: "no_pay_link",
                      });
                      return;
                    }
                    copyToClipboard(emailText);
                  }}
                  style={buttonBase}
                  disabled={!emailText}
                  title="Copies a ready-to-send email snippet"
                >
                  Copy Email Text
                </button>

                {isPaid ? (
                  <span style={{ fontWeight: 900, color: "rgba(0,0,0,0.35)" }} title="Invoice is already paid">
                    Paid
                  </span>
                ) : (
                  <a
                    href={payUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!payUrl) {
                        e.preventDefault();
                        pvUiHook("billing.admin_invoice.pay_link.blocked.ui", {
                          tc: "TC-AID-PL-06B",
                          sev: "warn",
                          stable: `invoice:${String(invoiceId)}`,
                          invoiceId: Number(invoiceId),
                          blockedReason: "no_pay_link",
                        });
                        return;
                      }
                      pvUiHook("billing.admin_invoice.pay_link.pay_now.ui", {
                        tc: "TC-AID-PL-06",
                        sev: "info",
                        stable: `invoice:${String(invoiceId)}`,
                        invoiceId: Number(invoiceId),
                      });
                    }}
                    style={{
                      textDecoration: "none",
                      fontWeight: 900,
                      color: payUrl ? undefined : "rgba(0,0,0,0.35)",
                      pointerEvents: payUrl ? "auto" : "none",
                    }}
                    aria-disabled={!payUrl}
                    title={!payUrl ? "Generate a pay link first" : "Opens the public pay page in a new tab"}
                  >
                    Pay Now
                  </a>
                )}

                <div style={{ flex: 1 }} />

                <div style={{ color: "rgba(0,0,0,0.60)" }}>
                  Amount due: <b>{moneyUsd(amountDueCents)}</b>
                </div>
              </div>

              {payErr ? (
                <div
                  style={{
                    marginTop: 10,
                    background: "rgba(255,0,0,0.06)",
                    border: "1px solid rgba(255,0,0,0.15)",
                    padding: 10,
                    borderRadius: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {payErr}
                </div>
              ) : null}
            </div>

            {/* Late fee preview */}
            {lateFeePreview ? (
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Late fee preview</div>

                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8 }}>
                  <div style={styles.k}>Eligible</div>
                  <div>{String(!!preview?.eligible)}</div>

                  <div style={styles.k}>Reason</div>
                  <div>{preview?.reason || "—"}</div>

                  <div style={styles.k}>Late fee amount</div>
                  <div>{previewPolicy ? moneyUsd(previewPolicy.lateFeeCents) : "—"}</div>

                  <div style={styles.k}>Grace days</div>
                  <div>{previewPolicy?.graceDays ?? "—"}</div>

                  <div style={styles.k}>Late fee net days</div>
                  <div>{previewPolicy?.lateFeeNetDays ?? "—"}</div>

                  <div style={styles.k}>Would create due</div>
                  <div>{previewWould?.dueAt ? fmtDate(previewWould.dueAt) : "—"}</div>

                  <div style={styles.k}>Existing late-fee invoice</div>
                  <div>{preview?.existingLateFeeInvoiceId ? `#${preview.existingLateFeeInvoiceId}` : "—"}</div>

                  <div style={styles.k}>Line item</div>
                  <div>{previewLine ? `${previewLine.description} — ${moneyUsd(previewLine.amountCents)}` : "—"}</div>
                </div>

                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 900 }}>Show raw JSON</summary>
                  <pre
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      padding: 10,
                      background: "rgba(0,0,0,0.04)",
                      overflowX: "auto",
                      borderRadius: 12,
                    }}
                  >
                    {JSON.stringify(lateFeePreview, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}
          </div>

          {/* Summary */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8 }}>
              <div style={styles.k}>Status</div>
              <div>{inv.status}</div>

              <div style={styles.k}>Merchant</div>
              <div>{inv.merchantId}</div>

              <div style={styles.k}>BillingAccount</div>
              <div>{inv.billingAccountId}</div>

              <div style={styles.k}>Issued</div>
              <div>{inv.issuedAt ? new Date(inv.issuedAt).toLocaleString() : "—"}</div>

              <div style={styles.k}>Net terms</div>
              <div>{inv.netTermsDays != null ? `Net ${inv.netTermsDays}` : "—"}</div>

              <div style={styles.k}>Due</div>
              <div>{inv.dueAt ? new Date(inv.dueAt).toLocaleString() : "—"}</div>

              <div style={styles.k}>Total</div>
              <div>{moneyUsd(inv.totalCents)}</div>

              <div style={styles.k}>Paid</div>
              <div>{moneyUsd(inv.amountPaidCents)}</div>

              <div style={styles.k}>Amount due</div>
              <div>{moneyUsd(amountDueCents)}</div>
            </div>
          </div>

          {/* Line items */}
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
                      <td style={{ ...styles.td, textAlign: "right" }}>{moneyUsd(li.amountCents)}</td>
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
                    <b>{p.status}</b> — {moneyUsd(p.amountCents)} — {p.payerEmail || "—"} —{" "}
                    {p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}
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
