// src/api/client.js

export const API_BASE = (import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

/* =============================================================
   API Stability: single-flight + short TTL cache (Thread: api-stability-v1)
   - Coalesce concurrent /me calls
   - Short TTL cache (3s) scoped to current JWT
   - Coalesce concurrent /merchant/stores calls
   - Hard reset on logout/token clear
============================================================= */

const __ME_TTL_MS = 3000;

let __meCache = null;           // { token, ts, data }
let __meInFlight = null;        // Promise
let __storesInFlight = null;    // Promise

function __clearApiStabilityCaches() {
  __meCache = null;
  __meInFlight = null;
  __storesInFlight = null;
}



// Storage keys (canonical)
const ADMIN_KEY_STORAGE = "perkvalet_admin_api_key";
const JWT_STORAGE = "perkvalet_access_token";
const SYSTEM_ROLE_STORAGE = "perkvalet_system_role";

// Security-V1: stable device id for trusted-device flow
const PV_DEVICE_ID_STORAGE = "perkvalet_device_id";

// NOTE: This device id is intentionally NOT cleared by pvClearSession().
// It must remain stable across tabs and re-logins so device-trust works after email redirects.

// Cross-tab sync channel
export const AUTH_BC_NAME = "perkvalet_auth";

// All known PerkValet localStorage keys (wipe as one unit)
export const PV_LOCAL_KEYS = [
  // auth + routing
  ADMIN_KEY_STORAGE,
  JWT_STORAGE,
  SYSTEM_ROLE_STORAGE,
  "perkvalet_system_role_raw",
  "perkvalet_landing",

  // Security-V1

  // POS legacy flag
  "perkvalet_is_pos",

  // POS legacy details
  "perkvalet_pos_store_label",
  "perkvalet_pos_store_id",
  "perkvalet_pos_assoc_label",

  // POS-8A/8B-ish “dingle berries” seen in your screenshots
  "perkvalet_pos_authed_merchant_id",
  "perkvalet_pos_authed_store_id",
  "perkvalet_pos_authed_terminal_id",
  "perkvalet_pos_terminal_id",
  "perkvalet_pos_terminal_label",
  "perkvalet_pos_last_action",
  "perkvalet_pos_needs_refresh",
];

// Session storage keys (tab-scoped)
export const PV_SESSION_KEYS = ["perkvalet_return_to"];

// Support / diagnostics (tab-scoped, best-effort)
const PV_SUPPORT_API_LOG_KEY = "perkvalet_support_api_log";
const PV_SUPPORT_LAST_ERROR_KEY = "perkvalet_support_last_error";
const PV_SUPPORT_LAST_SUCCESS_TS_KEY = "perkvalet_support_last_success_ts";
const PV_SUPPORT_LAST_REQUEST_KEY = "perkvalet_support_last_request";
const PV_SUPPORT_MERCHANT_ID_KEY = "pv_support.merchantId";
const PV_SUPPORT_MAX_API_EVENTS = 60;

/* -----------------------------
   Cross-tab broadcast helper
-------------------------------- */
export function pvBroadcast(type, fields = {}) {
  try {
    const bc = new BroadcastChannel(AUTH_BC_NAME);
    bc.postMessage({ type, ts: new Date().toISOString(), ...fields });
    bc.close();
  } catch {
    // ignore (older browsers)
  }
}

/* -----------------------------
   One true “clear session”
-------------------------------- */
export function pvClearSession({ reason = "clear", broadcast = true } = {}) {
  // localStorage wipe (only our keys; do NOT nuke everything)
  try {
    PV_LOCAL_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }

  // sessionStorage wipe (only our keys)
  try {
    PV_SESSION_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }

  if (broadcast) {
    pvBroadcast("session_cleared", { reason });
  }
}

/* -----------------------------
   Token / key handling
-------------------------------- */

export function getAdminKey() {
  return localStorage.getItem(ADMIN_KEY_STORAGE) || "";
}

export function setAdminKey(key) {
  localStorage.setItem(ADMIN_KEY_STORAGE, key || "");
}

export function clearAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
}

export function getAccessToken() {
  return localStorage.getItem(JWT_STORAGE) || "";
}

export function setAccessToken(token) {
  localStorage.setItem(JWT_STORAGE, token || "");
}

export function clearAccessToken() {
  __clearApiStabilityCaches();
  localStorage.removeItem(JWT_STORAGE);
}

export function getSystemRole() {
  return localStorage.getItem(SYSTEM_ROLE_STORAGE) || "";
}

function assertNotPvAdminForMerchantCall(endpointPath) {
  const role = getSystemRole();
  if (role === "pv_admin") {
    throw new Error(`Forbidden in pv_admin session: attempted merchant endpoint ${endpointPath}`);
  }
}

/* -----------------------------
   Security-V1: device id handling
-------------------------------- */

