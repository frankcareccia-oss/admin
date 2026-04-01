// admin/src/pages/MerchantPos.jsx
// POS-13.5 (admin-only) — UI tweaks based on review:
// 1) Fix phone input overflow: enforce boxSizing + maxWidth to prevent spill.
// 2) Combine helper text lines: show sample + requirement on one line.
// 3) Remove consumerId display from UI (keep consumerId gating + hooks; do not display it).
// NOTE: Full module replacement. Builds on POS-13.4 all-in-one.

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  clearAccessToken,
  posGetTodayStats,
  posGetRecentActivity,
  posCustomerPreview,
  posCustomerCreate,
} from "../api/client";

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

// Cross-page refresh + last-action signals (Visit/Reward pages write these)
const SS_POS_DASH_NEEDS_REFRESH = "perkvalet_pos_dash_needs_refresh";
const LS_POS_NEEDS_REFRESH = "perkvalet_pos_needs_refresh";
const LS_POS_LAST_ACTION = "perkvalet_pos_last_action";

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
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

function readDashNeedsRefresh() {
  try {
    const flaggedSS = String(sessionStorage.getItem(SS_POS_DASH_NEEDS_REFRESH) || "") === "1";
    const flaggedLS = String(localStorage.getItem(LS_POS_NEEDS_REFRESH) || "") === "1";
    return flaggedSS || flaggedLS;
  } catch {
    return false;
  }
}

function clearDashNeedsRefresh() {
  try {
    sessionStorage.removeItem(SS_POS_DASH_NEEDS_REFRESH);
  } catch {}
  try {
    localStorage.removeItem(LS_POS_NEEDS_REFRESH);
  } catch {}
}

