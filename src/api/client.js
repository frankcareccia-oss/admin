// src/api/client.js

const API_BASE = "http://localhost:3001";

// Storage keys
const ADMIN_KEY_STORAGE = "perkvalet_admin_api_key";
const JWT_STORAGE = "perkvalet_access_token";
const SYSTEM_ROLE_STORAGE = "perkvalet_system_role";

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
    // Prevent noisy 403s in admin UI by refusing to call merchant endpoints at all.
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

  const res = await fetch(url, {
    method,
    headers: h,
    body: payload,
  });

  // Rate limit handling
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

    // Session hygiene: if token is revoked/expired, clear it so UI can route to /login cleanly
    if (res.status === 401) {
      clearAccessToken();
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
    auth: "auto", // safe: sends admin key if present, not required for login
  });

  if (!result?.accessToken) throw new Error("Login failed: missing accessToken");
  setAccessToken(result.accessToken);
  return result; // { accessToken, systemRole, landing } (if backend returns)
}

export async function me() {
  return request("/me", { auth: "jwt" });
}

export async function logout() {
  clearAccessToken();
}

/* -----------------------------
   Password management (Thread C1)
-------------------------------- */

// Public (no auth): always returns ok (generic message)
export async function forgotPassword(email) {
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!emailNorm) throw new Error("Email is required");

  return request("/auth/forgot-password", {
    method: "POST",
    body: { email: emailNorm },
    auth: "none",
  });
}

// Public (no auth): token + new password
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

// Authenticated: current + new password.
// Backend revokes session by bumping tokenVersion; so after success we should force re-login.
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

  // Current token is invalid after password change (tokenVersion increments). Force logout client-side.
  clearAccessToken();
  return result;
}

/* -----------------------------
   Admin debug (admin + jwt)
-------------------------------- */

export async function whoAmI() {
  return request("/whoami", { auth: "admin" });
}

/* -----------------------------
   Merchants (admin routes require JWT + admin key now)
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
  return request("/merchants", {
    method: "POST",
    body: { name },
    auth: "auto",
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
   Stores (admin routes require JWT + admin key now)
-------------------------------- */

export async function createStore(data) {
  return request("/stores", {
    method: "POST",
    body: data,
    auth: "auto",
  });
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
   Store QR (admin routes require JWT + admin key now)
-------------------------------- */

export async function listStoreQrs(storeId) {
  return request(`/stores/${storeId}/qrs`, { auth: "auto" });
}

export async function mintStoreQr(storeId) {
  return request(`/stores/${storeId}/qrs`, {
    method: "POST",
    auth: "auto",
  });
}

export function getStoreQrPngUrl(storeId) {
  return `${API_BASE}/stores/${storeId}/qr.png`;
}

/* -----------------------------
   Merchant portal (JWT protected)
   Guarded to prevent pv_admin from calling merchant endpoints.
-------------------------------- */

export async function listMerchantStores() {
  assertNotPvAdminForMerchantCall("/merchant/stores");
  return request("/merchant/stores", { auth: "jwt" });
}

/* -----------------------------
   Billing (v2.02.1)
   Admin + Merchant + Guest pay
-------------------------------- */

// -------- Admin: billing policy --------

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
  return request("/admin/billing-policy", {
    method: "PUT",
    body: policy,
    auth: "auto",
  });
}

// -------- Admin: invoices --------

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

// -------- Admin: merchant-scoped invoices (UI convenience) --------

export async function adminListMerchantInvoices(merchantId, { status } = {}) {
  return adminListInvoices({ merchantId, status });
}

export async function adminGenerateMerchantInvoice(merchantId, { totalCents, netTermsDays } = {}) {
  return adminGenerateInvoice({ merchantId, totalCents, netTermsDays });
}

// -------- Merchant: invoices (JWT) --------
// Guarded to prevent pv_admin from calling merchant endpoints.

export async function merchantListInvoices() {
  assertNotPvAdminForMerchantCall("/merchant/invoices");
  return request("/merchant/invoices", { auth: "jwt" });
}

export async function merchantGetInvoice(invoiceId) {
  assertNotPvAdminForMerchantCall(`/merchant/invoices/${invoiceId}`);
  return request(`/merchant/invoices/${invoiceId}`, { auth: "jwt" });
}

// -------- Guest pay (NO AUTH) --------

export async function guestGetInvoiceByToken(token) {
  const qs = new URLSearchParams();
  qs.set("token", token);
  return request(`/pay/invoice?${qs}`, { auth: "none" });
}

export async function guestPayByToken(token, { payerEmail }) {
  const qs = new URLSearchParams();
  qs.set("token", token);
  return request(`/pay/pay?${qs}`, {
    method: "POST",
    body: { payerEmail },
    auth: "none",
  });
}

/* -----------------------------
   POS (POS-8A) — Associate login (code-based)
   Public endpoint: POST /pos/auth/login
   Returns { accessToken, systemRole, landing, posSession, storeId, merchantId }
-------------------------------- */

/**
 * POS associate "fast login" using short code / shift code.
 *
 * IMPORTANT: UI calls this with an object (storeId/terminalId/terminalLabel/code).
 * Prior versions stringified the object into "[object Object]" and sent that as code.
 * This implementation accepts either a string or an object and always extracts the string code.
 */
export async function posAuthLogin(input) {
  const rawCode =
    typeof input === "string"
      ? input
      : input && typeof input === "object"
        ? input.code
        : "";

  const c = String(rawCode || "").trim();
  if (!c) throw new Error("POS code is required");

  // If the UI provided extra fields, we send them too (backend may ignore).
  const body =
    typeof input === "object" && input && !(input instanceof FormData)
      ? { ...input, code: c }
      : { code: c };

  const result = await request("/pos/auth/login", {
    method: "POST",
    body,
    auth: "none",
  });

  if (!result?.accessToken) throw new Error("POS login failed: missing accessToken");
  setAccessToken(result.accessToken);
  return result;
}

/* -----------------------------
   POS (POS-8A) — Dashboard stats / activity (JWT)
   Endpoints expected:
   - GET /pos/stats/today
   - GET /pos/activity/recent?limit=20
-------------------------------- */

export async function posGetTodayStats() {
  // POS endpoints are JWT protected; caller is a POS associate (merchant systemRole).
  return request("/pos/stats/today", { auth: "jwt" });
}

export async function posGetRecentActivity({ limit = 20 } = {}) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  return request(`/pos/activity/recent?${qs}`, { auth: "jwt" });
}
