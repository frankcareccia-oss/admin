// admin/src/pages/MerchantStores.jsx
import React from "react";
import { Link } from "react-router-dom";
import { listMerchantStores, me, getSystemRole } from "../api/client";

export default function MerchantStores() {
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [profile, setProfile] = React.useState(null);

  async function load() {
    setLoading(true);
    setErr("");

    const role = getSystemRole();

    // Hard guard: pv_admin should never call merchant portal APIs
    if (role === "pv_admin") {
      setItems([]);
      setProfile(null);
      setErr("pv_admin session: merchant portal is not available.");
      setLoading(false);
      return;
    }

    try {
      const m = await me();
      setProfile(m);

      const r = await listMerchantStores();
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch (e) {
      setErr(e?.message || "Failed to load stores");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>My Stores</h2>
          <div style={{ color: "rgba(0,0,0,0.65)" }}>
            Stores available to this merchant user (scoped by membership).
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "10px 12px", borderRadius: 10 }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {err && (
        <div
          style={{
            marginTop: 14,
            background: "rgba(255,0,0,0.06)",
            border: "1px solid rgba(255,0,0,0.15)",
            padding: 10,
            borderRadius: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      )}

      {/* List */}
      <div style={{ marginTop: 14 }}>
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700 }}>Results</div>
            <div style={{ color: "rgba(0,0,0,0.6)" }}>
              ({items.length} store{items.length === 1 ? "" : "s"})
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Name</th>
                  <th style={th}>City</th>
                  <th style={th}>State</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>{s.id}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 650 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                        {s.address1 || ""}
                      </div>
                    </td>
                    <td style={td}>{s.city || ""}</td>
                    <td style={td}>{s.state || ""}</td>
                    <td style={td}>
                      <Link to={`/merchant/stores/${s.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}

                {!loading && items.length === 0 && !err && (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                      No stores available for this user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer / Debug */}
        {profile && (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            Logged in as <code>{profile?.user?.email}</code> (role{" "}
            <code>{profile?.user?.systemRole}</code>)
          </div>
        )}
      </div>
    </div>
  );
}

const th = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const td = {
  padding: 12,
  borderBottom: "1px solid rgba(0,0,0,0.06)",
};
