/**
 * Module: admin/src/pages/AdminMerchantOwnershipChange.jsx
 */

import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import {
  adminListMerchantUsers,
  adminTransferOwnership,
} from "../api/client";

const TOKENS = {
  navy: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.10)",
  divider: "rgba(0,0,0,0.06)",
  teal: "#2F8F8B",
  okBg: "rgba(47,143,139,0.10)",
  okBorder: "rgba(47,143,139,0.28)",
  errBg: "rgba(180,35,24,0.06)",
  errBorder: "rgba(180,35,24,0.22)",
  surface: "#FFFFFF",
};

function prettyStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function prettyRole(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "merchant_admin") return "'Owner'";
  if (s === "merchant_employee") return "Staff";
  if (s === "ap_clerk") return "Billing";
  return v || "—";
}

function displayLabel(u) {
  const email = String(u?.email || "").trim();
  const firstName = String(u?.firstName || "").trim();
  const lastName = String(u?.lastName || "").trim();
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (full && email) return `${full} — ${email}`;
  return full || email || "—";
}

export default function AdminMerchantOwnershipChange() {
  const { merchantId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [transferComplete, setTransferComplete] = React.useState(false);

  const [merchantName, setMerchantName] = React.useState("");
  const [users, setUsers] = React.useState([]);

  const [currentOwner, setCurrentOwner] = React.useState("");
  const [newOwner, setNewOwner] = React.useState("");
  const [reason, setReason] = React.useState("ownership_transfer");
  const [oldOwnerAction, setOldOwnerAction] = React.useState("suspend");

  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState("info");

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchantId]);

  async function load() {
    setLoading(true);

    try {
      const res = await adminListMerchantUsers(merchantId);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.users)
        ? res.users
        : [];

      console.log("[OWNERSHIP] load result", {
        merchantId,
        count: list.length,
        list,
      });

      setUsers(list);
      setMerchantName(String(res?.merchantName || "").trim());

      const activeOwnerOptions = list
        .filter(
          (u) =>
            String(u?.role || "").toLowerCase() === "merchant_admin" &&
            String(u?.status || "").toLowerCase() === "active" &&
            String(u?.email || "").trim()
        )
        .map((u) => String(u.email).trim());

      if (!activeOwnerOptions.includes(String(currentOwner || "").trim())) {
        setCurrentOwner(activeOwnerOptions[0] || "");
      }
    } catch (e) {
      console.error("[OWNERSHIP] load failed", e);
      setMsg("Failed to load users: " + (e?.message || "Unknown error"));
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  }

  const currentOwnerOptions = React.useMemo(() => {
    return users
      .filter(
        (u) =>
          String(u?.role || "").toLowerCase() === "merchant_admin" &&
          String(u?.status || "").toLowerCase() === "active"
      )
      .map((u) => ({
        email: u.email,
        label: `${displayLabel(u)} · ${prettyStatus(u.status)}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users]);

  const newOwnerOptions = React.useMemo(() => {
    return users
      .filter((u) => String(u?.email || "").trim())
      .filter(
        (u) =>
          String(u?.email || "").trim() !== String(currentOwner || "").trim()
      )
      .map((u) => ({
        email: u.email,
        label: `${displayLabel(u)} · ${prettyRole(u.role)} · ${prettyStatus(
          u.status
        )}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users, currentOwner]);

  React.useEffect(() => {
    if (!newOwnerOptions.some((u) => u.email === newOwner)) {
      setNewOwner("");
    }
  }, [newOwnerOptions, newOwner]);

  const formLocked = loading || submitting || transferComplete;

  const canSubmit =
    !loading &&
    !submitting &&
    !transferComplete &&
    currentOwner &&
    newOwner &&
    currentOwner !== newOwner;

  async function handleSubmit() {
    console.log("[OWNERSHIP] submit clicked", {
      merchantId,
      currentOwner,
      newOwner,
      reason,
      oldOwnerAction,
      transferComplete,
    });

    if (transferComplete) {
      console.log("[OWNERSHIP] blocked: transfer already completed");
      return;
    }

    setMsg("");
    setMsgType("info");

    if (!currentOwner) {
      console.log("[OWNERSHIP] blocked: no current owner");
      setMsg("Select the current active 'owner'.");
      setMsgType("error");
      return;
    }

    if (!newOwner) {
      console.log("[OWNERSHIP] blocked: no new owner");
      setMsg("Select the new 'owner'.");
      setMsgType("error");
      return;
    }

    if (currentOwner === newOwner) {
      console.log("[OWNERSHIP] blocked: same owner selected");
      setMsg("Current owner and new owner cannot be the same.");
      setMsgType("error");
      return;
    }

    setSubmitting(true);

    try {
      console.log("[OWNERSHIP] posting transfer request");

      const result = await adminTransferOwnership({
        merchantId: Number(merchantId),
        currentOwnerEmail: currentOwner,
        newOwnerEmail: newOwner,
        reason,
        oldOwnerAction,
      });

      console.log("[OWNERSHIP] success", result);

      const completedNewOwner = newOwner;
      const completedOldOwnerAction = oldOwnerAction;

      await load();

      setTransferComplete(true);
      setCurrentOwner("");
      setNewOwner("");

      setMsg(
        `Ownership transferred. '${completedNewOwner}' is now the active 'owner'. Previous owner action: ${completedOldOwnerAction}. Confirm Transfer has been disabled for this completed action.`
      );
      setMsgType("success");
    } catch (e) {
      console.error("[OWNERSHIP] failed", e);
      setMsg("Failed: " + (e?.message || "Unknown error"));
      setMsgType("error");
    } finally {
      setSubmitting(false);
    }
  }

  const msgStyle =
    msgType === "error"
      ? styles.errBox
      : msgType === "success"
      ? styles.okBox
      : styles.infoBox;

  return (
    <div style={styles.page}>
      <PageContainer size="page">
        <div style={styles.topLinkRow}>
          <Link to={`/merchants/${merchantId}`} style={styles.link}>
            ← Back to Merchant
          </Link>
        </div>

        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>Change 'Owner' Access</h2>
            <div style={styles.subhead}>
              Transfer ownership and define what happens to the previous owner.
            </div>
            <div style={styles.orgRow}>
              Organization:{" "}
              <code style={styles.code}>
                {merchantName || merchantId || "—"}
              </code>
            </div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Ownership Transfer</div>
          <div style={styles.cardHelp}>
            Only an <b>active</b> current 'owner' can be used as the source for a
            transfer.
          </div>

          {loading ? <div style={styles.loading}>Loading...</div> : null}

          <div style={styles.formGrid}>
            <div style={styles.field}>
              <label style={styles.label}>Current Owner</label>
              <select
                value={currentOwner}
                onChange={(e) => setCurrentOwner(e.target.value)}
                disabled={formLocked}
                style={styles.select}
              >
                <option value="">Select active current owner</option>
                {currentOwnerOptions.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>New Owner</label>
              <select
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                disabled={formLocked}
                style={styles.select}
              >
                <option value="">Select new owner</option>
                {newOwnerOptions.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={formLocked}
                style={styles.select}
              >
                <option value="ownership_transfer">Ownership transfer</option>
                <option value="business_sold">Business sold</option>
                <option value="credentials_lost">Credentials lost</option>
                <option value="admin_correction">Administrative correction</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Previous Owner Action</label>
              <select
                value={oldOwnerAction}
                onChange={(e) => setOldOwnerAction(e.target.value)}
                disabled={formLocked}
                style={styles.select}
              >
                <option value="suspend">Suspend</option>
                <option value="demote">Demote to Staff</option>
                <option value="keep">Keep active temporarily</option>
              </select>
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                ...styles.primaryBtn,
                ...(canSubmit ? null : styles.btnDisabled),
              }}
            >
              {submitting
                ? "Working..."
                : transferComplete
                ? "Transfer Complete"
                : "Confirm Transfer"}
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={submitting}
              style={{
                ...styles.secondaryBtn,
                ...(submitting ? styles.btnDisabled : null),
              }}
            >
              Back
            </button>
          </div>

          {msg ? <div style={msgStyle}>{msg}</div> : null}
        </div>
      </PageContainer>
    </div>
  );
}

const styles = {
  page: {
    background: "#FEFCF7",
    minHeight: "calc(100vh - 72px)",
    color: TOKENS.navy,
    paddingTop: 28,
    paddingBottom: 28,
  },

  topLinkRow: {
    marginBottom: 12,
  },

  link: {
    color: TOKENS.teal,
    textDecoration: "none",
    fontWeight: 700,
  },

  headerRow: {
    marginBottom: 18,
  },

  title: {
    margin: 0,
    marginBottom: 8,
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 900,
    color: TOKENS.navy,
  },

  subhead: {
    color: TOKENS.muted,
    fontSize: 15,
    marginBottom: 8,
  },

  orgRow: {
    color: TOKENS.muted,
    fontSize: 12,
  },

  card: {
    background: TOKENS.surface,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },

  cardTitle: {
    fontWeight: 900,
    fontSize: 16,
    marginBottom: 6,
  },

  cardHelp: {
    color: TOKENS.muted,
    fontSize: 13,
    marginBottom: 16,
  },

  loading: {
    color: TOKENS.muted,
    marginBottom: 12,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  field: {
    minWidth: 0,
  },

  label: {
    display: "block",
    fontSize: 12,
    color: TOKENS.muted,
    marginBottom: 6,
  },

  select: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#fff",
    color: TOKENS.navy,
    fontSize: 14,
    outline: "none",
  },

  buttonRow: {
    display: "flex",
    gap: 12,
    marginTop: 18,
    flexWrap: "wrap",
  },

  primaryBtn: {
    minWidth: 180,
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.16)",
    background: "#fff",
    color: TOKENS.navy,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryBtn: {
    minWidth: 110,
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.16)",
    background: "#fff",
    color: TOKENS.navy,
    fontWeight: 800,
    cursor: "pointer",
  },

  btnDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  okBox: {
    marginTop: 16,
    padding: 12,
    border: `1px solid ${TOKENS.okBorder}`,
    borderRadius: 12,
    background: TOKENS.okBg,
    color: TOKENS.navy,
    whiteSpace: "pre-wrap",
  },

  errBox: {
    marginTop: 16,
    padding: 12,
    border: `1px solid ${TOKENS.errBorder}`,
    borderRadius: 12,
    background: TOKENS.errBg,
    color: TOKENS.navy,
    whiteSpace: "pre-wrap",
  },

  infoBox: {
    marginTop: 16,
    padding: 12,
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 12,
    background: "#fff",
    color: TOKENS.navy,
    whiteSpace: "pre-wrap",
  },

  code: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
  },
};