function pvGenerateUuid() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }

  // Fallback UUID v4-ish (good enough for client-side stable id)
  try {
    const buf = new Uint8Array(16);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(buf);
    } else {
      for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    // Per RFC 4122
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;

    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    // last resort
    return `pv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function getDeviceId() {
  try {
    const existing = localStorage.getItem(PV_DEVICE_ID_STORAGE);
    if (existing && String(existing).trim()) return existing;
  } catch {
    // ignore
  }

  const id = pvGenerateUuid();

  try {
    localStorage.setItem(PV_DEVICE_ID_STORAGE, id);
  } catch {
    // ignore
  }

  return id;
}

export function clearDeviceId() {
  try {
    localStorage.removeItem(PV_DEVICE_ID_STORAGE);
  } catch {
    // ignore
  }
}

/* -----------------------------
   Support helpers (best-effort)
-------------------------------- */

function pvSupportNowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function pvSupportSafeGetSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function pvSupportSafeSetSession(key, val) {
  try {
    sessionStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function pvSupportSafeJsonParse(s, fallback) {
  try {
    if (!s) return fallback;
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function pvSupportGetApiLog() {
  const raw = pvSupportSafeGetSession(PV_SUPPORT_API_LOG_KEY);
  const arr = pvSupportSafeJsonParse(raw, []);
  return Array.isArray(arr) ? arr : [];
}

function pvSupportAppendApiEvent(evt) {
  // Safety: keep meta-only fields (no bodies/tokens/headers)
  try {
    const safe = {
      ts: evt?.ts ? String(evt.ts) : pvSupportNowIso(),
      direction: evt?.direction ? String(evt.direction) : "out",
      method: evt?.method ? String(evt.method) : "",
      path: evt?.path ? String(evt.path) : "",
      status: evt?.status == null ? null : Number(evt.status),
      ms: evt?.ms == null ? null : Number(evt.ms),
    };
    // optional meta (string only, short) — still safe, and ignored by UI if absent
    if (evt?.error) safe.error = String(evt.error).slice(0, 180);

    const arr = pvSupportGetApiLog();
    arr.push(safe);
    while (arr.length > PV_SUPPORT_MAX_API_EVENTS) arr.shift();
    pvSupportSafeSetSession(PV_SUPPORT_API_LOG_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function pvSupportSetLastError(msg) {
  try {
    pvSupportSafeSetSession(
      PV_SUPPORT_LAST_ERROR_KEY,
      JSON.stringify({ ts: pvSupportNowIso(), message: String(msg || "") })
    );
  } catch {
    // ignore
  }
}

function pvSupportClearLastError() {
  try {
    // Removing the key represents a clean/healthy state.
    sessionStorage.removeItem(PV_SUPPORT_LAST_ERROR_KEY);
  } catch {
    // ignore
  }
}

function pvSupportSetMerchantId(val) {
  try {
    const s = val == null ? "" : String(val).trim();
    if (!s) {
      sessionStorage.removeItem(PV_SUPPORT_MERCHANT_ID_KEY);
      return;
    }
    sessionStorage.setItem(PV_SUPPORT_MERCHANT_ID_KEY, s);
  } catch {
    // ignore
  }
}

export function pvSupportGetMerchantId() {
  try {
    return String(sessionStorage.getItem(PV_SUPPORT_MERCHANT_ID_KEY) || "");
  } catch {
    return "";
  }
}



function pvSupportSetLastSuccessTs() {
  try {
    pvSupportSafeSetSession(PV_SUPPORT_LAST_SUCCESS_TS_KEY, pvSupportNowIso());
  } catch {
    // ignore
  }
}

function pvSupportSetLastRequest({ method = "", path = "", status = null, ms = null, error = "" } = {}) {
  try {
    const obj = {
      ts: pvSupportNowIso(),
      method: method ? String(method) : "",
      path: path ? String(path) : "",
      status: status == null ? null : Number(status),
      ms: ms == null ? null : Number(ms),
      error: error ? String(error) : null,
    };
    pvSupportSafeSetSession(PV_SUPPORT_LAST_REQUEST_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function pvSupportGetLastRequest() {
  const raw = pvSupportSafeGetSession(PV_SUPPORT_LAST_REQUEST_KEY);
  const obj = pvSupportSafeJsonParse(raw, null);
  if (!obj || typeof obj !== "object") return null;
  return {
    ts: obj.ts ? String(obj.ts) : null,
    method: obj.method ? String(obj.method) : null,
    path: obj.path ? String(obj.path) : null,
    status: obj.status == null ? null : Number(obj.status),
    ms: obj.ms == null ? null : Number(obj.ms),
    error: obj.error ? String(obj.error) : null,
  };
}

function pvSupportGetLastError() {
  const raw = pvSupportSafeGetSession(PV_SUPPORT_LAST_ERROR_KEY);
  const obj = pvSupportSafeJsonParse(raw, null);
  if (!obj || typeof obj !== "object") return null;
  return {
    ts: obj.ts ? String(obj.ts) : null,
    message: obj.message ? String(obj.message) : null,
  };
}

function pvSupportGetLastSuccessTs() {
  const raw = pvSupportSafeGetSession(PV_SUPPORT_LAST_SUCCESS_TS_KEY);
  return raw ? String(raw) : null;
}

/**
 * Support panel: read last N outbound API events (best-effort, tab-scoped).
 * This is outbound-only (what the browser called). We do not have inbound server logs here.
 */
export function pvSupportGetRecentApiEvents(arg = {}) {
  // Back-compat: allow pvSupportGetRecentApiEvents(10)
  const limit = (typeof arg === "number" ? arg : arg?.limit) ?? 25;
  const n = Math.max(0, Math.min(200, Number(limit) || 0));
  const arr = pvSupportGetApiLog();
  if (n === 0) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

/**
 * Support panel: produce a snapshot of client-side diagnostics.
 * Safe to call anytime; never throws.
 */
export function pvSupportGetSnapshot() {
  try {
    const systemRole = getSystemRole() || "";
    const email =
      (() => {
        try {
          // some pages stash "me" response; if not present, we'll just return blank
          return "";
        } catch {
          return "";
        }
      })() || "";

    const route =
      (() => {
        try {
          return window?.location?.pathname || "";
        } catch {
          return "";
        }
      })() || "";

    const page =
      (() => {
        try {
          return document?.title || "";
        } catch {
          return "";
        }
      })() || "";

    const jwtPresent = Boolean(getAccessToken());
    const deviceIdMasked = (() => {
      try {
        const d = getDeviceId();
        const s = d ? String(d) : "";
        if (!s) return "";
        if (s.length <= 10) return `${s.slice(0, 3)}…`;
        return `${s.slice(0, 6)}…${s.slice(-4)}`;
      } catch {
        return "";
      }
    })();

    const viewport = (() => {
      try {
        return { w: window.innerWidth, h: window.innerHeight };
      } catch {
        return null;
      }
    })();

    const userAgent = (() => {
      try {
        return navigator?.userAgent || "";
      } catch {
        return "";
      }
    })();

    const lastErrorObj = pvSupportGetLastError();


    return {
      session: {
        systemRole,
        email,
        route,
        page,
        merchantId: null,
        storeId: null,
      },
      authDevice: {
        jwtPresent,
        deviceIdMasked,
        deviceVerificationRequired: null,
      },
      environment: {
        API_BASE,
        build: (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE) ? import.meta.env.MODE : "",
        viewport,
        userAgent,
      },
      api: {
        lastError: lastErrorObj?.message ?? null,
        lastErrorTs: lastErrorObj?.ts ?? null,
        lastSuccessTs: pvSupportGetLastSuccessTs(),
        lastRequest: pvSupportGetLastRequest(),
        recentEvents: pvSupportGetRecentApiEvents({ limit: 25 }),
      },
      // Convenience top-level fields for UI consumers
      lastError: pvSupportGetLastError(),
      lastSuccessTs: pvSupportGetLastSuccessTs(),
      lastRequest: (() => {
        const lr = pvSupportGetLastRequest();
        if (!lr) return null;
        const st = lr.status != null ? `HTTP ${lr.status}` : (lr.error ? "ERR" : "—");
        const ms = lr.ms != null ? ` (${lr.ms}ms)` : "";
        const mp = `${lr.method || ""} ${lr.path || ""}`.trim();
        return `${mp} → ${st}${ms}`.trim();
      })(),
    };
  } catch {
    return {
      session: {},
      authDevice: {},
      environment: { API_BASE },
      api: { lastError: null, lastErrorTs: null, recentEvents: pvSupportGetRecentApiEvents({ limit: 25 }) },
      lastError: pvSupportGetLastError(),
      lastSuccessTs: pvSupportGetLastSuccessTs(),
      lastRequest: null,
    };
  }
}

/* -----------------------------
   Core request helper
-------------------------------- */

async function request(path, { method = "GET", headers = {}, body, auth = "auto" } = {}) {

  // Guardrail: prevent common API contract mistakes
  if (typeof body === "string") {
    throw new Error("client.js guardrail: body must be an object, not JSON.stringify(). The request() helper serializes automatically.");
  }

  // Guardrail: merchant user PATCH must include merchantId in body
  if (method === "PATCH" && path.startsWith("/merchant/users")) {
    if (!body || typeof body !== "object" || !("merchantId" in body)) {
      throw new Error("client.js guardrail: PATCH /merchant/users requires merchantId in the request body.");
    }
  }
  const url = `${API_BASE}${path}`;
  const h = new Headers(headers);

  h.set("Accept", "application/json");

  let payload = body;
  if (body && typeof body === "object" && !(body instanceof FormData)) {
    h.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  // Security-V1: attach device id for all non-guest calls
  if (auth !== "none") {
    try {
      h.set("X-PV-Device-Id", getDeviceId());
    } catch {
      // never break requests for device id issues
    }
  }

  // auth modes:
  // - "auto": send both if present (JWT + admin key)
  // - "admin": x-api-key only
  // - "jwt": Authorization only
  // - "none": send no auth headers (guest endpoints)

  if (auth !== "none" && (auth === "auto" || auth === "admin")) {
    const key = getAdminKey();
    if (key) h.set("x-api-key", key);
  }

  if (auth !== "none" && (auth === "auto" || auth === "jwt")) {
    const tok = getAccessToken();
    if (tok) h.set("Authorization", `Bearer ${tok}`);
  }

  const t0 = (() => {
    try {
      return (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
    } catch {
      return Date.now();
    }
  })();

  // Support panel: log outbound call (best-effort, meta only; never bodies/tokens)
  try {
    pvSupportAppendApiEvent({
      ts: pvSupportNowIso(),
      direction: "out",
      method,
      path,
      status: null,
      ms: null,
    });
    pvSupportSetLastRequest({ method, path, status: null, ms: null });
  } catch {
    // ignore
  }

  let res;
  try {
    res = await fetch(url, { method, headers: h, body: payload });
  } catch (e) {
    const t1 = (() => {
      try {
        return (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
      } catch {
        return Date.now();
      }
    })();
    const ms = Math.max(0, Math.round(Number(t1 - t0) || 0));

    try {
      pvSupportAppendApiEvent({
        ts: pvSupportNowIso(),
        direction: "in",
        method,
        path,
        status: null,
        ms,
        error: e?.message ? String(e.message) : "network_error",
      });
      pvSupportSetLastRequest({
        method,
        path,
        status: null,
        ms,
        error: e?.message ? String(e.message) : "network_error",
      });
      pvSupportSetLastError(e?.message ? String(e.message) : "Network error");
    } catch {
      // ignore
    }

    throw e;
  }

  const t1 = (() => {
    try {
      return (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
    } catch {
      return Date.now();
    }
  })();
  const ms = Math.max(0, Math.round(Number(t1 - t0) || 0));

  // Support panel: log inbound response (best-effort)
  try {
    pvSupportAppendApiEvent({
      ts: pvSupportNowIso(),
      direction: "in",
      method,
      path,
      status: res?.status ?? null,
      ms,
    });
    pvSupportSetLastRequest({ method, path, status: res?.status ?? null, ms });
  } catch {
    // ignore
  }


  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const msg = retryAfter ? `Rate limited. Retry after ${retryAfter}s.` : "Rate limited.";
    pvSupportSetLastError(msg);
    throw new Error(msg);
  }

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (isJson) {
      const data = await res.json().catch(() => null);
      if (data?.error?.message) msg = data.error.message;
      if (data?.message && !data?.error?.message) msg = String(data.message);
    } else {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }

    // record last error for support panel
    pvSupportSetLastError(msg);

    // If token is revoked/expired: clear session consistently.
    // BUT: do not nuke the whole session for every 401, because some endpoints may
    // temporarily return 401 due to wiring/role gates (ex: invoices) while the token
    // is still valid for the rest of the app.
    if (res.status === 401) {
      const lower = String(msg || "").toLowerCase();

      const jwtSent = auth !== "none" && (auth === "jwt" || auth === "auto") && Boolean(getAccessToken());

      // Strong signals the JWT is actually invalid/expired.
      const looksLikeTokenProblem =
        lower.includes("expired") ||
        lower.includes("invalid token") ||
        lower.includes("jwt") ||
        lower.includes("token") ||
        path === "/me";

      if (jwtSent && looksLikeTokenProblem) {
        pvClearSession({ reason: "http_401_token_invalid", broadcast: true });
      } else {
        // Soft 401: keep session; let the calling page show the error.
        // (Useful during rollout when some routes are gated/miswired.)
        pvBroadcast("auth_401_soft", { path, auth, msg });
      }
    }

    throw new Error(msg);
  }

  // success marker for support panel
  pvSupportSetLastSuccessTs();
  pvSupportClearLastError();

  return isJson ? res.json() : res;
}

/* -----------------------------
   JWT Auth (browser login)
-------------------------------- */

export async function login(email, password) {
  const result = await request("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: "auto",
  });

  // Security-V1: privileged users on untrusted devices may receive:
  // { requiresDeviceVerification: true } and MAY OR MAY NOT include accessToken
  // depending on backend policy. Support both safely.
  if (result?.requiresDeviceVerification) {
    if (result?.accessToken) {
      setAccessToken(result.accessToken);
    } else {
      // Ensure we do not accidentally keep a stale token from a prior session
      clearAccessToken();
    }
    pvBroadcast("login_requires_device_verification", {});
    return result;
  }

  if (!result?.accessToken) throw new Error("Login failed: missing accessToken");
  setAccessToken(result.accessToken);

  // tell other tabs “a login happened” so they can re-render if needed
  pvBroadcast("login", {});
  return result;
}

export async function me() {
  const token = getAccessToken() || "";
  const now = Date.now();

  // TTL cache hit
  if (
    __meCache &&
    __meCache.token === token &&
    now - __meCache.ts < __ME_TTL_MS
  ) {
    return __meCache.data;
  }

  // Join in-flight request
  if (__meInFlight) {
    return __meInFlight;
  }

  __meInFlight = (async () => {
    try {
      const res = await request("/me", { auth: "jwt" });

      try {
        const mid =
          res?.user?.merchantUsers?.[0]?.merchantId ??
          res?.user?.merchantUsers?.[0]?.merchant?.id ??
          res?.user?.merchantId ??
          res?.merchantId ??
          "";
        pvSupportSetMerchantId(mid);
      } catch {
        // ignore
      }

      __meCache = { token, ts: Date.now(), data: res };
      return res;
    } finally {
      __meInFlight = null;
    }
  })();

  return __meInFlight;
}


export async function logout() {
  __clearApiStabilityCaches();
  pvClearSession({ reason: "logout", broadcast: true });
}

/* -----------------------------
   Security-V1: device verification
-------------------------------- */

export async function startDeviceVerification({ returnTo } = {}) {
  const qs = new URLSearchParams();
  if (returnTo) qs.set("returnTo", String(returnTo));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/auth/device/start${suffix}`, { method: "POST", body: {}, auth: "jwt" });
}

