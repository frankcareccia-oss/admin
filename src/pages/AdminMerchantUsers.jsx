/**
 * Module: admin/src/pages/AdminMerchantUsers.jsx
 *
 * Admin merchant users page (pv_admin)
 *
 * Responsibilities:
 *  - Read-only listing of merchant users for pv_admin
 *  - Lazy-load row detail diagnostics
 *  - Recovery path for merchants:
 *      - zero users  -> create first 'owner' access
 *      - existing users -> refresh / replace / create 'owner' access
 */

import React from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  adminListMerchantUsers,
  adminGetMerchantUser,
  adminCreateMerchantUser,
  adminUpdateMerchantUser,
  getMerchant,
  getSystemRole,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import { color, btn, inputStyle as themeInput } from "../theme";

const STATUS_COLORS = {
  active:    { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  suspended: { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  archived:  { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.50)",  border: "1px solid rgba(0,0,0,0.12)" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.archived;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}


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

function prettyRole(role) {
  const v = String(role || "").trim().toLowerCase();
  if (!v) return "—";
  if (v === "merchant_admin") return "Owner";
  if (v === "owner") return "Owner";
  if (v === "merchant_employee") return "Staff";
  if (v === "ap_clerk") return "Billing Clerk";
  if (v === "store_admin") return "Store Admin";
  if (v === "store_subadmin") return "Store Staff";
  if (v === "pv_admin") return "PV Admin";
  if (v === "pv_support") return "PV Support";
  return role;
}

function prettyStatus(status) {
  const v = String(status || "").trim().toLowerCase();
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function userDisplayLabel(mu) {
  const email =
    mu?.email ||
    mu?.user?.email ||
    mu?.contactEmail ||
    mu?.userEmail ||
    "";

  const firstName = mu?.firstName || mu?.user?.firstName || "";
  const lastName = mu?.lastName || mu?.user?.lastName || "";
  const full = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (full && email) return `${full} — ${email}`;
  return full || email || "—";
}

function userEmail(mu) {
  return (
    mu?.email ||
    mu?.user?.email ||
    mu?.contactEmail ||
    mu?.userEmail ||
    ""
  );
}

function merchantUserIdOf(mu) {
  return mu?.merchantUserId ?? mu?.id ?? null;
}

export default function AdminMerchantUsers() {
  const { merchantId } = useParams();
  const location = useLocation();

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [merchant, setMerchant] = React.useState(null);
  const [items, setItems] = React.useState([]);

  // ownership access state
  const [existingAccessEmail, setExistingAccessEmail] = React.useState("");
  const [otherPersonEmail, setOtherPersonEmail] = React.useState("");
  const [manualEmail, setManualEmail] = React.useState("");
  const [manualFirstName, setManualFirstName] = React.useState("");
  const [manualLastName, setManualLastName] = React.useState("");
  const [createBusy, setCreateBusy] = React.useState(false);
  const [createMsg, setCreateMsg] = React.useState("");
  const [createResult, setCreateResult] = React.useState(null);
  const [actionMode, setActionMode] = React.useState("create");

  const [prevOpen, setPrevOpen] = React.useState(false);

  // expanded rows + per-row lazy detail caches
  const [expandedById, setExpandedById] = React.useState({});
  const [detailById, setDetailById] = React.useState({});
  const [detailBusyById, setDetailBusyById] = React.useState({});
  const [detailErrById, setDetailErrById] = React.useState({});

  // diagnostics toggle per row
  const [diagEnabledById, setDiagEnabledById] = React.useState({});
  const [copyStateById, setCopyStateById] = React.useState({}); // idle | copied | failed

  async function load({ preserveCreateFeedback = false } = {}) {
    setLoading(true);
    setErr("");
    if (!preserveCreateFeedback) {
      setCreateMsg("");
      setCreateResult(null);
    }

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

      try {
        const m = await getMerchant(mid);
        setMerchant(m || null);
      } catch {
        setMerchant(null);
      }

      const res = await adminListMerchantUsers(mid);

      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.users)
            ? res.users
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
      await load({ preserveCreateFeedback: true });
    } finally {
      setBusy(false);
    }
  }

  const existingOwnerOptions = React.useMemo(() => {
    return items
      .filter((mu) => String(mu?.role || "").toLowerCase() === "merchant_admin")
      .map((mu) => {
        const email = userEmail(mu);
        return {
          email,
          label: userDisplayLabel(mu),
        };
      })
      .filter((x) => x.email)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const otherEligibleOptions = React.useMemo(() => {
    const map = new Map();

    for (const mu of items) {
      const email = userEmail(mu);
      if (!email) continue;

      const label = userDisplayLabel(mu);
      if (!map.has(email)) {
        map.set(email, { email, label });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const usingManualEmail = otherPersonEmail === "__manual__";

  function selectedEmailForMode(mode) {
    if (mode === "resend") {
      return String(existingAccessEmail || "").trim().toLowerCase();
    }

    if (usingManualEmail) {
      return String(manualEmail || "").trim().toLowerCase();
    }

    return String(otherPersonEmail || "").trim().toLowerCase();
  }

  async function runOwnershipAction(mode) {
    const mid = Number(merchantId);
    const email = selectedEmailForMode(mode);

    if (!mid) {
      setCreateMsg("Invalid merchantId.");
      return;
    }

    if (!email) {
      if (mode === "resend") {
        setCreateMsg("Choose an existing 'owner' access path first.");
      } else {
        setCreateMsg("Choose another person or enter a different email first.");
      }
      return;
    }

    setActionMode(mode);
    setCreateBusy(true);
    setCreateMsg("");
    setCreateResult(null);

    try {
      const res = await adminCreateMerchantUser(mid, {
        email,
        firstName: manualFirstName.trim() || undefined,
        lastName: manualLastName.trim() || undefined,
        mode,
      });

      const result = {
        email,
        createdUser: Boolean(res?.createdUser),
        tempPassword: String(res?.tempPassword || ""),
        userId: res?.userId ?? null,
        membership: res?.membership ?? null,
        mode,
      };

      setCreateResult(result);

      if (mode === "replace") {
        setCreateMsg(
          result.createdUser
            ? `New 'owner' access created for ${email}.`
            : `Existing account linked for 'owner' access: ${email}.`
        );
      } else if (mode === "resend") {
        setCreateMsg(
          result.createdUser
            ? `Access prepared for ${email}.`
            : `Access refreshed for 'owner' account: ${email}.`
        );
      } else {
        setCreateMsg(
          result.createdUser
            ? `New 'owner' access created for ${email}.`
            : `Existing account linked for 'owner' access: ${email}.`
        );
      }

      pvUiHook("admin.merchant.users.recovery_create_succeeded.ui", {
        stable: "admin.merchant:users:recovery_create",
        merchantId: mid,
        email,
        createdUser: result.createdUser,
        hasTempPassword: Boolean(result.tempPassword),
        mode,
      });

      if (mode === "resend") {
        setExistingAccessEmail(email);
      } else if (usingManualEmail) {
        setManualEmail("");
        setOtherPersonEmail("");
      } else {
        setOtherPersonEmail(email);
      }

      await load({ preserveCreateFeedback: true });
    } catch (e) {
      const msg = e?.message || "Failed to update 'owner' access";
      setCreateMsg(msg);
      setCreateResult(null);

      pvUiHook("admin.merchant.users.recovery_create_failed.ui", {
        stable: "admin.merchant:users:recovery_create",
        merchantId: mid,
        email,
        error: msg,
        mode,
      });
    } finally {
      setCreateBusy(false);
    }
  }

  async function ensureDetailLoaded(merchantUserId) {
    if (!merchantUserId) return;
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
    const merchantUserId = merchantUserIdOf(mu);
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

  async function onCopyTempPassword() {
    if (!createResult?.tempPassword) return;
    try {
      await copyToClipboard(createResult.tempPassword);
      setCreateMsg(`Temporary password copied for ${createResult.email}.`);
    } catch {
      setCreateMsg("Failed to copy temporary password.");
    }
  }

  const mid = Number(merchantId) || null;
  const merchantName = merchant?.name || "";
  const hasUsers = items.length > 0;

  const recoveryTitle = hasUsers ? "Change or Replace Owner" : "Create Owner Access";

  const recoveryHelp = "The owner is the legal proprietor of this merchant account — responsible for billing, store operations, and ownership history.";

  const currentOwner = React.useMemo(() => {
    return (
      items.find(
        (mu) =>
          (String(mu?.role || "").toLowerCase() === "owner" ||
           String(mu?.role || "").toLowerCase() === "merchant_admin") &&
          String(mu?.status || "").toLowerCase() === "active"
      ) || null
    );
  }, [items]);

  const previousOwnerItems = React.useMemo(() => {
    const currentId = merchantUserIdOf(currentOwner);
    const currentEmail = String(userEmail(currentOwner) || "").trim().toLowerCase();

    return items.filter((mu) => {
      if (String(mu?.role || "").toLowerCase() !== "merchant_admin") return false;

      const muId = merchantUserIdOf(mu);
      const muEmail = String(userEmail(mu) || "").trim().toLowerCase();

      if (currentId && muId && currentId === muId) return false;
      if (!currentId && currentEmail && muEmail === currentEmail) return false;

      return true;
    });
  }, [items, currentOwner]);

  const currentOwnerExpanded = currentOwner
    ? Boolean(expandedById[merchantUserIdOf(currentOwner)])
    : false;


  return (
    <PageContainer size="page">
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName || `Merchant ${merchantId}`}</Link>
        {" / "}
        <span>Team</span>
      </div>

      <PageHeader
        title="Owner Access"
        subtitle={
          merchant ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={merchant.status} />
              <span style={{ fontSize: 12, color: color.textMuted }}>
                {merchantName} · ID: {merchant.id}
                {merchant.billingAccount?.pvAccountNumber ? ` · ${merchant.billingAccount.pvAccountNumber}` : ""}
              </span>
            </span>
          ) : null
        }
        right={
          <button onClick={onRefresh} disabled={loading || busy} style={styles.refreshBtn}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

        {err ? <div style={styles.errBox}>{err}</div> : null}

        <div style={{ marginTop: 10, ...styles.recoveryCard }}>
          <div style={styles.recoveryTitle}>{recoveryTitle}</div>
          <div style={styles.recoveryHelp}>{recoveryHelp}</div>

          <div style={styles.recoveryLayout}>
            <div style={styles.recoveryField}>
              <label style={styles.recoveryLabel}>Select Existing 'Owner' Access</label>
              <select
                value={existingAccessEmail}
                onChange={(e) => setExistingAccessEmail(e.target.value)}
                style={styles.recoverySelect}
                disabled={createBusy}
              >
                <option value="">Choose existing 'owner' access…</option>
                {existingOwnerOptions.map((opt) => (
                  <option key={opt.email} value={opt.email}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.recoveryField}>
              <label style={styles.recoveryLabel}>Choose Another Person</label>
              <select
                value={otherPersonEmail}
                onChange={(e) => setOtherPersonEmail(e.target.value)}
                style={styles.recoverySelect}
                disabled={createBusy}
              >
                <option value="">Choose another existing person…</option>
                {otherEligibleOptions.map((opt) => (
                  <option key={opt.email} value={opt.email}>
                    {opt.label}
                  </option>
                ))}
                <option value="__manual__">Use a different email…</option>
              </select>
            </div>

            {usingManualEmail ? (
              <>
                <div style={{ ...styles.recoveryField, gridColumn: "1 / span 2" }}>
                  <label style={styles.recoveryLabel}>Email</label>
                  <input
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="owner@company.com"
                    autoComplete="off"
                    style={styles.recoveryInput}
                    disabled={createBusy}
                  />
                </div>
                <div style={styles.recoveryField}>
                  <label style={styles.recoveryLabel}>First Name</label>
                  <input
                    value={manualFirstName}
                    onChange={(e) => setManualFirstName(e.target.value)}
                    placeholder="Jane"
                    autoComplete="off"
                    style={styles.recoveryInput}
                    disabled={createBusy}
                  />
                </div>
                <div style={styles.recoveryField}>
                  <label style={styles.recoveryLabel}>Last Name</label>
                  <input
                    value={manualLastName}
                    onChange={(e) => setManualLastName(e.target.value)}
                    placeholder="Smith"
                    autoComplete="off"
                    style={styles.recoveryInput}
                    disabled={createBusy}
                  />
                </div>
              </>
            ) : null}

            <div style={styles.recoveryActionsRow}>
              <button
                type="button"
                style={styles.recoveryBtn}
                disabled={createBusy || !selectedEmailForMode("create")}
                onClick={() => runOwnershipAction("create")}
              >
                {createBusy && actionMode === "create" ? "Working..." : "Create New"}
              </button>

              <button
                type="button"
                style={styles.recoveryBtn}
                disabled={createBusy || !selectedEmailForMode("replace")}
                onClick={() => runOwnershipAction("replace")}
              >
                {createBusy && actionMode === "replace" ? "Working..." : "Replace Access"}
              </button>

              <Link
                to={`/merchants/${mid}/ownership`}
                style={styles.changeOwnerLink}
              >
                Change 'Owner'…
              </Link>
            </div>
          </div>

          {createMsg ? (
            <div
              style={
                createMsg.toLowerCase().includes("failed") ||
                  createMsg.toLowerCase().includes("error")
                  ? styles.errBox
                  : styles.okBox
              }
            >
              {createMsg}
            </div>
          ) : null}

          {createResult?.createdUser && createResult?.tempPassword ? (
            <div style={styles.passwordCard}>
              <div style={styles.passwordTitle}>Temporary Password</div>
              <div style={styles.passwordHelp}>
                Save this now. It may not be shown again.
              </div>

              <div style={styles.passwordRow}>
                <code style={styles.passwordCode}>{createResult.tempPassword}</code>
                <button
                  type="button"
                  onClick={onCopyTempPassword}
                  style={styles.copyBtn}
                >
                  Copy
                </button>
              </div>

              <div style={styles.passwordMeta}>
                Email: <code style={styles.code}>{createResult.email}</code>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 10, ...styles.card }}>
          <div style={styles.cardTop}>
            <div style={{ fontWeight: 900 }}>Current Owner</div>
            <div style={{ fontSize: 12, color: TOKENS.muted }}>
              Use caret to view details
            </div>
          </div>

          {!loading && !currentOwner ? (
            <div style={styles.emptyBox}>No active current owner found.</div>
          ) : currentOwner ? (
            <>
              <div style={styles.currentOwnerCard}>
                <div style={styles.currentOwnerMain}>
                  <div style={styles.currentOwnerName}>
                    {(() => {
                      const fn = currentOwner?.firstName || currentOwner?.user?.firstName || "";
                      const ln = currentOwner?.lastName || currentOwner?.user?.lastName || "";
                      return [fn, ln].filter(Boolean).join(" ") || userEmail(currentOwner) || "—";
                    })()}
                  </div>
                </div>

                <div style={styles.currentOwnerActions}>
                  {merchantUserIdOf(currentOwner) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleExpand(currentOwner);
                      }}
                      style={styles.caretBtn}
                      aria-label={currentOwnerExpanded ? "Collapse details" : "Expand details"}
                      title={currentOwnerExpanded ? "Collapse details" : "Expand details"}
                    >
                      {currentOwnerExpanded ? "▼" : "▶"}
                    </button>
                  ) : null}
                </div>
              </div>

              {currentOwnerExpanded ? (
                <div style={styles.currentOwnerDetailWrap}>
                  {Boolean(detailBusyById[merchantUserIdOf(currentOwner)]) ? (
                    <div style={{ color: TOKENS.muted }}>Loading details…</div>
                  ) : String(detailErrById[merchantUserIdOf(currentOwner)] || "") ? (
                    <div style={styles.detailErrBox}>
                      {String(detailErrById[merchantUserIdOf(currentOwner)] || "")}
                    </div>
                  ) : detailById[merchantUserIdOf(currentOwner)] ? (
                    <DetailBlock
                      merchantId={mid}
                      merchantUserId={merchantUserIdOf(currentOwner)}
                      detail={detailById[merchantUserIdOf(currentOwner)]}
                      diagEnabled={Boolean(diagEnabledById[merchantUserIdOf(currentOwner)])}
                      copyState={copyStateById[merchantUserIdOf(currentOwner)] || "idle"}
                      onToggleDiagnostics={toggleDiagnostics}
                      onCopyDiagnostics={onCopyDiagnostics}
                    />
                  ) : (
                    <div style={{ color: TOKENS.muted }}>No detail loaded.</div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 10, ...styles.card }}>
          <button
            type="button"
            onClick={() => setPrevOpen((o) => !o)}
            style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%" }}
          >
            <span style={{ fontWeight: 900 }}>Previous Owners</span>
            <span style={{ color: TOKENS.muted, fontSize: 13 }}>({previousOwnerItems.length})</span>
            <span style={{ marginLeft: "auto", fontSize: 13, color: TOKENS.muted }}>{prevOpen ? "Hide" : "Show"}</span>
          </button>

          {prevOpen && <div style={styles.scrollArea}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>User</th>
                  <th style={th}>Access Type</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, width: 56 }}></th>
                </tr>
              </thead>

              <tbody>
                {previousOwnerItems.map((mu, idx) => {
                  const rowKey =
                    mu?.merchantUserId ?? mu?.id ?? mu?.userId ?? mu?.email ?? idx;

                  const merchantUserId = merchantUserIdOf(mu);
                  const emailLabel = userEmail(mu) || "—";
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
                        <td style={tdUser}>
                          <div style={{ fontWeight: 800, color: TOKENS.navy }}>{emailLabel}</div>
                        </td>

                        <td style={tdText}>{prettyRole(role)}</td>

                        <td style={tdText}>{prettyStatus(status)}</td>

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
                              <DetailBlock
                                merchantId={mid}
                                merchantUserId={merchantUserId}
                                detail={d}
                                diagEnabled={diagEnabled}
                                copyState={copyState}
                                onToggleDiagnostics={toggleDiagnostics}
                                onCopyDiagnostics={onCopyDiagnostics}
                              />
                            ) : (
                              <div style={{ color: TOKENS.muted }}>No detail loaded.</div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}

                {!loading && previousOwnerItems.length === 0 && !err ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 14, color: TOKENS.muted }}>
                      No previous owner access records found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>}

        </div>

        <div style={{ marginTop: 10, ...styles.card }}>
          <div style={{ fontWeight: 900, marginBottom: 14 }}>
            All Team Members
            <span style={{ fontWeight: 400, fontSize: 13, color: TOKENS.muted, marginLeft: 8 }}>
              ({items.length})
            </span>
          </div>

          {loading ? (
            <div style={{ color: TOKENS.muted, padding: "8px 0" }}>Loading...</div>
          ) : items.length === 0 ? (
            <div style={{ color: TOKENS.muted, padding: "8px 0" }}>No team members found.</div>
          ) : (
            <div style={styles.scrollArea}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={th}>Name</th>
                    <th style={th}>Email</th>
                    <th style={th}>Role</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((mu, idx) => {
                    const rowKey = mu?.merchantUserId ?? mu?.id ?? mu?.userId ?? idx;
                    const firstName = mu?.firstName || mu?.user?.firstName || "";
                    const lastName = mu?.lastName || mu?.user?.lastName || "";
                    const fullName = [firstName, lastName].filter(Boolean).join(" ");
                    const email = userEmail(mu);
                    const role = mu?.role || "—";
                    const status = mu?.status || "—";
                    const isCurrentOwner = currentOwner && merchantUserIdOf(mu) === merchantUserIdOf(currentOwner);

                    return (
                      <TeamMemberRow
                        key={String(rowKey)}
                        mu={mu}
                        fullName={fullName}
                        email={email}
                        role={role}
                        status={status}
                        isCurrentOwner={isCurrentOwner}
                        merchantId={mid}
                        onUpdated={() => load()}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

    </PageContainer>
  );
}

function DetailBlock({
  detail,
  merchantUserId,
  diagEnabled,
  copyState,
  onToggleDiagnostics,
  onCopyDiagnostics,
}) {
  return (
    <div style={styles.detailWrap}>
      <div style={styles.detailGrid}>
        <div style={styles.detailRow}>
          <b style={styles.label}>Email:</b>
          <span style={styles.value}>{detail.user?.email || "—"}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>Phone:</b>
          <span style={styles.value}>{detail.user?.phoneRaw || detail.user?.phoneE164 || "—"}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>User status:</b>
          <span style={styles.value}>{detail.user?.status || "—"}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>Access type:</b>
          <span style={styles.value}>{prettyRole(detail.role || "—")}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>Status:</b>
          <span style={styles.value}>{prettyStatus(detail.status || "—")}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>Status reason:</b>
          <span style={styles.value}>{detail.statusReason || "—"}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>Created:</b>
          <span style={styles.value}>{fmt(detail.createdAt)}</span>
        </div>
        <div style={styles.detailRow}>
          <b style={styles.label}>Updated:</b>
          <span style={styles.value}>{fmt(detail.updatedAt)}</span>
        </div>
      </div>

      <div style={{ ...styles.diagBar, opacity: 0.6, fontSize: 11 }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleDiagnostics(merchantUserId);
          }}
          style={{ ...diagEnabled ? styles.diagChipOn : styles.diagChip, fontSize: 11 }}
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
          disabled={!detail}
          style={{ ...styles.copyBtn, fontSize: 11 }}
          title="Copy diagnostics payload for support/chatbot"
        >
          {copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Copy failed"
              : "Copy diagnostics"}
        </button>
      </div>

      {diagEnabled ? (
        <pre style={styles.detailPre}>{JSON.stringify(detail, null, 2)}</pre>
      ) : null}
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
};

const styles = {
  recoveryCard: {
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 14,
    padding: 14,
    background: TOKENS.surface,
  },
  recoveryTitle: {
    fontWeight: 900,
    fontSize: 16,
    marginBottom: 6,
  },
  recoveryHelp: {
    color: TOKENS.muted,
    fontSize: 14,
    lineHeight: 1.35,
    marginBottom: 10,
  },

  recoveryLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    alignItems: "end",
  },
  recoveryField: {
    minWidth: 0,
  },
  recoveryLabel: {
    display: "block",
    fontSize: 12,
    color: TOKENS.muted,
    marginBottom: 6,
  },
  recoverySelect: {
    ...themeInput,
    borderRadius: 12,
  },
  recoveryInput: {
    ...themeInput,
    borderRadius: 12,
  },
  recoveryActionsRow: {
    gridColumn: "1 / span 2",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
    gap: 12,
    alignItems: "center",
    marginTop: 2,
  },
  recoveryBtn: {
    padding: "10px 14px",
    ...btn.secondary,
    borderRadius: 14,
    whiteSpace: "nowrap",
    minHeight: 44,
  },
  changeOwnerLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.18)",
    textDecoration: "none",
    color: TOKENS.navy,
    background: "white",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  passwordCard: {
    marginTop: 12,
    border: "1px solid rgba(47,143,139,0.30)",
    background: "rgba(47,143,139,0.08)",
    borderRadius: 12,
    padding: 12,
  },
  passwordTitle: {
    fontWeight: 900,
    marginBottom: 4,
  },
  passwordHelp: {
    fontSize: 12,
    color: TOKENS.muted,
    marginBottom: 10,
  },
  passwordRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  passwordCode: {
    display: "inline-block",
    padding: "10px 12px",
    borderRadius: 10,
    background: "white",
    border: "1px solid rgba(0,0,0,0.14)",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
  },
  passwordMeta: {
    marginTop: 10,
    fontSize: 12,
    color: TOKENS.muted,
  },

  card: {
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 14,
    padding: 14,
    background: TOKENS.surface,
    display: "flex",
    flexDirection: "column",
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
    borderRadius: 12,
    border: `1px solid ${color.border}`,
    background: color.cardBg,
    cursor: "pointer",
    fontWeight: 800,
    color: color.text,
  },

  errBox: {
    marginTop: 12,
    background: color.dangerSubtle,
    border: `1px solid ${color.dangerBorder}`,
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    color: color.danger,
  },

  okBox: {
    marginTop: 12,
    background: "rgba(47,143,139,0.10)",
    border: "1px solid rgba(47,143,139,0.30)",
    padding: 10,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    color: TOKENS.navy,
  },

  emptyBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    border: `1px solid ${TOKENS.divider}`,
    background: "rgba(11,42,51,0.03)",
    color: TOKENS.muted,
  },

  currentOwnerCard: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    border: `1px solid ${TOKENS.divider}`,
    borderRadius: 12,
    padding: 14,
    background: "rgba(11,42,51,0.03)",
  },

  currentOwnerMain: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },

  currentOwnerName: {
    fontWeight: 700,
    fontSize: 15,
    color: TOKENS.navy,
    wordBreak: "break-word",
  },

    currentOwnerActions: {
    flexShrink: 0,
  },

  currentOwnerDetailWrap: {
    marginTop: 10,
    padding: 12,
    background: "rgba(11,42,51,0.03)",
    border: `1px solid ${TOKENS.divider}`,
    borderRadius: 12,
  },

  scrollArea: {
    marginTop: 10,
    overflowY: "auto",
    overflowX: "hidden",
    borderRadius: 12,
    border: `1px solid ${TOKENS.divider}`,
    maxHeight: 360,
  },

  row: {},

  caretTd: {
    padding: 12,
    borderBottom: `1px solid ${TOKENS.divider}`,
    width: 56,
    textAlign: "right",
    paddingRight: 14,
  },

  caretBtn: {
    border: "1px solid rgba(0,0,0,0.14)",
    background: "white",
    borderRadius: 10,
    width: 40,
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: TOKENS.muted,
    fontSize: 14,
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
  padding: 14,
  borderBottom: `1px solid ${TOKENS.border}`,
  color: TOKENS.navy,
  background: "rgba(11,42,51,0.06)",
  fontSize: 14,
  fontWeight: 900,
};

const tdUser = {
  padding: 14,
  borderBottom: `1px solid ${TOKENS.divider}`,
  fontSize: 14,
};

const tdText = {
  padding: 14,
  borderBottom: `1px solid ${TOKENS.divider}`,
  fontSize: 14,
  color: TOKENS.navy,
};

function TeamMemberRow({ mu, fullName, email, role, status, isCurrentOwner, merchantId, onUpdated }) {
  const [editing, setEditing] = React.useState(false);
  const [editFirst, setEditFirst] = React.useState(mu?.firstName || mu?.user?.firstName || "");
  const [editLast, setEditLast] = React.useState(mu?.lastName || mu?.user?.lastName || "");
  const [editPhone, setEditPhone] = React.useState(mu?.phoneRaw || mu?.user?.phoneRaw || "");
  const [saving, setSaving] = React.useState(false);

  const userId = mu?.userId || mu?.user?.id;

  const handleSave = async () => {
    if (!userId || !merchantId) return;
    // Validate: names shouldn't contain @ (prevent email in name fields)
    if (editFirst.includes("@") || editLast.includes("@")) {
      alert("Name fields should not contain email addresses. Use the Email field for email.");
      return;
    }
    setSaving(true);
    try {
      await adminUpdateMerchantUser(merchantId, userId, {
        firstName: editFirst.trim(),
        lastName: editLast.trim(),
        phoneRaw: editPhone.trim() || undefined,
      });
      setEditing(false);
      if (onUpdated) onUpdated();
    } catch (e) {
      alert(e?.message || "Failed to update");
    }
    setSaving(false);
  };

  if (editing) {
    return (
      <tr style={styles.row}>
        <td colSpan={4} style={{ padding: 14, borderBottom: `1px solid ${TOKENS.divider}` }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={editFirst} onChange={e => setEditFirst(e.target.value)} placeholder="First name"
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${TOKENS.divider}`, fontSize: 13, width: 140 }} />
            <input value={editLast} onChange={e => setEditLast(e.target.value)} placeholder="Last name"
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${TOKENS.divider}`, fontSize: 13, width: 140 }} />
            <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone"
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${TOKENS.divider}`, fontSize: 13, width: 140 }} />
            <span style={{ fontSize: 12, color: TOKENS.muted }}>{email}</span>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#1D9E75", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "..." : "Save"}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${TOKENS.divider}`, background: "transparent", fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={styles.row}>
      <td style={tdUser}>
        <span style={{ fontWeight: 700, color: TOKENS.navy }}>
          {fullName || <span style={{ color: TOKENS.muted, fontStyle: "italic" }}>No name</span>}
        </span>
        {isCurrentOwner && (
          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: "rgba(0,150,80,0.10)", color: "rgba(0,110,50,1)", border: "1px solid rgba(0,150,80,0.25)", padding: "1px 7px", borderRadius: 999 }}>
            current
          </span>
        )}
        <button onClick={() => setEditing(true)}
          style={{ marginLeft: 8, background: "none", border: "none", fontSize: 11, color: "#1D9E75", cursor: "pointer", fontWeight: 600 }}>
          Edit
        </button>
      </td>
      <td style={tdText}>{email || "—"}</td>
      <td style={tdText}>{prettyRole(role)}</td>
      <td style={tdText}>{prettyStatus(status)}</td>
    </tr>
  );
}