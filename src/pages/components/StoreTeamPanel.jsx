// admin/src/pages/components/StoreTeamPanel.jsx
import React from "react";
import {
  merchantListStoreTeam,
  merchantAssignStoreTeamMember,
  merchantRemoveStoreTeamMember,
  merchantSetPrimaryContact,
} from "../../api/client";

/* ------------------------------------------------------------- */
/* UI hook (QA / Support / Telemetry)                            */
/* ------------------------------------------------------------- */

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

/* ------------------------------------------------------------- */
/* Palette                                                       */
/* ------------------------------------------------------------- */

const TOKENS = {
  cardBg: "#FFFFFF",
  text: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.16)",
  divider: "rgba(0,0,0,0.06)",
  teal: "#2F8F8B",
  tealHover: "#277D79",
  errBg: "rgba(255,0,0,0.06)",
  errBorder: "rgba(255,0,0,0.15)",
  flashBg: "rgba(47,143,139,0.08)",
  overlay: "rgba(11,42,51,0.40)",
  danger: "#B42318",
  dangerHover: "#912018",
};

/* ------------------------------------------------------------- */
/* Helpers                                                       */
/* ------------------------------------------------------------- */

function digits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

function fmtPhone(v) {
  const d = digits(v);
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return d || "—";
}

function fullName(firstName, lastName) {
  const fn = String(firstName ?? "").trim();
  const ln = String(lastName ?? "").trim();
  return [fn, ln].filter(Boolean).join(" ").trim();
}

function nameOf(u) {
  const name = fullName(u?.firstName, u?.lastName);
  if (name) return name;
  if (u?.email) return u.email;
  return "";
}

function inputStyle() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${TOKENS.border}`,
    background: TOKENS.cardBg,
    color: TOKENS.text,
    fontSize: 14,
    outline: "none",
  };
}

function roleLabel(v) {
  switch (String(v || "").toLowerCase()) {
    case "store_admin":
    case "admin":
      return "Store Admin";
    case "store_subadmin":
    case "subadmin":
      return "Store Subadmin";
    case "pos_access":
    case "pos_employee":
      return "POS Access";
    default:
      return v || "—";
  }
}

function statusLabel(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------- */
/* Shape adapter                                                 */
/* ------------------------------------------------------------- */

function adaptEmployee(e) {
  return {
    merchantUserId: String(e?.merchantUserId ?? e?.id ?? ""),
    userId: String(e?.userId ?? ""),
    email: e?.email ?? "",
    role: String(e?.role ?? ""),
    status: String(e?.status ?? ""),
    firstName: e?.firstName ?? "",
    lastName: e?.lastName ?? "",
    phone: e?.phoneE164 ?? e?.phoneRaw ?? e?.phone ?? "",
    assigned: Boolean(e?.assigned),
    storeUserId: e?.storeUserId == null ? "" : String(e.storeUserId),
    permissionLevel: String(e?.permissionLevel ?? ""),
    storeAssignmentStatus: String(e?.storeAssignmentStatus ?? ""),
  };
}

/* ------------------------------------------------------------- */
/* Confirm Dialog                                                */
/* ------------------------------------------------------------- */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape" && !busy) onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={!busy ? onCancel : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: TOKENS.overlay,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          borderRadius: 18,
          border: `1px solid ${TOKENS.border}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, color: TOKENS.text, marginBottom: 10 }}>
          {title}
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: TOKENS.muted,
            marginBottom: 18,
          }}
        >
          {message}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              fontSize: 13,
              fontWeight: 800,
              minHeight: 38,
              padding: "9px 14px",
              borderRadius: 12,
              border: `1px solid ${TOKENS.border}`,
              background: "#fff",
              color: TOKENS.text,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              fontSize: 13,
              fontWeight: 900,
              minHeight: 38,
              padding: "9px 14px",
              borderRadius: 12,
              border: 0,
              background: danger ? TOKENS.danger : TOKENS.teal,
              color: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.75 : 1,
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- */
/* Component                                                     */
/* ------------------------------------------------------------- */