export async function authDeviceStatus() {
  return request("/auth/device/status", { auth: "jwt" });
}

export async function authDeviceStart({ returnTo } = {}) {
  const rt = String(returnTo || "").trim();
  return request("/auth/device/start", {
    method: "POST",
    body: { ...(rt ? { returnTo: rt } : {}) },
    auth: "jwt",
  });
}

/* -----------------------------
   Password management
-------------------------------- */

export async function forgotPassword(email) {
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!emailNorm) throw new Error("Email is required");

  return request("/auth/forgot-password", {
    method: "POST",
    body: { email: emailNorm },
    auth: "none",
  });
}

export async function resetPassword(token, newPassword) {
  const t = String(token || "").trim();
  const pw = String(newPassword || "");
  if (!t) throw new Error("Reset token is required");
  if (!pw) throw new Error("New password is required");

  return request("/auth/reset-password", {
    method: "POST",
    body: { token: t, newPassword: pw },
    auth: "none",
  });
}

export async function changePassword(currentPassword, newPassword) {
  const cur = String(currentPassword || "");
  const pw = String(newPassword || "");
  if (!cur) throw new Error("Current password is required");
  if (!pw) throw new Error("New password is required");

  const result = await request("/auth/change-password", {
    method: "POST",
    body: { currentPassword: cur, newPassword: pw },
    auth: "jwt",
  });

  // force re-login
  pvClearSession({ reason: "password_changed", broadcast: true });
  return result;
}

/* -----------------------------
   Admin debug
-------------------------------- */

export async function whoAmI() {
  return request("/whoami", { auth: "admin" });
}

/* -----------------------------
   Merchants (admin)
-------------------------------- */

export async function listMerchants({ status = "active" } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/merchants${suffix}`, { auth: "auto" });
}

export async function getMerchant(merchantId) {
  return request(`/merchants/${merchantId}`, { auth: "auto" });
}

export async function createMerchant({ name, merchantType }) {
  return request("/merchants", { method: "POST", body: { name, merchantType: merchantType || null }, auth: "auto" });
}

// pv_admin: set/update merchantType on any merchant
export async function updateMerchantType(merchantId, merchantType) {
  return request(`/merchants/${encodeURIComponent(String(merchantId))}`, {
    method: "PATCH",
    body: { merchantType },
    auth: "auto",
  });
}

// merchant owner/admin: update their own merchant type
export async function merchantUpdateType(merchantType) {
  assertNotPvAdminForMerchantCall("/merchant/type");
  return request("/merchant/type", {
    method: "PATCH",
    body: { merchantType },
    auth: "jwt",
  });
}

export async function updateMerchantStatus(merchantId, { status, statusReason }) {
  return request(`/merchants/${merchantId}`, {
    method: "PATCH",
    body: { status, statusReason },
    auth: "auto",
  });
}

/* -----------------------------
   Stores (admin)
-------------------------------- */

export async function createStore(data) {
  return request("/stores", { method: "POST", body: data, auth: "auto" });
}

export async function getStore(storeId) {
  return request(`/stores/${storeId}`, { auth: "auto" });
}

export async function updateStoreStatus(storeId, { status, statusReason }) {
  return request(`/stores/${storeId}`, {
    method: "PATCH",
    body: { status, statusReason },
    auth: "auto",
  });
}

export async function updateStore(storeId, { name, address1, city, state, postal }) {
  return request(`/stores/${storeId}`, {
    method: "PATCH",
    body: { name, address1, city, state, postal },
    auth: "auto",
  });
}

/* -----------------------------
   Store Team (admin)
-------------------------------- */

export async function adminGetStoreTeam(storeId) {
  return request(`/stores/${encodeURIComponent(String(storeId))}/team`, { auth: "auto" });
}

export async function adminAssignStoreTeam(storeId, { merchantUserId, permissionLevel }) {
  return request(`/stores/${encodeURIComponent(String(storeId))}/team/assign`, {
    method: "POST",
    body: { merchantUserId, permissionLevel },
    auth: "auto",
  });
}

export async function adminRemoveStoreTeamMember(storeUserId) {
  return request(`/stores/team/${encodeURIComponent(String(storeUserId))}`, {
    method: "DELETE",
    auth: "auto",
  });
}

/* -----------------------------
   Store QR (admin)
-------------------------------- */

export async function listStoreQrs(storeId) {
  return request(`/stores/${storeId}/qrs`, { auth: "auto" });
}

export async function mintStoreQr(storeId) {
  return request(`/stores/${storeId}/qrs`, { method: "POST", auth: "auto" });
}

export function getStoreQrPngUrl(storeId) {
  return `${API_BASE}/stores/${storeId}/qr.png`;
}

/* -----------------------------
   Merchant portal (JWT protected)
-------------------------------- */

export const MERCHANT_ROLE_VALUES = ["owner", "merchant_admin", "store_admin", "store_subadmin"];

export function normalizeMerchantRole(role) {
  const r = String(role || "").trim();
  return MERCHANT_ROLE_VALUES.includes(r) ? r : null;
}

export async function listMerchantStores() {
  assertNotPvAdminForMerchantCall("/merchant/stores");

  if (__storesInFlight) return __storesInFlight;

  __storesInFlight = (async () => {
    try {
      return await request("/merchant/stores", { auth: "jwt" });
    } finally {
      __storesInFlight = null;
    }
  })();

  return __storesInFlight;
}

export async function authMe() {
  // Alias for UI identity checks (preferred endpoint name in newer threads)
  return me();
}

export async function merchantCreateStore({ merchantId, name, address1, city, state } = {}) {
  assertNotPvAdminForMerchantCall("/merchant/stores");
  return request("/merchant/stores", {
    method: "POST",
    auth: "jwt",
    body: { merchantId, name, address1, city, state },
  });
}

export async function merchantUpdateStoreStatus(storeId, { status } = {}) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/${storeId}`);
  return request(`/merchant/stores/${storeId}`, {
    method: "PATCH",
    auth: "jwt",
    body: { status },
  });
}

