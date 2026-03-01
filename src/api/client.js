// src/api/client.js

export const API_BASE = "http://localhost:3001";

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
   Core request helper
-------------------------------- */

async function request(path, { method = "GET", headers = {}, body, auth = "auto" } = {}) {
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

  const res = await fetch(url, { method, headers: h, body: payload });

  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw new Error(retryAfter ? `Rate limited. Retry after ${retryAfter}s.` : "Rate limited.");
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
  return request("/me", { auth: "jwt" });
}

export async function logout() {
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

export async function createMerchant({ name }) {
  return request("/merchants", { method: "POST", body: { name }, auth: "auto" });
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
  return request("/merchant/stores", { auth: "jwt" });
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

export async function merchantCreateUser({ merchantId, email, role } = {}) {
  assertNotPvAdminForMerchantCall("/merchant/users");

  const emailNorm = String(email || "").trim().toLowerCase();
  if (!emailNorm) throw new Error("Email is required");

  const roleNorm = normalizeMerchantRole(role);
  if (!roleNorm) {
    throw new Error(`Invalid role. Allowed: ${MERCHANT_ROLE_VALUES.join("|")}`);
  }

  return request("/merchant/users", {
    method: "POST",
    auth: "jwt",
    body: { merchantId, email: emailNorm, role: roleNorm },
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
   Billing (v2.02.1)
-------------------------------- */

export async function adminListMerchantUsers(merchantId) {
  return request(`/admin/merchants/${merchantId}/users`, { auth: "auto" });
}

export async function adminGetMerchantUser(merchantUserId) {
  if (merchantUserId == null) throw new Error("merchantUserId is required");
  return request(`/admin/merchant-users/${encodeURIComponent(String(merchantUserId))}`, { auth: "auto" });
}

export async function adminCreateMerchantUser(merchantId, { email } = {}) {
  return request(`/admin/merchants/${merchantId}/users`, {
    method: "POST",
    auth: "auto",
    body: { email },
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
  } catch {}
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

  const raw = await request("/pos/customer/preview", {
    method: "POST",
    body: {
      identityKind: "phone",
      identityValue: digits,
      phone: digits,
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
    raw,
  };
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

  const raw = await request("/pos/customer/create", {
    method: "POST",
    body: {
      identityKind: "phone",
      identityValue: digits,
      phone: digits,
      firstName: fn,
      ...(ln ? { lastName: ln } : {}),
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