export default function StoreTeamPanel({
  storeId,
  canManage,
  primaryContactStoreUserId = null,
  onPrimaryContactChanged,
  onPrimaryContactResolved,
}) {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [flash, setFlash] = React.useState("");

  const [employees, setEmployees] = React.useState([]);

  const [pickId, setPickId] = React.useState("");
  const [pickPerm, setPickPerm] = React.useState("");

  const [primaryId, setPrimaryId] = React.useState(
    primaryContactStoreUserId ? String(primaryContactStoreUserId) : ""
  );

  const [confirmState, setConfirmState] = React.useState({
    open: false,
    type: null, // "remove" | "resetPrimary"
    payload: null,
  });

  const cancelledRef = React.useRef(false);
  const flashTimerRef = React.useRef(null);

  function closeConfirm() {
    if (busy) return;
    setConfirmState({ open: false, type: null, payload: null });
  }

  function showFlash(message) {
    setFlash(message);
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => {
      setFlash("");
      flashTimerRef.current = null;
    }, 2000);
  }

  /* --------------------------------------------------------- */
  /* Load data                                                 */
  /* --------------------------------------------------------- */

  const load = React.useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    setErr("");

    pvUiHook("merchant.store.team.load_start", {
      stable: "merchant:store:team",
      storeId,
    });

    try {
      const raw = await merchantListStoreTeam(storeId);

      const employeeItems = Array.isArray(raw?.employees)
        ? raw.employees
        : Array.isArray(raw)
          ? raw
          : raw?.items || [];

      const nextEmployees = employeeItems.map(adaptEmployee);

      if (!cancelledRef.current) {
        setEmployees(nextEmployees);
      }

      pvUiHook("merchant.store.team.load_success", {
        stable: "merchant:store:team",
        storeId,
        employeeCount: nextEmployees.length,
        assignedCount: nextEmployees.filter((e) => e.assigned).length,
      });
    } catch (e) {
      const m = e?.message || "Failed to load team";
      setErr(m);

      pvUiHook("merchant.store.team.load_fail", {
        stable: "merchant:store:team",
        storeId,
        error: m,
      });
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [storeId]);

  React.useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };
  }, [storeId, load]);

  React.useEffect(() => {
    setPrimaryId(primaryContactStoreUserId ? String(primaryContactStoreUserId) : "");
  }, [primaryContactStoreUserId]);

  /* --------------------------------------------------------- */
  /* Derived data                                              */
  /* --------------------------------------------------------- */

  const resolvedTeam = React.useMemo(() => {
    return employees
      .filter((e) => e.assigned && e.storeUserId)
      .slice()
      .sort((a, b) => {
        const aPrimary = String(a.storeUserId) === String(primaryId) ? 1 : 0;
        const bPrimary = String(b.storeUserId) === String(primaryId) ? 1 : 0;
        if (aPrimary !== bPrimary) return bPrimary - aPrimary;

        const aActive = String(a.storeAssignmentStatus || a.status || "").toLowerCase() === "active" ? 1 : 0;
        const bActive = String(b.storeAssignmentStatus || b.status || "").toLowerCase() === "active" ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        return nameOf(a).localeCompare(nameOf(b));
      });
  }, [employees, primaryId]);

  const assignableUsers = React.useMemo(() => {
    return employees
      .filter((e) => e.merchantUserId && !e.assigned)
      .slice()
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [employees]);

  function actionPillStyle({ danger = false, disabled = false } = {}) {
    return {
      fontSize: 12,
      fontWeight: 700,
      lineHeight: 1,
      padding: "7px 12px",
      minHeight: 32,
      borderRadius: 999,
      border: danger ? "1px solid rgba(160,0,0,0.25)" : `1px solid ${TOKENS.border}`,
      color: danger ? "rgba(160,0,0,0.9)" : TOKENS.text,
      background: "#fff",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      whiteSpace: "nowrap",
    };
  }

  /* --------------------------------------------------------- */
  /* Assign                                                    */
  /* --------------------------------------------------------- */

  async function assignMember() {
    if (!pickId || !pickPerm) return;

    try {
      setBusy(true);
      setErr("");

      await merchantAssignStoreTeamMember(storeId, {
        merchantUserId: pickId,
        permissionLevel: pickPerm,
      });

      setPickId("");
      setPickPerm("");

      await load();
      showFlash("Employee assigned");
    } catch (e) {
      setErr(e?.message || "Failed to assign employee.");
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------- */
  /* Remove                                                    */
  /* --------------------------------------------------------- */

  function removeMember(storeUserId) {
    setConfirmState({
      open: true,
      type: "remove",
      payload: { storeUserId },
    });
  }

  async function confirmRemove(storeUserId) {
    try {
      setBusy(true);
      setErr("");

      const isPrimary = String(storeUserId) === String(primaryId);
      if (isPrimary) {
        await merchantSetPrimaryContact(storeId, {
          primaryContactStoreUserId: null,
        });
        setPrimaryId("");
        onPrimaryContactChanged &&
          onPrimaryContactChanged({
            primaryContactStoreUserId: null,
          });
      }

      await merchantRemoveStoreTeamMember(storeUserId);

      await load();
      showFlash("Employee removed");
      setConfirmState({ open: false, type: null, payload: null });
    } catch (e) {
      setErr(e?.message || "Failed to remove employee.");
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------- */
  /* Primary contact                                           */
  /* --------------------------------------------------------- */

  async function setPrimary(storeUserId) {
    try {
      setBusy(true);
      setErr("");

      await merchantSetPrimaryContact(storeId, {
        primaryContactStoreUserId: Number(storeUserId),
      });

      setPrimaryId(String(storeUserId));

      onPrimaryContactChanged &&
        onPrimaryContactChanged({
          primaryContactStoreUserId: Number(storeUserId),
        });

      await load();
      showFlash("Primary contact updated");
    } catch (e) {
      setErr(e?.message || "Failed to set primary contact.");
      pvUiHook("merchant.store.team.primary_fail", {
        stable: "merchant:store:team",
        storeId,
        error: e?.message,
      });
    } finally {
      setBusy(false);
    }
  }

  function resetPrimary() {
    if (!primaryId) return;

    setConfirmState({
      open: true,
      type: "resetPrimary",
      payload: {},
    });
  }

  async function confirmResetPrimary() {
    try {
      setBusy(true);
      setErr("");

      await merchantSetPrimaryContact(storeId, {
        primaryContactStoreUserId: null,
      });

      setPrimaryId("");

      onPrimaryContactChanged &&
        onPrimaryContactChanged({
          primaryContactStoreUserId: null,
        });

      await load();
      showFlash("Primary contact cleared");
      setConfirmState({ open: false, type: null, payload: null });
    } catch (e) {
      setErr(e?.message || "Failed to reset primary contact.");
      pvUiHook("merchant.store.team.primary_reset_fail", {
        stable: "merchant:store:team",
        storeId,
        error: e?.message,
      });
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------- */
  /* Resolve primary for parent card                           */
  /* --------------------------------------------------------- */

  React.useEffect(() => {
    const p = resolvedTeam.find((t) => String(t.storeUserId) === String(primaryId));
    if (p && onPrimaryContactResolved) {
      onPrimaryContactResolved(p);
    } else if (!p && onPrimaryContactResolved) {
      onPrimaryContactResolved(null);
    }
  }, [resolvedTeam, primaryId, onPrimaryContactResolved]);

  /* --------------------------------------------------------- */
  /* Render                                                    */
  /* --------------------------------------------------------- */

  if (loading) {
    return <div style={{ marginTop: 12 }}>Loading team…</div>;
  }

  return (
    <>
      <div
        style={{
          marginTop: 14,
          padding: 18,
          borderRadius: 14,
          border: `1px solid ${TOKENS.border}`,
          background: TOKENS.cardBg,
        }}
      >
        {flash ? (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 10px",
              borderRadius: 10,
              background: TOKENS.flashBg,
              color: TOKENS.teal,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {flash}
          </div>
        ) : null}

        {err ? (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${TOKENS.errBorder}`,
              background: TOKENS.errBg,
            }}
          >
            {err}
          </div>
        ) : null}

        {canManage ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: TOKENS.text, marginBottom: 6 }}>
              Assign employee to this store
            </div>
            <div style={{ fontSize: 13, color: TOKENS.muted, marginBottom: 12 }}>
              This adds the employee to this store team. Setting the store’s primary contact is a separate action below.
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                style={{ ...inputStyle(), minWidth: 250 }}
                disabled={busy}
              >
                <option value="">Select employee</option>
                {assignableUsers.map((u) => (
                  <option key={u.merchantUserId} value={u.merchantUserId}>
                    {nameOf(u)}
                  </option>
                ))}
              </select>

              <select
                value={pickPerm}
                onChange={(e) => setPickPerm(e.target.value)}
                style={{ ...inputStyle(), minWidth: 160 }}
                disabled={busy}
              >
                <option value="">Role</option>
                <option value="store_admin">Store Admin</option>
                <option value="store_subadmin">Store Subadmin</option>
                <option value="pos_access">POS Access</option>
              </select>

              <button
                onClick={assignMember}
                disabled={busy || !pickId || !pickPerm}
                style={{
                  background: busy || !pickId || !pickPerm ? "rgba(47,143,139,0.45)" : TOKENS.teal,
                  color: "#fff",
                  border: 0,
                  borderRadius: 12,
                  minHeight: 40,
                  padding: "10px 18px",
                  fontWeight: 800,
                  cursor: busy || !pickId || !pickPerm ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Working…" : "Assign"}
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ fontSize: 15, fontWeight: 900, color: TOKENS.text, marginBottom: 6 }}>
          Assigned team members
        </div>
        <div style={{ fontSize: 13, color: TOKENS.muted, marginBottom: 12 }}>
          Set one assigned employee as the store’s primary contact.
        </div>

        {resolvedTeam.length === 0 ? (
          <div style={{ fontSize: 13, color: TOKENS.muted }}>No employees are assigned to this store yet.</div>
        ) : (
          <div style={{ borderTop: `1px solid ${TOKENS.divider}` }}>
            {resolvedTeam.map((t) => {
              const isPrimary = String(t.storeUserId) === String(primaryId);
              const effectiveStatus = t.storeAssignmentStatus || t.status;
              const isActive = String(effectiveStatus || "").toLowerCase() === "active";
              const phoneVal = fmtPhone(t.phone);
              const showPhone = phoneVal && phoneVal !== "—";
              const displayName = nameOf(t) || t.email || "User";

              return (
                <div
                  key={t.storeUserId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    padding: "15px 0",
                    borderBottom: `1px solid ${TOKENS.divider}`,
                    opacity: isActive ? 1 : 0.6,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: TOKENS.text, marginBottom: 2 }}>
                      {displayName}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color: TOKENS.muted,
                      }}
                    >
                      {showPhone && t.email
                        ? `${phoneVal} • ${t.email}`
                        : t.email || (showPhone ? phoneVal : "")}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: TOKENS.muted,
                      }}
                    >
                      {roleLabel(t.permissionLevel)} · {statusLabel(effectiveStatus)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {isPrimary ? (
                      <>
                        <span
                          style={{
                            background: TOKENS.teal,
                            color: "#fff",
                            padding: "6px 12px",
                            minHeight: 32,
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Primary Contact
                        </span>

                        {canManage ? (
                          <button
                            onClick={resetPrimary}
                            disabled={busy || !primaryId}
                            style={actionPillStyle({ disabled: busy || !primaryId })}
                          >
                            Reset Primary
                          </button>
                        ) : null}
                      </>
                    ) : (
                      isActive &&
                      canManage && (
                        <button
                          onClick={() => setPrimary(t.storeUserId)}
                          disabled={busy}
                          style={actionPillStyle({ disabled: busy })}
                        >
                          Set Primary
                        </button>
                      )
                    )}

                    {canManage ? (
                      <button
                        onClick={() => removeMember(t.storeUserId)}
                        disabled={busy}
                        style={actionPillStyle({ danger: true, disabled: busy })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmState.open}
        title={
          confirmState.type === "remove"
            ? "Remove Employee"
            : "Remove Primary Contact"
        }
        message={
          confirmState.type === "remove"
            ? "This will remove the employee from this store. If they are currently the primary contact, the store’s primary contact will also be cleared."
            : "This will clear the current primary contact for this store. You can assign a new one at any time."
        }
        confirmLabel={
          confirmState.type === "remove" ? "Remove Employee" : "Clear Primary"
        }
        cancelLabel="Cancel"
        danger={true}
        busy={busy}
        onCancel={closeConfirm}
        onConfirm={() => {
          if (confirmState.type === "remove") {
            confirmRemove(confirmState.payload?.storeUserId);
          } else if (confirmState.type === "resetPrimary") {
            confirmResetPrimary();
          }
        }}
      />
    </>
  );
}