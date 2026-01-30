// src/pages/Merchants.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { listMerchants, createMerchant, getAdminKey } from "../api/client";
import Toast from "../components/Toast";

import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

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

function Badge({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: "rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </span>
  );
}

const buttonBase = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.18)",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const card = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  overflow: "hidden",
  background: "white",
};

export default function Merchants() {
  const navigate = useNavigate();

  const [status, setStatus] = React.useState("active");
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState("");

  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [toast, setToast] = React.useState(null);

  // This page never mentions the secret. It only checks whether this browser is enabled.
  const [isBrowserEnabled, setIsBrowserEnabled] = React.useState(() => Boolean(getAdminKey() || ""));

  React.useEffect(() => {
    // If user enabled the browser in another tab/page, reflect it on focus.
    function onFocus() {
      const ok = Boolean(getAdminKey() || "");
      setIsBrowserEnabled(ok);
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function refresh(reason = "auto") {
    setLoading(true);
    setErr("");

    pvUiHook("admin.merchants.list_load_started.ui", {
      tc: "TC-MER-UI-01",
      sev: "info",
      stable: "merchants:list",
      status: status || null,
      reason,
      isBrowserEnabled,
    });

    try {
      const data = await listMerchants({ status });
      const list = Array.isArray(data) ? data : [];
      setItems(list);

      pvUiHook("admin.merchants.list_load_succeeded.ui", {
        tc: "TC-MER-UI-02",
        sev: "info",
        stable: "merchants:list",
        status: status || null,
        count: list.length,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load merchants";
      setErr(msg);
      setToast({ type: "error", message: msg });

      pvUiHook("admin.merchants.list_load_failed.ui", {
        tc: "TC-MER-UI-03",
        sev: "error",
        stable: "merchants:list",
        status: status || null,
        error: e?.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    pvUiHook("admin.merchants.page_loaded.ui", {
      tc: "TC-MER-UI-00",
      sev: "info",
      stable: "merchants:page",
      status: status || null,
      isBrowserEnabled,
    });

    if (!isBrowserEnabled) {
      pvUiHook("admin.merchants.browser_enablement.banner_shown.ui", {
        tc: "TC-MER-UI-30",
        sev: "info",
        stable: "merchants:enablementBanner",
      });
    }

    refresh("status_change");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function onCreate(e) {
    e.preventDefault();
    const name = newName.trim();

    pvUiHook("admin.merchants.create.click.ui", {
      tc: "TC-MER-UI-10",
      sev: "info",
      stable: "merchants:create",
      nameLength: name.length,
      isBrowserEnabled,
    });

    if (!isBrowserEnabled) {
      setToast({
        type: "error",
        message: "This browser isn’t enabled for admin setup yet. Use Admin Key in the top menu.",
      });

      pvUiHook("admin.merchants.create.blocked.ui", {
        tc: "TC-MER-UI-10B",
        sev: "warn",
        stable: "merchants:create",
        blockedReason: "browser_not_enabled",
      });
      return;
    }

    if (!name) {
      pvUiHook("admin.merchants.create.blocked.ui", {
        tc: "TC-MER-UI-11",
        sev: "warn",
        stable: "merchants:create",
        blockedReason: "name_missing",
      });
      return;
    }

    setCreating(true);
    setErr("");

    try {
      await createMerchant({ name });
      setNewName("");

      pvUiHook("admin.merchants.create.success.ui", {
        tc: "TC-MER-UI-12",
        sev: "info",
        stable: "merchants:create",
      });

      await refresh("post_create");
      setToast({ type: "success", message: "Merchant created" });
    } catch (e2) {
      const msg = e2?.message || "Failed to create merchant";
      setErr(msg);
      setToast({ type: "error", message: msg });

      pvUiHook("admin.merchants.create.failure.ui", {
        tc: "TC-MER-UI-13",
        sev: "error",
        stable: "merchants:create",
        error: e2?.message || String(e2),
      });
    } finally {
      setCreating(false);
    }
  }

  return (
    <PageContainer size="page">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <PageHeader
        title="Merchants"
        subtitle="Manage merchants and drill into stores + QR printing."
        right={
          <button
            onClick={() => {
              pvUiHook("admin.merchants.reload.click.ui", {
                tc: "TC-MER-UI-20",
                sev: "info",
                stable: "merchants:reload",
                status: status || null,
              });
              refresh("manual_refresh");
            }}
            disabled={loading}
            style={{
              ...buttonBase,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        {!isBrowserEnabled ? (
          <div
            style={{
              padding: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: 14,
              background: "rgba(255, 215, 0, 0.18)",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>You’re almost there</div>

            <div style={{ opacity: 0.92, lineHeight: 1.4 }}>
              You’re signed in, but <b>this browser</b> isn’t yet enabled for admin setup tasks like creating merchants
              or issuing invoices.
            </div>

            <div style={{ opacity: 0.9, lineHeight: 1.4 }}>
              For security, admin setup is only enabled on trusted computers.
            </div>

            <div
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(0,0,0,0.12)",
                fontWeight: 900,
              }}
            >
              Next step: Use the top menu → <span style={{ fontWeight: 900 }}>Admin Key</span> to enable this browser.
            </div>
          </div>
        ) : null}

        <form
          onSubmit={onCreate}
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            padding: 14,
            display: "grid",
            gap: 10,
            background: "white",
            opacity: !isBrowserEnabled ? 0.65 : 1,
          }}
        >
          <div style={{ fontWeight: 800 }}>Create merchant</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='e.g., "Merchant A"'
              disabled={!isBrowserEnabled || creating}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.22)",
                minWidth: 280,
              }}
            />

            <button
              type="submit"
              disabled={!isBrowserEnabled || creating || !newName.trim()}
              style={{
                ...buttonBase,
                background: !isBrowserEnabled || creating || !newName.trim() ? "rgba(0,0,0,0.03)" : "white",
                cursor: !isBrowserEnabled || creating || !newName.trim() ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (!isBrowserEnabled) {
                  pvUiHook("admin.merchants.create.blocked.ui", {
                    tc: "TC-MER-UI-11B",
                    sev: "warn",
                    stable: "merchants:create",
                    blockedReason: "browser_not_enabled",
                  });
                } else if (!newName.trim()) {
                  pvUiHook("admin.merchants.create.blocked.ui", {
                    tc: "TC-MER-UI-11A",
                    sev: "warn",
                    stable: "merchants:create",
                    blockedReason: "name_missing",
                  });
                }
              }}
            >
              {creating ? "Creating..." : "Create"}
            </button>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 700 }}>Status filter</div>
              <select
                value={status}
                onChange={(e) => {
                  const next = e.target.value;
                  pvUiHook("admin.merchants.filters.status_change.ui", {
                    tc: "TC-MER-UI-40",
                    sev: "info",
                    stable: "merchants:filters",
                    from: status || null,
                    to: next || null,
                  });
                  setStatus(next);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.22)",
                  background: "white",
                }}
              >
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="archived">archived</option>
                <option value="all">all</option>
              </select>
            </div>
          </div>

          {!isBrowserEnabled ? (
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              Creating merchants is disabled until this browser is enabled (top menu → Admin Key).
            </div>
          ) : null}

          {err ? (
            <div
              style={{
                background: "rgba(255,0,0,0.06)",
                border: "1px solid rgba(255,0,0,0.15)",
                padding: 10,
                borderRadius: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {err}
            </div>
          ) : null}
        </form>

        <div style={card}>
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              gap: 10,
              alignItems: "baseline",
            }}
          >
            <div style={{ fontWeight: 800 }}>Results</div>
            <div style={{ color: "rgba(0,0,0,0.6)" }}>
              ({items.length} merchant{items.length === 1 ? "" : "s"})
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  <th style={th}>Stores</th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td style={td}>{m.id}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{m.name}</div>
                    </td>
                    <td style={td}>
                      <Badge>{m.status}</Badge>
                    </td>
                    <td style={td}>{Array.isArray(m.stores) ? m.stores.length : 0}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => {
                          pvUiHook("admin.merchants.row_action.view.ui", {
                            tc: "TC-MER-UI-50",
                            sev: "info",
                            stable: `merchant:${String(m.id)}`,
                            merchantId: Number(m.id),
                          });
                          navigate(`/merchants/${m.id}`);
                        }}
                        style={actionBtn}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 14, color: "rgba(0,0,0,0.6)" }}>
                      No merchants found for status: <code>{status}</code>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
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

const actionBtn = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
  fontWeight: 900,
  textDecoration: "none",
};
