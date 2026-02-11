// admin/src/pages/AdminMerchantUsers.jsx
import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminListMerchantUsers,
  adminGetMerchantUser,
  getMerchant,
  getSystemRole,
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

function fmt(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

async function copyToClipboard(text) {
  if (!text) throw new Error("Nothing to copy");
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Copy failed");
}

export default function AdminMerchantUsers() {
  const { merchantId } = useParams();

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [merchant, setMerchant] = React.useState(null);
  const [items, setItems] = React.useState([]);

  // expanded rows + per-row lazy detail caches
  const [expandedById, setExpandedById] = React.useState({});
  const [detailById, setDetailById] = React.useState({});
  const [detailBusyById, setDetailBusyById] = React.useState({});
  const [detailErrById, setDetailErrById] = React.useState({});

  // “Advanced” diagnostics toggle per row (raw JSON view + copy)
  const [diagEnabledById, setDiagEnabledById] = React.useState({});
  const [copyStateById, setCopyStateById] = React.useState({}); // idle | copied | failed

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
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : [];

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

  async function ensureDetailLoaded(merchantUserId) {
    if (!merchantUserId) return;

    // already loaded
    if (detailById[merchantUserId]) return;

    setDetailBusyById((p) => ({ ...p, [merchantUserId]: true }));
    setDetailErrById((p) => ({ ...p, [merchantUserId]: "" }));

    try {
      const detail = await adminGetMerchantUser(merchantUserId);
      setDetailById((p) => ({ ...p, [merchantUserId]: detail }));

      pvUiHook("admin.merchant.users.detail_load_succeeded.ui", {
        stable: "admin.merchant:users:detail",
        merchantId: Number(merchantId) || null,
        merchantUserId,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load user detail";
      setDetailErrById((p) => ({ ...p, [merchantUserId]: msg }));

      pvUiHook("admin.merchant.users.detail_load_failed.ui", {
        stable: "admin.merchant:users:detail",
        merchantId: Number(merchantId) || null,
        merchantUserId,
        error: msg,
      });
    } finally {
      setDetailBusyById((p) => ({ ...p, [merchantUserId]: false }));
    }
  }

  function toggleExpand(mu) {
    const merchantUserId = mu?.id ?? null;
    if (!merchantUserId) return;

    setExpandedById((prev) => {
      const next = !prev[merchantUserId];

      pvUiHook("merchant.users.row_expanded.ui", {
        stable: "admin.merchant:users:detail",
        merchantId: Number(merchantId) || null,
        merchantUserId,
        expanded: next,
      });

      return { ...prev, [merchantUserId]: next };
    });

    // lazy load detail on first expand
    if (!expandedById[merchantUserId] && !detailById[merchantUserId]) {
      ensureDetailLoaded(merchantUserId);
    }
  }

  function toggleDiagnostics(merchantUserId) {
    setDiagEnabledById((prev) => {
      const next = !prev[merchantUserId];
      pvUiHook("admin.merchant.users.diagnostics_toggled.ui", {
        stable: "admin.merchant:users:diagnostics",
        merchantUserId,
        enabled: next,
      });
      return { ...prev, [merchantUserId]: next };
    });
  }

  async function onCopyDiagnostics(merchantUserId) {
    const d = detailById[merchantUserId];
    if (!d) return;

    const payload = {
      screen: "AdminMerchantUsers",
      merchantId: Number(merchantId) || null,
      merchantUserId,
      capturedAt: new Date().toISOString(),
      detail: d,
    };

    setCopyStateById((p) => ({ ...p, [merchantUserId]: "idle" }));

    try {
      await copyToClipboard(JSON.stringify(payload, null, 2));
      setCopyStateById((p) => ({ ...p, [merchantUserId]: "copied" }));

      pvUiHook("admin.merchant.users.diagnostics_copied.ui", {
        stable: "admin.merchant:users:diagnostics",
        merchantUserId,
        bytes: JSON.stringify(payload).length,
      });

      // auto-reset indicator
      window.setTimeout(() => {
        setCopyStateById((p) => ({ ...p, [merchantUserId]: "idle" }));
      }, 1500);
    } catch (e) {
      setCopyStateById((p) => ({ ...p, [merchantUserId]: "failed" }));

      pvUiHook("admin.merchant.users.diagnostics_copy_failed.ui", {
        stable: "admin.merchant:users:diagnostics",
        merchantUserId,
        error: e?.message || "copy failed",
      });

      window.setTimeout(() => {
        setCopyStateById((p) => ({ ...p, [merchantUserId]: "idle" }));
      }, 1500);
    }
  }

  const mid = Number(merchantId) || null;
  const merchantName = merchant?.name || "";

  return (
    <div style={styles.page}>
      <div style={styles.frame}>
        <div style={{ marginBottom: 10 }}>
          <Link to={`/merchants/${mid || ""}`} style={styles.link}>
            ← Back to Merchant
          </Link>
        </div>

        <div style={styles.headerRow}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Team</h2>
            <div style={{ color: TOKENS.muted }}>
              Read-only view (pv_admin)
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: TOKENS.muted }}>
              Merchant: <code style={styles.code}>{merchantName || "—"}</code>
            </div>
          </div>

          <button onClick={onRefresh} disabled={loading || busy} style={styles.refreshBtn}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {err ? <div style={styles.errBox}>{err}</div> : null}

        <div style={{ marginTop: 14, ...styles.card }}>
          <div style={styles.cardTop}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900 }}>Users</div>
              <div style={{ color: TOKENS.muted }}>
                ({items.length} user{items.length === 1 ? "" : "s"})
              </div>
            </div>

            <div style={{ fontSize: 12, color: TOKENS.muted }}>
              Use carets to view details
            </div>
          </div>

          {/* scroll only inside this area */}
          <div style={styles.scrollArea}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>User</th>
                  <th style={th}>Tenant Role</th>
                  <th style={th}>Membership Status</th>
                  <th style={{ ...th, width: 36 }}></th>
                </tr>
              </thead>

              <tbody>
                {items.map((mu, idx) => {
                  const rowKey =
                    mu?.id ?? mu?.user?.id ?? mu?.user?.email ?? mu?.contactEmail ?? idx;

                  const merchantUserId = mu?.id ?? null;

                  const emailLabel =
                    mu?.user?.email ||
                    mu?.contactEmail ||
                    mu?.email ||
                    mu?.userEmail ||
                    "—";

                  const userStatus = mu?.user?.status || "";
                  const role = mu?.role || "—";
                  const status = mu?.status || "—";

                  const expanded = merchantUserId ? Boolean(expandedById[merchantUserId]) : false;
                  const d = merchantUserId ? detailById[merchantUserId] : null;
                  const dBusy = merchantUserId ? Boolean(detailBusyById[merchantUserId]) : false;
                  const dErr = merchantUserId ? String(detailErrById[merchantUserId] || "") : "";

                  const diagEnabled = merchantUserId ? Boolean(diagEnabledById[merchantUserId]) : false;
                  const copyState = merchantUserId ? (copyStateById[merchantUserId] || "idle") : "idle";

                  const expandable = Boolean(merchantUserId);

                  return (
                    <React.Fragment key={String(rowKey)}>
                      <tr style={styles.row}>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: TOKENS.navy }}>{emailLabel}</div>
                          {userStatus ? (
                            <div style={{ fontSize: 12, color: TOKENS.muted }}>
                              userStatus: <code style={styles.code}>{userStatus}</code>
                            </div>
                          ) : null}
                        </td>

                        <td style={td}>
                          <code style={styles.code}>{role}</code>
                        </td>

                        <td style={td}>
                          <code style={styles.code}>{status}</code>
                        </td>

                        {/* Dedicated RIGHT action column */}
                        <td style={styles.caretTd}>
                          {expandable ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleExpand(mu);
                              }}
                              style={styles.caretBtn}
                              aria-label={expanded ? "Collapse details" : "Expand details"}
                              title={expanded ? "Collapse details" : "Expand details"}
                            >
                              {expanded ? "▼" : "▶"}
                            </button>
                          ) : null}
                        </td>
                      </tr>

                      {expanded ? (
                        <tr>
                          <td colSpan={4} style={styles.detailCell}>
                            {dBusy ? (
                              <div style={{ color: TOKENS.muted }}>Loading details…</div>
                            ) : dErr ? (
                              <div style={styles.detailErrBox}>{dErr}</div>
                            ) : d ? (
                              <div style={styles.detailWrap}>
                                {/* Human summary */}
                                <div style={styles.detailGrid}>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>Email:</b>
                                    <span style={styles.value}>{d.user?.email || "—"}</span>
                                  </div>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>User status:</b>
                                    <span style={styles.value}>{d.user?.status || "—"}</span>
                                  </div>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>Role:</b>
                                    <span style={styles.value}>{d.role || "—"}</span>
                                  </div>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>Membership:</b>
                                    <span style={styles.value}>{d.status || "—"}</span>
                                  </div>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>Status reason:</b>
                                    <span style={styles.value}>{d.statusReason || "—"}</span>
                                  </div>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>Created:</b>
                                    <span style={styles.value}>{fmt(d.createdAt)}</span>
                                  </div>
                                  <div style={styles.detailRow}>
                                    <b style={styles.label}>Updated:</b>
                                    <span style={styles.value}>{fmt(d.updatedAt)}</span>
                                  </div>
                                </div>

                                {/* Advanced (support-friendly) */}
                                <div style={styles.diagBar}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleDiagnostics(merchantUserId);
                                    }}
                                    style={diagEnabled ? styles.diagChipOn : styles.diagChip}
                                    aria-pressed={diagEnabled}
                                    title="Support: enable advanced diagnostics"
                                  >
                                    Advanced {diagEnabled ? "▾" : "▸"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onCopyDiagnostics(merchantUserId);
                                    }}
                                    disabled={!d}
                                    style={styles.copyBtn}
                                    title="Copy diagnostics payload for support/chatbot"
                                  >
                                    {copyState === "copied"
                                      ? "Copied"
                                      : copyState === "failed"
                                      ? "Copy failed"
                                      : "Copy diagnostics"}
                                  </button>
                                </div>

                                {/* Raw JSON (only when Advanced enabled) */}
                                {diagEnabled ? (
                                  <pre style={styles.detailPre}>
                                    {JSON.stringify(d, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            ) : (
                              <div style={{ color: TOKENS.muted }}>No detail loaded.</div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}

                {!loading && items.length === 0 && !err ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 14, color: TOKENS.muted }}>
                      No users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: TOKENS.muted }}>
            Screen <code style={styles.code}>AdminMerchantUsers</code> · Role{" "}
            <code style={styles.code}>pv_admin</code> · MerchantId{" "}
            <code style={styles.code}>{mid || "—"}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

const TOKENS = {
  pageBg: "#FEFCF7",
  surface: "#FFFFFF",
  navy: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.10)",
  divider: "rgba(0,0,0,0.06)",
  teal: "#2F8F8B",
  tealHover: "#277D79",
};