/* ================================================================
   Merchant Store QR
================================================================ */

export async function generateMerchantStoreQr(storeId) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/${storeId}/qr/generate`);
  return request(`/merchant/stores/${storeId}/qr/generate`, {
    method: "POST",
    auth: "jwt",
  });
}

export async function merchantUpdateStoreProfile(
  storeId,
  {
    name,
    address1,
    city,
    state,
    postal,

    // Store contact / phone fields (Thread: store_phone_and_contact)
    phoneRaw,
    phoneE164,
    phoneCountry,

    contactName,
    contactEmail,
    contactPhoneRaw,
    contactPhoneE164,
    contactPhoneCountry,
  } = {}
) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/${storeId}/profile`);
  if (storeId == null) throw new Error("storeId is required");

  function normOpt(v, { upper = false } = {}) {
    if (v === undefined) return undefined; // not provided
    if (v === null) return null;
    const s0 = String(v || "").trim();
    if (!s0) return null;
    return upper ? s0.toUpperCase() : s0;
  }

  function normOptPhoneRaw(v, { maxLen = 20 } = {}) {
    if (v === undefined) return undefined; // not provided
    if (v === null) return null;
    const digits = String(v || "").replace(/\D+/g, "");
    if (!digits) return null;
    return digits.slice(0, maxLen);
  }

  const nameNorm = normOpt(name);
  if (name !== undefined && !nameNorm) throw new Error("name cannot be empty");

  const body = {
    ...(name !== undefined ? { name: nameNorm } : {}),
    ...(address1 !== undefined ? { address1: normOpt(address1) } : {}),
    ...(city !== undefined ? { city: normOpt(city) } : {}),
    ...(state !== undefined ? { state: normOpt(state, { upper: true }) } : {}),
    ...(postal !== undefined ? { postal: normOpt(postal) } : {}),

    ...(phoneRaw !== undefined ? { phoneRaw: normOptPhoneRaw(phoneRaw) } : {}),
    ...(phoneE164 !== undefined ? { phoneE164: normOpt(phoneE164) } : {}),
    ...(phoneCountry !== undefined ? { phoneCountry: normOpt(phoneCountry, { upper: true }) } : {}),

    ...(contactName !== undefined ? { contactName: normOpt(contactName) } : {}),
    ...(contactEmail !== undefined ? { contactEmail: normOpt(contactEmail) } : {}),
    ...(contactPhoneRaw !== undefined ? { contactPhoneRaw: normOptPhoneRaw(contactPhoneRaw) } : {}),
    ...(contactPhoneE164 !== undefined ? { contactPhoneE164: normOpt(contactPhoneE164) } : {}),
    ...(contactPhoneCountry !== undefined ? { contactPhoneCountry: normOpt(contactPhoneCountry, { upper: true }) } : {}),
  };

  if (!Object.keys(body).length) {
    throw new Error("Provide at least one store profile field to update");
  }

  return request(`/merchant/stores/${encodeURIComponent(String(storeId))}/profile`, {
    method: "PATCH",
    auth: "jwt",
    body,
  });
}

export async function merchantListUsers({ merchantId } = {}) {
  assertNotPvAdminForMerchantCall("/merchant/users");
  const qs = merchantId != null ? `?merchantId=${encodeURIComponent(String(merchantId))}` : "";
  return request(`/merchant/users${qs}`, { auth: "jwt" });
}

export async function merchantCreateUser(
  { merchantId, email, role, status, firstName, lastName, phoneRaw, phoneCountry } = {}
) {
  assertNotPvAdminForMerchantCall("/merchant/users");

  const emailNorm = String(email || "").trim().toLowerCase();
  if (!emailNorm) throw new Error("Email is required");

  const roleNorm = String(role || "").trim();
  if (!roleNorm) throw new Error("Role is required");

  const statusNorm = String(status || "active").trim();

  const body = { merchantId, email: emailNorm, role: roleNorm, status: statusNorm };

  // Optional identity fields (backend may ignore if not supported yet)
  if (firstName !== undefined) body.firstName = firstName === null ? null : String(firstName).trim() || null;
  if (lastName !== undefined) body.lastName = lastName === null ? null : String(lastName).trim() || null;
  if (phoneRaw !== undefined) body.phoneRaw = phoneRaw === null ? null : String(phoneRaw).trim() || null;
  if (phoneCountry !== undefined) body.phoneCountry = phoneCountry === null ? null : String(phoneCountry).trim() || null;

  return request("/merchant/users", {
    method: "POST",
    auth: "jwt",
    body,
  });
}

/**
 * Merchant HR (Thread: Merchant HR Model)
 * - Membership lifecycle: MerchantUser.status (active/suspended/archived)
 * - Store assignment lifecycle: StoreUser.status
 */
export async function merchantUpdateUserMembership(userId, { merchantId, role, status, reason } = {}) {
  assertNotPvAdminForMerchantCall(`/merchant/users/${userId}/membership`);
  if (userId == null) throw new Error("userId is required");
  if (merchantId == null) throw new Error("merchantId is required");

  return request(`/merchant/users/${encodeURIComponent(String(userId))}/membership`, {
    method: "PATCH",
    auth: "jwt",
    body: {
      merchantId,
      ...(role !== undefined ? { role } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(reason !== undefined ? { reason } : {}),
    },
  });
}

export async function merchantUpdateUserProfile(userId, merchantId, fields = {}) {
  assertNotPvAdminForMerchantCall(`/merchant/users/${userId}`);
  if (!userId) throw new Error("merchantUpdateUserProfile: userId is required");
  if (!merchantId) throw new Error("merchantUpdateUserProfile: merchantId is required");

  // Backend expects merchantId inside the PATCH body (not query string)
  return request(`/merchant/users/${encodeURIComponent(String(userId))}`, {
    method: "PATCH",
    auth: "jwt",
    body: {
      merchantId,
      ...fields
    },
  });
}

export async function merchantUpsertUserStoreAssignments(userId, { merchantId, assignments, reason } = {}) {
  assertNotPvAdminForMerchantCall(`/merchant/users/${userId}/stores`);
  if (userId == null) throw new Error("userId is required");
  if (merchantId == null) throw new Error("merchantId is required");
  if (!Array.isArray(assignments)) throw new Error("assignments must be an array");

  return request(`/merchant/users/${encodeURIComponent(String(userId))}/stores`, {
    method: "PUT",
    auth: "jwt",
    body: { merchantId, assignments, ...(reason !== undefined ? { reason } : {}) },
  });
}

/* -----------------------------
   Store Team (merchant portal)
-------------------------------- */

function pvApiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvApiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never throw
  }

  // Support panel: keep last N events (tab-scoped)
  try {
    pvSupportAppendApiEvent({
      ts: pvSupportNowIso(),
      kind: "pvApiHook",
      event,
      fields,
    });
  } catch {
    // ignore
  }
}

