// admin/src/pages/PosLogin.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { posAuthLogin, clearAccessToken } from "../api/client";
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

// Provisioning keys (persist)
const LS_POS_STORE_ID = "perkvalet_pos_store_id";
const LS_POS_TERMINAL_ID = "perkvalet_pos_terminal_id";
const LS_POS_TERMINAL_LABEL = "perkvalet_pos_terminal_label";

// Session keys
const LS_SYSTEM_ROLE = "perkvalet_system_role";
const LS_SYSTEM_ROLE_RAW = "perkvalet_system_role_raw";
const LS_LANDING = "perkvalet_landing";
const LS_IS_POS = "perkvalet_is_pos";

// Authed-context keys (clear when logging out / ending shift)
const LS_POS_AUTHED_STORE_ID = "perkvalet_pos_authed_store_id";
const LS_POS_AUTHED_TERMINAL_ID = "perkvalet_pos_authed_terminal_id";
const LS_POS_AUTHED_MERCHANT_ID = "perkvalet_pos_authed_merchant_id";

function readStr(key) {
  return String(localStorage.getItem(key) || "").trim();
}

function readProvisioning() {
  const storeId = readStr(LS_POS_STORE_ID);
  const terminalId = readStr(LS_POS_TERMINAL_ID);
  const terminalLabel = readStr(LS_POS_TERMINAL_LABEL);

  return {
    storeId: storeId ? Number(storeId) : null,
    terminalId: terminalId || null,
    terminalLabel: terminalLabel || null,
    provisioned: Boolean(storeId && terminalId),
  };
}

function onlyDigits(s) {
  return String(s || "").replace(/[^\d]/g, "");
}

function looksAlphaNumToken(s) {
  const v = String(s || "").trim();
  // token-style (future): letters/digits/_/- only, no spaces
  return /^[A-Za-z0-9_-]{3,64}$/.test(v);
}

function maskCodeForLogs(code) {
  const v = String(code || "").trim();
  if (!v) return "";
  if (v.includes("#")) {
    const parts = v.split("#").filter(Boolean);
    if (parts.length === 1) return "****";
    const last = parts[parts.length - 1] || "";
    return `${parts[0]}#${"*".repeat(Math.min(6, Math.max(4, last.length || 4)))}`;
  }
  return v.length <= 4 ? "****" : `${v.slice(0, 2)}****`;
}

/**
 * normalizePosCode
 *
 * Supports:
 *  - PIN-only: "7931"  -> "storeId#7931" (requires provisioning storeId)
 *  - Full code: "5#7931" -> send as-is
 *  - Token-style: "ABCD1234" -> send as-is (future)
 */
