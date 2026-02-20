/**
 * admin/src/components/RequireAuth.jsx
 *
 * Hard authorization gate.
 * Blocks BEFORE render. No flash.
 *
 * Supported requiredRole:
 *   "pv_admin"
 *   "merchant"
 *   "pv_ar_clerk"
 */

import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, pvClearSession } from "../api/client";

function readRole() {
  const role = String(localStorage.getItem("perkvalet_system_role") || "").trim();
  const raw = String(localStorage.getItem("perkvalet_system_role_raw") || "").trim();

  // Normalized roles
  if (role === "pv_admin" || role === "pv_ar_clerk" || role === "merchant") {
    return role;
  }

  // Legacy collapse
  if (role === "user") return "merchant";

  // Raw fallback
  if (raw === "pv_admin") return "pv_admin";
  if (raw === "pv_ar_clerk") return "pv_ar_clerk";
  if (raw) return "merchant";

  return "";
}

function isPvStaff(role) {
  return role === "pv_admin" || role === "pv_ar_clerk";
}

function isPosUser() {
  return localStorage.getItem("perkvalet_is_pos") === "1";
}

function shouldRememberReturnTo(path) {
  const p = String(path || "");
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
    if (isPosLogin) return children;

    if (shouldRememberReturnTo(path)) {
      try {
        const full = `${location.pathname || ""}${location.search || ""}`;
        sessionStorage.setItem("perkvalet_return_to", full);
      } catch {}
    }

    return <Navigate to="/login" replace state={{ notice: "Please sign in." }} />;
  }

  // Invalid session (no role)
  if (!role) {
    pvClearSession({ reason: "missing_role", broadcast: true });
    return <Navigate to="/login" replace state={{ notice: "Session invalid. Please sign in again." }} />;
  }

  // POS enforcement
  if (pos && !isPosPath && !isAccount && !isPosLogin) {
    return <Navigate to="/merchant/pos" replace />;
  }

  if (!pos && isPosPath) {
    return <Navigate to="/merchant" replace state={{ notice: "POS associate required." }} />;
  }

  // ---- Role gating

  if (requiredRole === "pv_admin") {
    if (!isPvStaff(role)) {
      return <Navigate to="/merchant" replace state={{ notice: "Admin access required." }} />;
    }
  }

  if (requiredRole === "pv_ar_clerk") {
    if (!isPvStaff(role)) {
      return <Navigate to="/merchant" replace state={{ notice: "PV staff access required." }} />;
    }
  }

  if (requiredRole === "merchant") {
    if (role !== "merchant") {
      return <Navigate to="/merchants" replace state={{ notice: "Merchant access required." }} />;
    }
  }

  return children;
}
