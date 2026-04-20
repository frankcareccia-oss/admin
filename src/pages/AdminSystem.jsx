/**
 * AdminSystem.jsx — System admin: cron job monitor
 * Route: /admin/system
 * Access: pv_admin only
 */

import React from "react";
import { color } from "../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function fetchCronLogs() {
  const token = localStorage.getItem("pv_token");
  const res = await fetch(`${API_BASE}/admin/system/cron-logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load cron logs");
  return res.json();
}

const s = {
  page: { padding: "20px" },
  title: { fontSize: 20, fontWeight: 700, color: color.navy, marginBottom: 16 },
  subtitle: { fontSize: 14, color: color.muted, marginBottom: 20 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: `2px solid ${color.border}`, color: color.muted, fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" },
  td: { padding: "10px 12px", borderBottom: `1px solid ${color.border}` },
  statusOk: { display: "inline-block", background: "#E8F5E9", color: "#2E7D32", fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px" },
  statusFail: { display: "inline-block", background: "#FFEBEE", color: "#C62828", fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px" },
  statusNever: { display: "inline-block", background: "#F5F5F5", color: "#9E9E9E", fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: color.navy, marginBottom: 10 },
  refreshBtn: {
    padding: "6px 16px", borderRadius: 6, border: `1px solid ${color.border}`,
    background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: color.navy,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  loading: { textAlign: "center", padding: 40, color: color.muted },
  error: { background: "#FFEBEE", padding: 12, borderRadius: 8, color: "#C62828", fontSize: 13 },
};

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function summarize(summary) {
  if (!summary) return "—";
  if (typeof summary === "string") return summary;
  if (summary.totalTransactions != null) return `${summary.totalTransactions} txns`;
  if (summary.totalProcessed != null) return `${summary.totalProcessed} merchants`;
  return JSON.stringify(summary).slice(0, 60);
}

export default function AdminSystem() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const d = await fetchCronLogs();
      setData(d);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // Auto-retry: if initial load failed, poll every 2s until token works (max 5 retries)
  const retryRef = React.useRef(0);
  React.useEffect(() => {
    if (!err || retryRef.current >= 5) return;
    const timer = setTimeout(() => {
      retryRef.current++;
      load();
    }, 2000);
    return () => clearTimeout(timer);
  }, [err, load]);

  if (loading && !data) return <div style={s.loading}>Loading...</div>;
  if (err && !data) return (
    <div style={s.error}>
      {err}
      <button style={{ ...s.refreshBtn, marginLeft: 12 }} onClick={() => { retryRef.current = 0; load(); }}>Retry</button>
    </div>
  );

  const latest = data?.latest || [];
  const logs = data?.logs || [];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.title}>System — Scheduled Jobs</div>
          <div style={s.subtitle}>Cron job execution monitor. pv_admin only.</div>
        </div>
        <button style={s.refreshBtn} onClick={load}>Refresh</button>
      </div>

      {/* Latest run per job */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Current Status</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Job</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Last Run</th>
              <th style={s.th}>Duration</th>
              <th style={s.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {latest.map(job => (
              <tr key={job.jobName}>
                <td style={s.td}>{job.jobName}</td>
                <td style={s.td}>
                  <span style={job.status === "ok" ? s.statusOk : job.status === "failed" ? s.statusFail : s.statusNever}>
                    {job.status === "ok" ? "✓ OK" : job.status === "failed" ? "✗ FAIL" : "Never run"}
                  </span>
                </td>
                <td style={s.td}>{fmtTime(job.lastRun)}</td>
                <td style={s.td}>{fmtDuration(job.durationMs)}</td>
                <td style={{ ...s.td, fontSize: 12, color: job.error ? "#C62828" : color.muted }}>
                  {job.error || summarize(job.summary)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Full history */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Recent History (last 50 runs)</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Job</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Started</th>
              <th style={s.th}>Duration</th>
              <th style={s.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ background: log.status === "failed" ? "#FFF5F5" : "transparent" }}>
                <td style={s.td}>{log.jobName}</td>
                <td style={s.td}>
                  <span style={log.status === "ok" ? s.statusOk : s.statusFail}>
                    {log.status === "ok" ? "✓" : "✗"}
                  </span>
                </td>
                <td style={s.td}>{fmtTime(log.startedAt)}</td>
                <td style={s.td}>{fmtDuration(log.durationMs)}</td>
                <td style={{ ...s.td, fontSize: 12, color: log.error ? "#C62828" : color.muted }}>
                  {log.error || summarize(log.summary)}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={5} style={{ ...s.td, textAlign: "center", color: color.muted }}>No cron runs recorded yet. Jobs will appear after their next scheduled execution.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