const styles = {
  page: {
    background: TOKENS.pageBg,
    color: TOKENS.navy,
    height: "calc(100vh - 140px)", // keeps frame static; content scrolls inside card
    overflow: "hidden",
  },
  frame: {
    maxWidth: 980,
    height: "100%",
    overflow: "hidden",
  },

  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  link: {
    color: TOKENS.teal,
    textDecoration: "none",
    fontWeight: 700,
  },

  card: {
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 14,
    padding: 14,
    background: TOKENS.surface,
    display: "flex",
    flexDirection: "column",
    height: "calc(100% - 70px)",
    minHeight: 0,
  },

  cardTop: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },

  refreshBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    color: TOKENS.navy,
  },

  errBox: {
    marginTop: 14,
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    color: TOKENS.navy,
  },

  // The ONLY vertical scroll area on this screen:
  scrollArea: {
    marginTop: 10,
    overflowY: "auto",
    overflowX: "auto",
    borderRadius: 12,
    border: `1px solid ${TOKENS.divider}`,
    flex: 1,
    minHeight: 0,
  },

  row: {
    // Keep row look neutral; caret button is the explicit affordance
  },

  caretTd: {
    padding: 12,
    borderBottom: `1px solid ${TOKENS.divider}`,
    width: 44,
    textAlign: "right",
    paddingRight: 10,
  },

  caretBtn: {
    border: "1px solid rgba(0,0,0,0.14)",
    background: "white",
    borderRadius: 10,
    width: 28,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: TOKENS.muted,
    fontSize: 12,
  },

  statusCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
  },

  caretRight: {
    display: "inline-block",
    minWidth: 14,
    textAlign: "right",
    color: TOKENS.muted,
    fontSize: 12,
  },

  detailCell: {
    padding: 12,
    background: "rgba(11,42,51,0.03)",
    borderBottom: `1px solid ${TOKENS.divider}`,
  },

  detailWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 6,
  },

  detailRow: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    flexWrap: "wrap",
  },

  label: {
    color: TOKENS.navy,
  },

  value: {
    color: TOKENS.navy,
  },

  diagBar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
  },

  diagChip: {
    border: "1px solid rgba(0,0,0,0.14)",
    background: "white",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 800,
    color: TOKENS.navy,
  },

  diagChipOn: {
    border: "1px solid rgba(47,143,139,0.50)",
    background: "rgba(47,143,139,0.10)",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 900,
    color: TOKENS.navy,
  },

  copyBtn: {
    border: "1px solid rgba(0,0,0,0.14)",
    background: "white",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontWeight: 800,
    color: TOKENS.navy,
  },

  detailPre: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: `1px solid ${TOKENS.divider}`,
    background: "rgba(255,255,255,0.65)",
    fontSize: 12,
    overflowX: "auto",
    maxHeight: 260,
  },

  detailErrBox: {
    background: "rgba(255,0,0,0.06)",
    border: "1px solid rgba(255,0,0,0.15)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },

  code: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
  },
};

const th = {
  padding: 12,
  borderBottom: `1px solid ${TOKENS.border}`,
  color: TOKENS.navy,
  background: "rgba(11,42,51,0.06)",
};

const td = {
  padding: 12,
  borderBottom: `1px solid ${TOKENS.divider}`,
};
