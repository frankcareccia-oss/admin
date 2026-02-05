// admin/src/pages/MerchantUsers.jsx
import React from "react";
import { Link } from "react-router-dom";
import { merchantListUsers, merchantCreateUser, me, getSystemRole } from "../api/client";

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

// NOTE (locked to schema.prisma enum MerchantRole):
// owner | merchant_admin | store_admin | store_subadmin
const ROLE_OPTIONS = [
  { value: "owner", label: "owner (Merchant Owner)" },
  { value: "merchant_admin", label: "merchant_admin (Merchant Admin)" },
  { value: "store_admin", label: "store_admin (Store Admin)" },
  { value: "store_subadmin", label: "store_subadmin (Store Sub-admin)" },
];

function resolveMerchantContextFromMe(meRes) {
  const membership = Array.isArray(meRes?.memberships) ? meRes.memberships[0] : null;

  const merchantIdRaw =
    meRes?.merchantId ??
    meRes?.merchant?.id ??
    membership?.merchantId ??
    membership?.merchant?.id ??
    null;

  const merchantId = merchantIdRaw != null ? Number(merchantIdRaw) : null;

  const merchantName =
    membership?.merchant?.name || meRes?.merchant?.name || meRes?.merchantName || "";

  const tenantRole = membership?.role || membership?.tenantRole || "";

  return { merchantId, merchantName, tenantRole, membership };
}

export default function MerchantUsers() {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [profile, setProfile] = React.useState(null);

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("store_subadmin");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    setResult(null);

    const sysRole = getSystemRole();
    if (sysRole === "pv_admin") {
      setItems([]);
      setProfile(null);
      setErr("pv_admin session: merchant portal is not available.");
      setLoading(false);
      return;
    }

    try {
      pvUiHook("screen.enter", { screen: "MerchantUsers" });

      const m = await me();
      setProfile(m);

      const ctx = resolveMerchantContextFromMe(m);
      if (!ctx.merchantId) throw new Error("merchantId is required");

      const r = await merchantListUsers({ merchantId: ctx.merchantId });
      setItems(Array.isArray(r?.items) ? r.items : []);

      pvUiHook("merchant.users.list_load_succeeded.ui", {
        stable: "merchant:users:list",
        count: Array.isArray(r?.items) ? r.items.length : 0,
        merchantId: ctx.merchantId,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load users";
      setErr(msg);
      pvUiHook("merchant.users.list_load_failed.ui", {
        stable: "merchant:users:list",
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setErr("");
    setResult(null);

    const em = String(email || "").trim();
    if (!em) {
      setErr("Email is required.");
      return;
    }

    const ctx = resolveMerchantContextFromMe(profile);
    if (!ctx.merchantId) {
      setErr("merchantId is required");
      return;
    }

    setBusy(true);
    try {
      pvUiHook("merchant.users.create_clicked.ui", {
        stable: "merchant:users:create",
        role,
        merchantId: ctx.merchantId,
      });

      const r = await merchantCreateUser({ merchantId: ctx.merchantId, email: em, role });
      setResult(r);

      pvUiHook("merchant.users.create_succeeded.ui", {
        stable: "merchant:users:create",
        role: r?.role || role,
        createdUser: Boolean(r?.createdUser),
        merchantId: ctx.merchantId,
      });

      setEmail("");
      await load();
    } catch (e2) {
      const msg = e2?.message || "Failed to create user";
      setErr(msg);
      pvUiHook("merchant.users.create_failed.ui", {
        stable: "merchant:users:create",
        error: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  const ctx = resolveMerchantContextFromMe(profile);
  const merchantLabel = ctx.merchantName
    ? ctx.merchantName
    : ctx.merchantId
    ? `Merchant #${ctx.merchantId}`
    : "—";

  const resolvedRoleLabel = ctx.tenantRole || "user";

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 10 }}>
        <Link to="/merchant" style={{ textDecoration: "none" }}>
          ← Back to My Stores
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Team</h2>
          <div style={{ color: "rgba(0,0,0,0.65)" }}>
            Manage merchant users (employees) and tenant roles.
          </div>
        </div>

        <button onClick={load} disabled={loading || busy} style={styles.refreshBtn}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div style={styles.errBox}>
          {err}
        </div>
      )}

      <div style={{ marginTop: 14, ...styles.card }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Add employee</div>
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.6)", marginBottom: 10 }}>
          If the email does not exist yet, a temporary password is generated and returned once.
          If you have multiple merchant memberships, the API may require <code>merchantId</code>.
        </div>

        <form onSubmit={onCreate} style={styles.formRow}>
          <div style={{ minWidth: 280, flex: "1 1 280px" }}>
            <label style={styles.label}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              placeholder="employee@merchant.com"
              style={styles.input}
            />
          </div>

          <div style={{ minWidth: 260 }}>
            <label style={styles.label}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy} style={styles.select}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" disabled={busy} style={styles.saveBtn}>
            {busy ? "Creating…" : "Create"}
          </button>
        </form>

        {result ? (
          <div style={styles.resultBox}>
            <div>
              Created/updated: <code>{result.email}</code> as <code>{result.role}</code>
            </div>
            {result.createdUser ? (
              <div style={{ marginTop: 6 }}>
                Temporary password: <code>{result.tempPassword || "—"}</code>
              </div>
            ) : (
              <div style={{ marginTop: 6, color: "rgba(0,0,0,0.65)" }}>
                User already existed (no password generated).
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={styles.card}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 800 }}>Users</div>
            <div style={{ color: "rgba(0,0,0,0.6)" }}>
              ({items.length} user{items.length === 1 ? "" : "s"})
            </div>
          </div>

          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>User</th>
                  <th style={th}>Tenant Role</th>
                  <th style={th}>Membership Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((mu, idx) => {
                  const rowKey =
                    mu?.id ?? mu?.user?.id ?? mu?.user?.email ?? mu?.email ?? `${idx}`;

                  const emailLabel = mu?.user?.email || mu?.email || mu?.userEmail || "—";

                  const userStatus = mu?.user?.status || "";

                  return (
                    <tr key={String(rowKey)}>
                      <td style={td}>
                        <div style={{ fontWeight: 700 }}>{emailLabel}</div>
                        {userStatus ? (
                          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                            userStatus: <code>{userStatus}</code>
                          </div>
                        ) : null}
                      </td>
                      <td style={td}>
                        <code>{mu?.role || "—"}</code>
                      </td>
                      <td style={td}>
                        <code>{mu?.status || "—"}</code>
                      </td>
                    </tr>
                  );
                })}

                {!loading && items.length === 0 && !err && (
                  <tr>
                    <td colSpan={3} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {profile ? (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            Screen <code>MerchantUsers</code> · User <code>{profile?.user?.email}</code> · Resolved Role{" "}
            <code>{resolvedRoleLabel}</code> · Merchant <code>{merchantLabel}</code>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  card: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "rgba(0,0,0,0.65)",
    marginBottom: 6,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
  },
  saveBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  },
  refreshBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  errBox: {
    marginTop: 14,
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },
  formRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "end",
  },
  resultBox: {
    marginTop: 10,
    background: "rgba(0,128,0,0.06)",
    border: "1px solid rgba(0,128,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    fontSize: 13,
  },
};

const th = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const td = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};
