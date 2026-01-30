// src/api/client.js

const API_BASE = "http://localhost:3001";

// Storage keys (canonical)
const ADMIN_KEY_STORAGE = "perkvalet_admin_api_key";
const JWT_STORAGE = "perkvalet_access_token";
const SYSTEM_ROLE_STORAGE = "perkvalet_system_role";

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
    } else {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }

    // If token is revoked/expired: clear session consistently.
    if (res.status === 401) {
      pvClearSession({ reason: "http_401", broadcast: true });
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

export async function listMerchantStores() {
  assertNotPvAdminForMerchantCall("/merchant/stores");
  return request("/merchant/stores", { auth: "jwt" });
}

/* -----------------------------
   Billing (v2.02.1)
-------------------------------- */

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
