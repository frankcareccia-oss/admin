// admin/src/pages/components/StoreTeamPanel.jsx
import React from "react";
import {
  merchantListStoreTeam,
  merchantAssignStoreTeamMember,
  merchantRemoveStoreTeamMember,
  merchantListUsers,
  merchantUpdateStoreProfile,
  me,
} from "../../api/client";

/**
 * StoreTeamPanel
 * - Assign merchant users to a store with a role (permissionLevel)
 * - Show assigned team for this store
 * - Set a single "Primary Contact" for the store (mutually exclusive)
 *
 * Notes:
 * - Primary Contact is stored on the Store profile as primaryContactStoreUserId
 * - Only ACTIVE assigned team members may be set as primary
 * - This is UI only; backend enforces auth/validation
 */

/**
 * pvUiHook: structured UI events for QA/docs/chatbot.
 * Must never throw.
 */
function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

// Palette tokens (PerkValet contract)
const TOKENS = {
  pageBg: "#FEFCF7",
  cardBg: "#FFFFFF",
  text: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.10)",
  divider: "rgba(0,0,0,0.06)",
  teal: "#2F8F8B",
  tealHover: "#277D79",
  errBg: "rgba(255,0,0,0.06)",
  errBorder: "rgba(255,0,0,0.15)",

  // UI alias for primary indicator
  primary: "#2F8F8B",
};

function digits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

function fmtPhone(v) {
  const d = digits(v);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return d ? d : "—";
}

function nameOf(u) {
  const fn = String(u?.firstName ?? u?.first_name ?? "").trim();
  const ln = String(u?.lastName ?? u?.last_name ?? "").trim();
  const nm = [fn, ln].filter(Boolean).join(" ").trim();
  return nm || String(u?.email ?? "").trim() || "—";
}

