// admin/src/pages/AdminMerchantUsers.jsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import { adminListMerchantUsers, getMerchant, getSystemRole } from "../api/client";

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

export default function AdminMerchantUsers() {
  const { merchantId } = useParams();

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [merchant, setMerchant] = React.useState(null);
  const [items, setItems] = React.useState([]);

  async function load() {
    setLoading(true);
    setErr("");

    const sysRole = getSystemRole();
    if (sysRole !== "pv_admin") {
      setItems([]);
      setMerchant(null);
      setErr("This page is for pv_admin only.");
      setLoading(false);
      return;
    }

    const mid = Number(merchantId);
    if (!mid) {
      setItems([]);
      setMerchant(null);
      setErr("Invalid merchantId in route.");
      setLoading(false);
      return;
    }

    try {
      pvUiHook("screen.enter", { screen: "AdminMerchantUsers", merchantId: mid });

      // Merchant header (optional but useful)
      try {
        const m = await getMerchant(mid);
        setMerchant(m || null);
      } catch {
        // non-fatal; still show list
        setMerchant(null);
      }

      const res = await adminListMerchantUsers(mid);

      // Backend returns an array; be defensive if wrapped in {items}
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      setItems(list);

      pvUiHook("admin.merchant.users.list_load_succeeded.ui", {
        stable: "admin.merchant:users:list",
        merchantId: mid,
        count: list.length,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load merchant users";
      setErr(msg);
      setItems([]);
      pvUiHook("admin.merchant.users.list_load_failed.ui", {
        stable: "admin.merchant:users:list",
        merchantId: Number(merchantId) || null,
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  async function onRefresh() {
    setBusy(true);
    try {
      await load();
    } finally {
      setBusy(false);
    }
  }

  const mid = Number(merchantId) || null;
  const merchantName = merchant?.name || "";

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ marginBottom: 10 }}>
        <Link to={`/merchants/${mid || ""}`} style={{ textDecoration: "none" }}>
          ← Back to Merchant
        </Link>
      </div>

      <div style={styles.headerRow}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Team</h2>
          <div style={{ color: "rgba(0,0,0,0.65)" }}>
            Read-only view of merchant users (pv_admin).
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            Merchant: <code>{merchantName || "—"}</code>
          </div>
        </div>

        <button onClick={onRefresh} disabled={loading || busy} style={styles.refreshBtn}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err ? <div style={styles.errBox}>{err}</div> : null}

      <div style={{ marginTop: 14, ...styles.card }}>
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
                const rowKey = mu?.id ?? mu?.user?.id ?? mu?.user?.email ?? mu?.contactEmail ?? idx;

                const emailLabel =
                  mu?.user?.email ||
                  mu?.contactEmail ||
                  mu?.email ||
                  mu?.userEmail ||
                  "—";

                const userStatus = mu?.user?.status || "";
                const role = mu?.role || "—";
                const status = mu?.status || "—";

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
                      <code>{role}</code>
                    </td>
                    <td style={td}>
                      <code>{status}</code>
                    </td>
                  </tr>
                );
              })}

              {!loading && items.length === 0 && !err ? (
                <tr>
                  <td colSpan={3} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
          Screen <code>AdminMerchantUsers</code> · Role <code>pv_admin</code> · MerchantId{" "}
          <code>{mid || "—"}</code>
        </div>
      </div>
    </div>
  );
}

const styles = {
  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  card: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 14,
    padding: 14,
    background: "white",
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
};

const th = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const td = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};
