/**
 * AdminSystem.jsx — System admin: cron job monitor
 * Route: /admin/system
 * Access: pv_admin only
 */

import React from "react";
import { color } from "../theme";
import { API_BASE, getAccessToken } from "../api/client";

async function fetchCronLogs() {
  const token = getAccessToken();
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
        <button style={s.refreshBtn} onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
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
      {/* Test Health */}
      <TestHealthSection />

      {/* Agent Pipeline */}
      <AgentPipelineSection />
    </div>
  );
}

function TestHealthSection() {
  const [health, setHealth] = React.useState(null);
  const [running, setRunning] = React.useState(false);
  const [runResult, setRunResult] = React.useState(null);

  React.useEffect(() => {
    const token = getAccessToken();
    fetch(`${API_BASE}/admin/system/test-health`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => setHealth(d))
      .catch(() => {});
  }, []);

  const handleRunTests = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/admin/system/test-run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setRunResult(data);
    } catch (e) {
      setRunResult({ success: false, message: e?.message || "Failed to run tests" });
    }
    setRunning(false);
  };

  if (!health) return null;

  const cats = health.categories || {};
  const lastRun = health.lastRun;

  return (
    <div style={s.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={s.sectionTitle}>Test Health — {health.totalTestFiles} test files</div>
        {health.environment !== "production" && (
          <button style={s.refreshBtn} onClick={handleRunTests} disabled={running}>
            {running ? "Running tests..." : "Run All Tests"}
          </button>
        )}
        {health.environment === "production" && (
          <span style={{ fontSize: 11, color: color.muted }}>Tests run locally via QA dashboard (localhost:4100)</span>
        )}
      </div>

      {/* Category breakdown */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {Object.entries(cats).map(([cat, files]) => (
          <div key={cat} style={{
            padding: "8px 12px", borderRadius: 8, background: "#fff",
            border: `1px solid ${color.border}`, fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, color: color.navy, textTransform: "capitalize" }}>{cat.replace(/-/g, " ")}</div>
            <div style={{ color: color.muted }}>{files.length} files</div>
          </div>
        ))}
      </div>

      {/* Last run results */}
      {lastRun && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: lastRun.failedTests === 0 ? "#F0FDF4" : "#FEF2F2",
          border: `1px solid ${lastRun.failedTests === 0 ? "#BBF7D0" : "#FECACA"}`,
          marginBottom: 8,
        }}>
          <strong>Last run:</strong> {lastRun.passedTests}/{lastRun.totalTests} passed
          {lastRun.failedTests > 0 && ` · ${lastRun.failedTests} failed`}
          {lastRun.timestamp && ` · ${new Date(lastRun.timestamp).toLocaleString()}`}
          {lastRun.duration && ` · ${(lastRun.duration / 1000).toFixed(1)}s`}
        </div>
      )}

      {/* Run result */}
      {runResult && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: runResult.success ? "#F0FDF4" : "#FEF2F2",
          border: `1px solid ${runResult.success ? "#BBF7D0" : "#FECACA"}`,
        }}>
          {runResult.success
            ? <span style={{ color: "#2E7D32", fontWeight: 700 }}>All {runResult.totalTests} tests passed ({(runResult.duration / 1000).toFixed(1)}s)</span>
            : runResult.message
              ? <span style={{ color: "#C62828" }}>{runResult.message}</span>
              : <span style={{ color: "#C62828", fontWeight: 700 }}>{runResult.failed} of {runResult.totalTests} tests failed</span>
          }
          {runResult.failures?.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {runResult.failures.map((f, i) => (
                <div key={i} style={{ color: "#C62828", fontSize: 11, marginTop: 2 }}>
                  {f.file}: {f.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentPipelineSection() {
  const [logs, setLogs] = React.useState(null);
  const [docs, setDocs] = React.useState(null);
  const [running, setRunning] = React.useState(false);
  const [runResult, setRunResult] = React.useState(null);
  const [showDoc, setShowDoc] = React.useState(null);

  React.useEffect(() => {
    const token = getAccessToken();
    Promise.all([
      fetch(`${API_BASE}/admin/system/agent-logs`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/admin/system/generated-docs`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
    ]).then(([l, d]) => { setLogs(l); setDocs(d); }).catch(() => {});
  }, []);

  const handleRunPipeline = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/admin/system/deploy-hook`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      setRunResult(data);
      // Reload logs
      const logsRes = await fetch(`${API_BASE}/admin/system/agent-logs`, { headers: { Authorization: `Bearer ${token}` } });
      if (logsRes.ok) setLogs(await logsRes.json());
      const docsRes = await fetch(`${API_BASE}/admin/system/generated-docs`, { headers: { Authorization: `Bearer ${token}` } });
      if (docsRes.ok) setDocs(await docsRes.json());
    } catch (e) {
      setRunResult({ message: e?.message || "Pipeline failed" });
    }
    setRunning(false);
  };

  return (
    <div style={s.section}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={s.sectionTitle}>AI Support Pipeline</div>
        <button style={s.refreshBtn} onClick={handleRunPipeline} disabled={running}>
          {running ? "Running pipeline..." : "Run Full Pipeline"}
        </button>
      </div>

      {/* Pipeline run result */}
      {runResult && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 12,
          background: runResult.agents ? "#F0FDF4" : "#FEF2F2",
          border: `1px solid ${runResult.agents ? "#BBF7D0" : "#FECACA"}`,
        }}>
          <strong>{runResult.message}</strong>
          {runResult.agents?.map((a, i) => (
            <div key={i} style={{ marginTop: 4, color: a.changed ? "#2E7D32" : color.muted }}>
              {a.changed ? "✓" : "—"} {a.agent} {a.durationMs ? `(${(a.durationMs / 1000).toFixed(1)}s)` : ""}
            </div>
          ))}
        </div>
      )}

      {/* Knowledge graph stats */}
      {docs?.kgStats && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { label: "Pages", value: docs.kgStats.pages },
            { label: "Flows", value: docs.kgStats.flows },
            { label: "Error Codes", value: docs.kgStats.errorCodes },
            { label: "Snapshots", value: docs.snapshots?.length || 0 },
          ].map(s => (
            <div key={s.label} style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: `1px solid ${color.border}`, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: color.navy }}>{s.value}</div>
              <div style={{ color: color.muted }}>{s.label}</div>
            </div>
          ))}
          <div style={{ padding: "8px 14px", borderRadius: 8, background: "#fff", border: `1px solid ${color.border}`, fontSize: 11, color: color.muted }}>
            Source: {docs.kgStats.source || "manual seed"}<br />
            Updated: {docs.kgStats.generatedAt ? new Date(docs.kgStats.generatedAt).toLocaleDateString() : "—"}
          </div>
        </div>
      )}

      {/* Generated docs */}
      {docs?.docs && Object.keys(docs.docs).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.navy, marginBottom: 6 }}>Generated Documentation</div>
          {Object.entries(docs.docs).map(([name, content]) => (
            <div key={name} style={{ marginBottom: 6 }}>
              <button
                onClick={() => setShowDoc(showDoc === name ? null : name)}
                style={{ background: "none", border: `1px solid ${color.border}`, borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: color.navy }}
              >
                {showDoc === name ? "▲" : "▼"} {name} ({content.length} chars)
              </button>
              {showDoc === name && (
                <pre style={{ fontSize: 11, color: color.muted, background: "#fff", padding: 12, borderRadius: 8, border: `1px solid ${color.border}`, overflow: "auto", maxHeight: 400, whiteSpace: "pre-wrap", marginTop: 4 }}>
                  {content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recent agent logs */}
      {logs?.logs?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.navy, marginBottom: 6 }}>Recent Agent Runs</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Agent</th>
                <th style={s.th}>Triggered By</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Changed</th>
                <th style={s.th}>Duration</th>
                <th style={s.th}>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.logs.slice(0, 20).map(log => (
                <tr key={log.id}>
                  <td style={s.td}>{log.agentName}</td>
                  <td style={{ ...s.td, fontSize: 11 }}>{log.triggeredBy}</td>
                  <td style={s.td}>
                    <span style={log.status === "complete" ? s.statusOk : log.status === "skipped" ? s.statusNever : s.statusFail}>
                      {log.status}
                    </span>
                  </td>
                  <td style={s.td}>{log.outputChanged ? "Yes" : "—"}</td>
                  <td style={s.td}>{log.durationMs ? fmtDuration(log.durationMs) : "—"}</td>
                  <td style={{ ...s.td, fontSize: 11 }}>{fmtTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
