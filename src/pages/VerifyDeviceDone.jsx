// admin/src/pages/VerifyDeviceDone.jsx
import React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import PageContainer from "../components/layout/PageContainer";
import { authDeviceStatus, getAccessToken } from "../api/client";
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

function safePath(v) {
  const s = String(v || "").trim();
  return s.startsWith("/") ? s : "";
}

export default function VerifyDeviceDone() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();

  const authed = Boolean(getAccessToken());

  const returnTo =
    safePath(sp.get("returnTo")) ||
    safePath(location.state?.returnTo) ||
    safePath(location.state?.from) ||
    "/merchants";

  const [checking, setChecking] = React.useState(false);
  const [trusted, setTrusted] = React.useState(null); // null | boolean
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    pvUiHook("auth.device_verify.done.page_loaded.ui", {
      tc: "TC-DEVICE-UI-40",
      sev: "info",
      stable: "auth:device:done",
      authed,
      returnTo,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Best-effort: if we are still authed in this browser, confirm trust and auto-continue.
  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!authed) return;

      setChecking(true);
      setErr("");
      try {
        const r = await authDeviceStatus();
        const t = !!r?.trusted;
        if (!cancelled) {
          setTrusted(t);
          setChecking(false);
        }

        pvUiHook("auth.device_verify.done.status.loaded.ui", {
          tc: "TC-DEVICE-UI-41",
          sev: "info",
          stable: "auth:device:done",
          trusted: t,
        });

        if (t) {
          // Continue to the intended page.
          navigate(returnTo || "/merchants", { replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setTrusted(false);
          setChecking(false);
          setErr(e?.message || "Unable to confirm device status yet.");
        }

        pvUiHook("auth.device_verify.done.status.failed.ui", {
          tc: "TC-DEVICE-UI-42",
          sev: "warn",
          stable: "auth:device:done",
          error: e?.message || String(e),
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [authed, navigate, returnTo]);

  function onContinue() {
    pvUiHook("auth.device_verify.done.continue.click.ui", {
      tc: "TC-DEVICE-UI-43",
      sev: "info",
      stable: "auth:device:done",
      authed,
      returnTo,
    });

    if (authed) {
      navigate(returnTo || "/merchants", { replace: true });
      return;
    }

    // No token in this tab/session: send them to login, but preserve the returnTo.
    try {
      sessionStorage.setItem(RETURN_TO_STORAGE, returnTo);
    } catch {}

    navigate("/login", {
      replace: true,
      state: {
        notice: "Device verified. Please sign in to continue.",
        from: returnTo,
      },
    });
  }

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6, color: color.text }}>Device verified</h2>

        <div style={{ color: color.textMuted, marginBottom: 14 }}>
          This browser has been enabled for PerkValet admin actions.
        </div>

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
          <div style={{ color: color.textMuted, lineHeight: 1.4 }}>
            Next you'll continue to:
            <div style={{ marginTop: 8, fontWeight: 800, color: color.text }}>
              <code>{returnTo}</code>
            </div>
          </div>

          {checking ? (
            <div style={{ fontSize: 13, color: color.textMuted }}>
              Confirming device trust…
            </div>
          ) : null}

          {trusted === false ? (
            <div
              style={{
                background: "rgba(255,160,0,0.10)",
                border: "1px solid rgba(255,160,0,0.25)",
                padding: 10,
                borderRadius: 12,
                whiteSpace: "pre-wrap",
                color: color.text,
              }}
            >
              We couldn't confirm trust yet in this tab. If you just verified, this is usually a session/tab issue —
              sign in again and it should be recognized.
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={onContinue}
              style={{
                ...btn.primary,
                padding: "10px 12px",
                borderRadius: 12,
              }}
            >
              Continue
            </button>
          </div>

          <div style={{ fontSize: 12, color: color.textFaint }}>
            Tip: If you verified in another tab, it's normal to need to sign in again in this tab.
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