export async function merchantListStoreTeam(storeId) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/${storeId}/team`);
  if (storeId == null) throw new Error("storeId is required");

  pvApiHook("merchant.store.team.list.api", { storeId });

  return request(`/merchant/stores/${encodeURIComponent(String(storeId))}/team`, {
    auth: "jwt",
  });
}

export async function merchantAssignStoreTeamMember(storeId, { merchantUserId, permissionLevel } = {}) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/${storeId}/team`);
  if (storeId == null) throw new Error("storeId is required");
  if (merchantUserId == null) throw new Error("merchantUserId is required");
  if (!permissionLevel) throw new Error("permissionLevel is required");

  pvApiHook("merchant.store.team.assign.api", {
    storeId,
    merchantUserId,
    permissionLevel,
  });

  return request(`/merchant/stores/${encodeURIComponent(String(storeId))}/team/assign`, {
    method: "POST",
    auth: "jwt",
    body: { merchantUserId, permissionLevel },
  });
}

export async function merchantSetPrimaryContact(storeId, { primaryContactStoreUserId } = {}) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/${storeId}/team/primary-contact`);
  if (storeId == null) throw new Error("storeId is required");

  const body = {
    primaryContactStoreUserId:
      primaryContactStoreUserId === null
        ? null
        : Number(primaryContactStoreUserId),
  };

  pvApiHook("merchant.store.team.primary.api", {
    storeId,
    primaryContactStoreUserId: body.primaryContactStoreUserId,
  });

  return request(
    `/merchant/stores/${encodeURIComponent(String(storeId))}/team/primary-contact`,
    {
      method: "PATCH",
      auth: "jwt",
      body,
    }
  );
}

export async function merchantRemoveStoreTeamMember(storeUserId) {
  assertNotPvAdminForMerchantCall(`/merchant/stores/team/${storeUserId}`);
  if (storeUserId == null) throw new Error("storeUserId is required");

  pvApiHook("merchant.store.team.remove.api", { storeUserId });

  return request(`/merchant/stores/team/${encodeURIComponent(String(storeUserId))}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

/* -----------------------------
   Billing (v2.02.1)
-------------------------------- */

export async function adminListMerchantUsers(merchantId) {
  return request(`/admin/merchants/${merchantId}/users`, { auth: "auto" });
}

export async function adminGetMerchantUser(merchantUserId) {
  if (merchantUserId == null) throw new Error("merchantUserId is required");
  return request(`/admin/merchant-users/${encodeURIComponent(String(merchantUserId))}`, { auth: "auto" });
}

export async function adminCreateMerchantUser(merchantId, { email, firstName, lastName } = {}) {
  return request(`/admin/merchants/${merchantId}/users`, {
    method: "POST",
    auth: "auto",
    body: { email, firstName, lastName },
  });
}

export async function adminTransferOwnership(payload) {
  return request(`/admin/merchant/ownership-transfer`, {
    method: "POST",
    auth: "auto",
    body: payload,
  });
}

export async function adminGetMerchantBillingPolicy(merchantId) {
  return request(`/admin/merchants/${merchantId}/billing-policy`, { auth: "auto" });
}

export async function adminUpdateMerchantBillingPolicy(merchantId, overridesOrClear) {
  return request(`/admin/merchants/${merchantId}/billing-policy`, {
    method: "PUT",
    body: overridesOrClear,
    auth: "auto",
  });
}

export async function adminGenerateInvoice({ merchantId, totalCents, netTermsDays } = {}) {
  return request("/admin/billing/generate-invoice", {
    method: "POST",
    body: { merchantId, totalCents, netTermsDays },
    auth: "auto",
  });
}

export async function getBillingPolicy() {
  return request("/admin/billing-policy", { auth: "auto" });
}

export async function updateBillingPolicy(policy) {
  return request("/admin/billing-policy", { method: "PUT", body: policy, auth: "auto" });
}

export async function adminListInvoices({ merchantId, status, from, to } = {}) {
  const qs = new URLSearchParams();
  if (merchantId != null) qs.set("merchantId", String(merchantId));
  if (status) qs.set("status", status);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/admin/invoices${suffix}`, { auth: "auto" });
}

export async function adminGetInvoice(invoiceId) {
  return request(`/admin/invoices/${invoiceId}`, { auth: "auto" });
}

export async function adminIssueInvoice(invoiceId, { netTermsDays } = {}) {
  return request(`/admin/invoices/${invoiceId}/issue`, {
    method: "POST",
    body: netTermsDays != null ? { netTermsDays } : {},
    auth: "auto",
  });
}

export async function adminLateFeePreview(invoiceId) {
  return request(`/admin/invoices/${invoiceId}/late-fee-preview`, { auth: "auto" });
}

export async function adminApplyLateFee(invoiceId) {
  return request(`/admin/invoices/${invoiceId}/apply-late-fee`, {
    method: "POST",
    body: {},
    auth: "auto",
  });
}

export async function adminVoidInvoice(invoiceId) {
  return request(`/admin/invoices/${invoiceId}/void`, {
    method: "POST",
    body: {},
    auth: "auto",
  });
}

export async function adminGetBillingAccount(merchantId) {
  return request(`/admin/merchants/${merchantId}/billing-account`, { auth: "jwt" });
}

export async function adminUpdateBillingAccount(merchantId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/billing-account`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function adminListMerchantInvoices(merchantId, { status } = {}) {
  return adminListInvoices({ merchantId, status });
}

export async function adminGenerateMerchantInvoice(merchantId, { totalCents, netTermsDays } = {}) {
  return adminGenerateInvoice({ merchantId, totalCents, netTermsDays });
}

export async function merchantListInvoices() {
  assertNotPvAdminForMerchantCall("/merchant/invoices");
  return request("/merchant/invoices", { auth: "jwt" });
}

export async function merchantGetInvoice(invoiceId) {
  assertNotPvAdminForMerchantCall(`/merchant/invoices/${invoiceId}`);
  return request(`/merchant/invoices/${invoiceId}`, { auth: "jwt" });
}

export async function guestGetInvoiceByToken(token) {
  const qs = new URLSearchParams();
  qs.set("token", token);
  return request(`/pay/invoice?${qs}`, { auth: "none" });
}

export async function guestPayByToken(token, { payerEmail }) {
  const qs = new URLSearchParams();
  qs.set("token", token);
  return request(`/pay/pay?${qs}`, { method: "POST", body: { payerEmail }, auth: "none" });
}

/* -----------------------------
   POS login + stats
-------------------------------- */

export async function posAuthLogin(input) {
  const rawCode =
    typeof input === "string"
      ? input
      : input && typeof input === "object"
        ? input.code
        : "";

  const c = String(rawCode || "").trim();
  if (!c) throw new Error("POS code is required");

  const body =
    typeof input === "object" && input && !(input instanceof FormData)
      ? { ...input, code: c }
      : { code: c };

  const result = await request("/pos/auth/login", { method: "POST", body, auth: "none" });

  if (!result?.accessToken) throw new Error("POS login failed: missing accessToken");
  setAccessToken(result.accessToken);
  pvBroadcast("login", {});
  return result;
}

export async function posGetTodayStats() {
  return request("/pos/stats/today", { auth: "jwt" });
}

export async function posGetRecentActivity({ limit = 20 } = {}) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  return request(`/pos/activity/recent?${qs}`, { auth: "jwt" });
}

/* -----------------------------
   POS-11 Customer identity flow
-------------------------------- */

function normalizePhone10(phone) {
  return String(phone || "").replace(/\D/g, "").slice(0, 10);
}

function pickFirst(obj, paths) {
  try {
    for (const p of paths) {
      const parts = p.split(".");
      let cur = obj;
      let ok = true;
      for (const part of parts) {
        if (!cur || typeof cur !== "object") {
          ok = false;
          break;
        }
        cur = cur[part];
      }
      if (ok && cur != null && String(cur).trim() !== "") return cur;
    }
  } catch { }
  return null;
}

