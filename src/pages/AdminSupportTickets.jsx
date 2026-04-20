/**
 * AdminSupportTickets.jsx — Support ticket management
 * Route: /admin/support
 * Access: pv_admin only
 */

import React from "react";
import { color } from "../theme";
import { API_BASE, getAccessToken } from "../api/client";

const C = {
  navy: color.navy || "#0B2A33",
  teal: "#1D9E75", tealBg: "#E1F5EE",
  amber: "#EF9F27", amberBg: "#FFFBF2",
  red: "#E24B4A", redBg: "#FEF2F2",
  muted: "#888780", border: "#E5E5E0", bg: "#F4F4F0",
};

const priorityStyle = {
  critical: { bg: "#FEE2E2", color: "#A32D2D", label: "CRITICAL" },
  high: { bg: "#FEE2E2", color: "#A32D2D", label: "HIGH" },
  normal: { bg: "#F5F5F5", color: "#666", label: "NORMAL" },
};

const statusStyle = {
  open: { bg: C.amberBg, color: C.amber, label: "Open" },
  in_progress: { bg: C.tealBg, color: C.teal, label: "In Progress" },
  resolved: { bg: "#F0FDF4", color: "#2E7D32", label: "Resolved" },
};

async function fetchTickets() {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/admin/support/tickets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load tickets");
  return res.json();
}

async function updateTicket(id, data) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/admin/support/tickets/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update ticket");
  return res.json();
}

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function Badge({ type, map }) {
  const s = map[type] || map.normal || { bg: "#eee", color: "#999", label: type };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function AdminSupportTickets() {
  const [tickets, setTickets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(null);
  const [resolveNote, setResolveNote] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTickets();
      setTickets(data.tickets || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const handleResolve = async (id) => {
    await updateTicket(id, { status: "resolved", resolutionNote: resolveNote || "Resolved" });
    setResolveNote("");
    setExpanded(null);
    load();
  };

  const handleInProgress = async (id) => {
    await updateTicket(id, { status: "in_progress" });
    load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading tickets...</div>;

  const openCount = tickets.filter(t => t.status === "open").length;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.navy }}>Support Tickets</div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {openCount > 0 ? `${openCount} open ticket${openCount === 1 ? "" : "s"}` : "No open tickets"}
          </div>
        </div>
        <button onClick={load} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.navy }}>
          Refresh
        </button>
      </div>

      {tickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.muted }}>No support tickets yet.</div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
          {tickets.map((t, idx) => (
            <React.Fragment key={t.id}>
              <div
                style={{
                  padding: "14px 18px", cursor: "pointer",
                  borderTop: idx > 0 ? `1px solid ${C.border}` : "none",
                  background: expanded === t.id ? C.bg : t.status === "open" ? "#fff" : "rgba(0,0,0,0.01)",
                }}
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>#{t.id}</span>
                      <Badge type={t.priority} map={priorityStyle} />
                      <Badge type={t.status} map={statusStyle} />
                      <span style={{ fontSize: 12, color: C.muted }}>{t.merchantName || `Merchant #${t.merchantId}`}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.navy, lineHeight: 1.4 }}>
                      {t.aiDiagnosis || "No AI diagnosis available"}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Page: {t.page} · {fmtTime(t.createdAt)}
                      {t.daysOnPlatform != null && ` · ${t.daysOnPlatform} days on platform`}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: C.muted }}>{expanded === t.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {expanded === t.id && (
                <div style={{ padding: "0 18px 16px", background: C.bg, borderTop: `1px solid ${C.border}` }}>
                  {/* AI Diagnosis + Steps */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>AI DIAGNOSIS</div>
                    <div style={{ fontSize: 13, color: C.navy, background: "#fff", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}` }}>
                      {t.aiDiagnosis || "—"}
                      {t.aiConfidence && <span style={{ marginLeft: 8, fontSize: 10, color: C.muted }}>({t.aiConfidence} confidence)</span>}
                    </div>
                  </div>

                  {t.resolutionAttempted && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>RESOLUTION ATTEMPTED</div>
                      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.navy, lineHeight: 1.6 }}>
                        {(Array.isArray(t.resolutionAttempted) ? t.resolutionAttempted : []).map((s, i) => (
                          <li key={i}>{String(s).replace(/^\d+\.\s*/, "")}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Platform snapshot — structured */}
                  {t.platformSnapshot && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>PLATFORM CONTEXT</div>

                      {/* Session info */}
                      {t.platformSnapshot.session && (
                        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12 }}>
                          <strong>Page:</strong> {t.platformSnapshot.session.pathname || "—"} &nbsp;
                          <strong>Role:</strong> {t.platformSnapshot.session.merchantRole || t.platformSnapshot.session.systemRole || "—"} &nbsp;
                          <strong>Captured:</strong> {t.platformSnapshot.session.capturedAt ? fmtTime(t.platformSnapshot.session.capturedAt) : "—"}
                        </div>
                      )}

                      {/* Last API error */}
                      {t.platformSnapshot.api?.lastRequest && (
                        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12 }}>
                          <strong>Last API call:</strong> {typeof t.platformSnapshot.api.lastRequest === "object"
                            ? `${t.platformSnapshot.api.lastRequest.method} ${t.platformSnapshot.api.lastRequest.path} → ${t.platformSnapshot.api.lastRequest.status} (${t.platformSnapshot.api.lastRequest.ms}ms)`
                            : String(t.platformSnapshot.api.lastRequest)}
                          {t.platformSnapshot.api.lastError && t.platformSnapshot.api.lastError !== "—" && (
                            <span style={{ color: C.red, marginLeft: 8 }}>Error: {t.platformSnapshot.api.lastError}</span>
                          )}
                        </div>
                      )}

                      {/* Recent events */}
                      {t.platformSnapshot.recentEvents?.length > 0 && (
                        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 4 }}>RECENT EVENTS</div>
                          {t.platformSnapshot.recentEvents.slice(0, 8).map((e, i) => (
                            <div key={i} style={{ fontSize: 11, color: e.status >= 400 ? C.red : C.muted, padding: "2px 0" }}>
                              {e.ts ? new Date(e.ts).toLocaleTimeString() : "—"} &nbsp;
                              {e.method} {e.path} → {e.status || "pending"}
                              {e.ms && ` (${e.ms}ms)`}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Raw JSON (collapsible) */}
                      <details style={{ marginTop: 4 }}>
                        <summary style={{ fontSize: 11, color: C.teal, cursor: "pointer", fontWeight: 500 }}>Show raw snapshot</summary>
                        <pre style={{ fontSize: 10, color: C.muted, background: "#fff", padding: 10, borderRadius: 6, overflow: "auto", maxHeight: 200, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap", marginTop: 4 }}>
                          {JSON.stringify(t.platformSnapshot, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
                    {t.status === "open" && (
                      <button onClick={() => handleInProgress(t.id)} style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${C.teal}`, background: "transparent", color: C.teal, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Mark In Progress
                      </button>
                    )}
                    {(t.status === "open" || t.status === "in_progress") && (
                      <>
                        <input
                          value={resolveNote} onChange={e => setResolveNote(e.target.value)}
                          placeholder="Resolution note (optional)"
                          style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}
                        />
                        <button onClick={() => handleResolve(t.id)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: C.teal, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Resolve
                        </button>
                      </>
                    )}
                    {t.status === "resolved" && t.resolutionNote && (
                      <div style={{ fontSize: 12, color: "#2E7D32" }}>Resolved: {t.resolutionNote}</div>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
