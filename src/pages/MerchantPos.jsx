// admin/src/pages/MerchantPos.jsx
import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { clearAccessToken, posGetTodayStats, posGetRecentActivity } from "../api/client";

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

// Provisioning keys (persist across shifts)
const LS_POS_STORE_ID = "perkvalet_pos_store_id";
const LS_POS_TERMINAL_ID = "perkvalet_pos_terminal_id";
const LS_POS_TERMINAL_LABEL = "perkvalet_pos_terminal_label";

// Auth/session keys (cleared on End Shift)
const LS_ACCESS_TOKEN = "perkvalet_access_token";
const LS_SYSTEM_ROLE = "perkvalet_system_role";
const LS_SYSTEM_ROLE_RAW = "perkvalet_system_role_raw";
const LS_LANDING = "perkvalet_landing";
const LS_IS_POS = "perkvalet_is_pos";

// Optional: “authed terminal context” keys (clear on End Shift; keep provisioning)
const LS_POS_AUTHED_STORE_ID = "perkvalet_pos_authed_store_id";
const LS_POS_AUTHED_TERMINAL_ID = "perkvalet_pos_authed_terminal_id";
const LS_POS_AUTHED_MERCHANT_ID = "perkvalet_pos_authed_merchant_id";

// Optional cross-page hint (not required): other pages MAY set this to "1" before navigating back
const SS_POS_DASH_NEEDS_REFRESH = "perkvalet_pos_dash_needs_refresh";

// Route constant
const POS_DASH_PATH = "/merchant/pos";

function readStr(key) {
  return String(localStorage.getItem(key) || "").trim();
}

function readProvisioning() {
  const storeId = readStr(LS_POS_STORE_ID);
  const terminalId = readStr(LS_POS_TERMINAL_ID);
  const terminalLabel = readStr(LS_POS_TERMINAL_LABEL);
  return {
    storeId: storeId || null,
    terminalId: terminalId || null,
    terminalLabel: terminalLabel || null,
  };
}