function splitDisplayNameToParts(displayName) {
  const s = String(displayName || "").trim();
  if (!s) return { firstName: null, lastName: null };

  // Collapse whitespace and strip trailing commas
  const cleaned = s.replace(/\s+/g, " ").replace(/,+$/g, "").trim();

  // If there's only one token, treat as firstName
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: null };

  // first token = firstName, remaining = lastName-ish
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * POST /pos/customer/preview
 *
 * Observed response shape:
 * {
 *   ok: true,
 *   found: true,
 *   customer: { consumerId: 3, displayName: "Jane D.", createdAt: ... }
 * }
 */
export async function posCustomerPreview({ phone } = {}) {
  const digits = normalizePhone10(phone);
  if (digits.length !== 10) throw new Error("Phone must be 10 digits");

  const merchantId = String(localStorage.getItem("perkvalet_pos_authed_merchant_id") || "").trim();
  const storeId = (
    String(localStorage.getItem("perkvalet_pos_authed_store_id") || "").trim() ||
    String(localStorage.getItem("perkvalet_pos_store_id") || "").trim()
  );

  const raw = await request("/consumers/lookup", {
    method: "POST",
    body: {
      phone: digits,
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
    },
    auth: "jwt",
  });

  const consumerId = pickFirst(raw, [
    "customer.consumerId",
    "customer.consumerID",
    "customer.consumer_id",
    "consumerId",
    "consumerID",
    "consumer_id",
    "consumer.consumerId",
    "consumer.consumerID",
    "consumer.consumer_id",
    "consumer.id",
    "id",
  ]);

  const displayName = pickFirst(raw, ["customer.displayName", "customer.display_name", "displayName", "display_name"]);

  // Prefer explicit first/last if present; otherwise derive from displayName
  let firstName = pickFirst(raw, [
    "firstName",
    "first_name",
    "customer.firstName",
    "customer.first_name",
    "consumer.firstName",
    "consumer.first_name",
    "consumer.profile.firstName",
    "consumer.profile.first_name",
  ]);

  let lastName = pickFirst(raw, [
    "lastName",
    "last_name",
    "customer.lastName",
    "customer.last_name",
    "consumer.lastName",
    "consumer.last_name",
    "consumer.profile.lastName",
    "consumer.profile.last_name",
  ]);

  if ((!firstName && !lastName) && displayName) {
    const parts = splitDisplayNameToParts(displayName);
    firstName = parts.firstName;
    lastName = parts.lastName;
  }

  const found = raw?.found === true || raw?.exists === true || Boolean(consumerId);

  return {
    found: Boolean(found),
    consumerId: consumerId != null ? String(consumerId) : null,
    firstName: firstName ? String(firstName) : null,
    lastName: lastName ? String(lastName) : null,
    visitCount: raw?.visitCount != null ? Number(raw.visitCount) : null,
    lastVisitAt: raw?.lastVisitAt ? String(raw.lastVisitAt) : null,
    promotionProgress: raw?.promotionProgress || null,
    rewardEarned: raw?.rewardEarned === true,
    rewardLabel: raw?.rewardLabel ? String(raw.rewardLabel) : null,
    raw,
  };
}

/**
 * POST /pos/visit — inline visit registration from POS dashboard.
 * Requires POS headers (timestamp, nonce, idempotency key).
 */
export async function posRegisterVisit({ phone, consumerId } = {}) {
  const digits = normalizePhone10(phone);
  if (digits.length !== 10) throw new Error("Phone must be 10 digits");

  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  const hex = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");

  return request("/pos/visit", {
    method: "POST",
    auth: "jwt",
    body: { identifier: digits, consumerId: consumerId ? String(consumerId) : undefined },
    headers: {
      "X-POS-Timestamp": new Date().toISOString(),
      "X-POS-Nonce": hex,
      "X-POS-Idempotency-Key": hex,
    },
  });
}

/**
 * POST /pos/customer/create
 * firstName required, lastName optional
 *
 * Create response may mirror preview (customer object).
 */
export async function posCustomerCreate({ phone, firstName, lastName } = {}) {
  const digits = normalizePhone10(phone);
  if (digits.length !== 10) throw new Error("Phone must be 10 digits");

  const fn = String(firstName || "").trim();
  const ln = String(lastName || "").trim();
  if (!fn) throw new Error("First name is required");

  const merchantId = String(localStorage.getItem("perkvalet_pos_authed_merchant_id") || "").trim();
  const storeId = String(localStorage.getItem("perkvalet_pos_authed_store_id") || "").trim();

  const raw = await request("/consumers", {
    method: "POST",
    body: {
      phone: digits,
      firstName: fn,
      lastName: ln || "",
      ...(merchantId ? { merchantId } : {}),
      ...(storeId ? { storeId } : {}),
    },
    auth: "jwt",
  });

  const consumerId = pickFirst(raw, [
    "customer.consumerId",
    "customer.consumerID",
    "customer.consumer_id",
    "consumerId",
    "consumerID",
    "consumer_id",
    "consumer.consumerId",
    "consumer.consumerID",
    "consumer.consumer_id",
    "consumer.id",
    "id",
  ]);

  return {
    consumerId: consumerId != null ? String(consumerId) : null,
    raw,
  };
}

/* =============================================================
   POS — Bundle sell / redeem (Phase C)
============================================================= */

/** GET /pos/bundles/available — live bundles this merchant can sell */
export async function posBundlesAvailable() {
  return request("/pos/bundles/available", { auth: "jwt" });
}

/**
 * GET /pos/bundles/consumer?identifier=<phone|email>
 * Returns { consumer, instances } — instances are active BundleInstances.
 */
export async function posBundleConsumerLookup(identifier) {
  const qs = `?identifier=${encodeURIComponent(String(identifier || "").trim())}`;
  return request(`/pos/bundles/consumer${qs}`, { auth: "jwt" });
}

/**
 * POST /pos/bundles/sell
 * { bundleId, consumerId? }
 */
export async function posBundleSell({ bundleId, consumerId } = {}) {
  return request("/pos/bundles/sell", {
    method: "POST",
    auth: "jwt",
    body: { bundleId, ...(consumerId != null ? { consumerId } : {}) },
  });
}

/**
 * POST /pos/bundles/:instanceId/redeem
 * Sends x-idempotency-key header to prevent double-redeem.
 */
export async function posBundleRedeem(instanceId, idempotencyKey) {
  return request(`/pos/bundles/${instanceId}/redeem`, {
    method: "POST",
    auth: "jwt",
    body: {},
    headers: idempotencyKey ? { "x-idempotency-key": String(idempotencyKey) } : {},
  });
}

/* =============================================================
   Catalog — Categories (v3.5)
============================================================= */

