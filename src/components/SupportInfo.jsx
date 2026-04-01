// admin/src/components/SupportInfo.jsx
import React from "react";
import {
  API_BASE,
  getAccessToken,
  getDeviceId,
  getSystemRole,
  me,
  pvSupportGetSnapshot,
  pvSupportGetRecentApiEvents,
} from "../api/client";
import { color, palette } from "../theme";

/**
 * SupportInfo (Global Support / Troubleshooting Footer)
 *
 * - Collapsed by default
 * - Small toggle bottom-left
 * - Expands as an anchored panel (no modal)
 * - Informational only (must not modify app state)
 * - Never show sensitive data (no full JWT, no full device id, no tokens)
 */
export default function SupportInfo({
  context = {},
  authed,
  systemRole,
  merchantRole,
  merchantRolePath,
  deviceTrusted,
  deviceTrustedLoading,
  pathname,
  apiBase,
}) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [emailErr, setEmailErr] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const route = `${window.location.pathname}${window.location.search || ""}`;
  const sysRole = String(systemRole || getSystemRole() || "").trim() || "—";
  const jwtPresent = typeof authed === "boolean" ? authed : Boolean(String(getAccessToken() || "").trim());
  const deviceId = String(getDeviceId() || "");
  const deviceShort = deviceId ? `${deviceId.slice(0, 8)}…` : "—";

  // best-effort /me email (non-fatal)
  React.useEffect(() => {
    let cancelled = false;

    async function loadEmail() {
      setEmailErr("");
      try {
        const res = await me();
        const em = String(res?.user?.email ?? res?.email ?? "").trim();
        if (!cancelled) setEmail(em || "—");
      } catch (e) {
        const m = e?.message || "Failed to load /me";
        if (!cancelled) {
          setEmail("—");
          setEmailErr(m);
        }
      }
    }

    loadEmail();
    return () => {
      cancelled = true;
    };
  }, []);

  // Environment
  const ua = String(navigator?.userAgent || "");
  const uaShort = ua.length > 72 ? `${ua.slice(0, 72)}…` : ua;
  const viewport = `${window.innerWidth} x ${window.innerHeight}`;
  const build = import.meta?.env?.MODE || "—";

  // Support snapshot (from api/client.js)
  const snap = (typeof pvSupportGetSnapshot === "function" ? pvSupportGetSnapshot() : {}) || {};
  const apiEvents =
    (typeof pvSupportGetRecentApiEvents === "function" ? pvSupportGetRecentApiEvents(10) : []) || [];

  const page = context?.page ? String(context.page) : "—";
  const merchantId = context?.merchantId != null && String(context.merchantId).trim() ? String(context.merchantId) : "—";
  const storeId = context?.storeId != null && String(context.storeId).trim() ? String(context.storeId) : "—";
  const invoiceId = context?.invoiceId != null && String(context.invoiceId).trim() ? String(context.invoiceId) : "—";

  const deviceVerificationRequired =
    context?.deviceVerificationRequired === true
      ? "Yes"
      : context?.deviceVerificationRequired === false
        ? "No"
        : "—";

  const lastError = context?.lastError ?? snap?.lastError ?? "—";
  const lastSuccessTs = context?.lastSuccessTs ?? snap?.lastSuccessTs ?? "—";

  function asText(v) {
    try {
      if (v == null) return "—";
      if (typeof v === "string") return v.trim() || "—";
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        if (typeof v.message === "string" && v.message) return v.message;
        return JSON.stringify(v);
      }
      return String(v);
    } catch {
      return "—";
    }
  }

  function asYesNoUnknown(v, { loading = false } = {}) {
    if (loading) return "Loading…";
    if (v === true) return "Yes";
    if (v === false) return "No";
    return "—";
  }

  function compactRoute(v) {
    try {
      const s = String(v || "").trim();
      if (!s) return "—";
      return s;
    } catch {
      return "—";
    }
  }

  const lastErrorText = asText(lastError);
  const lastSuccessText = asText(lastSuccessTs);
  const merchantRoleText = asText(merchantRole);
  const merchantRolePathText = asText(merchantRolePath);
  const deviceTrustedText = asYesNoUnknown(deviceTrusted, { loading: Boolean(deviceTrustedLoading) });
  const deviceTrustLoadingText = asYesNoUnknown(Boolean(deviceTrustedLoading));
  const pathnameText = compactRoute(pathname || window.location.pathname);
  const routeText = compactRoute(route);
  const apiBaseText = asText(apiBase || API_BASE);

  function valueStyle() {
    return {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      color: color.text,
      textAlign: "right",
      wordBreak: "break-word",
    };
  }

  function keyStyle() {
    return { color: color.textMuted, fontSize: 12 };
  }

  function sectionTitleStyle() {
    return { fontWeight: 900, color: color.text, margin: "12px 0 8px" };
  }

  function actionPillStyle() {
    return {
      border: `1px solid ${color.border}`,
      background: color.cardBg,
      borderRadius: 999,
      padding: "6px 10px",
      fontWeight: 800,
      cursor: "pointer",
    };
  }

  function row(k, v, { warn = false } = {}) {
    return (
      <div
        key={k}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          alignItems: "start",
          padding: "6px 0",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={keyStyle()}>{k}</div>
        <div style={{ ...valueStyle(), color: warn ? color.danger : color.text }}>{v}</div>
      </div>
    );
  }

  function buildCopyBundle() {
    const now = new Date().toISOString();

    return {
      ts: now,
      session: {
        systemRole: sysRole,
        merchantRole: merchantRoleText,
        merchantRolePath: merchantRolePathText,
        email: email || "—",
        route: routeText,
        pathname: pathnameText,
        page,
        merchantId,
        storeId,
        invoiceId,
      },
      auth: {
        jwtPresent,
        deviceIdShort: deviceShort,
        deviceTrusted: deviceTrustedText,
        deviceTrustedLoading: deviceTrustLoadingText,
        deviceVerificationRequired,
      },
      env: {
        API_BASE: apiBaseText,
        build,
        viewport,
        userAgent: uaShort,
      },
      api: {
        lastError: lastErrorText,
        lastSuccessTs: lastSuccessText,
        lastRequest: snap?.lastRequest || "—",
      },
      apiEvents,
    };
  }

  async function onCopy() {
    try {
      const payload = JSON.stringify(buildCopyBundle(), null, 2);
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be denied; do nothing
    }
  }

  function renderActionRow() {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          alignItems: "center",
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid rgba(0,0,0,0.08)",
          position: "sticky",
          bottom: 0,
          background: color.cardBg,
        }}
      >
        <button
          type="button"
          onClick={onCopy}
          style={actionPillStyle()}
          title="Copy diagnostics to clipboard"
        >
          {copied ? "Copied" : "Copy"}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          style={actionPillStyle()}
        >
          Close ▼
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", bottom: 10, left: 10, zIndex: 1000, fontSize: 12 }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: `1px solid ${color.border}`,
            background: color.cardBg,
            borderRadius: 999,
            padding: "6px 10px",
            fontWeight: 800,
            color: color.text,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
          }}
        >
          Support ▲
        </button>
      ) : (
        <div
          style={{
            width: 560,
            maxWidth: "calc(100vw - 20px)",
            maxHeight: "70vh",
            overflow: "auto",
            background: color.cardBg,
            border: `1px solid ${color.border}`,
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 900, color: color.text }}>Support / Troubleshooting</div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={onCopy}
                style={actionPillStyle()}
                title="Copy diagnostics to clipboard"
              >
                {copied ? "Copied" : "Copy"}
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                style={actionPillStyle()}
              >
                Close ▼
              </button>
            </div>
          </div>

          <div style={{ marginTop: 8, color: color.textMuted, fontSize: 12 }}>
            Use <strong>Copy</strong> and paste the diagnostics into a support ticket (or to the chatbot). Do not paste tokens.
          </div>

          <div style={sectionTitleStyle()}>Session / Identity</div>
          {row("systemRole", sysRole)}
          {row("email (/me)", email || "—", { warn: Boolean(emailErr) })}
          {row("route", routeText)}
          {row("pathname", pathnameText)}
          {row("page", page)}
          {row("merchantId", merchantId)}
          {row("storeId", storeId)}
          {row("invoiceId", invoiceId)}

          <div style={sectionTitleStyle()}>Permissions / Context</div>
          {row("merchantRole", merchantRoleText)}
          {row("merchantRolePath", merchantRolePathText)}
          {row("deviceTrusted", deviceTrustedText)}
          {row("deviceTrustedLoading", deviceTrustLoadingText)}

          <div style={sectionTitleStyle()}>Auth / Device</div>
          {row("JWT present?", jwtPresent ? "Yes" : "No")}
          {row("Device ID", deviceShort)}
          {row("Device verification required?", deviceVerificationRequired)}

          <div style={sectionTitleStyle()}>Environment</div>
          {row("API_BASE", apiBaseText)}
          {row("build", build)}
          {row("viewport", viewport)}
          {row("user agent", uaShort)}

          <div style={sectionTitleStyle()}>API Diagnostics</div>
          {row("lastError", lastErrorText || "—", { warn: lastErrorText && lastErrorText !== "—" })}
          {row("lastSuccessTs", lastSuccessText || "—")}
          {row("lastRequest", snap?.lastRequest || "—")}

          {apiEvents.length ? (
            <>
              <div style={sectionTitleStyle()}>Recent API Events</div>
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                {apiEvents.map((ev, idx) => (
                  <div
                    key={`${ev.ts || "t"}-${idx}`}
                    style={{
                      padding: "8px 0",
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div style={keyStyle()}>
                      {ev.direction} {ev.method} {ev.path}
                    </div>
                    <div style={valueStyle()}>
                      {ev.status != null ? `HTTP ${ev.status}` : "—"} {ev.ms != null ? `· ${ev.ms}ms` : ""}{" "}
                      {ev.ts ? `· ${String(ev.ts).slice(11, 19)}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {renderActionRow()}
        </div>
      )}
    </div>
  );
}
