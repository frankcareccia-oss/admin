// admin/src/pages/VerifyDevice.jsx
import React from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { getAccessToken, me, startDeviceVerification, pvClearSession } from "../api/client";
import { color, btn } from "../theme";

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
  } catch {}
}

const RETURN_TO_STORAGE = "perkvalet_return_to";

function readReturnTo() {
  try {
    const rt = String(sessionStorage.getItem(RETURN_TO_STORAGE) || "").trim();
    if (rt) sessionStorage.removeItem(RETURN_TO_STORAGE);
    return rt.startsWith("/") ? rt : "";
  } catch {
    return "";
  }
}

function peekReturnTo() {
  try {
    const rt = String(sessionStorage.getItem(RETURN_TO_STORAGE) || "").trim();
    return rt.startsWith("/") ? rt : "";
  } catch {
    return "";
  }
}

export default function VerifyDevice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();

  const authed = Boolean(getAccessToken());

  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [profileEmail, setProfileEmail] = React.useState("");
  const [cooldownUntil, setCooldownUntil] = React.useState(0);

  const returnToFromQuery = String(sp.get("returnTo") || "").trim();
  const returnToFromState = String(location.state?.returnTo || "").trim();
  const returnToFromStorage = peekReturnTo();

  const returnTo =
    (returnToFromQuery.startsWith("/") ? returnToFromQuery : "") ||
    (returnToFromState.startsWith("/") ? returnToFromState : "") ||
    returnToFromStorage ||
    "/";


  React.useEffect(() => {
    pvUiHook("auth.device_verify.page_loaded.ui", {
      tc: "TC-DEVICE-UI-00",
      sev: "info",
      stable: "auth:device",
      authed,
      returnTo,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load profile email (best effort, non-blocking)
  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!authed) return;
      try {
        const p = await me();
        const email = String(p?.user?.email || "").trim();
        if (!cancelled) setProfileEmail(email);
      } catch {
        // ignore
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authed]);

  function canResend() {
    return !busy && Date.now() >= cooldownUntil;
  }

  async function onSend() {
    setErr("");
    setBusy(true);

    pvUiHook("auth.device_verify.send.click.ui", {
      tc: "TC-DEVICE-UI-10",
      sev: "info",
      stable: "auth:device:send",
      authed,
      returnTo,
    });

    try {
      if (!authed) {
        throw new Error("Please sign in to continue device verification.");
      }

      await startDeviceVerification({ returnTo });

      setSent(true);

      // 30s resend cooldown to avoid spam; backend also enforces idempotency on its side.
      const until = Date.now() + 30_000;
      setCooldownUntil(until);

      pvUiHook("auth.device_verify.send.success.ui", {
        tc: "TC-DEVICE-UI-11",
        sev: "info",
        stable: "auth:device:send",
        returnTo,
      });
    } catch (e) {
      const msg = e?.message || "Unable to send verification email.";
      setErr(msg);

      pvUiHook("auth.device_verify.send.failure.ui", {
        tc: "TC-DEVICE-UI-12",
        sev: "error",
        stable: "auth:device:send",
        error: e?.message || String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  function onBackToLogin() {
    // Preserve returnTo for a smooth loop.
    try {
      sessionStorage.setItem(RETURN_TO_STORAGE, returnTo);
    } catch {}

    pvUiHook("auth.device_verify.back_to_login.click.ui", {
      tc: "TC-DEVICE-UI-20",
      sev: "info",
      stable: "auth:device",
      returnTo,
    });

    navigate("/login", { replace: true, state: { notice: "Please sign in to verify this device.", from: returnTo } });
  }

  async function onStartOver() {
    setErr("");
    pvUiHook("auth.device_verify.start_over.click.ui", {
      tc: "TC-DEVICE-UI-30",
      sev: "warn",
      stable: "auth:device",
    });

    try {
      pvClearSession({ reason: "device_verify_start_over", broadcast: true });
    } catch {}

    onBackToLogin();
  }

  const emailLabel = profileEmail || String(location.state?.email || "").trim();

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6, color: color.text }}>Verify this device</h2>
        <div style={{ color: color.textMuted, marginBottom: 14 }}>
          For accounts that handle money, PerkValet requires a one-time verification for this browser.
        </div>

        {!authed ? (
          <div
            style={{
              background: "rgba(255,160,0,0.10)",
              border: "1px solid rgba(255,160,0,0.25)",
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6, color: color.text }}>Sign-in required</div>
            <div style={{ color: color.textMuted, marginBottom: 10, lineHeight: 1.35 }}>
              Please sign in again so we can send your verification link.
            </div>
            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                ...btn.secondary,
                padding: "10px 12px",
                borderRadius: 12,
              }}
            >
              Back to Login
            </button>
          </div>
        ) : null}

        <div
          style={{
            border: `1px solid ${color.border}`,
            borderRadius: 14,
            padding: 14,
            background: color.cardBg,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: color.textMuted }}>We'll send the verification link to</div>
            <div style={{ fontWeight: 900, color: color.text }}>
              {emailLabel ? emailLabel : <span style={{ color: color.textFaint }}>your account email</span>}
            </div>
          </div>

          <div style={{ color: color.textMuted, lineHeight: 1.4 }}>
            Click the link in the email to verify this device. When you return, you'll be able to continue to:
            <div style={{ marginTop: 8, fontWeight: 800, color: color.text }}>
              <code>{returnTo}</code>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={onSend}
              disabled={!canResend() || !authed}
              style={{
                ...(!canResend() || !authed ? btn.primaryDisabled : btn.primary),
                padding: "10px 12px",
                borderRadius: 12,
              }}
            >
              {busy ? "Sending..." : sent ? "Resend verification email" : "Send verification email"}
            </button>

            <Link
              to="/login"
              onClick={(e) => {
                e.preventDefault();
                onBackToLogin();
              }}
              style={{
                ...btn.secondary,
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 12,
                textDecoration: "none",
              }}
            >
              Back to Login
            </Link>

            <button
              type="button"
              onClick={onStartOver}
              style={{
                ...btn.danger,
                padding: "10px 12px",
                borderRadius: 12,
              }}
              title="Clears session and starts over"
            >
              Start over
            </button>
          </div>

          {sent ? (
            <div
              style={{
                background: color.primarySubtle,
                border: `1px solid ${color.primaryBorder}`,
                padding: 10,
                borderRadius: 12,
                whiteSpace: "pre-wrap",
                color: color.text,
              }}
            >
              Verification email sent. Check your inbox and click the link.
            </div>
          ) : null}

          {err ? (
            <div
              style={{
                background: color.dangerSubtle,
                border: `1px solid ${color.dangerBorder}`,
                color: color.danger,
                padding: 10,
                borderRadius: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {err}
            </div>
          ) : null}

          <div style={{ fontSize: 12, color: color.textFaint }}>
            Tip: If you don't see the message within a minute, check spam/junk. You can resend after a short delay.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