export async function merchantListCategories({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/merchant/categories${qs}`, { auth: "jwt" });
}

export async function merchantCreateCategory({ name } = {}) {
  return request("/merchant/categories", {
    method: "POST",
    auth: "jwt",
    body: { name },
  });
}

export async function merchantUpdateCategory(categoryId, fields = {}) {
  return request(`/merchant/categories/${categoryId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantDeactivateCategory(categoryId) {
  return request(`/merchant/categories/${categoryId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

export async function adminListMerchantCategories(merchantId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/admin/merchants/${merchantId}/categories${qs}`, { auth: "jwt" });
}

export async function adminCreateMerchantCategory(merchantId, { name } = {}) {
  return request(`/admin/merchants/${merchantId}/categories`, {
    method: "POST",
    auth: "jwt",
    body: { name },
  });
}

export async function adminUpdateMerchantCategory(merchantId, categoryId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/categories/${categoryId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

/* =============================================================
   Catalog — Products (E.2)
============================================================= */

export async function merchantListProducts({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/merchant/products${qs}`, { auth: "jwt" });
}

export async function merchantCreateProduct({ name, description, sku, imageUrl, categoryId } = {}) {
  return request("/merchant/products", {
    method: "POST",
    auth: "jwt",
    body: { name, description, sku, imageUrl, categoryId },
  });
}

export async function merchantUpdateProduct(productId, fields = {}) {
  return request(`/merchant/products/${productId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantDeactivateProduct(productId) {
  return request(`/merchant/products/${productId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

export async function merchantReactivateProduct(productId) {
  return request(`/merchant/products/${productId}/reactivate`, {
    method: "POST",
    auth: "jwt",
  });
}

export async function merchantActivateProduct(productId) {
  return request(`/merchant/products/${productId}/activate`, { method: "POST", auth: "jwt" });
}

export async function adminListMerchantProducts(merchantId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/admin/merchants/${merchantId}/products${qs}`, { auth: "jwt" });
}

export async function adminCreateMerchantProduct(merchantId, { name, description, sku, imageUrl, categoryId } = {}) {
  return request(`/admin/merchants/${merchantId}/products`, {
    method: "POST",
    auth: "jwt",
    body: { name, description, sku, imageUrl, categoryId },
  });
}

export async function adminUpdateMerchantProduct(merchantId, productId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/products/${productId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function adminDeactivateMerchantProduct(merchantId, productId) {
  return request(`/admin/merchants/${merchantId}/products/${productId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

export async function adminReactivateMerchantProduct(merchantId, productId) {
  return request(`/admin/merchants/${merchantId}/products/${productId}/reactivate`, {
    method: "POST",
    auth: "jwt",
  });
}

export async function adminActivateMerchantProduct(merchantId, productId) {
  return request(`/admin/merchants/${merchantId}/products/${productId}/activate`, { method: "POST", auth: "jwt" });
}

/* =============================================================
   Catalog — Store Product Overrides (v1)
============================================================= */

export async function merchantListStoreProducts(storeId) {
  return request(`/merchant/stores/${storeId}/products`, { auth: "jwt" });
}

export async function merchantSetStoreProduct(storeId, productId, enabled) {
  return request(`/merchant/stores/${storeId}/products/${productId}`, {
    method: "PATCH",
    auth: "jwt",
    body: { enabled },
  });
}

export async function adminListStoreProducts(merchantId, storeId) {
  return request(`/admin/merchants/${merchantId}/stores/${storeId}/products`, { auth: "jwt" });
}

export async function adminSetStoreProduct(merchantId, storeId, productId, enabled) {
  return request(`/admin/merchants/${merchantId}/stores/${storeId}/products/${productId}`, {
    method: "PATCH",
    auth: "jwt",
    body: { enabled },
  });
}

/* =============================================================
   Promotions — Earn Items (E.3)
============================================================= */

export async function merchantListPromoItems({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/merchant/promo-items${qs}`, { auth: "jwt" });
}

export async function merchantCreatePromoItem({ name, description, type, skus } = {}) {
  return request("/merchant/promo-items", {
    method: "POST",
    auth: "jwt",
    body: { name, description, type, skus },
  });
}

export async function merchantUpdatePromoItem(itemId, fields = {}) {
  return request(`/merchant/promo-items/${itemId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantArchivePromoItem(itemId) {
  return request(`/merchant/promo-items/${itemId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

export async function adminListMerchantPromoItems(merchantId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/admin/merchants/${merchantId}/promo-items${qs}`, { auth: "jwt" });
}

export async function adminCreateMerchantPromoItem(merchantId, { name, description, type, skus } = {}) {
  return request(`/admin/merchants/${merchantId}/promo-items`, {
    method: "POST",
    auth: "jwt",
    body: { name, description, type, skus },
  });
}

export async function adminUpdateMerchantPromoItem(merchantId, itemId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/promo-items/${itemId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function adminArchiveMerchantPromoItem(merchantId, itemId) {
  return request(`/admin/merchants/${merchantId}/promo-items/${itemId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

/* =============================================================
   Promotions — Promotion Rules (E.3)
============================================================= */

export async function merchantListPromotions({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/merchant/promotions${qs}`, { auth: "jwt" });
}

export async function merchantCreatePromotion(fields = {}) {
  return request("/merchant/promotions", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function generatePromoTerms(fields = {}) {
  return request("/merchant/promotions/generate-terms", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function generatePromoDescription(fields = {}) {
  return request("/merchant/promotions/generate-description", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function generateBundleTerms(fields = {}) {
  return request("/merchant/bundles/generate-terms", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function generateBundleDescription(fields = {}) {
  return request("/merchant/bundles/generate-description", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function generateProductInfo(fields = {}) {
  return request("/merchant/products/generate-info", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function generateProductDescription(fields = {}) {
  return request("/merchant/products/generate-description", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantUpdatePromotion(promoId, fields = {}) {
  return request(`/merchant/promotions/${promoId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantArchivePromotion(promoId) {
  return request(`/merchant/promotions/${promoId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

export async function adminListMerchantPromotions(merchantId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/admin/merchants/${merchantId}/promotions${qs}`, { auth: "jwt" });
}

export async function adminCreateMerchantPromotion(merchantId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/promotions`, {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function adminUpdateMerchantPromotion(merchantId, promoId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/promotions/${promoId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function adminArchiveMerchantPromotion(merchantId, promoId) {
  return request(`/admin/merchants/${merchantId}/promotions/${promoId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

export async function merchantTransitionPromotion(promoId, status) {
  return request(`/merchant/promotions/${promoId}`, { method: "PATCH", auth: "jwt", body: { status } });
}

export async function merchantDuplicatePromotion(promoId) {
  return request(`/merchant/promotions/${promoId}/duplicate`, { method: "POST", auth: "jwt" });
}

export async function adminTransitionPromotion(merchantId, promoId, status) {
  return request(`/admin/merchants/${merchantId}/promotions/${promoId}`, { method: "PATCH", auth: "jwt", body: { status } });
}

export async function adminDuplicateMerchantPromotion(merchantId, promoId) {
  return request(`/admin/merchants/${merchantId}/promotions/${promoId}/duplicate`, { method: "POST", auth: "jwt" });
}

export async function merchantGetPromoAudit(promoId) {
  return request(`/merchant/promotions/${promoId}/audit`, { auth: "jwt" });
}

export async function adminGetPromoAudit(merchantId, promoId) {
  return request(`/admin/merchants/${merchantId}/promotions/${promoId}/audit`, { auth: "jwt" });
}

/* =============================================================
   Promotions — Offer Sets (E.3)
============================================================= */

export async function merchantListOfferSets({ status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/merchant/offer-sets${qs}`, { auth: "jwt" });
}

export async function merchantCreateOfferSet(fields = {}) {
  return request("/merchant/offer-sets", {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantUpdateOfferSet(setId, fields = {}) {
  return request(`/merchant/offer-sets/${setId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function merchantPublishOfferSet(setId) {
  return request(`/merchant/offer-sets/${setId}/publish`, {
    method: "POST",
    auth: "jwt",
  });
}

export async function merchantExpireOfferSet(setId) {
  return request(`/merchant/offer-sets/${setId}/expire`, {
    method: "POST",
    auth: "jwt",
  });
}

export async function adminListMerchantOfferSets(merchantId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(`/admin/merchants/${merchantId}/offer-sets${qs}`, { auth: "jwt" });
}

export async function adminCreateMerchantOfferSet(merchantId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/offer-sets`, {
    method: "POST",
    auth: "jwt",
    body: fields,
  });
}

export async function adminUpdateMerchantOfferSet(merchantId, setId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/offer-sets/${setId}`, {
    method: "PATCH",
    auth: "jwt",
    body: fields,
  });
}

export async function adminArchiveMerchantOfferSet(merchantId, setId) {
  return request(`/admin/merchants/${merchantId}/offer-sets/${setId}`, {
    method: "DELETE",
    auth: "jwt",
  });
}

// ── Bundles (Prepaid Credits) ─────────────────────────────────

export async function merchantListBundles({ status } = {}) {
  const qs = status ? `?status=${status}` : "";
  return request(`/merchant/bundles${qs}`, { auth: "jwt" });
}

export async function merchantCreateBundle({ name, price, ruleTree, startAt, endAt } = {}) {
  return request("/merchant/bundles", {
    method: "POST", auth: "jwt",
    body: { name, price, ruleTree, startAt, endAt },
  });
}

export async function merchantUpdateBundle(bundleId, fields = {}) {
  return request(`/merchant/bundles/${bundleId}`, {
    method: "PATCH", auth: "jwt", body: fields,
  });
}

export async function adminListMerchantBundles(merchantId, { status } = {}) {
  const qs = status ? `?status=${status}` : "";
  return request(`/admin/merchants/${merchantId}/bundles${qs}`, { auth: "jwt" });
}

export async function adminCreateMerchantBundle(merchantId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/bundles`, {
    method: "POST", auth: "jwt", body: fields,
  });
}

export async function adminUpdateMerchantBundle(merchantId, bundleId, fields = {}) {
  return request(`/admin/merchants/${merchantId}/bundles/${bundleId}`, {
    method: "PATCH", auth: "jwt", body: fields,
  });
}

export async function merchantDeleteBundle(bundleId) {
  return request(`/merchant/bundles/${bundleId}`, { method: "DELETE", auth: "jwt" });
}

export async function merchantDuplicateBundle(bundleId) {
  return request(`/merchant/bundles/${bundleId}/duplicate`, { method: "POST", auth: "jwt" });
}

export async function adminDeleteMerchantBundle(merchantId, bundleId) {
  return request(`/admin/merchants/${merchantId}/bundles/${bundleId}`, { method: "DELETE", auth: "jwt" });
}

export async function adminDuplicateMerchantBundle(merchantId, bundleId) {
  return request(`/admin/merchants/${merchantId}/bundles/${bundleId}/duplicate`, { method: "POST", auth: "jwt" });
}

export async function merchantGetBundleAudit(bundleId) {
  return request(`/merchant/bundles/${bundleId}/audit`, { auth: "jwt" });
}

export async function adminGetBundleAudit(merchantId, bundleId) {
  return request(`/admin/merchants/${merchantId}/bundles/${bundleId}/audit`, { auth: "jwt" });
}

/* =============================================================
   Reporting (Thread R)
============================================================= */

export async function merchantGetReportOverview({ range = "30d" } = {}) {
  return request(`/merchant/reports/overview?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

export async function merchantGetReportStores({ range = "30d" } = {}) {
  return request(`/merchant/reports/stores?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

export async function merchantGetReportPromotions({ range = "30d" } = {}) {
  return request(`/merchant/reports/promotions?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

export async function adminGetMerchantReportOverview(merchantId, { range = "30d" } = {}) {
  return request(`/admin/merchants/${merchantId}/reports/overview?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

export async function adminGetMerchantReportStores(merchantId, { range = "30d" } = {}) {
  return request(`/admin/merchants/${merchantId}/reports/stores?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

export async function adminGetMerchantReportPromotions(merchantId, { range = "30d" } = {}) {
  return request(`/admin/merchants/${merchantId}/reports/promotions?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

export async function adminGetPlatformReport({ range = "30d" } = {}) {
  return request(`/admin/reports/platform?range=${encodeURIComponent(range)}`, { auth: "jwt" });
}

/* -----------------------------
   Platform Config (pv_admin)
-------------------------------- */

export async function adminGetPlatformConfig() {
  return request("/admin/platform/config", { auth: "jwt" });
}

export async function adminUpdatePlatformConfig(updates) {
  return request("/admin/platform/config", { method: "PUT", body: updates, auth: "jwt" });
}

/* =============================================================
   Square POS Integration
============================================================= */

// Generic POS connection status (returns posType, connected, storeStatuses)
export async function posGetStatus() {
  return request("/pos/connect/status", { auth: "jwt" });
}

export async function squareGetStatus() {
  return request("/pos/connect/square/status", { auth: "jwt" });
}

export async function squareGetLocations() {
  return request("/pos/connect/square/locations", { auth: "jwt" });
}

export async function squareMapLocation({ externalLocationId, externalLocationName, pvStoreId }) {
  return request("/pos/connect/square/map-location", {
    method: "POST",
    body: { externalLocationId, externalLocationName, pvStoreId },
    auth: "jwt",
  });
}

export async function squareDisconnect() {
  return request("/pos/connect/square", { method: "DELETE", auth: "jwt" });
}

export function squareConnectUrl() {
  const token = getAccessToken();
  return `${API_BASE}/pos/connect/square${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

// Clover OAuth connect URL
export function cloverConnectUrl() {
  const token = getAccessToken();
  return `${API_BASE}/pos/connect/clover${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

// Toast connect (client-credentials, POST)
export async function toastConnect({ clientId, clientSecret }) {
  return request("/pos/connect/toast", { method: "POST", body: { clientId, clientSecret }, auth: "jwt" });
}

// Generic POS disconnect
export async function posDisconnect(posType) {
  return request(`/pos/connect/${posType}`, { method: "DELETE", auth: "jwt" });
}

// Generic POS locations
export async function posGetLocations(posType) {
  return request(`/pos/connect/${posType}/locations`, { auth: "jwt" });
}

// Generic POS map location
export async function posMapLocation(posType, { externalLocationId, externalLocationName, pvStoreId }) {
  return request(`/pos/connect/${posType}/map-location`, {
    method: "POST",
    body: { externalLocationId, externalLocationName, pvStoreId },
    auth: "jwt",
  });
}

// ── Growth Advisor ────────────────────────────────────────────

export async function getGrowthAdvisor({ storeId } = {}) {
  const qs = storeId ? `?storeId=${storeId}` : "";
  return request(`/merchant/growth-advisor${qs}`, { auth: "jwt" });
}

export async function getPromotionOutcomes() {
  return request("/merchant/promotion-outcomes", { auth: "jwt" });
}

export async function getPromotionOutcome(promotionId) {
  return request(`/merchant/promotions/${promotionId}/outcomes`, { auth: "jwt" });
}

export async function getPromotionValidation(promotionId) {
  return request(`/merchant/promotions/${promotionId}/validation`, { auth: "jwt" });
}

export async function recomputePromotionOutcomes() {
  return request("/merchant/promotion-outcomes/recompute", { method: "POST", auth: "jwt" });
}

/* -----------------------------
   Duplicate Customer Alerts
-------------------------------- */

export async function merchantListDuplicateAlerts() {
  return request("/merchants/me/alerts/duplicate-customers", { auth: "jwt" });
}

export async function merchantResolveDuplicateAlert(alertId, status) {
  return request(`/merchants/me/alerts/duplicate-customers/${alertId}`, {
    method: "PATCH",
    body: { status },
    auth: "jwt",
  });
}

// ── Reporting Dashboard (pre-aggregated) ──

export async function merchantGetDashboard({ period = "30d", storeId = "all", from, to } = {}) {
  let qs = `period=${period}&storeId=${storeId}`;
  if (from) qs += `&from=${from}`;
  if (to) qs += `&to=${to}`;
  return request(`/merchant/reporting/dashboard?${qs}`, { auth: "jwt" });
}

export async function merchantGetReportingStores() {
  return request("/merchant/reporting/stores", { auth: "jwt" });
}

export async function merchantGetPromotionDetail(promotionId, { period = "30d" } = {}) {
  return request(`/merchant/reporting/promotions/${promotionId}?period=${period}`, { auth: "jwt" });
}

export async function merchantGetSimulatorData(promotionId, objective) {
  const qs = objective ? `?objective=${objective}` : "";
  return request(`/merchant/reporting/simulator/${promotionId}${qs}`, { auth: "jwt" });
}

export async function merchantGetNewSimulatorData(promotionType, objective) {
  const qs = objective ? `?objective=${objective}` : "";
  return request(`/merchant/reporting/simulator/new/${promotionType}${qs}`, { auth: "jwt" });
}

export async function merchantSetAvgTransactionValue(avgTransactionValueCents) {
  return request("/merchant/reporting/simulator/aov", {
    method: "PATCH",
    auth: "jwt",
    body: { avgTransactionValueCents },
  });
}

// ── Merchant Onboarding ──

export async function getOnboardingSession() {
  return request("/merchant/onboarding", { auth: "jwt" });
}

export async function updateOnboardingSession(data) {
  return request("/merchant/onboarding", { method: "PATCH", body: data, auth: "jwt" });
}

export async function requestOnboardingHelp(data) {
  return request("/merchant/onboarding/help", { method: "POST", body: data, auth: "jwt" });
}

export async function initiateOnboardingConnect() {
  return request("/merchant/onboarding/connect", { method: "POST", auth: "jwt" });
}

export async function completeOnboardingConnection() {
  return request("/merchant/onboarding/complete-connection", { method: "POST", auth: "jwt" });
}

export async function ingestPosPromotions() {
  return request("/merchant/onboarding/ingest", { method: "POST", auth: "jwt" });
}
