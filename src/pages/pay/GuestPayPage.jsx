// admin/src/pages/pay/GuestPayPage.jsx
import React from "react";
import { useParams } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import GuestPayCheckout from "./GuestPayCheckout";
import { stripePromise, backendBaseUrl as backendBaseUrlRaw } from "../../payments/stripeClient";

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

const DEFAULT_BACKEND = "http://localhost:3001";
const BACKEND_BASE = String(backendBaseUrlRaw || DEFAULT_BACKEND).replace(/\/$/, "");

function moneyUsd(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function normalizeParam(v) {
  const s = String(v || "").trim();
  return s ? s : "";
}

export default function GuestPayPage() {
  const { token: tokenParam, code: codeParam } = useParams();

  // Canonical identifier:
  // - prefer shortpay `code` (from /p/:code)
  // - fallback to legacy `token` (from /pay/:token)
  const code = normalizeParam(codeParam);
  const token = normalizeParam(tokenParam);
  const mode = code ? "shortpay" : token ? "legacy" : "missing";
  const id = code || token;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [summary, setSummary] = React.useState(null);

  async function loadSummary() {
    setLoading(true);
    setError("");
    setSummary(null);

    pvUiHook("billing.guest_pay_page_loaded.ui", {
      tc: "TC-GP-UI-00",
      sev: "info",
      stable: "guestPay:page",
      mode,
      codePresent: Boolean(code),
      tokenPresent: Boolean(token),
    });

    try {
      if (!id) throw new Error("Missing payment token");

      const url =
        mode === "shortpay"
          ? `${BACKEND_BASE}/p/${encodeURIComponent(code)}`
          : `${BACKEND_BASE}/pay/${encodeURIComponent(token)}`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error?.message || `Invalid or expired payment link (HTTP ${res.status})`;
        throw new Error(msg);
      }

      // Normalize summary so the UI can render both shapes.
      let normalized = null;

      if (mode === "shortpay") {
        const inv = json?.invoice || {};
        normalized = {
          mode: "shortpay",
          merchantName: inv.merchantName || "Merchant",
          invoiceId: inv.id ?? null,
          status: inv.status || null,
          totalCents: inv.totalCents ?? inv.amountCents ?? null,
          amountPaidCents: inv.amountPaidCents ?? 0,
          amountDueCents:
            Number.isInteger(inv.totalCents) || Number.isInteger(inv.amountPaidCents)
              ? Math.max(0, Number(inv.totalCents || 0) - Number(inv.amountPaidCents || 0))
              : null,
          paid: Boolean(inv.paid),
          raw: json,
        };
      } else {
        normalized = {
          mode: "legacy",
          merchantName: json?.merchantName || "Merchant",
          invoiceId: json?.invoiceId ?? null,
          status: json?.status || null,
          totalCents: json?.totalCents ?? null,
          amountPaidCents: json?.amountPaidCents ?? 0,
          amountDueCents: json?.amountDueCents ?? null,
          paid: String(json?.status || "").toLowerCase() === "paid" || Number(json?.amountDueCents || 0) <= 0,
          raw: json,
        };
      }

      setSummary(normalized);

      pvUiHook("billing.guest_pay_summary_loaded.ui", {
        tc: "TC-GP-UI-01",
        sev: "info",
        stable: `invoice:${String(normalized?.invoiceId || "unknown")}`,
        mode,
        invoiceId: normalized?.invoiceId || null,
        amountDueCents: normalized?.amountDueCents ?? null,
        status: normalized?.status || null,
      });
    } catch (e) {
      setError(e?.message || String(e));

      pvUiHook("billing.guest_pay_summary_failed.ui", {
        tc: "TC-GP-UI-02",
        sev: "error",
        stable: "guestPay:summary",
        mode,
        error: e?.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token]);

  function onBack() {
    pvUiHook("billing.guest_pay_back_clicked.ui", {
      tc: "TC-GP-UI-03",
      sev: "info",
      stable: "guestPay:nav",
      mode,
    });

    // Safe universal behavior:
    // - If opened from admin/merchant UI: history.back() returns there
    // - If opened from email/new tab: go to home
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      {/* Back/Close affordance (works for email, admin, merchant, new-tab) */}
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          marginBottom: 12,
          color: "rgba(0,0,0,0.6)",
          cursor: "pointer",
          fontWeight: 800,
        }}
      >
        ← Back
      </button>

      <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 14 }}>Pay Invoice</div>

      {loading ? <div style={{ color: "rgba(0,0,0,0.65)" }}>Loading…</div> : null}

      {error ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(255,0,0,0.18)",
            background: "rgba(255,0,0,0.06)",
            color: "rgba(160,0,0,0.95)",
            fontWeight: 800,
            marginTop: 10,
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && summary ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{summary.merchantName || "Merchant"}</div>
          <div style={{ marginTop: 2, color: "rgba(0,0,0,0.70)" }}>Invoice #{summary.invoiceId}</div>

          <div style={{ marginTop: 6, fontWeight: 900 }}>
            Amount due: {moneyUsd(summary.amountDueCents)}
          </div>

          <div style={{ marginTop: 6, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            Cards only (Stripe Elements). Card data never touches PerkValet servers.
          </div>

          <div style={{ marginTop: 16 }}>
            <Elements stripe={stripePromise}>
              <GuestPayCheckout
                token={token}
                code={code}
                amountDueCents={Number(summary.amountDueCents || 0)}
              />
            </Elements>
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: "rgba(0,0,0,0.45)" }}>
            Backend: {BACKEND_BASE} • Mode: {summary.mode}
          </div>
        </>
      ) : null}
    </div>
  );
}
