// admin/src/components/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, clearAccessToken } from "../api/client";

function readRole() {
  const role = String(localStorage.getItem("perkvalet_system_role") || "").trim();
  const raw = String(localStorage.getItem("perkvalet_system_role_raw") || "").trim();

  // Accept normalized UI roles
  if (role === "pv_admin" || role === "merchant") return role;

  // Back-compat: if older code stored "user", treat it as merchant
  if (role === "user") return "merchant";

  // If only raw exists, normalize it
  if (raw === "pv_admin") return "pv_admin";
  if (raw) return "merchant";

  return "";
}

function isPosUser() {
  return localStorage.getItem("perkvalet_is_pos") === "1";
}

export default function RequireAuth({ children, requiredRole }) {
  const location = useLocation();
  const token = getAccessToken();
  const role = readRole();
  const pos = isPosUser();

  // Not logged in
  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, notice: "Please sign in." }}
      />
    );
  }

  // If token exists but we have no role, treat as invalid session
  if (!role) {
    clearAccessToken();
    localStorage.removeItem("perkvalet_system_role");
    localStorage.removeItem("perkvalet_system_role_raw");
    localStorage.removeItem("perkvalet_landing");
    localStorage.removeItem("perkvalet_is_pos");

    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, notice: "Session invalid. Please sign in again." }}
      />
    );
  }

  const path = location.pathname || "";

  // POS enforcement:
  // - POS users should ONLY live under /merchant/pos (plus account pages)
  // - Non-POS users should NOT access /merchant/pos
  const isAccount = path.startsWith("/account/");
  const isPosPath = path.startsWith("/merchant/pos");

  if (pos && !isPosPath && !isAccount) {
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