function formatLocal(ts) {
  try {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

function readDashNeedsRefresh() {
  try {
    return String(sessionStorage.getItem(SS_POS_DASH_NEEDS_REFRESH) || "") === "1";
  } catch {
    return false;
  }
}

function clearDashNeedsRefresh() {
  try {
    sessionStorage.removeItem(SS_POS_DASH_NEEDS_REFRESH);
  } catch {
    // ignore
  }
}

export default function MerchantPos() {
  const navigate = useNavigate();
  const location = useLocation();

  const [prov, setProv] = React.useState(() => readProvisioning());

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const [today, setToday] = React.useState({
    visits: 0,
    rewards: 0,
    updatedAt: null, // event time from backend if available
    fetchedAt: null, // when UI refreshed
  });

  const [recent, setRecent] = React.useState({
    items: [],
    fetchedAt: null,
  });

  // Auto-refresh guards
  const initialLoadDoneRef = React.useRef(false);
  const lastAutoRefreshAtRef = React.useRef(0);

  React.useEffect(() => {
    pvUiHook("pos.dashboard.page_loaded.ui", {
      tc: "TC-POS-DASH-UI-01",
      sev: "info",
      stable: "pos:dash",
      storeId: prov.storeId || null,
      terminalIdPresent: Boolean(prov.terminalId),
      terminalLabelPresent: Boolean(prov.terminalLabel),
    });

    // Load stats on entry (best-effort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refreshAll({ reason: "initial_mount" }).finally(() => {
      initialLoadDoneRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If this page is NOT unmounted when navigating (nested routing), this catches "return to dashboard".
  React.useEffect(() => {
    if (location?.pathname !== POS_DASH_PATH) return;

    // Avoid double-refresh immediately on first mount.
    if (!initialLoadDoneRef.current) return;

    // If other pages opted-in (sessionStorage flag), always refresh once.
    const flagged = readDashNeedsRefresh();

    // Otherwise do a conservative "route return" refresh with cooldown.
    const now = Date.now();
    const cooldownMs = 2000; // prevent accidental double calls (HMR / double effects / rapid nav)
    const recentlyAutoRefreshed = now - lastAutoRefreshAtRef.current < cooldownMs;

    if (flagged || !recentlyAutoRefreshed) {
      if (flagged) clearDashNeedsRefresh();
      lastAutoRefreshAtRef.current = now;

      pvUiHook("pos.dashboard.auto_refresh_on_return.ui", {
        tc: "TC-POS-DASH-UI-05",
        sev: "info",
        stable: "pos:dash",
        reason: flagged ? "flagged_return" : "route_return",
        path: location?.pathname || null,
      });

      // eslint-disable-next-line react-hooks/exhaustive-deps
      refreshAll({ reason: flagged ? "flagged_return" : "route_return" });
    }
  }, [location?.pathname]);

  function refreshTerminalOnly() {
    const p = readProvisioning();
    setProv(p);
    setError("");
    pvUiHook("pos.dashboard.refresh_terminal_only_clicked.ui", {
      tc: "TC-POS-DASH-UI-02B",
      sev: "info",
      stable: "pos:dash",
      storeId: p.storeId || null,
      terminalIdPresent: Boolean(p.terminalId),
    });
  }

  function normalizeTodayResponse(t) {
    // Prefer backend shape: { ok:true, today:{ visitsCount, rewardsCount, lastUpdatedAt } }
    const visitsCount = t?.today?.visitsCount ?? t?.visitsCount ?? t?.visits ?? 0;

    const rewardsCount = t?.today?.rewardsCount ?? t?.rewardsCount ?? t?.rewards ?? 0;

    const lastUpdatedAt = t?.today?.lastUpdatedAt ?? t?.lastUpdatedAt ?? t?.updatedAt ?? null;

    return {
      visits: Number(visitsCount || 0),
      rewards: Number(rewardsCount || 0),
      updatedAt: lastUpdatedAt ? String(lastUpdatedAt) : null,
    };
  }

  function normalizeRecentResponse(r) {
    // Prefer backend shape: { ok:true, activity:{ items:[...] } }
    const items = r?.activity?.items ?? r?.items ?? [];
    return {
      items: Array.isArray(items) ? items : [],
    };
  }

  async function refreshAll(opts = {}) {
    const reason = String(opts?.reason || "manual_refresh");
    const p = readProvisioning();
    setProv(p);
    setError("");
    setBusy(true);

    pvUiHook("pos.dashboard.refresh_clicked.ui", {
      tc: "TC-POS-DASH-UI-02",
      sev: "info",
      stable: "pos:dash",
      storeId: p.storeId || null,
      terminalIdPresent: Boolean(p.terminalId),
      reason,
    });

    try {
      const [tRaw, rRaw] = await Promise.all([
        posGetTodayStats().catch((e) => ({ _err: e })),
        posGetRecentActivity({ limit: 25 }).catch((e) => ({ _err: e })),
      ]);

      if (tRaw && tRaw._err) throw tRaw._err;
      if (rRaw && rRaw._err) throw rRaw._err;

      const nowIso = new Date().toISOString();

      const t = normalizeTodayResponse(tRaw);
      const r = normalizeRecentResponse(rRaw);

      setToday({
        visits: t.visits,
        rewards: t.rewards,
        updatedAt: t.updatedAt, // event time (from backend)
        fetchedAt: nowIso, // UI refresh time
      });

      setRecent({
        items: r.items,
        fetchedAt: nowIso,
      });

      pvUiHook("pos.dashboard.refresh_succeeded.ui", {
        tc: "TC-POS-DASH-UI-02S",
        sev: "info",
        stable: "pos:dash",
        storeId: p.storeId || null,
        visits: t.visits,
        rewards: t.rewards,
        recentCount: r.items.length,
        reason,
      });
    } catch (e) {
      const msg = e?.message || String(e) || "Failed to refresh";
      setError(msg);

      pvUiHook("pos.dashboard.refresh_failed.ui", {
        tc: "TC-POS-DASH-UI-02F",
        sev: "warn",
        stable: "pos:dash",
        error: msg,
        reason,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onEndShift() {
    const p = readProvisioning();

    pvUiHook("pos.dashboard.end_shift_clicked.ui", {
      tc: "TC-POS-DASH-UI-03",
      sev: "info",
      stable: "pos:shift",
      storeId: p.storeId || null,
      terminalIdPresent: Boolean(p.terminalId),
    });

    // OPTION 2: KEEP provisioning keys
    // Clear only session/auth + authed-context keys.
    try {
      clearAccessToken(); // local UI helper
    } catch {
      // ignore
    }

    // Session/auth keys
    localStorage.removeItem(LS_ACCESS_TOKEN);
    localStorage.removeItem(LS_SYSTEM_ROLE);
    localStorage.removeItem(LS_SYSTEM_ROLE_RAW);
    localStorage.removeItem(LS_LANDING);
    localStorage.removeItem(LS_IS_POS);

    // Authed-context keys (do NOT use these to determine provisioning)
    localStorage.removeItem(LS_POS_AUTHED_STORE_ID);
    localStorage.removeItem(LS_POS_AUTHED_TERMINAL_ID);
    localStorage.removeItem(LS_POS_AUTHED_MERCHANT_ID);

    pvUiHook("pos.dashboard.end_shift_completed.ui", {
      tc: "TC-POS-DASH-UI-04",
      sev: "info",
      stable: "pos:shift",
      keptProvisioning: true,
      storeId: p.storeId || null,
      terminalIdPresent: Boolean(p.terminalId),
    });

    // Back to POS login page (terminal should still show as provisioned)
    navigate("/pos/login", {
      replace: true,
      state: { notice: "Shift ended. Please sign in." },
    });
  }

  const storeLine = prov.storeId ? `Store #${prov.storeId}` : "— not provisioned —";
  const termLine = prov.terminalId
    ? `${prov.terminalLabel || "Terminal"} (${prov.terminalId})`
    : "— not provisioned —";

  return (
    <div style={{ maxWidth: 980 }}>
      <h2>POS Associate - Dashboard</h2>
      <div style={{ color: "rgba(0,0,0,0.65)" }}>
        Use this page to register visits and grant rewards at your store.
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => refreshAll({ reason: "manual_click" })} disabled={busy} style={styles.secondaryBtn}>
          {busy ? "Refreshing..." : "Refresh"}
        </button>

        <button onClick={onEndShift} style={styles.dangerBtn}>
          End Shift
        </button>

        <button onClick={refreshTerminalOnly} disabled={busy} style={styles.ghostBtn}>
          Refresh Terminal Only
        </button>

        {error ? <div style={styles.inlineError}>{error}</div> : null}
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Terminal</div>
        <div style={styles.kvRow}>
          <div style={styles.k}>Store:</div>
          <div style={styles.v}>{storeLine}</div>
        </div>
        <div style={styles.kvRow}>
          <div style={styles.k}>Terminal:</div>
          <div style={styles.v}>{termLine}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/merchant/pos/visit" style={styles.primaryBtn}>
          Register Visit
        </Link>
        <Link to="/merchant/pos/reward" style={styles.primaryBtn}>
          Grant Reward
        </Link>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Today</div>

          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <div style={styles.kvRow2}>
              <div style={styles.k2}>Visits</div>
              <div style={styles.v2}>{Number(today.visits || 0)}</div>
            </div>

            <div style={styles.kvRow2}>
              <div style={styles.k2}>Rewards</div>
              <div style={styles.v2}>{Number(today.rewards || 0)}</div>
            </div>

            {today.updatedAt || today.fetchedAt ? (
              <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                {today.updatedAt ? (
                  <div style={styles.metaLine}>Updated (local): {formatLocal(today.updatedAt)}</div>
                ) : null}
                {today.fetchedAt ? (
                  <div style={styles.metaLine}>Refreshed (local): {formatLocal(today.fetchedAt)}</div>
                ) : null}
              </div>
            ) : (
              <div style={styles.panelText}>Press Refresh to load today&apos;s stats.</div>
            )}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Recent Activity</div>

          {Array.isArray(recent.items) && recent.items.length ? (
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              {/* Column header */}
              <div style={styles.activityHeader}>
                <div style={{ minWidth: 72 }}>TYPE</div>
                <div>IDENTIFIER</div>
                <div style={{ marginLeft: "auto" }}>LOCAL TIME</div>
              </div>

              {recent.items.slice(0, 10).map((it, idx) => (
                <div key={`${it.type || "x"}-${it.id || idx}`} style={styles.activityRow}>
                  <div style={{ fontWeight: 900, minWidth: 72 }}>{String(it.type || "").toUpperCase()}</div>
                  <div style={{ fontWeight: 800, color: "rgba(0,0,0,0.75)" }}>
                    {it.identifierMasked || it.identifier || "—"}
                  </div>
                  <div style={{ marginLeft: "auto", color: "rgba(0,0,0,0.55)", fontWeight: 800, fontSize: 12 }}>
                    {formatLocal(it.at || it.ts) || ""}
                  </div>
                </div>
              ))}

              {recent.fetchedAt ? (
                <div style={styles.metaLine}>Refreshed (local): {formatLocal(recent.fetchedAt)}</div>
              ) : null}
            </div>
          ) : (
            <div style={styles.panelText}>No recent activity yet. Press Refresh after a visit/reward.</div>
          )}
        </div>
      </div>

      <div style={styles.footer}>
        POS associate - limited to visit/reward actions only. This page never shows access tokens or raw server payloads.
      </div>
    </div>
  );
}

const styles = {
  primaryBtn: {
    padding: "12px 20px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    textDecoration: "none",
    fontWeight: 800,
    color: "black",
    display: "inline-block",
    minWidth: 160,
    textAlign: "center",
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px dashed rgba(0,0,0,0.22)",
    background: "rgba(0,0,0,0.02)",
    cursor: "pointer",
    fontWeight: 900,
  },
  dangerBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "rgba(255,0,0,0.06)",
    cursor: "pointer",
    fontWeight: 900,
  },
  inlineError: {
    marginLeft: 6,
    padding: "8px 10px",
    borderRadius: 12,
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    fontWeight: 800,
    color: "rgba(140,0,0,1)",
    maxWidth: 520,
    whiteSpace: "pre-wrap",
  },
  card: {
    marginTop: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  cardTitle: { fontWeight: 900, marginBottom: 10 },
  kvRow: { display: "grid", gridTemplateColumns: "90px 1fr", gap: 10, padding: "4px 0" },
  k: { color: "rgba(0,0,0,0.65)", fontWeight: 800 },
  v: { fontWeight: 800 },
  kvRow2: { display: "grid", gridTemplateColumns: "90px 1fr", gap: 10, alignItems: "center" },
  k2: { color: "rgba(0,0,0,0.65)", fontWeight: 900 },
  v2: { fontWeight: 900 },
  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  panelTitle: { fontWeight: 900, marginBottom: 6 },
  panelText: { color: "rgba(0,0,0,0.65)" },
  activityHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 2px",
    color: "rgba(0,0,0,0.45)",
    fontSize: 12,
    fontWeight: 900,
  },
  activityRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.01)",
  },
  metaLine: { color: "rgba(0,0,0,0.5)", fontSize: 12, fontWeight: 800 },
  footer: { marginTop: 18, color: "rgba(0, 0, 0, 0.5)", fontSize: 13 },
};