function normalizePosCode({ provisionedStoreId }, rawInput) {
  const raw = String(rawInput || "").trim();

  if (!raw) return { ok: false, error: "PIN / code is required" };

  // Full code with '#'
  if (raw.includes("#")) {
    const compact = raw.replace(/\s+/g, "");
    if (/^#|#$/.test(compact)) return { ok: false, error: "Invalid code format" };
    if (compact.length < 3 || compact.length > 80) return { ok: false, error: "Code length invalid" };
    return { ok: true, code: compact, mode: "full_code" };
  }

  // PIN only (digits)
  const digits = onlyDigits(raw);
  if (digits && digits === raw) {
    if (digits.length < 4 || digits.length > 8) {
      return { ok: false, error: "PIN must be 4–8 digits." };
    }
    if (!provisionedStoreId) {
      return { ok: false, error: 'This terminal is not set up yet. Tap "Provision Terminal" first.' };
    }
    return { ok: true, code: `${provisionedStoreId}#${digits}`, mode: "pin" };
  }

  // Token-style (future-proof)
  if (looksAlphaNumToken(raw)) {
    return { ok: true, code: raw, mode: "token" };
  }

  return { ok: false, error: "Invalid PIN/code. Use 4–8 digits, or a valid short code." };
}

export default function PosLogin() {
  const navigate = useNavigate();
  const location = useLocation();

  const [prov, setProv] = React.useState(() => readProvisioning());
  const [codeInput, setCodeInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const notice = location.state?.notice || "";
  const fromPath = location.state?.from || "";

  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const p = readProvisioning();
    setProv(p);

    pvUiHook("pos.login.page_loaded.ui", {
      tc: "TC-POS-LOGIN-UI-01",
      sev: "info",
      stable: "pos:login",
      provisioned: p.provisioned,
      storeIdPresent: Boolean(p.storeId),
      terminalIdPresent: Boolean(p.terminalId),
      from: fromPath || null,
    });

    // Fast-register UX: focus PIN on load
    try {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    const p = readProvisioning();
    setProv(p);
    setError("");

    pvUiHook("pos.login.refresh_clicked.ui", {
      tc: "TC-POS-LOGIN-UI-02",
      sev: "info",
      stable: "pos:login",
      provisioned: p.provisioned,
      storeIdPresent: Boolean(p.storeId),
      terminalIdPresent: Boolean(p.terminalId),
    });

    try {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    } catch {}
  }

  function clearTerminalPairing() {
    pvUiHook("pos.login.clear_terminal_clicked.ui", {
      tc: "TC-POS-LOGIN-UI-03",
      sev: "warn",
      stable: "pos:login",
    });

    // Clear provisioning (manager/support action)
    localStorage.removeItem(LS_POS_STORE_ID);
    localStorage.removeItem(LS_POS_TERMINAL_ID);
    localStorage.removeItem(LS_POS_TERMINAL_LABEL);

    // Also clear any lingering session artifacts
    try {
      clearAccessToken();
    } catch {
      // ignore
    }
    localStorage.removeItem(LS_SYSTEM_ROLE);
    localStorage.removeItem(LS_SYSTEM_ROLE_RAW);
    localStorage.removeItem(LS_LANDING);
    localStorage.removeItem(LS_IS_POS);

    localStorage.removeItem(LS_POS_AUTHED_STORE_ID);
    localStorage.removeItem(LS_POS_AUTHED_TERMINAL_ID);
    localStorage.removeItem(LS_POS_AUTHED_MERCHANT_ID);

    const p = readProvisioning();
    setProv(p);
    setCodeInput("");
    setError("Terminal cleared. Next step: Provision this terminal again.");

    try {
      setTimeout(() => inputRef.current?.focus?.(), 0);
    } catch {}
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const p = readProvisioning();
    setProv(p);

    if (!p.provisioned) {
      setError('This terminal is not set up yet. Tap "Provision Terminal" first.');
      pvUiHook("pos.login.submit_failed.ui", {
        tc: "TC-POS-LOGIN-UI-04",
        sev: "warn",
        stable: "pos:login",
        error: "Terminal not provisioned",
      });
      return;
    }

    const norm = normalizePosCode({ provisionedStoreId: p.storeId }, codeInput);
    if (!norm.ok) {
      setError(norm.error);
      pvUiHook("pos.login.submit_failed.ui", {
        tc: "TC-POS-LOGIN-UI-05",
        sev: "warn",
        stable: "pos:login",
        error: norm.error,
        provisioned: p.provisioned,
      });
      return;
    }

    const code = norm.code;

    setBusy(true);
    try {
      pvUiHook("pos.login.submit_clicked.ui", {
        tc: "TC-POS-LOGIN-UI-06",
        sev: "info",
        stable: "pos:login",
        storeId: p.storeId != null ? String(p.storeId) : null,
        terminalId: p.terminalId,
        terminalLabel: p.terminalLabel,
        codeMode: norm.mode,
        codeMasked: maskCodeForLogs(code),
      });

      const payload = {
        storeId: p.storeId,
        terminalId: p.terminalId,
        terminalLabel: p.terminalLabel,
        code,
      };

      const r = await posAuthLogin(payload);

      // Persist standard session UI keys
      localStorage.setItem(LS_SYSTEM_ROLE, "merchant");
      localStorage.setItem(LS_SYSTEM_ROLE_RAW, String(r?.systemRole || "user"));
      localStorage.setItem(LS_IS_POS, "1");
      localStorage.setItem(LS_LANDING, "/merchant/pos");

      // Persist authed context
      if (r?.storeId != null) localStorage.setItem(LS_POS_AUTHED_STORE_ID, String(r.storeId));
      if (r?.merchantId != null) localStorage.setItem(LS_POS_AUTHED_MERCHANT_ID, String(r.merchantId));
      if (p.terminalId) localStorage.setItem(LS_POS_AUTHED_TERMINAL_ID, String(p.terminalId));

      // Persist session timeout (minutes) for MerchantPos inactivity timer
      localStorage.setItem("perkvalet_pos_timeout_minutes", String(r?.sessionTimeoutMinutes || 5));

      pvUiHook("pos.login.submit_succeeded.ui", {
        tc: "TC-POS-LOGIN-UI-07",
        sev: "info",
        stable: "pos:login",
        storeId: String(r?.storeId || p.storeId || ""),
        merchantId: String(r?.merchantId || ""),
        terminalId: p.terminalId,
        redirectedFrom: fromPath || null,
      });

      const dest = String(fromPath || "").startsWith("/merchant/pos") ? fromPath : "/merchant/pos";
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err?.message || "Invalid code";
      setError(msg);

      pvUiHook("pos.login.submit_failed.ui", {
        tc: "TC-POS-LOGIN-UI-08",
        sev: "warn",
        stable: "pos:login",
        error: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  const storeLine = prov.storeId != null ? prov.storeId : "Not set up";
  const termLine = prov.terminalId ? `${prov.terminalLabel || "Terminal"} (${prov.terminalId})` : "Not set up";

  const codeHasValue = Boolean(String(codeInput || "").trim());
  const canSignIn = prov.provisioned && codeHasValue && !busy;

  return (
    <PageContainer size="form">
      <div style={{ paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/pos/provision" style={styles.pillBtn}>
              &lt; Provision Terminal
            </Link>
            <Link to="/login" style={styles.pillBtn}>
              Main Login
            </Link>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="button" onClick={refresh} style={styles.pillBtnButton}>
              Refresh
            </button>

            <button
              type="button"
              onClick={clearTerminalPairing}
              style={styles.dangerPillBtnButton}
              title="Manager/Support: unpair this terminal from a store"
            >
              Clear Terminal
            </button>
          </div>
        </div>

        <h2 style={{ marginTop: 16, marginBottom: 6, color: color.text }}>POS Associate Login</h2>
        <div style={{ color: color.textMuted, marginBottom: 12 }}>
          Enter your <b>PIN</b> to start your shift. This terminal must be set up once before use.
        </div>

        {notice ? <div style={styles.noticeBox}>{notice}</div> : null}

        {!prov.provisioned ? (
          <div style={styles.notProvisionedBox}>
            <div style={{ fontWeight: 950, marginBottom: 6, color: color.text }}>This terminal isn't set up yet</div>
            <div style={{ color: color.textMuted, fontWeight: 750, lineHeight: 1.35 }}>
              Next step: tap <b>Provision Terminal</b> to connect this device to a store/register.
            </div>
          </div>
        ) : null}

        <div style={styles.card}>
          <div style={styles.cardTitle}>Terminal</div>

          <div style={styles.kvRow}>
            <div style={styles.k}>Store ID</div>
            <div style={styles.v}>{storeLine}</div>
          </div>

          <div style={styles.kvRow}>
            <div style={styles.k}>Terminal</div>
            <div style={styles.v}>{termLine}</div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={styles.form}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 13, color: color.textMuted, fontWeight: 850 }}>PIN / Code</div>
            <input
              ref={inputRef}
              className="pvInput"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              inputMode="numeric"
              placeholder="Example: 7931"
              autoComplete="one-time-code"
              disabled={busy}
              style={styles.input}
            />
            <div style={{ fontSize: 12, color: color.textFaint, fontWeight: 700 }}>
              PIN is typically 4–8 digits.
            </div>
          </label>

          <button disabled={!canSignIn} type="submit" style={{ ...styles.signInBtn, opacity: canSignIn ? 1 : 0.6 }}>
            {busy ? "Signing in..." : "Sign in"}
          </button>

          {error ? <div style={styles.errorBox}>{error}</div> : null}
        </form>

        <div style={{ marginTop: 14, color: color.textFaint, fontSize: 13 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Support notes</div>
          <ul style={{ marginTop: 0 }}>
            <li>This page never shows access tokens or raw server payloads.</li>
            <li>PIN-only becomes <b>storeId#PIN</b> behind the scenes.</li>
            <li>If terminal is not set up, go to <b>Provision Terminal</b> first.</li>
            <li>"Clear Terminal" is for managers/support to unpair a terminal if it was set up to the wrong store.</li>
          </ul>
        </div>
      </div>
    </PageContainer>
  );
}

const styles = {
  pillBtn: {
    ...btn.pill,
    textDecoration: "none",
    padding: "8px 12px",
    display: "inline-block",
  },
  pillBtnButton: {
    ...btn.pill,
    padding: "8px 12px",
  },
  dangerPillBtnButton: {
    ...btn.danger,
    padding: "8px 12px",
  },
  noticeBox: {
    background: color.primarySubtle,
    border: `1px solid ${color.primaryBorder}`,
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    whiteSpace: "pre-wrap",
    fontWeight: 750,
    color: color.text,
  },
  notProvisionedBox: {
    background: "rgba(255, 215, 0, 0.18)",
    border: `1px solid ${color.border}`,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  card: {
    border: `1px solid ${color.border}`,
    borderRadius: 14,
    padding: 14,
    background: color.cardBg,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: 900, marginBottom: 10, color: color.text },
  kvRow: { display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, padding: "4px 0" },
  k: { color: color.textMuted, fontWeight: 850 },
  v: { fontWeight: 850, color: color.text },
  form: {
    display: "grid",
    gap: 12,
    border: `1px solid ${color.border}`,
    borderRadius: 14,
    padding: 14,
    background: color.cardBg,
  },
  input: {
    ...themeInput,
    fontSize: 16,
    /* NOTE: font-weight/color controlled by .pvInput in App.css */
    fontWeight: "inherit",
  },
  signInBtn: {
    ...btn.primary,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
  },
  errorBox: {
    background: color.dangerSubtle,
    border: `1px solid ${color.dangerBorder}`,
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    fontWeight: 850,
    color: color.danger,
  },
};
