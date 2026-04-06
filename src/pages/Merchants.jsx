// src/pages/Merchants.jsx
import React from "react";
import { Link } from "react-router-dom";
import { listMerchants, createMerchant, authDeviceStatus, authDeviceStart } from "../api/client";
import { MERCHANT_TYPE_OPTIONS, detectMerchantType } from "../config/merchantTypes";
import Toast from "../components/Toast";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";
import ProductAvatar from "../components/ProductAvatar";
import useBreakpoint from "../hooks/useBreakpoint";
import { color, btn, inputStyle as themeInput } from "../theme";

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
  } catch {
    // never break UI for logging
  }
}

const STATUS_BADGE_STYLES = {
  active:    { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",   border: "1px solid rgba(0,150,80,0.25)" },
  suspended: { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",   border: "1px solid rgba(200,120,0,0.25)" },
  archived:  { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.50)",   border: "1px solid rgba(0,0,0,0.12)" },
};

function StatusBadge({ status }) {
  const s = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.archived;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

function Badge({ children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: color.borderSubtle }}>
      {children}
    </span>
  );
}

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${color.border}`,
  background: color.cardBg,
  cursor: "pointer",
  fontWeight: 800,
};

const card = {
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: 14,
  background: color.cardBg,
};

function isDeviceGateError(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("device") &&
    (msg.includes("not enabled") || msg.includes("not trusted") || msg.includes("verify this device"))
  );
}

export default function Merchants() {
  const { isMobile } = useBreakpoint();
  const [merchants, setMerchants] = React.useState([]);
  const [status, setStatus] = React.useState("active");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("");
  const [showTypeStep, setShowTypeStep] = React.useState(false);

  const [toast, setToast] = React.useState(null);

  // Security-V1 device gate (admin actions only)
  const [device, setDevice] = React.useState({
    loading: true,
    trusted: true,
    expiresAt: null,
  });
  const [verifying, setVerifying] = React.useState(false);
  const [verifySent, setVerifySent] = React.useState(false);

  async function loadDeviceStatus(reason = "auto") {
    setDevice((d) => ({ ...d, loading: true }));
    try {
      const r = await authDeviceStatus();
      const trusted = Boolean(r?.trusted);
      setDevice({ loading: false, trusted, expiresAt: r?.expiresAt || null });

      pvUiHook("security.device.status.loaded.ui", {
        tc: "TC-SEC-DEV-UI-01",
        sev: "info",
        stable: "security:device:status",
        trusted,
        reason,
      });
    } catch (e) {
      // If this fails, we don't hard-block; listMerchants call will surface gate if needed.
      setDevice((d) => ({ ...d, loading: false }));

      pvUiHook("security.device.status.failed.ui", {
        tc: "TC-SEC-DEV-UI-02",
        sev: "warn",
        stable: "security:device:status",
        error: e?.message || String(e),
      });
    }
  }

  React.useEffect(() => {
    loadDeviceStatus("mount");

    function onFocus() {
      loadDeviceStatus("focus");
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(reason = "auto") {
    setLoading(true);
    setErr("");

    pvUiHook("admin.merchants.list_load_started.ui", {
      tc: "TC-MER-UI-01",
      sev: "info",
      stable: "merchants:list",
      status: status || null,
      reason,
    });

    try {
      
      const rows = await listMerchants({ status });
      const items = Array.isArray(rows?.items) ? rows.items : [];
      setMerchants(items);

      pvUiHook("admin.merchants.list_load_succeeded.ui", {
        tc: "TC-MER-UI-02",
        sev: "info",
        stable: "merchants:list",
        count: Array.isArray(rows) ? rows.length : 0,
        status: status || null,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load merchants";
      setErr(msg);

      // If backend says device isn't trusted, show the device gate.
      if (isDeviceGateError(e)) {
        setDevice((d) => ({ ...d, trusted: false }));
      }

      pvUiHook("admin.merchants.list_load_failed.ui", {
        tc: "TC-MER-UI-03",
        sev: "error",
        stable: "merchants:list",
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh("mount_or_status_change");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function onNameSubmit(e) {
    e.preventDefault();
    const name = String(newName || "").trim();
    if (!name) { setErr("Merchant name is required"); return; }
    setErr("");
    const detected = detectMerchantType(name);
    if (detected && !newType) setNewType(detected);
    setShowTypeStep(true);
  }

  async function onCreate() {
    setErr("");

    const name = String(newName || "").trim();

    setCreating(true);
    try {
      const created = await createMerchant({ name, merchantType: newType || null });
      setToast({ kind: "success", message: "Merchant created" });
      setNewName("");
      setNewType("");
      setShowTypeStep(false);

      pvUiHook("admin.merchants.create_succeeded.ui", {
        tc: "TC-MER-UI-10",
        sev: "info",
        stable: "merchants:create",
        merchantId: created?.id || null,
      });

      await refresh("create");
    } catch (e2) {
      const msg = e2?.message || "Create merchant failed";
      setErr(msg);

      if (isDeviceGateError(e2)) {
        setDevice((d) => ({ ...d, trusted: false }));
      }

      pvUiHook("admin.merchants.create_failed.ui", {
        tc: "TC-MER-UI-11",
        sev: "error",
        stable: "merchants:create",
        error: msg,
      });
    } finally {
      setCreating(false);
    }
  }

  async function sendVerifyLink() {
    setErr("");
    setVerifying(true);
    setVerifySent(false);

    const returnTo = "/merchants";

    pvUiHook("security.device.verify.send_clicked.ui", {
      tc: "TC-SEC-DEV-UI-10",
      sev: "info",
      stable: "security:device:verify",
      returnTo,
    });

    try {
      await authDeviceStart({ returnTo });
      setVerifySent(true);

      setToast({
        kind: "success",
        message: "Verification email sent. Open it on this computer and click the link.",
      });

      pvUiHook("security.device.verify.sent.ui", {
        tc: "TC-SEC-DEV-UI-11",
        sev: "info",
        stable: "security:device:verify",
      });
    } catch (e) {
      const msg = e?.message || "Failed to send verification email";
      setErr(msg);

      pvUiHook("security.device.verify.send_failed.ui", {
        tc: "TC-SEC-DEV-UI-12",
        sev: "error",
        stable: "security:device:verify",
        error: msg,
      });
    } finally {
      setVerifying(false);
    }
  }

  // Device gate UI (human wording, merged — no “secret” language)
  if (device && device.loading === false && device.trusted === false) {
    return (
      <PageContainer>
        <PageHeader
          title="Enable this browser for admin actions"
          subtitle="For safety, PerkValet requires a quick email verification before you can manage merchants and billing."
        />

        <div style={{ maxWidth: 760 }}>
          <div style={{ ...card, background: color.primarySubtle, borderColor: color.primaryBorder }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>One-time email link</div>
            <div style={{ color: color.textMuted, lineHeight: 1.45 }}>
              Click the button below and we’ll email you a verification link. Open the email on <b>this computer</b>
              and click the link to finish.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button
                type="button"
                onClick={sendVerifyLink}
                disabled={verifying}
                style={{
                  ...btn.primary,
                  padding: "10px 12px",
                  cursor: verifying ? "not-allowed" : "pointer",
                }}
              >
                {verifying ? "Sending..." : "Email me the verification link"}
              </button>

              <button
                type="button"
                onClick={() => loadDeviceStatus("manual_refresh")}
                disabled={verifying}
                style={{ ...buttonBase, cursor: verifying ? "not-allowed" : "pointer" }}
                title="If you already clicked the email link, refresh the status"
              >
                I already verified — refresh
              </button>
            </div>

            {verifySent ? (
              <div style={{ marginTop: 10, fontSize: 12, color: color.textMuted }}>
                Tip: if you don’t see it, check spam/junk.
              </div>
            ) : null}

            {err ? (
              <div
                style={{
                  marginTop: 12,
                  background: color.dangerSubtle,
                  border: `1px solid ${color.dangerBorder}`,
                  padding: 10,
                  borderRadius: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {err}
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: color.textFaint }}>
            Why this exists: admin accounts can change billing and access sensitive data. This step helps prevent
            accidental access from an untrusted machine.
          </div>
        </div>

        {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/admin" style={{ color: "inherit", textDecoration: "none" }}>Dashboard</Link>
        {" / "}
        <span>Merchants</span>
      </div>

      <PageHeader title="Merchants" subtitle="Manage merchant lifecycle and view merchant details." />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: color.textMuted, fontWeight: 800 }}>Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${color.borderInput}` }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
        </label>

        <button type="button" onClick={() => refresh("manual")} disabled={loading} style={buttonBase}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {device?.loading
            ? <Badge>Checking device…</Badge>
            : device?.trusted
              ? <Badge>
                  Device enabled
                  {device.expiresAt ? ` · expires ${new Date(device.expiresAt).toLocaleDateString()}` : ""}
                </Badge>
              : null}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create Merchant</div>

        {!showTypeStep ? (
          /* ── Step 1: name ── */
          <form onSubmit={onNameSubmit} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Merchant name"
              disabled={creating}
              style={{ ...themeInput, minWidth: 240, flex: 1 }}
              autoFocus
            />
            <button type="submit" disabled={!newName.trim()} style={buttonBase}>
              Create Merchant
            </button>
          </form>
        ) : (
          /* ── Step 2: business type ── */
          <div>
            <div style={{ fontWeight: 600, marginBottom: 12, color: color.text }}>
              {newName}
              <button
                type="button"
                onClick={() => setShowTypeStep(false)}
                style={{ marginLeft: 10, fontSize: 12, color: color.textFaint, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                edit name
              </button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: color.textMuted, marginBottom: 8 }}>
              Business type <span style={{ fontWeight: 400, color: color.textFaint }}>(optional)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginBottom: 16 }}>
              {MERCHANT_TYPE_OPTIONS.map(opt => (
                <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: creating ? "not-allowed" : "pointer", fontSize: 13 }}>
                  <input
                    type="radio"
                    name="newMerchantType"
                    value={opt.value}
                    checked={newType === opt.value}
                    onChange={() => setNewType(opt.value)}
                    disabled={creating}
                  />
                  {opt.label}
                </label>
              ))}
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: creating ? "not-allowed" : "pointer", fontSize: 13, color: color.textFaint }}>
                <input
                  type="radio"
                  name="newMerchantType"
                  value=""
                  checked={newType === ""}
                  onChange={() => setNewType("")}
                  disabled={creating}
                />
                Not specified
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onCreate} disabled={creating} style={buttonBase}>
                {creating ? "Creating…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setShowTypeStep(false); setNewType(""); setErr(""); }}
                disabled={creating}
                style={{ ...buttonBase, fontWeight: 600, color: color.textMuted }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {err ? (
        <div
          style={{
            ...card,
            background: color.dangerSubtle,
            borderColor: color.dangerBorder,
            marginBottom: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={{ ...card }}>
        {loading ? (
          <div style={{ padding: 8 }}>Loading…</div>
        ) : merchants.length === 0 ? (
          <div style={{ padding: 8, color: color.textMuted }}>No merchants found.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
            {merchants.map((m) => (
              <Link
                key={m.id}
                to={`/merchants/${m.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${color.border}`,
                  background: color.cardBg,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "box-shadow 0.15s",
                }}
              >
                <ProductAvatar name={m.name} size={44} radius={10} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: color.textFaint, marginTop: 2 }}>
                    ID: {m.id}
                    {m.pvAccountNumber ? ` · ${m.pvAccountNumber}` : ""}
                    {m.storeCount != null ? ` · ${m.storeCount} store${m.storeCount === 1 ? "" : "s"}` : ""}
                  </div>
                </div>
                <StatusBadge status={m.status || "active"} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <SupportInfo context={{ page: "Merchants" }} />
      {toast ? <Toast kind={toast.kind} message={toast.message} onClose={() => setToast(null)} /> : null}
    </PageContainer>
  );
}
