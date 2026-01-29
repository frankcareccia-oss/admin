// admin/src/pages/PosLogin.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import { posAuthLogin, clearAccessToken } from "../api/client";

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
  // allow short “codes” that are not just digits (future-proof): letters, digits, '-', '_', '#'
  // (We keep it conservative; no spaces)
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

  // If user entered a full code with '#', trust it (but sanitize whitespace).
  if (raw.includes("#")) {
    const compact = raw.replace(/\s+/g, "");
    // basic sanity: no leading/trailing '#'
    if (/^#|#$/.test(compact)) return { ok: false, error: "Invalid code format" };
    if (compact.length < 3 || compact.length > 80) return { ok: false, error: "Code length invalid" };
    return { ok: true, code: compact, mode: "full_code" };
  }

  // Pure digits => treat as PIN
  const digits = onlyDigits(raw);
  if (digits && digits === raw) {
    if (digits.length < 4 || digits.length > 8) {
      return { ok: false, error: "PIN must be 4–8 digits." };
    }
    if (!provisionedStoreId) {
      return { ok: false, error: 'This terminal is not provisioned. Click "Provision Terminal" first.' };
    }
    return { ok: true, code: `${provisionedStoreId}#${digits}`, mode: "pin" };
  }

  // Token-style code (future-proof)
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
    setError("Terminal pairing cleared. Please provision this terminal.");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    const p = readProvisioning();
    setProv(p);

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

    if (!p.provisioned) {
      setError('This terminal is not provisioned. Click "Provision Terminal" first.');
      pvUiHook("pos.login.submit_failed.ui", {
        tc: "TC-POS-LOGIN-UI-04",
        sev: "warn",
        stable: "pos:login",
        error: "Terminal not provisioned",
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
        codeMasked: maskCodeForLogs(code), // do NOT leak
      });

      // IMPORTANT: send context as an object so backend can validate terminal/store.
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

      // Persist authed context (optional but useful)
      if (r?.storeId != null) localStorage.setItem(LS_POS_AUTHED_STORE_ID, String(r.storeId));
      if (r?.merchantId != null) localStorage.setItem(LS_POS_AUTHED_MERCHANT_ID, String(r.merchantId));
      if (p.terminalId) localStorage.setItem(LS_POS_AUTHED_TERMINAL_ID, String(p.terminalId));

      pvUiHook("pos.login.submit_succeeded.ui", {
        tc: "TC-POS-LOGIN-UI-07",
        sev: "info",
        stable: "pos:login",
        storeId: String(r?.storeId || p.storeId || ""),
        merchantId: String(r?.merchantId || ""),
        terminalId: p.terminalId,
        redirectedFrom: fromPath || null,
      });

      // If we were redirected here from a POS route, go back there; otherwise go to dashboard.
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

  const storeLine = prov.storeId != null ? prov.storeId : "— not provisioned —";
  const termLine = prov.terminalId
    ? `${prov.terminalLabel || "Terminal"} (${prov.terminalId})`
    : "— not provisioned —";

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

        <h2 style={{ marginTop: 16, marginBottom: 6 }}>POS Associate Login</h2>
        <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
          Enter your <b>PIN</b> (e.g., <b>7931</b>) or a full code (e.g., <b>5#7931</b>). This terminal must be
          provisioned first.
        </div>

        {notice ? <div style={styles.noticeBox}>{notice}</div> : null}

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
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)", fontWeight: 800 }}>PIN / Code</div>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              inputMode="text"
              placeholder="Example: 7931"
              autoComplete="one-time-code"
              disabled={busy}
              style={styles.input}
            />
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              If you type <b>7931</b>, we send <b>storeId#PIN</b> and also include terminal context.
            </div>
          </label>

          <button disabled={busy} type="submit" style={styles.signInBtn}>
            {busy ? "Signing in..." : "Sign in"}
          </button>

          {error ? <div style={styles.errorBox}>{error}</div> : null}
        </form>

        <div style={{ marginTop: 14, color: "rgba(0,0,0,0.55)", fontSize: 13 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Support notes</div>
          <ul style={{ marginTop: 0 }}>
            <li>This page never shows access tokens or raw server payloads.</li>
            <li>PIN-only becomes <b>storeId#PIN</b> behind the scenes.</li>
            <li>If terminal is not provisioned, go to <b>Provision Terminal</b> first.</li>
            <li>
              “Clear Terminal” is for managers/support to unpair a terminal if it was provisioned to the wrong store.
            </li>
          </ul>
        </div>
      </div>
    </PageContainer>
  );
}

const styles = {
  pillBtn: {
    textDecoration: "none",
    color: "inherit",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 800,
    display: "inline-block",
  },
  pillBtnButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  dangerPillBtnButton: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "rgba(255,0,0,0.06)",
    cursor: "pointer",
    fontWeight: 900,
  },
  noticeBox: {
    background: "rgba(0,120,255,0.08)",
    border: "1px solid rgba(0,120,255,0.18)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
    whiteSpace: "pre-wrap",
    fontWeight: 700,
  },
  card: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
    marginBottom: 12,
  },
  cardTitle: { fontWeight: 900, marginBottom: 10 },
  kvRow: { display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, padding: "4px 0" },
  k: { color: "rgba(0,0,0,0.65)", fontWeight: 800 },
  v: { fontWeight: 800 },
  form: {
    display: "grid",
    gap: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.22)",
  },
  signInBtn: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  errorBox: {
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    fontWeight: 800,
    color: "rgba(140,0,0,1)",
  },
};
