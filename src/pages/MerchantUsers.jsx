// admin/src/pages/MerchantUsers.jsx
import React from "react";
import { Link } from "react-router-dom";
import {
  merchantListUsers,
  merchantCreateUser,
  me,
  getSystemRole,
  adminGetMerchantUser,
} from "../api/client";

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
  const membership = Array.isArray(meRes?.memberships)
    ? meRes.memberships[0]
    : null;

  const merchantIdRaw =
    meRes?.merchantId ??
    meRes?.merchant?.id ??
    membership?.merchantId ??
    membership?.merchant?.id ??
    null;

  const merchantId = merchantIdRaw != null ? Number(merchantIdRaw) : null;

  const merchantName =
    membership?.merchant?.name ||
    meRes?.merchant?.name ||
    meRes?.merchantName ||
    "";

  const tenantRole = membership?.role || membership?.tenantRole || "";

  return { merchantId, merchantName, tenantRole, membership };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "—";
  }
}

/**
 * MerchantUsers
 *
 * Props:
 * - readOnly (boolean, default false)
 *   When true:
 *   - hides Create / Save / mutation actions
 *   - prevents any mutation calls
 *
 * Row expand (Option A):
 * - Enabled ONLY when readOnly === true (admin view)
 * - Lazy fetches /admin/merchant-users/:merchantUserId on first expand
 */
