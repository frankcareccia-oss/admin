// admin/src/components/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, pvClearSession } from "../api/client";

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

function shouldRememberReturnTo(path) {
  const p = String(path || "");
  // Remember deep links into protected areas.
  return (
    p.startsWith("/admin/") ||
    p.startsWith("/merchants") ||
    p.startsWith("/stores/") ||
    p.startsWith("/settings/") ||
    p.startsWith("/merchant/")
  );
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

  // Not logged in
  if (!token) {
    // Let /pos/login render without loops
    if (isPosLogin) return children;

    // Save deep-link return-to (one time)
    if (shouldRememberReturnTo(path)) {
      try {
        const full = `${location.pathname || ""}${location.search || ""}`;
        sessionStorage.setItem("perkvalet_return_to", full);
      } catch {
        // ignore
      }
    }

    return <Navigate to="/login" replace state={{ notice: "Please sign in." }} />;
  }

  // Token exists but no role => invalid session
  if (!role) {
    pvClearSession({ reason: "missing_role", broadcast: true });
    return <Navigate to="/login" replace state={{ notice: "Session invalid. Please sign in again." }} />;
  }

  // POS enforcement (leave as-is if you still use perkvalet_is_pos)
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
