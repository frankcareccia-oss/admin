// admin/src/components/RequireAuth.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { me, clearAccessToken, getAccessToken } from "../api/client";

function getSystemRole() {
  return localStorage.getItem("perkvalet_system_role") || "";
}

function clearSession() {
  clearAccessToken();
  localStorage.removeItem("perkvalet_system_role");
  localStorage.removeItem("perkvalet_landing");
}

// Treat these as equivalent for UI gating (keeps backward compatibility)
function normalizeRole(role) {
  if (!role) return "";
  // Backend may evolve to emit "merchant" while older UI expects "user"
  if (role === "merchant") return "user";
  return role;
}

export default function RequireAuth({ children, requiredRole }) {
  const location = useLocation();

  const [state, setState] = React.useState({
    loading: true,
    ok: false,
    role: "",
  });

  React.useEffect(() => {
    let cancelled = false;

    async function check() {
      // ✅ If there is no JWT, don't call /me (prevents noisy 401 in console)
      const token = getAccessToken();
      if (!token) {
        clearSession();
        if (!cancelled) setState({ loading: false, ok: false, role: "" });
        return;
      }

      try {
        const data = await me(); // uses JWT only
        const role = data?.user?.systemRole || getSystemRole() || "";
        if (!cancelled) setState({ loading: false, ok: true, role });
      } catch (e) {
        // Treat as logged out (token expired/invalid)
        clearSession();
        if (!cancelled) setState({ loading: false, ok: false, role: "" });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return <div style={{ padding: 16 }}>Checking session…</div>;
  }

  if (!state.ok) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Optional role gate
  if (requiredRole) {
    const role = state.role || "";
    const normalized = normalizeRole(role);

    // Support requiredRole as either a string or an array of allowed roles
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    // Allow if either the raw role or normalized role matches
    const ok =
      (role && allowed.includes(role)) ||
      (normalized && allowed.includes(normalized));

    if (!ok) {
      const home = normalized === "pv_admin" ? "/merchants" : "/merchant";
      return <Navigate to={home} replace />;
    }
  }

  return children;
}
