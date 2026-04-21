/**
 * SupportWidget.jsx — AI-powered support state machine
 *
 * States:
 *   quiet    → small ? icon (default)
 *   alert    → red pill "Something went wrong — tap for help"
 *   diagnose → "Looking into this..." with spinner
 *   result   → "Here's what happened" + diagnosis + steps
 *   ticket   → "Your request is in — we'll follow up shortly"
 *   expanded → full support panel (existing SupportInfo content)
 *
 * Auto-triggers alert mode on any 4xx/5xx API response.
 */

import React from "react";
import { API_BASE, getAccessToken, pvSupportGetSnapshot, pvSupportGetRecentApiEvents } from "../api/client";
import { color } from "../theme";

const C = {
  teal: "#1D9E75", tealBg: "#E1F5EE",
  red: "#E24B4A", redBg: "#FEF2F2",
  amber: "#EF9F27",
  navy: color.navy || "#0B2A33",
  muted: "#888780",
  border: "#E5E5E0",
  bg: "#fff",
};

const s = {
  quiet: {
    position: "fixed", bottom: 16, left: 16, zIndex: 9999,
    width: 36, height: 36, borderRadius: "50%",
    background: "rgba(0,0,0,0.06)", border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: 16, color: C.muted,
    transition: "all 0.3s",
  },
  alertPill: {
    position: "fixed", bottom: 16, left: 16, zIndex: 9999,
    padding: "8px 16px", borderRadius: 20,
    background: C.redBg, border: `1px solid ${C.red}`,
    display: "flex", alignItems: "center", gap: 8,
    cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.red,
    animation: "supportPulse 2s infinite",
  },
  card: {
    position: "fixed", bottom: 16, left: 16, zIndex: 9999,
    width: 360, maxHeight: 450, overflow: "auto",
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "16px 18px",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: 700, color: C.navy },
  closeBtn: { background: "none", border: "none", fontSize: 18, color: C.muted, cursor: "pointer", padding: 4 },
  diagnosisBox: { background: C.tealBg, border: `1px solid #BBF7D0`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 },
  diagnosisText: { fontSize: 13, color: C.navy, lineHeight: 1.5 },
  stepList: { margin: "8px 0", padding: "0 0 0 18px", fontSize: 13, color: C.navy, lineHeight: 1.7 },
  escalationBox: { background: C.redBg, border: `1px solid #FECACA`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 },
  actionBtn: (primary) => ({
    padding: "8px 16px", borderRadius: 8, border: primary ? "none" : `1px solid ${C.border}`,
    background: primary ? C.teal : "transparent", color: primary ? "#fff" : C.muted,
    fontSize: 12, fontWeight: 600, cursor: "pointer", marginRight: 8,
  }),
  spinner: { display: "inline-block", width: 16, height: 16, border: "2px solid #ddd", borderTop: `2px solid ${C.teal}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  ticketSuccess: { textAlign: "center", padding: "20px 0" },
  ticketId: { fontSize: 11, color: C.muted, marginTop: 8 },
  moreLink: { fontSize: 11, color: C.teal, cursor: "pointer", textDecoration: "none", fontWeight: 500, display: "inline-block", marginTop: 8 },
};

// Inject CSS animations
if (typeof document !== "undefined" && !document.getElementById("pv-support-styles")) {
  const style = document.createElement("style");
  style.id = "pv-support-styles";
  style.textContent = `
    @keyframes supportPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

export default function SupportWidget() {
  const [state, setState] = React.useState("quiet"); // quiet | alert | diagnose | result | ticket | expanded | orientation | ask_first | section_detail
  const [diagnosis, setDiagnosis] = React.useState(null);
  const [ticketId, setTicketId] = React.useState(null);
  const [context, setContext] = React.useState(null);
  const [orientation, setOrientation] = React.useState(null); // { title, summary, sections, pageId }
  const [sectionDetail, setSectionDetail] = React.useState(null);

  // Watch for API errors to auto-trigger alert mode
  React.useEffect(() => {
    const interval = setInterval(() => {
      try {
        const events = pvSupportGetRecentApiEvents?.() || [];
        // Only alert on 500+ errors (server errors), not 4xx (auth/permission — often expected)
        const recentError = events.find(e => e.direction === "in" && e.status >= 500 && (Date.now() - new Date(e.ts).getTime()) < 30000);
        if (recentError && state === "quiet") {
          setState("alert");
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [state]);

  const gatherContext = () => {
    try {
      const snapshot = pvSupportGetSnapshot?.() || {};
      // Always capture the current page from the browser
      const currentPage = window.location.hash?.replace("#", "") || window.location.pathname || "unknown";
      if (!snapshot.session) snapshot.session = {};
      snapshot.session.pathname = currentPage;
      snapshot.session.capturedAt = new Date().toISOString();
      return snapshot;
    } catch { return { session: { pathname: window.location.hash?.replace("#", "") || "unknown" } }; }
  };

  const handleTap = async () => {
    const ctx = gatherContext();
    setContext(ctx);

    // Always check mode endpoint first — let the server decide
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/support/mode`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });
      const data = await res.json();

      if (data.mode === "orientation") {
        setOrientation(data);
        setState("orientation");
      } else if (data.mode === "diagnosis") {
        handleDiagnose(ctx);
      } else {
        setState("ask_first");
      }
    } catch {
      setState("ask_first");
    }
  };

  const handleDiagnose = async (ctx) => {
    setState("diagnose");
    const context = ctx || gatherContext();
    setContext(context);

    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/support/diagnose`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });
      const data = await res.json();
      setDiagnosis(data);
      setState("result");
    } catch (e) {
      setDiagnosis({
        diagnosis: "We couldn't reach our support system right now. Try refreshing the page.",
        confidence: "low",
        resolution_steps: ["Refresh the page", "If the issue continues, email support@perksvalet.com"],
        requires_pv_support: false,
      });
      setState("result");
    }
  };

  const handleSectionTap = async (sectionId) => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/support/section/${orientation.pageId}/${sectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSectionDetail(data);
      setState("section_detail");
    } catch {
      setSectionDetail({ label: sectionId, description: "Details not available right now." });
      setState("section_detail");
    }
  };

  const handleCreateTicket = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/api/support/ticket`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ context, diagnosis }),
      });
      const data = await res.json();
      setTicketId(data.ticketId);
      setState("ticket");
    } catch {
      setState("ticket");
      setTicketId(null);
    }
  };

  const handleClose = () => {
    setState("quiet");
    setDiagnosis(null);
    setTicketId(null);
    setContext(null);
    setOrientation(null);
    setSectionDetail(null);
  };

  const handleCopyContext = () => {
    const ctx = context || gatherContext();
    const page = ctx?.session?.pathname || "unknown";
    const diag = diagnosis?.diagnosis || "No diagnosis";
    const steps = (diagnosis?.resolution_steps || []).map((s, i) => `${i + 1}. ${String(s).replace(/^\d+\.\s*/, "")}`).join("\n");
    const events = (ctx?.recentEvents || ctx?.apiEvents || [])
      .filter(e => e.direction === "in")
      .slice(-5)
      .map(e => `  ${e.ts ? new Date(e.ts).toLocaleTimeString() : "?"} ${e.method || ""} ${e.path || ""} → ${e.status || "?"}`)
      .join("\n");

    const text = `PerkValet Support Context
========================
Page: ${page}
Time: ${new Date().toLocaleString()}

Diagnosis: ${diag}

Steps suggested:
${steps || "  (none)"}

Recent API calls:
${events || "  (none)"}
`;

    navigator.clipboard?.writeText(text).then(() => {
      alert("Copied to clipboard!");
    }).catch(() => {
      // Fallback: select text
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Copied to clipboard!");
    });
  };

  // ── Quiet mode ─────────────────────────────────────────────
  if (state === "quiet") {
    return (
      <button style={s.quiet} onClick={handleTap} title="Get help">
        ?
      </button>
    );
  }

  // ── Alert mode ─────────────────────────────────────────────
  if (state === "alert") {
    return (
      <button style={s.alertPill} onClick={() => handleDiagnose()}>
        <span style={{ fontSize: 14 }}>&#9888;</span>
        Something went wrong — tap for help
      </button>
    );
  }

  // ── Ask First mode ─────────────────────────────────────────
  if (state === "ask_first") {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>What can I help you with?</div>
          <button style={s.closeBtn} onClick={handleClose}>&times;</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={{ ...s.actionBtn(false), width: "100%", textAlign: "left", padding: "10px 14px" }}
            onClick={() => { handleTap(); }}>
            Explain what's on this page
          </button>
          <button style={{ ...s.actionBtn(false), width: "100%", textAlign: "left", padding: "10px 14px" }}
            onClick={() => handleDiagnose()}>
            Something isn't working
          </button>
        </div>
      </div>
    );
  }

  // ── Orientation mode ───────────────────────────────────────
  if (state === "orientation" && orientation) {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>{orientation.title}</div>
          <button style={s.closeBtn} onClick={handleClose}>&times;</button>
        </div>
        <div style={{ fontSize: 13, color: C.navy, lineHeight: 1.5, marginBottom: 12 }}>
          {orientation.summary}
        </div>
        {orientation.sections?.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 6 }}>Tap a section to learn more:</div>
            {orientation.sections.map(sec => (
              <button key={sec.id}
                onClick={() => handleSectionTap(sec.id)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", marginBottom: 4, borderRadius: 6, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500, color: C.navy }}>
                › {sec.label}
              </button>
            ))}
          </>
        )}
        <div style={s.moreLink} onClick={() => handleDiagnose()}>
          Something not working? →
        </div>
      </div>
    );
  }

  // ── Section detail ─────────────────────────────────────────
  if (state === "section_detail" && sectionDetail) {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <button style={{ background: "none", border: "none", fontSize: 12, color: C.teal, cursor: "pointer", fontWeight: 500 }}
            onClick={() => setState("orientation")}>
            ‹ Back
          </button>
          <button style={s.closeBtn} onClick={handleClose}>&times;</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 8 }}>{sectionDetail.label}</div>
        <div style={{ fontSize: 13, color: C.navy, lineHeight: 1.6, marginBottom: 8 }}>
          {sectionDetail.description}
        </div>
        {sectionDetail.additionalInfo && (
          <div style={{ fontSize: 12, color: C.muted, background: C.tealBg, padding: "8px 12px", borderRadius: 6, lineHeight: 1.5 }}>
            {sectionDetail.additionalInfo}
          </div>
        )}
        <div style={s.moreLink} onClick={() => handleDiagnose()}>
          Something not working? →
        </div>
      </div>
    );
  }

  // ── Diagnosing ─────────────────────────────────────────────
  if (state === "diagnose") {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Looking into this...</div>
          <button style={s.closeBtn} onClick={handleClose}>&times;</button>
        </div>
        <div style={{ textAlign: "center", padding: 20 }}>
          <div style={s.spinner} />
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────
  if (state === "result" && diagnosis) {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Here's what happened</div>
          <button style={s.closeBtn} onClick={handleClose}>&times;</button>
        </div>

        {diagnosis.requires_pv_support ? (
          <div style={s.escalationBox}>
            <div style={s.diagnosisText}>{diagnosis.diagnosis}</div>
          </div>
        ) : (
          <div style={s.diagnosisBox}>
            <div style={s.diagnosisText}>{diagnosis.diagnosis}</div>
          </div>
        )}

        {diagnosis.resolution_steps?.length > 0 && (
          <ol style={s.stepList}>
            {diagnosis.resolution_steps.map((step, i) => (
              <li key={i}>{String(step).replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
        )}

        {diagnosis.requires_pv_support ? (
          <>
            <div style={{ fontSize: 13, color: C.navy, marginBottom: 12, fontWeight: 500 }}>
              We've got everything we need
            </div>
            <button style={s.actionBtn(true)} onClick={handleCreateTicket}>
              Open support request
            </button>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center" }}>
            <button style={s.actionBtn(true)} onClick={handleClose}>Got it</button>
            <button style={s.actionBtn(false)} onClick={handleCreateTicket}>This didn't help</button>
          </div>
        )}

        <div style={s.moreLink} onClick={() => setState("expanded")}>
          Show technical details
        </div>
      </div>
    );
  }

  // ── Ticket confirmed ───────────────────────────────────────
  if (state === "ticket") {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Support Request</div>
          <button style={s.closeBtn} onClick={handleClose}>&times;</button>
        </div>
        <div style={s.ticketSuccess}>
          <div style={{ fontSize: 32, marginBottom: 8, color: C.teal }}>&#10003;</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.navy, marginBottom: 6 }}>
            Your request is in — we'll follow up shortly
          </div>
          {ticketId && <div style={s.ticketId}>Reference: #{ticketId}</div>}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
            We've captured everything we need — no need to explain the issue again.
          </div>
        </div>
        <button style={{ ...s.actionBtn(true), width: "100%", textAlign: "center" }} onClick={handleClose}>Done</button>
      </div>
    );
  }

  // ── Expanded (full support panel — for tech details) ───────
  if (state === "expanded") {
    const ctx = context || gatherContext();
    const page = ctx?.session?.pathname || "unknown";
    const recentEvents = (ctx?.recentEvents || ctx?.apiEvents || []).filter(e => e.direction === "in").slice(-8);

    return (
      <div style={{ ...s.card, maxHeight: 500 }}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Support Details</div>
          <button style={s.closeBtn} onClick={() => setState("result")}>&times;</button>
        </div>

        {/* Structured summary */}
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <div style={{ marginBottom: 6 }}><strong>Page:</strong> {page}</div>
          <div style={{ marginBottom: 6 }}><strong>Time:</strong> {new Date().toLocaleString()}</div>
          {diagnosis?.diagnosis && <div style={{ marginBottom: 6 }}><strong>Diagnosis:</strong> {diagnosis.diagnosis}</div>}
        </div>

        {/* Recent API calls */}
        {recentEvents.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Recent API calls:</div>
            {recentEvents.map((e, i) => (
              <div key={i} style={{ fontSize: 11, color: e.status >= 400 ? "#E24B4A" : C.muted, padding: "1px 0" }}>
                {e.ts ? new Date(e.ts).toLocaleTimeString() : "?"} {e.method} {e.path} → {e.status || "pending"} {e.ms ? `(${e.ms}ms)` : ""}
              </div>
            ))}
          </div>
        )}

        {/* Raw JSON (collapsible) */}
        <details style={{ marginBottom: 8 }}>
          <summary style={{ fontSize: 11, color: C.teal, cursor: "pointer" }}>Show raw data</summary>
          <pre style={{ fontSize: 9, color: C.muted, background: "#f5f5f5", padding: 8, borderRadius: 6, overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap", marginTop: 4 }}>
            {JSON.stringify(ctx, null, 2)}
          </pre>
        </details>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.actionBtn(true)} onClick={handleCopyContext}>Copy to clipboard</button>
          <button style={s.actionBtn(false)} onClick={() => setState("result")}>Back to diagnosis</button>
        </div>
      </div>
    );
  }

  return null;
}
