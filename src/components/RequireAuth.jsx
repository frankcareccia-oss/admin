// admin/src/components/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, clearAccessToken } from "../api/client";

function readRole() {
  const role = String(localStorage.getItem("perkvalet_system_role") || "").trim();
  const raw = String(localStorage.getItem("perkvalet_system_role_raw") || "").trim();

  if (role === "pv_admin" || role === "merchant") return role;
  if (role === "user") return "merchant";

  if (raw === "pv_admin") return "pv_admin";
  if (raw) return "merchant";

  return "";
}

function isPosUser() {
  return localStorage.getItem("perkvalet_is_pos") === "1";
}

function clearSession() {
  clearAccessToken();
  localStorage.removeItem("perkvalet_system_role");
  localStorage.removeItem("perkvalet_system_role_raw");
  localStorage.removeItem("perkvalet_landing");
  localStorage.removeItem("perkvalet_is_pos");
  localStorage.removeItem("perkvalet_pos_store_label");
  localStorage.removeItem("perkvalet_pos_store_id");
  localStorage.removeItem("perkvalet_pos_assoc_label");
}

export default function RequireAuth({ children, requiredRole }) {
  const location = useLocation();
  const token = getAccessToken();
  const role = readRole();
  const pos = isPosUser();

  const path = location.pathname || "";
  const isAccount = path.startsWith("/account/");
  const isPosPath = path.startsWith("/merchant/pos");
  const isPosLogin = path.startsWith("/pos/login");

  // Not logged in: allow the app to route to public pages.
  if (!token) {
    // Let /pos/login render without redirect loops
    if (isPosLogin) return children;

    return (
      <Navigate to="/login" replace state={{ from: location, notice: "Please sign in." }} />
    );
  }

  // Token exists but no role => invalid session
  if (!role) {
    clearSession();
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, notice: "Session invalid. Please sign in again." }}
      />
    );
  }

  // POS enforcement:
  // - POS users should ONLY live under /merchant/pos, /account/*, and /pos/login (for shift switching)
  // - Non-POS users should NOT access /merchant/pos
  if (pos && !isPosPath && !isAccount && !isPosLogin) {
    return <Navigate to="/merchant/pos" replace />;
  }

  if (!pos && isPosPath) {
    return <Navigate to="/merchant" replace state={{ notice: "POS associate required." }} />;
  }

  // Role gating
  if (requiredRole === "pv_admin" && role !== "pv_admin") {
    return <Navigate to="/merchant" replace state={{ notice: "Admin access required." }} />;
  }

  if (requiredRole === "merchant" && role !== "merchant") {
    return <Navigate to="/merchants" replace state={{ notice: "Merchant access required." }} />;
  }

  return children;
}