export default function MerchantUsers({ readOnly = false }) {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [profile, setProfile] = React.useState(null);

  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("store_subadmin");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);

  // Row expand state (admin/readOnly only)
  const [expandedId, setExpandedId] = React.useState(null);
  const [detailById, setDetailById] = React.useState({});
  const [detailBusyById, setDetailBusyById] = React.useState({});
  const [detailErrById, setDetailErrById] = React.useState({});

  async function load() {
    setLoading(true);
    setErr("");
    setResult(null);

    // Reset expansions on reload to avoid showing stale IDs
    setExpandedId(null);
    setDetailById({});
    setDetailBusyById({});
    setDetailErrById({});

    const sysRole = getSystemRole();

    // Guard: pv_admin should never mutate via merchant endpoints
    if (sysRole === "pv_admin" && !readOnly) {
      setItems([]);
      setProfile(null);
      setErr("pv_admin session: merchant portal is not available.");
      setLoading(false);
      return;
    }

    try {
      pvUiHook("screen.enter", {
        screen: "MerchantUsers",
        readOnly,
      });

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
        readOnly,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load users";
      setErr(msg);
      pvUiHook("merchant.users.list_load_failed.ui", {
        stable: "merchant:users:list",
        error: msg,
        readOnly,
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  async function onCreate(e) {
    e.preventDefault();

    if (readOnly) return;

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

      const r = await merchantCreateUser({
        merchantId: ctx.merchantId,
        email: em,
        role,
      });
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

  async function toggleExpand(mu) {
    // Expand only supported in admin readOnly view (Option A scope)
    if (!readOnly) return;

    const merchantUserIdRaw = mu?.id ?? null;
    const merchantUserId = merchantUserIdRaw != null ? String(merchantUserIdRaw) : "";
    if (!merchantUserId) return;

    // Toggle collapse if already open
    if (expandedId === merchantUserId) {
      setExpandedId(null);
      pvUiHook("merchant.users.row_collapsed.ui", {
        stable: "merchant:users:detail",
        merchantUserId,
      });
      return;
    }

    setExpandedId(merchantUserId);
    pvUiHook("merchant.users.row_expanded.ui", {
      stable: "merchant:users:detail",
      merchantUserId,
    });

    // Lazy fetch on first open
    if (detailById[merchantUserId]) return;
    if (detailBusyById[merchantUserId]) return;

    setDetailBusyById((prev) => ({ ...prev, [merchantUserId]: true }));
    setDetailErrById((prev) => ({ ...prev, [merchantUserId]: "" }));

    try {
      const detail = await adminGetMerchantUser(merchantUserId);
      setDetailById((prev) => ({ ...prev, [merchantUserId]: detail }));

      pvUiHook("merchant.users.detail_load_succeeded.ui", {
        stable: "merchant:users:detail",
        merchantUserId,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load user detail";
      setDetailErrById((prev) => ({ ...prev, [merchantUserId]: msg }));

      pvUiHook("merchant.users.detail_load_failed.ui", {
        stable: "merchant:users:detail",
        merchantUserId,
        error: msg,
      });
    } finally {
      setDetailBusyById((prev) => ({ ...prev, [merchantUserId]: false }));
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
        <Link
          to={readOnly ? "/merchants" : "/merchant"}
          style={{ textDecoration: "none" }}
        >
          ← Back
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
            {readOnly
              ? "View merchant users (read-only)."
              : "Manage merchant users (employees) and tenant roles."}
          </div>
        </div>

        <button onClick={load} disabled={loading || busy} style={styles.refreshBtn}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && <div style={styles.errBox}>{err}</div>}

      {!readOnly && (
        <div style={{ marginTop: 14, ...styles.card }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Add employee</div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(0,0,0,0.6)",
              marginBottom: 10,
            }}
          >
            If the email does not exist yet, a temporary password is generated and
            returned once.
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
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy}
                style={styles.select}
              >
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
                Created/updated: <code>{result.email}</code> as{" "}
                <code>{result.role}</code>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={styles.card}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <div style={{ fontWeight: 800 }}>Users</div>
            <div style={{ color: "rgba(0,0,0,0.6)" }}>
              ({items.length} user{items.length === 1 ? "" : "s"})
            </div>
            {readOnly ? (
              <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                Click a row to expand details
              </div>
            ) : null}
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
                    mu?.id ??
                    mu?.user?.id ??
                    mu?.user?.email ??
                    mu?.email ??
                    `${idx}`;

                  const merchantUserIdRaw = mu?.id ?? null;
                  const merchantUserId = merchantUserIdRaw != null ? String(merchantUserIdRaw) : "";

                  const isExpandable = readOnly && Boolean(merchantUserId);
                  const isExpanded = isExpandable && expandedId === merchantUserId;

                  const emailLabel =
                    mu?.user?.email ||
                    mu?.email ||
                    mu?.userEmail ||
                    "—";

                  const userStatus = mu?.user?.status || "";

                  const detail = merchantUserId ? detailById[merchantUserId] : null;
                  const detailBusy = merchantUserId ? Boolean(detailBusyById[merchantUserId]) : false;
                  const detailErr = merchantUserId ? String(detailErrById[merchantUserId] || "") : "";

                  return (
                    <React.Fragment key={String(rowKey)}>
                      <tr
                        onClick={isExpandable ? () => toggleExpand(mu) : undefined}
                        style={isExpandable ? styles.expandableRow : undefined}
                        title={isExpandable ? "Click to expand details" : undefined}
                      >
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {isExpandable ? (
                              <span style={styles.caret}>{isExpanded ? "▼" : "▶"}</span>
                            ) : null}
                            <div>
                              <div style={{ fontWeight: 700 }}>{emailLabel}</div>
                              {userStatus ? (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "rgba(0,0,0,0.55)",
                                  }}
                                >
                                  userStatus: <code>{userStatus}</code>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td style={td}>
                          <code>{mu?.role || "—"}</code>
                        </td>
                        <td style={td}>
                          <code>{mu?.status || "—"}</code>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr>
                          <td colSpan={3} style={styles.detailCell}>
                            {detailBusy ? (
                              <div style={{ color: "rgba(0,0,0,0.65)" }}>Loading details…</div>
                            ) : detailErr ? (
                              <div style={styles.detailErrBox}>{detailErr}</div>
                            ) : detail ? (
                              <pre style={styles.detailPre}>{safeStringify(detail)}</pre>
                            ) : (
                              <div style={{ color: "rgba(0,0,0,0.65)" }}>
                                No detail loaded.
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}

                {!loading && items.length === 0 && !err && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {profile ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: "rgba(0,0,0,0.55)",
            }}
          >
            Screen <code>MerchantUsers</code> · User{" "}
            <code>{profile?.user?.email}</code> · Resolved Role{" "}
            <code>{resolvedRoleLabel}</code> · Merchant{" "}
            <code>{merchantLabel}</code>
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
  expandableRow: {
    cursor: "pointer",
  },
  caret: {
    width: 16,
    display: "inline-block",
    textAlign: "center",
    color: "rgba(0,0,0,0.55)",
    fontSize: 12,
  },
  detailCell: {
    padding: 12,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(0,0,0,0.02)",
  },
  detailPre: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: 280,
    overflow: "auto",
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "white",
  },
  detailErrBox: {
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
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