// --- button/pill styles (canonical-ish) ---
function pillBtn(disabled) {
  return {
    border: `1px solid ${TOKENS.border}`,
    background: disabled ? "rgba(0,0,0,0.04)" : TOKENS.cardBg,
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
    color: TOKENS.text,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function pillBtnPrimary(disabled) {
  return {
    border: `1px solid ${disabled ? TOKENS.border : TOKENS.teal}`,
    background: disabled ? "rgba(0,0,0,0.04)" : TOKENS.teal,
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
    color: disabled ? TOKENS.text : "#FFFFFF",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

function dangerPill(disabled) {
  return {
    ...pillBtn(disabled),
    border: "1px solid rgba(160,0,0,0.25)",
    color: disabled ? TOKENS.muted : "rgba(160,0,0,0.95)",
  };
}

function inputStyle() {
  return {
    padding: 10,
    borderRadius: 10,
    border: `1px solid ${TOKENS.border}`,
    background: TOKENS.cardBg,
    color: TOKENS.text,
    outline: "none",
  };
}

function mono() {
  return {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
  };
}

// Best-effort shape adapters (backend can evolve)
function adaptMerchantUser(mu) {
  const user = mu?.user || mu?.User || mu;

  // NOTE:
  // Current GET /merchant/users payload is returning userId but not merchantUserId.
  // Fall back to userId so Team & Access can proceed while backend contract is corrected.
  return {
    merchantUserId: String(
      mu?.merchantUserId ??
        mu?.id ??
        mu?.merchant_user_id ??
        mu?.merchantUser?.id ??
        mu?.merchantUser?.merchantUserId ??
        mu?.user?.merchantUserId ??
        mu?.userId ??
        ""
    ),
    status: String(mu?.status ?? ""),
    firstName: user?.firstName ?? user?.first_name ?? "",
    lastName: user?.lastName ?? user?.last_name ?? "",
    email: user?.email ?? mu?.email ?? "",
    phone:
      user?.phoneE164 ??
      user?.phone_e164 ??
      user?.phoneRaw ??
      user?.phone_raw ??
      mu?.contactPhone ??
      "",
  };
}

function adaptStoreUser(su) {
  const mu = su?.merchantUser || su?.merchant_user || su;
  const user = mu?.user || mu?.User || mu;
  return {
    storeUserId: String(su?.id ?? su?.storeUserId ?? ""),
    merchantUserId: String(mu?.id ?? mu?.merchantUserId ?? ""),
    permissionLevel: String(su?.permissionLevel ?? su?.permission_level ?? ""),
    status: String(su?.status ?? ""),
    firstName: user?.firstName ?? user?.first_name ?? "",
    lastName: user?.lastName ?? user?.last_name ?? "",
    email: user?.email ?? mu?.email ?? "",
    phone:
      user?.phoneE164 ??
      user?.phone_e164 ??
      user?.phoneRaw ??
      user?.phone_raw ??
      mu?.contactPhone ??
      "",
  };
}

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

  const [merchantId, setMerchantId] = React.useState(null);

  const [team, setTeam] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  // Keep this BLANK by default so the dropdown does not look "pre-selected".
  const [pickId, setPickId] = React.useState("");
  const [pickPerm, setPickPerm] = React.useState("");

  const [primaryId, setPrimaryId] = React.useState(
    primaryContactStoreUserId != null ? String(primaryContactStoreUserId) : ""
  );
  const [primaryBusy, setPrimaryBusy] = React.useState(false);

  const cancelledRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setErr("");

    pvUiHook("merchant.store.team.load_started.ui", { stable: "merchant:store:team", storeId });

    try {
      // Resolve merchantId (best-effort)
      let mid = merchantId;
      if (mid == null) {
        const prof = await me();
        const guess =
          prof?.user?.merchantUsers?.[0]?.merchantId ??
          prof?.merchantId ??
          prof?.user?.merchantId ??
          null;
        mid = guess != null ? guess : null;
        if (mid != null) setMerchantId(mid);
      }

      const teamRaw = await merchantListStoreTeam(storeId);

      let usersRaw = [];
      if (mid != null) {
        usersRaw = await merchantListUsers({ merchantId: mid });
      }

      if (mid == null) {
        setErr("merchantId is required");
        pvUiHook("merchant.store.team.load_warn_missing_merchantId.ui", {
          stable: "merchant:store:team",
          storeId,
        });
      }

      const teamItems = Array.isArray(teamRaw) ? teamRaw : teamRaw?.items || teamRaw?.team || teamRaw?.assigned || [];
      const userItems = Array.isArray(usersRaw) ? usersRaw : usersRaw?.items || usersRaw?.users || [];

      const t = teamItems.map(adaptStoreUser);
      const u = userItems.map(adaptMerchantUser);

      if (!cancelledRef.current) {
        setTeam(t);
        setUsers(u);

        // IMPORTANT: do NOT auto-pick an employee (reduces confusion).
        // Keep current selection if it's still valid; otherwise blank.
        setPickId((cur) => (cur && u.some((x) => x.merchantUserId === cur) ? cur : ""));
      }

      pvUiHook("merchant.store.team.load_succeeded.ui", {
        stable: "merchant:store:team",
        storeId,
        count: t.length,
      });
    } catch (e) {
      const m = e?.message || "Failed to load store team";
      if (!cancelledRef.current) setErr(m);
      pvUiHook("merchant.store.team.load_failed.ui", { stable: "merchant:store:team", storeId, error: m });
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [storeId, merchantId]);

  React.useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [storeId]);

  React.useEffect(() => {
    const next = primaryContactStoreUserId != null ? String(primaryContactStoreUserId) : "";
    setPrimaryId(next);
    pvUiHook("merchant.store.team.primary_sync.ui", {
      stable: "merchant:store:team",
      storeId,
      primaryContactStoreUserId: next || null,
    });
  }, [primaryContactStoreUserId, storeId]);


  // Lift resolved Primary Contact back up to the parent (MerchantStoreDetail) so it can render
  // a small summary card. This is read-only; it does not change behavior.
  const resolvedPrimaryContact = React.useMemo(() => {
    if (!primaryId) return null;
    const match = team.find((t) => String(t.storeUserId) === String(primaryId));
    if (!match) return null;
    return {
      storeUserId: match.storeUserId,
      merchantUserId: match.merchantUserId,
      firstName: match.firstName,
      lastName: match.lastName,
      email: match.email,
      phone: match.phone,
    };
  }, [team, primaryId]);

  React.useEffect(() => {
    if (typeof onPrimaryContactResolved !== "function") return;
    try {
      onPrimaryContactResolved(resolvedPrimaryContact);
    } catch {
      // never break UI for parent notification
    }
  }, [resolvedPrimaryContact, onPrimaryContactResolved]);


  const assignedToThisStore = React.useMemo(
    () => new Set(team.map((t) => t.merchantUserId).filter(Boolean)),
    [team]
  );

  async function onSetPrimaryContact(storeUserId) {
    if (!canManage) return;
    if (!storeId) return;
    const idStr = String(storeUserId || "").trim();
    if (!idStr) return;

    // If they clicked the current primary, do nothing (prevents "scary" remove semantics).
    if (primaryId && String(primaryId) === idStr) {
      pvUiHook("merchant.store.team.primary_set_noop.ui", {
        stable: "merchant:store:team",
        storeId,
        primaryContactStoreUserId: idStr,
        reason: "already_primary",
      });
      return;
    }

    setPrimaryBusy(true);
    setErr("");

    pvUiHook("merchant.store.team.primary_set_started.ui", {
      stable: "merchant:store:team",
      storeId,
      primaryContactStoreUserId: idStr,
    });

    try {
      await merchantUpdateStoreProfile(storeId, { primaryContactStoreUserId: Number(idStr) });
      setPrimaryId(idStr);
      pvUiHook("merchant.store.team.primary_set_succeeded.ui", {
        stable: "merchant:store:team",
        storeId,
        primaryContactStoreUserId: idStr,
      });
      try {
        onPrimaryContactChanged && onPrimaryContactChanged({ primaryContactStoreUserId: Number(idStr) });
      } catch {}
    } catch (e) {
      const m = e?.message || "Failed to set primary contact";
      setErr(m);
      pvUiHook("merchant.store.team.primary_set_failed.ui", { stable: "merchant:store:team", storeId, error: m });
    } finally {
      setPrimaryBusy(false);
    }
  }

  async function onAssign() {
    if (!canManage) return;
    if (!pickId) return setErr("Select an employee to assign.");
    if (!pickPerm) return setErr("Select a role to assign.");
    setBusy(true);
    setErr("");

    pvUiHook("merchant.store.team.assign_started.ui", {
      stable: "merchant:store:team",
      storeId,
      merchantUserId: pickId,
      permissionLevel: pickPerm,
    });

    try {
      await merchantAssignStoreTeamMember(storeId, { merchantUserId: pickId, permissionLevel: pickPerm });
      pvUiHook("merchant.store.team.assign_succeeded.ui", {
        stable: "merchant:store:team",
        storeId,
        merchantUserId: pickId,
      });

      // Reset pickers after success (keeps flow clean)
      setPickId("");
      setPickPerm("");

      await load();
    } catch (e) {
      const m = e?.message || "Failed to assign employee";
      setErr(m);
      pvUiHook("merchant.store.team.assign_failed.ui", { stable: "merchant:store:team", storeId, error: m });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(storeUserId) {
    if (!canManage || !storeUserId) return;
    if (!window.confirm("Remove this employee from this store?")) return;

    setBusy(true);
    setErr("");

    pvUiHook("merchant.store.team.remove_started.ui", { stable: "merchant:store:team", storeId, storeUserId });

    try {
      await merchantRemoveStoreTeamMember(storeUserId);
      pvUiHook("merchant.store.team.remove_succeeded.ui", { stable: "merchant:store:team", storeId, storeUserId });
      await load();
    } catch (e) {
      const m = e?.message || "Failed to remove employee";
      setErr(m);
      pvUiHook("merchant.store.team.remove_failed.ui", { stable: "merchant:store:team", storeId, error: m });
    } finally {
      setBusy(false);
    }
  }

  const assignDisabled = busy || !pickId || !pickPerm;
  const pickSelectStyle = {
    ...inputStyle(),
    flex: "1 1 360px",
    minWidth: 260,
    color: pickId ? TOKENS.text : TOKENS.muted, // lighter placeholder
  };
  const roleSelectStyle = {
    ...inputStyle(),
    width: 170,
    flex: "0 0 170px",
    color: pickPerm ? TOKENS.text : TOKENS.muted, // lighter placeholder
  };

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 14,
        border: `1px solid ${TOKENS.border}`,
        background: TOKENS.cardBg,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, marginBottom: 2, color: TOKENS.text }}>Store Team</div>
          <div style={{ fontSize: 12, color: TOKENS.muted }}>Team members can be assigned to more than one store.</div>
        </div>

        <button onClick={load} disabled={loading || busy} style={pillBtn(loading || busy)}>
          Refresh
        </button>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 14,
            border: `1px solid ${TOKENS.errBorder}`,
            background: TOKENS.errBg,
            fontSize: 13,
            color: TOKENS.text,
          }}
        >
          {err}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 12, fontSize: 13, color: TOKENS.text }}>Loading…</div>
      ) : (
        <>
          <div style={{ marginTop: 14, fontWeight: 900, marginBottom: 8, color: TOKENS.text }}>
            Assign to this store
          </div>

          {!canManage ? (
            <div style={{ fontSize: 13, color: TOKENS.muted }}>You do not have permission to edit store team.</div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", marginBottom: 2 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: TOKENS.text,
                    flex: "1 1 360px",
                    minWidth: 260,
                    lineHeight: 1.1,
                  }}
                >
                  Employee
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: TOKENS.text,
                    width: 170,
                    flex: "0 0 170px",
                    textAlign: "center",
                    lineHeight: 1.1,
                  }}
                >
                  Role
                </div>
                <div style={{ width: 120, flex: "0 0 120px" }} />
              </div>

              <select value={pickId ?? ""} onChange={(e) => setPickId(e.target.value)} style={pickSelectStyle}>
                <option value="">Select employee…</option>
                {users.map((u) => {
                  const label = `${nameOf(u)} • ${fmtPhone(u.phone)} • ${u.email}`;
                  const isAssigned = assignedToThisStore.has(u.merchantUserId);
                  return (
                    <option
                      key={u.merchantUserId || label}
                      value={String(u.merchantUserId)}
                      disabled={!u.merchantUserId || isAssigned}
                    >
                      {label}
                      {isAssigned ? " (already assigned)" : ""}
                    </option>
                  );
                })}
              </select>

              <select value={pickPerm} onChange={(e) => setPickPerm(e.target.value)} style={roleSelectStyle}>
                <option value="">Select role…</option>
                <option value="admin">admin</option>
                <option value="subadmin">subadmin</option>
              </select>

              <button
                onClick={onAssign}
                disabled={assignDisabled}
                style={{ ...pillBtnPrimary(assignDisabled), width: 120, flex: "0 0 120px" }}
                onMouseEnter={(e) => {
                  if (assignDisabled) return;
                  e.currentTarget.style.background = TOKENS.tealHover;
                  e.currentTarget.style.borderColor = TOKENS.tealHover;
                }}
                onMouseLeave={(e) => {
                  if (assignDisabled) return;
                  e.currentTarget.style.background = TOKENS.teal;
                  e.currentTarget.style.borderColor = TOKENS.teal;
                }}
              >
                {busy ? "Working…" : "Assign"}
              </button>
            </div>
          )}

          <div style={{ marginTop: 18, fontWeight: 900, marginBottom: 8, color: TOKENS.text }}>
            Team members assigned to this store ({team.length})
          </div>

          {team.length === 0 ? (
            <div style={{ fontSize: 13, color: TOKENS.muted }}>No team members assigned yet.</div>
          ) : (
            <div style={{ borderTop: `1px solid ${TOKENS.divider}` }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "6px 0 4px",
                  borderBottom: `1px solid ${TOKENS.divider}`,
                }}
              >
                <div style={{ flex: "1 1 260px", minWidth: 220, fontSize: 12, fontWeight: 800, color: TOKENS.text }}>
                  Employee
                </div>
                <div style={{ width: 160, flex: "0 0 160px", fontSize: 12, fontWeight: 800, color: TOKENS.text, textAlign: "center" }}>
                  Role
                </div>
                <div style={{ width: 140, flex: "0 0 140px", fontSize: 12, fontWeight: 800, color: TOKENS.text, textAlign: "center" }}>
                  Status
                </div>
                <div style={{ width: 160, flex: "0 0 160px", fontSize: 12, fontWeight: 800, color: TOKENS.text, textAlign: "center" }}>
                  Primary Contact
                </div>
                <div style={{ width: 120, flex: "0 0 120px", fontSize: 12, fontWeight: 800, color: TOKENS.text, textAlign: "right" }}>
                  Action
                </div>
              </div>

              {team.map((t) => {
                const isActive = String(t.status || "").toLowerCase() === "active";
                const isPrimary = primaryId && String(primaryId) === String(t.storeUserId);
                const primaryDisabled = !canManage || busy || primaryBusy || !t.storeUserId || !isActive;

                return (
                  <div
                    key={t.storeUserId || `${t.email}-${t.permissionLevel}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                      padding: "10px 0",
                      borderBottom: `1px solid ${TOKENS.divider}`,
                    }}
                  >
                    <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                      <div style={{ fontWeight: 900, color: TOKENS.text }}>{nameOf(t)}</div>
                      <div style={{ fontSize: 12, color: TOKENS.muted }}>
                        {fmtPhone(t.phone)} • {t.email || "—"}
                      </div>
                    </div>

                    <div style={{ ...mono(), width: 160, flex: "0 0 160px", textAlign: "center", color: TOKENS.text }}>
                      {t.permissionLevel || "—"}
                    </div>

                    <div style={{ ...mono(), width: 140, flex: "0 0 140px", textAlign: "center", color: TOKENS.text }}>
                      {t.status || "—"}
                    </div>

                    <div style={{ width: 160, flex: "0 0 160px", display: "flex", justifyContent: "center" }}>
                      <button
                        onClick={() => onSetPrimaryContact(t.storeUserId)}
                        disabled={primaryDisabled}
                        title={!isActive ? "Only active team members can be primary." : isPrimary ? "Primary Contact" : "Set as Primary Contact"}
                        style={{
                          width: 44,
                          height: 26,
                          borderRadius: 999,
                          border: `1px solid ${TOKENS.divider}`,
                          background: isPrimary ? TOKENS.primary : "white",
                          opacity: primaryDisabled ? 0.55 : 1,
                          cursor: primaryDisabled ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: isPrimary ? "flex-end" : "flex-start",
                          padding: 3,
                          transition: "all 120ms ease",
                        }}
                      >
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            background: isPrimary ? "white" : "rgba(0,0,0,0.10)",
                          }}
                        />
                      </button>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", width: 120, flex: "0 0 120px" }}>
                      <button
                        onClick={() => onRemove(t.storeUserId)}
                        disabled={!canManage || busy || !t.storeUserId}
                        style={dangerPill(!canManage || busy || !t.storeUserId)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
