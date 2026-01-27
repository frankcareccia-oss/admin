import React from "react";
import { Link, useNavigate } from "react-router-dom";

function pvUiHook(event, fields = {}) {
  try {
    console.log(
      JSON.stringify({
        pvUiHook: event,
        ts: new Date().toISOString(),
        ...fields,
      })
    );
  } catch {}
}

function classifyIdentifier(raw) {
  const v = String(raw || "").trim();
  const digits = v.replace(/[^\d]/g, "");
  const looksPhone = digits.length >= 10 && digits.length <= 15 && v.indexOf("@") === -1;
  const looksEmail = v.includes("@") && v.includes(".");
  return { kind: looksEmail ? "email" : looksPhone ? "phone" : "token", digits };
}

function maskIdentifier(raw) {
  const v = String(raw || "").trim();
  const { kind, digits } = classifyIdentifier(v);

  if (kind === "email") {
    const [u, d] = v.split("@");
    const uMasked = u ? `${u.slice(0, 2)}***` : "***";
    return `${uMasked}@${d || "***"}`;
  }

  if (kind === "phone") {
    const last4 = digits.slice(-4);
    return `***-***-${last4 || "****"}`;
  }

  return v.length <= 6 ? "***" : `${v.slice(0, 3)}***${v.slice(-2)}`;
}

function getApiBase() {
  // Keep it simple + local; aligns with backend default.
  return "http://localhost:3001";
}

function friendlyErrorFromResponse(status, body) {
  const code = body?.error?.code || body?.code || null;
  const message = body?.error?.message || body?.message || null;

  if (status === 401) return "You are not logged in. Please log in again.";
  if (status === 403) return message || "You do not have permission to use POS.";
  if (status === 404) return "Not found.";
  if (status === 400) return message || "Please check the input and try again.";
  if (status >= 500) return "Server error. Please try again.";

  return message || `Request failed (${code || status}).`;
}

export default function PosRegisterVisit() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);

  const inputRef = React.useRef(null);

  React.useEffect(() => {
    pvUiHook("pos.visit.page_loaded.ui", {
      tc: "TC-POS-VISIT-UI-01",
      sev: "info",
      stable: "pos:visit",
    });

    // Keyboard-first: focus immediately
    setTimeout(() => {
      try {
        inputRef.current?.focus();
      } catch {}
    }, 0);
  }, []);

  async function callRegisterVisit(v) {
    // JWT is stored by your UI auth flow; keep it compatible.
    const token =
      localStorage.getItem("perkvalet_access_token") ||
      localStorage.getItem("access_token") ||
      "";

    const res = await fetch(`${getApiBase()}/pos/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
        // Replay/idempotency requirements:
        "X-POS-Timestamp": new Date().toISOString(),
        "X-POS-Idempotency-Key": `ui-visit-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      },
      body: JSON.stringify({ identifier: v }),
    });

    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      throw new Error(friendlyErrorFromResponse(res.status, body));
    }

    return body;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const started = Date.now();

    setBusy(true);
    setError("");
    setResult(null);

    const v = String(identifier || "").trim();
    const { kind } = classifyIdentifier(v);

    pvUiHook("pos.visit.submit_clicked.ui", {
      tc: "TC-POS-VISIT-UI-02",
      sev: "info",
      stable: "pos:visit",
      identifierKind: kind,
      identifierMasked: maskIdentifier(v),
    });

    try {
      if (!v) throw new Error("Customer identifier is required.");

      const res = await callRegisterVisit(v);
      setResult(res);

      pvUiHook("pos.visit.submit_succeeded.ui", {
        tc: "TC-POS-VISIT-UI-03",
        sev: "info",
        stable: "pos:visit",
        identifierKind: kind,
        identifierMasked: maskIdentifier(v),
        ms: Date.now() - started,
        visitId: res?.visitId || null,
      });

      // UX: send user back to POS dashboard with a success banner
      navigate("/merchant/pos?success=visit");
    } catch (err) {
      const msg = err?.message || "Failed to register visit.";
      setError(msg);

      pvUiHook("pos.visit.submit_failed.ui", {
        tc: "TC-POS-VISIT-UI-04",
        sev: "warn",
        stable: "pos:visit",
        identifierKind: kind,
        identifierMasked: maskIdentifier(v),
        ms: Date.now() - started,
        error: msg,
      });

      // Keep focus ready for retry
      try {
        inputRef.current?.focus();
        inputRef.current?.select();
      } catch {}
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <Link to="/merchant/pos" style={styles.pill}>
          ← POS Dashboard
        </Link>
        <Link to="/merchant/pos/reward" style={styles.pill}>
          Grant Reward
        </Link>
      </div>

      <h2>Register Visit</h2>
      <div style={{ color: "rgba(0,0,0,0.65)", marginBottom: 14 }}>
        Enter a customer identifier (phone, email, or scan token).
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          ref={inputRef}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Phone / Email / Token"
          inputMode="text"
          autoComplete="off"
          style={styles.input}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button disabled={busy} type="submit" style={styles.primaryBtn}>
            {busy ? "Working..." : "Register"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setIdentifier("");
              setError("");
              setResult(null);
              try {
                inputRef.current?.focus();
              } catch {}
            }}
            style={styles.secondaryBtn}
          >
            Clear
          </button>
        </div>
      </form>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {result ? <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre> : null}
    </div>
  );
}

const styles = {
  pill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    textDecoration: "none",
    color: "inherit",
    fontWeight: 700,
  },
  input: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.22)",
  },
  primaryBtn: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    width: 180,
  },
  secondaryBtn: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
  },
  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    color: "red",
    border: "1px solid rgba(255,0,0,0.18)",
    background: "rgba(255,0,0,0.04)",
  },
  pre: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.02)",
    overflowX: "auto",
  },
};
