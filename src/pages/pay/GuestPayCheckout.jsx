// admin/src/pages/pay/GuestPayCheckout.jsx
import React from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { backendBaseUrl } from "../../payments/stripeClient";
import { color, btn } from "../../theme";

/**
 * Thread P — Canonical Pay Flow
 * - Support both:
 *   - ShortPay: /p/:code/intent
 *   - Legacy:  /pay/:token/intent
 * - If backend returns 409 intent_exists, show a clear panel and DO NOT auto-retry or loop.
 * - Keep receipt/confirmation screen on success.
 * - Cards-only Stripe Elements (wallets disabled) to avoid wallet/link/hCaptcha noise in local dev.
 *
 * Feedback fix:
 * - Replace "Pay another" with:
 *    - Done (safe exit)
 *    - Log in
 * - Do NOT attempt to close the tab (browser restrictions).
 * - Avoid looping back into the same invoice URL (/p/:code or /pay/:token).
 * - Include hooks for QA/Docs/Support/Chatbot.
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

function money(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function normalize(v) {
  const s = String(v || "").trim();
  return s ? s : "";
}

function parseApiError(resStatus, json) {
  const code = json?.error?.code || "";
  const message = json?.error?.message || "";

  // Accept both variants used across backend paths
  const isIntentExists =
    resStatus === 409 &&
    (String(code).toLowerCase() === "intent_exists" || String(code).toUpperCase() === "INTENT_EXISTS");

  if (isIntentExists) {
    return {
      kind: "intent_exists",
      code,
      message: message || "A payment session already exists for this invoice. Please refresh the page.",
    };
  }

  return {
    kind: "generic",
    code,
    message: message || "Failed to create payment intent",
  };
}

export default function GuestPayCheckout({ code, token, amountDueCents }) {
  const stripe = useStripe();
  const elements = useElements();

  const shortCode = normalize(code);
  const longToken = normalize(token);

  const mode = shortCode ? "shortpay" : longToken ? "legacy" : "missing";
  const id = shortCode || longToken;

  const [payerEmail, setPayerEmail] = React.useState("qa@test.com");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // intent_exists UX: show panel and disable submit; user must refresh.
  const [intentExistsMsg, setIntentExistsMsg] = React.useState("");

  // Receipt / confirmation view (restored)
  const [receipt, setReceipt] = React.useState(null); // { paidAtIso, amountCents, payerEmail, paymentIntentId? }

  function goDone() {
    pvUiHook("billing.shortpay.receipt.done_clicked.ui", {
      tc: "TC-GP-UI-19D",
      sev: "info",
      stable: "guestPay:receipt",
      mode,
    });

    // Replace so Back doesn't lead the user back into the paid invoice pay URL.
    window.location.replace("/");
  }

  function goLogin() {
    pvUiHook("billing.shortpay.receipt.login_clicked.ui", {
      tc: "TC-GP-UI-19L",
      sev: "info",
      stable: "guestPay:receipt",
      mode,
    });

    window.location.replace("/login");
  }

  async function createIntent() {
    if (!id) {
      pvUiHook("billing.shortpay.intent_failed.ui", {
        tc: "TC-GP-UI-10",
        sev: "error",
        stable: "guestPay:intent",
        mode,
        httpStatus: 0,
        code: "MISSING_ID",
        kind: "generic",
        message: "Missing payment code/token",
      });
      throw new Error("Missing payment code/token");
    }

    const url =
      mode === "shortpay"
        ? `${backendBaseUrl}/p/${encodeURIComponent(shortCode)}/intent`
        : `${backendBaseUrl}/pay/${encodeURIComponent(longToken)}/intent`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: Number(amountDueCents),
        payerEmail: payerEmail ? payerEmail.trim() : null,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const parsed = parseApiError(res.status, json);

      pvUiHook("billing.shortpay.intent_failed.ui", {
        tc: "TC-GP-UI-10",
        sev: parsed.kind === "intent_exists" ? "warn" : "error",
        stable: "guestPay:intent",
        mode,
        httpStatus: res.status,
        code: parsed.code || null,
        kind: parsed.kind,
        message: parsed.message,
      });

      if (parsed.kind === "intent_exists") {
        // Show panel; do NOT retry automatically.
        setIntentExistsMsg(parsed.message);
      }

      throw new Error(parsed.message);
    }

    pvUiHook("billing.shortpay.intent_created.ui", {
      tc: "TC-GP-UI-11",
      sev: "info",
      stable: "guestPay:intent",
      mode,
      paymentId: json?.paymentId || null,
      provider: json?.provider || null,
    });

    return json; // { paymentId, provider, clientSecret }
  }

  async function onSubmit(e) {
    e.preventDefault();

    setError("");

    pvUiHook("billing.shortpay.pay_clicked.ui", {
      tc: "TC-GP-UI-12C",
      sev: "info",
      stable: "guestPay:pay",
      mode,
      amountCents: Number(amountDueCents || 0),
      intentExists: Boolean(intentExistsMsg),
    });

    // If we already know intent exists, don’t let user keep hammering.
    if (intentExistsMsg) {
      pvUiHook("billing.shortpay.pay_blocked.ui", {
        tc: "TC-GP-UI-22",
        sev: "info",
        stable: "guestPay:intent_exists",
        mode,
        blockedReason: "intent_exists",
      });
      return;
    }

    if (!stripe || !elements) {
      setError("Stripe is still loading. Try again in a moment.");
      pvUiHook("billing.shortpay.pay_blocked.ui", {
        tc: "TC-GP-UI-22A",
        sev: "warn",
        stable: "guestPay:pay",
        mode,
        blockedReason: "stripe_not_ready",
      });
      return;
    }

    setBusy(true);
    try {
      const { clientSecret } = await createIntent();

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card input not ready");

      pvUiHook("billing.shortpay.confirm_started.ui", {
        tc: "TC-GP-UI-12",
        sev: "info",
        stable: "guestPay:confirm",
        mode,
      });

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            email: payerEmail || undefined,
          },
        },
      });

      if (result.error) throw new Error(result.error.message || "Payment failed");
      if (result.paymentIntent?.status !== "succeeded") {
        throw new Error(`Payment status: ${result.paymentIntent?.status || "unknown"}`);
      }

      pvUiHook("billing.shortpay.payment_succeeded.ui", {
        tc: "TC-GP-UI-13",
        sev: "info",
        stable: "guestPay:succeeded",
        mode,
        amountCents: Number(amountDueCents || 0),
        paymentIntentId: result.paymentIntent?.id || null,
      });

      // Receipt/confirmation screen
      setReceipt({
        paidAtIso: new Date().toISOString(),
        amountCents: Number(amountDueCents || 0),
        payerEmail: payerEmail ? payerEmail.trim() : null,
        paymentIntentId: result.paymentIntent?.id || null,
      });
    } catch (e2) {
      const msg = e2?.message || String(e2);

      if (String(msg).toLowerCase().includes("payment session already exists")) {
        // Keep the panel message (already set), suppress generic error spam.
        setError("");
        setIntentExistsMsg((prev) => prev || msg);

        pvUiHook("billing.shortpay.intent_exists_shown.ui", {
          tc: "TC-GP-UI-23",
          sev: "info",
          stable: "guestPay:intent_exists",
          mode,
        });
      } else {
        setError(msg);

        pvUiHook("billing.shortpay.payment_failed.ui", {
          tc: "TC-GP-UI-13F",
          sev: "error",
          stable: "guestPay:pay",
          mode,
          error: msg,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  // Receipt view
  if (receipt) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(0,160,0,0.25)",
            background: "rgba(0,160,0,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Payment received</div>
          <div style={{ color: color.textMuted, marginBottom: 10 }}>
            Your payment of <b>{money(receipt.amountCents)}</b> was successful.
          </div>

          <div style={{ fontSize: 12, color: color.textMuted, display: "grid", gap: 6 }}>
            <div>
              Paid at: <b>{new Date(receipt.paidAtIso).toLocaleString()}</b>
            </div>
            <div>
              Receipt email: <b>{receipt.payerEmail || "—"}</b>
            </div>
            {receipt.paymentIntentId ? (
              <div>
                Reference: <span style={{ fontFamily: "monospace" }}>{receipt.paymentIntentId}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${color.border}`,
            background: color.borderSubtle,
            color: color.textMuted,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          You can safely close this tab. If you have another invoice to pay, open its payment link.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              pvUiHook("billing.shortpay.receipt.refresh_clicked.ui", {
                tc: "TC-GP-UI-18",
                sev: "info",
                stable: "guestPay:receipt",
                mode,
              });
              window.location.reload();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${color.border}`,
              fontWeight: 800,
              cursor: "pointer",
              background: color.cardBg,
            }}
          >
            Refresh invoice status
          </button>

          <button
            type="button"
            onClick={goDone}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${color.border}`,
              fontWeight: 800,
              cursor: "pointer",
              background: color.cardBg,
            }}
          >
            Done
          </button>

          <button
            type="button"
            onClick={goLogin}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${color.border}`,
              fontWeight: 800,
              cursor: "pointer",
              background: color.cardBg,
            }}
            title="Log in to your PerkValet account"
          >
            Log in
          </button>
        </div>

        <div style={{ fontSize: 12, color: color.textMuted }}>
          If the invoice page still shows an amount due, wait a moment and refresh (webhook processing can take a few
          seconds).
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      {intentExistsMsg ? (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(200,120,0,0.25)",
            background: "rgba(200,120,0,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Payment session already created</div>
          <div style={{ color: color.textMuted, marginBottom: 10 }}>{intentExistsMsg}</div>

          <button
            type="button"
            onClick={() => {
              pvUiHook("billing.shortpay.intent_exists_refresh_clicked.ui", {
                tc: "TC-GP-UI-14",
                sev: "info",
                stable: "guestPay:intent_exists",
                mode,
              });
              window.location.reload();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${color.border}`,
              fontWeight: 800,
              cursor: "pointer",
              background: color.cardBg,
            }}
          >
            Refresh page
          </button>

          <div style={{ marginTop: 8, fontSize: 12, color: color.textMuted }}>
            This can happen if you double-clicked Pay or opened the link in multiple tabs.
          </div>
        </div>
      ) : null}

      <label style={{ display: "grid", gap: 6 }}>
        Email (receipt)
        <input
          value={payerEmail}
          onChange={(e) => setPayerEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ padding: 10, borderRadius: 8, border: `1px solid ${color.borderInput}`, background: color.inputBg, color: color.text, fontSize: 14, width: "100%", boxSizing: "border-box" }}
          disabled={busy || Boolean(intentExistsMsg)}
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        Card
        <div style={{ padding: 12, borderRadius: 8, border: `1px solid ${color.borderInput}`, background: color.inputBg }}>
          <CardElement
            options={{
              hidePostalCode: false,
              wallets: {
                applePay: "never",
                googlePay: "never",
              },
            }}
          />
        </div>
      </label>

      {error ? <div style={{ color: color.danger }}>{error}</div> : null}

      <button
        type="submit"
        disabled={busy || !stripe || Boolean(intentExistsMsg)}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${color.border}`,
          fontWeight: 700,
          cursor: busy || !stripe || intentExistsMsg ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Processing..." : `Pay ${money(amountDueCents)}`}
      </button>
    </form>
  );
}