function readLastAction() {
  try {
    const raw = String(localStorage.getItem(LS_POS_LAST_ACTION) || "");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}

function describeLastAction(a) {
  if (!a) return "";
  const type = String(a.type || "").toLowerCase();
  const masked = a.identifierMasked ? String(a.identifierMasked) : "";
  const at = a.at ? formatLocal(a.at) : "";

  if (type === "visit") return `Last action: Visit registered ${masked ? `(${masked})` : ""}${at ? ` — ${at}` : ""}`;
  if (type === "reward") return `Last action: Reward granted ${masked ? `(${masked})` : ""}${at ? ` — ${at}` : ""}`;
  return `Last action recorded${at ? ` — ${at}` : ""}`;
}

// Phone-only normalization
function normalizePhoneDigits(raw) {
  return String(raw || "")
    .replace(/\D/g, "")
    .slice(0, 10);
}

function formatPhonePretty(digits) {
  const d = String(digits || "").replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);

  if (d.length <= 3) return `(${a}`;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

function maskPhone(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  if (d.length < 4) return "***-***-****";
  const last4 = d.slice(-4);
  return `***-***-${last4}`;
}

function normalizeNamePart(v) {
  return String(v || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function prettyName(firstName, lastName) {
  const fn = String(firstName || "").trim();
  const ln = String(lastName || "").trim();
  if (!fn && !ln) return "";
  if (fn && ln) return `${fn} ${ln}`;
  return fn || ln;
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
    updatedAt: null,
    fetchedAt: null,
  });

  const [recent, setRecent] = React.useState({
    items: [],
    fetchedAt: null,
  });

  const [lastActionMsg, setLastActionMsg] = React.useState("");

  // UX: Recent Activity collapsed by default
  const [recentOpen, setRecentOpen] = React.useState(false);

  // POS-11: customer identity flow
  const [phoneInput, setPhoneInput] = React.useState("");
  const [confirm, setConfirm] = React.useState(null); // { digits, masked, createdAt }
  const [identity, setIdentity] = React.useState(null); // { status, found, consumerId, firstName, lastName, displayName, previewedAt }
  const [createFirstName, setCreateFirstName] = React.useState("");
  const [createLastName, setCreateLastName] = React.useState("");

  // Auto-refresh guards
  const initialLoadDoneRef = React.useRef(false);
  const lastAutoRefreshAtRef = React.useRef(0);

  // POS-13.1: CTA gating (consumerId must be present)
  const ctaGatePrevRef = React.useRef(null); // null | true | false
  const ctaBlockedLastAtRef = React.useRef(0);

  // POS-13.2: focus reliability for phone input
  const phoneInputRef = React.useRef(null);
  const lastFocusAtRef = React.useRef(0);

  // POS-13.3: active customer banner impression guard
  const bannerShownRef = React.useRef(false);

  function focusPhoneInput(reason, opts = {}) {
    try {
      const now = Date.now();
      const cooldownMs = 120;
      if (!opts?.force && now - lastFocusAtRef.current < cooldownMs) return;
      lastFocusAtRef.current = now;

      const doFocus = () => {
        try {
          const el = phoneInputRef.current;
          if (!el) return;
          el.focus();
          if (opts?.selectAll) el.select();
          pvUiHook("pos.dashboard.phone.focused.ui", {
            tc: "TC-POS-13-FOCUS-01",
            sev: "info",
            stable: "pos:dash",
            reason: reason || "unknown",
            selectAll: Boolean(opts?.selectAll),
          });
        } catch {}
      };

      requestAnimationFrame(() => requestAnimationFrame(doFocus));
    } catch {}
  }

  function resetCustomerFlow(reason, extra = {}) {
    setError("");
    setCreateFirstName("");
    setCreateLastName("");
    setIdentity(null);
    setConfirm(null);

    pvUiHook("pos.dashboard.customer.reset.ui", {
      tc: "TC-POS-13-BANNER-RESET-01",
      sev: "info",
      stable: "pos:dash",
      reason: reason || "unknown",
      ...extra,
    });

    focusPhoneInput(`reset_${reason || "unknown"}`, { force: true, selectAll: true });
  }

  React.useEffect(() => {
    pvUiHook("pos.dashboard.page_loaded.ui", {
      tc: "TC-POS-DASH-UI-01",
      sev: "info",
      stable: "pos:dash",
      storeId: prov.storeId || null,
      terminalIdPresent: Boolean(prov.terminalId),
      terminalLabelPresent: Boolean(prov.terminalLabel),
    });

    const la = readLastAction();
    if (la) {
      setLastActionMsg(describeLastAction(la));
      pvUiHook("pos.dashboard.last_action.visible.ui", {
        tc: "TC-POS-DASH-UI-LA-01",
        sev: "info",
        stable: "pos:dash",
        type: la?.type || null,
      });
    }

    focusPhoneInput("mount", { force: true });

    refreshAll({ reason: "initial_mount" }).finally(() => {
      initialLoadDoneRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!confirm) {
      focusPhoneInput("confirm_cleared", { selectAll: Boolean(phoneInput), force: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm]);

  React.useEffect(() => {
    const isReady = Boolean(identity?.consumerId);
    const prev = ctaGatePrevRef.current;

    if (prev === null) {
      ctaGatePrevRef.current = isReady;
      return;
    }

    if (prev !== isReady) {
      ctaGatePrevRef.current = isReady;

      if (isReady) {
        pvUiHook("pos.dashboard.cta.enabled.ui", {
          tc: "TC-POS-13-CTA-ENABLED-01",
          sev: "info",
          stable: "pos:dash",
          consumerIdPresent: true,
          found: identity?.found ?? null,
          namePresent: Boolean(identity?.displayName),
        });
      } else {
        pvUiHook("pos.dashboard.cta.gated.ui", {
          tc: "TC-POS-13-CTA-GATED-01",
          sev: "info",
          stable: "pos:dash",
          consumerIdPresent: false,
          hasIdentity: Boolean(identity),
          found: identity?.found ?? null,
        });
      }
    }
  }, [identity?.consumerId, identity?.found, identity?.displayName, identity]);

  React.useEffect(() => {
    const ready = Boolean(confirm?.masked && identity?.consumerId);
    if (!ready) {
      bannerShownRef.current = false;
      return;
    }
    if (bannerShownRef.current) return;
    bannerShownRef.current = true;

    pvUiHook("pos.dashboard.active_customer.banner_shown.ui", {
      tc: "TC-POS-13-BANNER-01",
      sev: "info",
      stable: "pos:dash",
      identifierMasked: confirm?.masked || null,
      consumerIdPresent: Boolean(identity?.consumerId),
      namePresent: Boolean(identity?.displayName),
    });
  }, [confirm?.masked, identity?.consumerId, identity?.displayName]);

  React.useEffect(() => {
    if (location?.pathname !== POS_DASH_PATH) return;
    if (!initialLoadDoneRef.current) return;

    const flagged = readDashNeedsRefresh();

    const now = Date.now();
    const cooldownMs = 1200;
    const recentlyAutoRefreshed = now - lastAutoRefreshAtRef.current < cooldownMs;

    if (flagged || !recentlyAutoRefreshed) {
      if (flagged) clearDashNeedsRefresh();
      lastAutoRefreshAtRef.current = now;

      const la = readLastAction();
      if (la) setLastActionMsg(describeLastAction(la));

      pvUiHook("pos.dashboard.auto_refresh_on_return.ui", {
        tc: "TC-POS-DASH-UI-05",
        sev: "info",
        stable: "pos:dash",
        reason: flagged ? "flagged_return" : "route_return",
        path: location?.pathname || null,
      });

      refreshAll({ reason: flagged ? "flagged_return" : "route_return" });
    }
  }, [location?.pathname]);

  React.useEffect(() => {
    function onFocus() {
      if (location?.pathname !== POS_DASH_PATH) return;
      if (!initialLoadDoneRef.current) return;

      const flagged = readDashNeedsRefresh();
      if (!flagged) return;

      clearDashNeedsRefresh();
      const la = readLastAction();
      if (la) setLastActionMsg(describeLastAction(la));

      pvUiHook("pos.dashboard.auto_refresh_on_focus.ui", {
        tc: "TC-POS-DASH-UI-06",
        sev: "info",
        stable: "pos:dash",
        reason: "focus_flagged",
      });

      refreshAll({ reason: "focus_flagged" });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.pathname]);

  // ── Inactivity timeout ────────────────────────────────────────
  // 5 minutes of no interaction → clear session → back to PIN entry.
  // Keeps provisioning keys so the terminal stays paired to its store.
  const navigateRef = React.useRef(navigate);
  React.useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  React.useEffect(() => {
    const storedMin = parseInt(localStorage.getItem("perkvalet_pos_timeout_minutes") || "5", 10);
    const timeoutMin = Number.isInteger(storedMin) && storedMin >= 1 && storedMin <= 120 ? storedMin : 5;
    const TIMEOUT_MS = timeoutMin * 60 * 1000;
    let timer = null;

    function reset() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { clearAccessToken(); } catch {}
        [LS_ACCESS_TOKEN, LS_SYSTEM_ROLE, LS_SYSTEM_ROLE_RAW, LS_LANDING, LS_IS_POS,
         LS_POS_AUTHED_STORE_ID, LS_POS_AUTHED_TERMINAL_ID, LS_POS_AUTHED_MERCHANT_ID]
          .forEach(k => { try { localStorage.removeItem(k); } catch {} });

        pvUiHook("pos.dashboard.session.timeout.ui", {
          tc: "TC-POS-DASH-TIMEOUT-01",
          sev: "info",
          stable: "pos:session",
          reason: "inactivity",
          timeoutMs: TIMEOUT_MS,
          timeoutMin,
        });

        navigateRef.current("/pos/login", {
          replace: true,
          state: { notice: `Session ended after ${timeoutMin} minute${timeoutMin === 1 ? "" : "s"} of inactivity. Please sign in.` },
        });
      }, TIMEOUT_MS);
    }

    const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    EVENTS.forEach(e => document.addEventListener(e, reset, { passive: true }));
    reset(); // start timer on mount

    return () => {
      if (timer) clearTimeout(timer);
      EVENTS.forEach(e => document.removeEventListener(e, reset));
    };
  }, []); // mount only

  function normalizeTodayResponse(t) {
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
        updatedAt: t.updatedAt,
        fetchedAt: nowIso,
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

    try {
      clearAccessToken();
    } catch {}

    localStorage.removeItem(LS_ACCESS_TOKEN);
    localStorage.removeItem(LS_SYSTEM_ROLE);
    localStorage.removeItem(LS_SYSTEM_ROLE_RAW);
    localStorage.removeItem(LS_LANDING);
    localStorage.removeItem(LS_IS_POS);

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

    navigate("/pos/login", {
      replace: true,
      state: { notice: "Shift ended. Please sign in." },
    });
  }

  function clearIdentityState() {
    setIdentity(null);
    setCreateFirstName("");
    setCreateLastName("");
  }

  function onClearEntry() {
    setPhoneInput("");
    resetCustomerFlow("clear_clicked");
    pvUiHook("pos.dashboard.flow.clear_clicked.ui", {
      tc: "TC-POS-11-DASH-CLEAR-01",
      sev: "info",
      stable: "pos:dash",
    });
  }

  async function onConfirmPhone() {
    const digits = normalizePhoneDigits(phoneInput);
    if (digits.length !== 10) {
      setError("Enter a 10-digit phone number to continue.");
      pvUiHook("pos.dashboard.flow.confirm_failed.ui", {
        tc: "TC-POS-11-DASH-CONFIRM-02F",
        sev: "warn",
        stable: "pos:dash",
        reason: "invalid_phone",
        digitsLen: digits.length,
      });
      focusPhoneInput("confirm_failed_invalid_phone", { force: true, selectAll: Boolean(digits) });
      return;
    }

    const masked = maskPhone(digits);

    setError("");
    setConfirm({
      digits,
      masked,
      createdAt: new Date().toISOString(),
    });

    setBusy(true);
    clearIdentityState();

    pvUiHook("pos.dashboard.customer.preview.started.ui", {
      tc: "TC-POS-11-PREVIEW-01",
      sev: "info",
      stable: "pos:customer",
      identifierKind: "phone",
      identifierMasked: masked,
    });

    try {
      const r = await posCustomerPreview({ phone: digits });
      const display = prettyName(r?.firstName, r?.lastName);

      setIdentity({
        status: "ready",
        found: Boolean(r?.found),
        consumerId: r?.consumerId ? String(r.consumerId) : null,
        firstName: r?.firstName || null,
        lastName: r?.lastName || null,
        displayName: display || "",
        previewedAt: new Date().toISOString(),
      });

      pvUiHook("pos.dashboard.customer.preview.succeeded.ui", {
        tc: "TC-POS-11-PREVIEW-01S",
        sev: "info",
        stable: "pos:customer",
        identifierKind: "phone",
        identifierMasked: masked,
        found: Boolean(r?.found),
        consumerIdPresent: Boolean(r?.consumerId),
        namePresent: Boolean(display),
      });
    } catch (e) {
      const msg = e?.message || String(e) || "Customer preview failed";
      setError(msg);

      pvUiHook("pos.dashboard.customer.preview.failed.ui", {
        tc: "TC-POS-11-PREVIEW-01F",
        sev: "warn",
        stable: "pos:customer",
        identifierKind: "phone",
        identifierMasked: masked,
        error: msg,
      });

      setConfirm(null);
      focusPhoneInput("preview_failed", { force: true, selectAll: true });
    } finally {
      setBusy(false);
    }
  }

  async function onCreateCustomer() {
    const c = confirm;
    if (!c?.digits) return;

    const fn = normalizeNamePart(createFirstName);
    const ln = normalizeNamePart(createLastName);

    if (!fn) {
      setError("First name is required to create the customer.");
      pvUiHook("pos.dashboard.customer.create.validation_failed.ui", {
        tc: "TC-POS-11-CREATE-02F",
        sev: "warn",
        stable: "pos:customer",
        reason: "missing_first_name",
        identifierMasked: c.masked || null,
      });
      return;
    }

    setError("");
    setBusy(true);

    pvUiHook("pos.dashboard.customer.create.started.ui", {
      tc: "TC-POS-11-CREATE-01",
      sev: "info",
      stable: "pos:customer",
      identifierMasked: c.masked || null,
      firstNamePresent: true,
      lastNamePresent: Boolean(ln),
    });

    try {
      const r = await posCustomerCreate({
        phone: c.digits,
        firstName: fn,
        ...(ln ? { lastName: ln } : {}),
      });

      const consumerId = r?.consumerId ? String(r.consumerId) : null;

      setIdentity({
        status: "ready",
        found: true,
        consumerId,
        firstName: fn,
        lastName: ln || null,
        displayName: prettyName(fn, ln),
        previewedAt: new Date().toISOString(),
      });

      pvUiHook("pos.dashboard.customer.create.succeeded.ui", {
        tc: "TC-POS-11-CREATE-01S",
        sev: "info",
        stable: "pos:customer",
        identifierMasked: c.masked || null,
        consumerIdPresent: Boolean(consumerId),
      });
    } catch (e) {
      const msg = e?.message || String(e) || "Customer create failed";
      setError(msg);

      pvUiHook("pos.dashboard.customer.create.failed.ui", {
        tc: "TC-POS-11-CREATE-01F",
        sev: "warn",
        stable: "pos:customer",
        identifierMasked: c.masked || null,
        error: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  function emitCtaBlocked(kind, reason, extra = {}) {
    const now = Date.now();
    const cooldownMs = 650;
    if (now - ctaBlockedLastAtRef.current < cooldownMs) return;
    ctaBlockedLastAtRef.current = now;

    pvUiHook("pos.dashboard.cta.blocked.ui", {
      tc: "TC-POS-13-CTA-BLOCKED-01",
      sev: "info",
      stable: "pos:dash",
      kind,
      reason,
      consumerIdPresent: Boolean(identity?.consumerId),
      hasIdentity: Boolean(identity),
      found: identity?.found ?? null,
      ...extra,
    });
  }

  function onGoVisit() {
    const c = confirm;
    const id = identity;

    const canGo = Boolean(c?.digits && id?.consumerId);
    if (!canGo) {
      emitCtaBlocked("visit", "identity_not_resolved", { identifierMasked: c?.masked || null });
      return;
    }

    pvUiHook("pos.dashboard.go_visit_clicked.ui", {
      tc: "TC-POS-11-GO-01",
      sev: "info",
      stable: "pos:dash",
      identifierMasked: c.masked || null,
      consumerIdPresent: true,
      namePresent: Boolean(id.displayName),
    });

    navigate("/merchant/pos/visit", {
      state: {
        identifier: c.digits,
        identifierMasked: c.masked,
        consumerId: id.consumerId,
        displayName: id.displayName || null,
      },
    });
  }

  function onGoReward() {
    const c = confirm;
    const id = identity;

    const canGo = Boolean(c?.digits && id?.consumerId);
    if (!canGo) {
      emitCtaBlocked("reward", "identity_not_resolved", { identifierMasked: c?.masked || null });
      return;
    }

    pvUiHook("pos.dashboard.go_reward_clicked.ui", {
      tc: "TC-POS-11-GO-02",
      sev: "info",
      stable: "pos:dash",
      identifierMasked: c.masked || null,
      consumerIdPresent: true,
      namePresent: Boolean(id.displayName),
    });

    navigate("/merchant/pos/reward", {
      state: {
        identifier: c.digits,
        identifierMasked: c.masked,
        consumerId: id.consumerId,
        displayName: id.displayName || null,
      },
    });
  }

  function onEditConfirmedPhone() {
    const c = confirm;
    const masked = c?.masked || null;

    pvUiHook("pos.dashboard.flow.edit_clicked.ui", {
      tc: "TC-POS-11-DASH-EDIT-01",
      sev: "info",
      stable: "pos:dash",
      fromConfirmed: true,
      identifierMasked: masked,
    });

    if (c?.digits) setPhoneInput(String(c.digits));
    setError("");
    setCreateFirstName("");
    setCreateLastName("");
    setIdentity(null);
    setConfirm(null);

    focusPhoneInput("edit_clicked", { force: true, selectAll: true });
  }

  function onChangeCustomer() {
    pvUiHook("pos.dashboard.active_customer.change_clicked.ui", {
      tc: "TC-POS-13-BANNER-CHANGE-01",
      sev: "info",
      stable: "pos:dash",
      identifierMasked: confirm?.masked || null,
      consumerIdPresent: Boolean(identity?.consumerId),
    });

    setPhoneInput("");
    resetCustomerFlow("change_customer");
  }

  const isProvisioned = Boolean(prov.storeId && prov.terminalId);
  const storeLine = prov.storeId ? `Store #${prov.storeId}` : "Store —";
  const labelLine = prov.terminalLabel ? String(prov.terminalLabel) : "Terminal";
  const statusText = isProvisioned ? "Ready" : "Terminal not set up — provisioning required";

  const digits = normalizePhoneDigits(phoneInput);
  const pretty = formatPhonePretty(digits);
  const canConfirm = digits.length === 10;

  const confirmDisabled = busy || !canConfirm;

  const recentCount = Array.isArray(recent.items) ? recent.items.length : 0;
  const shownItems = Array.isArray(recent.items) ? recent.items.slice(0, 25) : [];

  const hasConfirmedPhone = Boolean(confirm?.digits);
  const hasIdentity = Boolean(identity);
  const hasConsumerId = Boolean(identity?.consumerId);
  const ctaGated = busy || !hasConfirmedPhone || !hasConsumerId;
  const ctaGateReason = busy
    ? "busy"
    : !hasConfirmedPhone
      ? "phone_not_confirmed"
      : !hasIdentity
        ? "identity_not_loaded"
        : "consumer_id_missing";

  const activeReady = Boolean(hasConfirmedPhone && hasConsumerId);
  const activeMasked = confirm?.masked || null;
  const activeName = identity?.displayName ? String(identity.displayName) : "";

  return (
    <div style={{ maxWidth: 980, paddingBottom: 24 }}>
      <div style={styles.topRow}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: -0.2 }}>POS Dashboard</div>
          <div style={{ color: "rgba(0,0,0,0.65)", fontWeight: 700, marginTop: 2 }}>
            Phone → customer identity → visit/reward.
          </div>
        </div>

        <div style={styles.topActions}>
          <button
            onClick={() => refreshAll({ reason: "manual_click" })}
            disabled={busy}
            style={{ ...styles.secondaryBtn, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>

          <button onClick={onEndShift} style={styles.dangerBtn}>
            End Shift
          </button>
        </div>
      </div>

      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <span style={styles.dot(isProvisioned)} />
          <span style={styles.statusMain}>
            {labelLine} · {storeLine} · {isProvisioned ? "Ready" : "Not ready"}
          </span>
        </div>
        <div style={styles.statusRight}>{statusText}</div>
      </div>

      {activeReady ? (
        <div style={styles.activeBanner}>
          <div style={styles.activeBannerLeft}>
            <div style={{ fontWeight: 950 }}>Active customer</div>
            <div style={{ marginTop: 4, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{activeMasked || "—"}</div>
              {activeName ? (
                <div style={{ fontWeight: 900, color: "rgba(0,0,0,0.75)" }}>{activeName}</div>
              ) : (
                <div style={{ fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>Name on file</div>
              )}
            </div>
          </div>

          <div style={styles.activeBannerRight}>
            <button onClick={onChangeCustomer} disabled={busy} style={styles.activeBannerBtn}>
              Change customer
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div style={styles.inlineError}>{error}</div> : null}

      {lastActionMsg ? (
        <div style={styles.lastAction}>
          <div style={{ fontWeight: 950 }}>✅ {lastActionMsg}</div>
          <div style={{ color: "rgba(0,0,0,0.65)", fontWeight: 700 }}>
            Tip: If Today/Recent don’t update immediately, press Refresh.
          </div>
        </div>
      ) : null}

      <div style={styles.grid2}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Register / Reward</div>
          <div style={{ color: "rgba(0,0,0,0.70)", fontWeight: 850 }}>
            Enter the customer’s phone number. We will preview identity first.
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={styles.smallLabel}>Phone number</div>
              <input
                ref={phoneInputRef}
                className="pvInput"
                value={pretty || phoneInput}
                onChange={(e) => {
                  const nextDigits = normalizePhoneDigits(e.target.value);
                  setPhoneInput(nextDigits);

                  if (confirm) {
                    setConfirm(null);
                    pvUiHook("pos.dashboard.flow.confirm_invalidated.ui", {
                      tc: "TC-POS-13-EDIT-02",
                      sev: "info",
                      stable: "pos:dash",
                      reason: "typing",
                    });
                  }
                  clearIdentityState();
                }}
                placeholder=""
                style={styles.input}
                inputMode="tel"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canConfirm) onConfirmPhone();
                }}
              />

              {/* Combined helper line */}
              <div style={styles.helperLine}>Example: (555) 123-4567 • 10 digits required</div>
            </div>

            {!confirm ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={onConfirmPhone}
                  disabled={confirmDisabled}
                  style={{
                    ...(confirmDisabled ? styles.primaryDisabledBtn : styles.primaryBtn),
                    cursor: confirmDisabled ? "not-allowed" : "pointer",
                  }}
                >
                  Confirm
                </button>

                <button onClick={onClearEntry} disabled={busy} style={styles.ghostBtn}>
                  Clear
                </button>
              </div>
            ) : (
              <div style={styles.confirmPanel}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 14 }}>
                      {activeReady ? "Customer confirmed" : "Phone confirmed"}
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 950, fontSize: 16 }}>{confirm.masked || "—"}</div>
                    <div style={styles.metaLine}>Confirmed: {formatLocal(confirm.createdAt)}</div>
                    {activeReady ? (
                      <div style={{ marginTop: 6, color: "rgba(0,0,0,0.65)", fontWeight: 850 }}>
                        Use Register Visit / Grant Reward below.
                      </div>
                    ) : null}
                  </div>

                  <button onClick={onEditConfirmedPhone} disabled={busy} style={styles.ghostBtn}>
                    Edit
                  </button>
                </div>

                {!activeReady ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {!identity ? (
                      <div style={styles.panelText}>Previewing customer…</div>
                    ) : identity.found ? (
                      <div style={styles.identityOk}>
                        <div style={{ fontWeight: 950 }}>✅ Customer found</div>
                        <div style={{ fontWeight: 900, color: "rgba(0,0,0,0.75)", marginTop: 4 }}>
                          {identity.displayName || "Name on file"}
                        </div>
                      </div>
                    ) : (
                      <div style={styles.identityCreate}>
                        <div style={{ fontWeight: 950 }}>🆕 New customer</div>
                        <div style={{ color: "rgba(0,0,0,0.65)", fontWeight: 800, marginTop: 4 }}>
                          No customer found for this phone. Create one to proceed.
                        </div>

                        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={styles.smallLabel}>First name (required)</div>
                            <input
                              className="pvInput"
                              value={createFirstName}
                              onChange={(e) => setCreateFirstName(e.target.value)}
                              placeholder="First name"
                              style={styles.input}
                              disabled={busy}
                              autoComplete="off"
                            />
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            <div style={styles.smallLabel}>Last name (optional)</div>
                            <input
                              className="pvInput"
                              value={createLastName}
                              onChange={(e) => setCreateLastName(e.target.value)}
                              placeholder="Last name"
                              style={styles.input}
                              disabled={busy}
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                          <button
                            onClick={onCreateCustomer}
                            disabled={busy}
                            style={{ ...styles.secondaryStrongBtn, padding: "12px 14px" }}
                          >
                            Create customer
                          </button>
                          <button onClick={onClearEntry} disabled={busy} style={styles.ghostBtn}>
                            Start over
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    onClick={onGoVisit}
                    aria-disabled={ctaGated ? "true" : "false"}
                    style={{
                      ...(ctaGated ? styles.primaryDisabledBtn : styles.primaryBtn),
                      padding: "14px 14px",
                      cursor: ctaGated ? "not-allowed" : "pointer",
                    }}
                    title={
                      ctaGated
                        ? "Confirm a customer first (phone + identity must resolve)."
                        : "Register a visit for the active customer."
                    }
                  >
                    Register Visit
                  </button>

                  <button
                    onClick={onGoReward}
                    aria-disabled={ctaGated ? "true" : "false"}
                    style={{
                      ...(ctaGated ? styles.secondaryDisabledBtn : styles.secondaryStrongBtn),
                      padding: "14px 14px",
                      cursor: ctaGated ? "not-allowed" : "pointer",
                    }}
                    title={
                      ctaGated
                        ? "Confirm a customer first (phone + identity must resolve)."
                        : "Grant a reward for the active customer."
                    }
                  >
                    Grant Reward
                  </button>
                </div>

                {/* Bundles — always accessible, no identity gate */}
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => {
                      pvUiHook("pos.dashboard.go_bundles_clicked.ui", {
                        tc: "TC-POS-DASH-BUNDLES-01",
                        sev: "info",
                        stable: "pos:dashboard",
                      });
                      navigate("/merchant/pos/bundles");
                    }}
                    style={{ ...styles.secondaryBtn, padding: "12px 14px", width: "100%", cursor: "pointer" }}
                  >
                    Bundle Sell & Redeem
                  </button>
                </div>

                <div style={styles.metaLine}>
                  {ctaGated
                    ? `Visit/Reward are disabled until identity is resolved (reason: ${ctaGateReason}).`
                    : "Customer identity is carried forward (visit/reward pages will show name when present)."}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelTitle}>Today</div>

          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
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
                {today.updatedAt ? <div style={styles.metaLine}>Updated: {formatLocal(today.updatedAt)}</div> : null}
                {today.fetchedAt ? <div style={styles.metaLine}>Refreshed: {formatLocal(today.fetchedAt)}</div> : null}
              </div>
            ) : (
              <div style={styles.panelText}>Press Refresh to load today’s stats.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div style={styles.panel}>
          <div style={styles.panelTitleRow}>
            <div style={styles.panelTitle}>Recent Activity</div>

            <button
              onClick={() => {
                setRecentOpen((v) => !v);
                pvUiHook("pos.dashboard.recent.toggle_clicked.ui", {
                  tc: "TC-POS-DASH-RECENT-TOGGLE-01",
                  sev: "info",
                  stable: "pos:dash",
                  open: !recentOpen,
                });
              }}
              style={styles.disclosureBtn}
              disabled={busy}
            >
              {recentOpen ? "Hide" : "Show"} ({recentCount})
            </button>
          </div>

          {!recentOpen ? (
            <div style={styles.panelText}>Collapsed to keep the dashboard simple.</div>
          ) : recentCount ? (
            <div style={{ marginTop: 10 }}>
              <div style={styles.activityHeader}>
                <div style={{ minWidth: 80 }}>TYPE</div>
                <div>IDENTIFIER</div>
                <div style={{ marginLeft: "auto" }}>TIME</div>
              </div>

              <div style={styles.activityScroll}>
                {shownItems.map((it, idx) => (
                  <div key={`${it.type || "x"}-${it.id || idx}`} style={styles.activityRow}>
                    <div style={{ fontWeight: 950, minWidth: 80 }}>{String(it.type || "").toUpperCase()}</div>
                    <div style={{ fontWeight: 850, color: "rgba(0,0,0,0.75)" }}>
                      {it.identifierMasked || it.identifier || "—"}
                    </div>
                    <div style={{ marginLeft: "auto", color: "rgba(0,0,0,0.55)", fontWeight: 850, fontSize: 12 }}>
                      {formatLocal(it.at || it.ts) || ""}
                    </div>
                  </div>
                ))}
              </div>

              {recent.fetchedAt ? <div style={styles.metaLine}>Refreshed: {formatLocal(recent.fetchedAt)}</div> : null}
            </div>
          ) : (
            <div style={styles.panelText}>No recent activity yet. Press Refresh after a visit/reward.</div>
          )}
        </div>
      </div>

      <div style={styles.footer}>
        POS associate: visit/reward only. This page never shows access tokens or raw server payloads.
      </div>
    </div>
  );
}

const styles = {
  topRow: {
    marginTop: 6,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  statusBar: {
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  statusLeft: { display: "flex", alignItems: "center", gap: 8 },
  statusMain: { fontWeight: 900, color: "rgba(0,0,0,0.75)" },
  statusRight: { fontWeight: 850, color: "rgba(0,0,0,0.55)" },
  dot: (ok) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: ok ? "rgba(0,160,0,0.85)" : "rgba(255,160,0,0.95)",
    boxShadow: "0 0 0 2px rgba(0,0,0,0.06)",
    display: "inline-block",
  }),

  activeBanner: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.03)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  activeBannerLeft: { display: "grid", gap: 4 },
  activeBannerRight: { display: "flex", alignItems: "center", gap: 10 },
  activeBannerBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 950,
  },

  secondaryBtn: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    fontWeight: 900,
  },
  dangerBtn: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,0,0,0.35)",
    background: "rgba(255,0,0,0.06)",
    cursor: "pointer",
    fontWeight: 950,
  },

  inlineError: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    fontWeight: 850,
    color: "rgba(140,0,0,1)",
    whiteSpace: "pre-wrap",
  },

  lastAction: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(0,140,0,0.28)",
    background: "rgba(0,170,0,0.10)",
    display: "grid",
    gap: 6,
  },

  grid2: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  card: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  cardTitle: { fontWeight: 950, marginBottom: 10 },

  panel: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  panelTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  panelTitle: { fontWeight: 950, marginBottom: 6 },
  panelText: { color: "rgba(0,0,0,0.65)", fontWeight: 700 },

  disclosureBtn: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "black",
    color: "white",
    fontWeight: 950,
  },

  primaryDisabledBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(0,0,0,0.05)",
    color: "rgba(0,0,0,0.55)",
    fontWeight: 950,
  },

  secondaryStrongBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    color: "black",
    fontWeight: 950,
  },

  secondaryDisabledBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(0,0,0,0.02)",
    color: "rgba(0,0,0,0.55)",
    fontWeight: 950,
  },

  ghostBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(0,0,0,0.02)",
    cursor: "pointer",
    fontWeight: 950,
  },

  input: {
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    outline: "none",
    fontSize: 14,
    fontWeight: "inherit",
    color: "inherit",
  },

  helperLine: {
    color: "rgba(0,0,0,0.55)",
    fontWeight: 750,
    fontSize: 12,
    marginTop: 6,
  },

  identityOk: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,140,0,0.20)",
    background: "rgba(0,170,0,0.08)",
  },

  identityCreate: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,160,0,0.25)",
    background: "rgba(255,160,0,0.06)",
  },

  smallLabel: { color: "rgba(0,0,0,0.60)", fontWeight: 950, fontSize: 12 },

  confirmPanel: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
  },

  kvRow2: { display: "grid", gridTemplateColumns: "90px 1fr", gap: 10, alignItems: "center" },
  k2: { color: "rgba(0,0,0,0.65)", fontWeight: 950 },
  v2: { fontWeight: 950, fontSize: 18 },

  activityHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 2px",
    color: "rgba(0,0,0,0.45)",
    fontSize: 12,
    fontWeight: 950,
  },

  activityScroll: {
    maxHeight: 260,
    overflowY: "auto",
    paddingRight: 4,
    marginTop: 8,
    display: "grid",
    gap: 8,
  },

  activityRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.01)",
  },

  metaLine: { color: "rgba(0,0,0,0.5)", fontSize: 12, fontWeight: 850 },
  footer: { marginTop: 18, color: "rgba(0, 0, 0, 0.5)", fontSize: 13, fontWeight: 700 },
};
