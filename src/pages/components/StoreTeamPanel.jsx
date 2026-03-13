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
  return fullName(u?.firstName, u?.lastName) || u?.email || "—";
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
    case "admin":
      return "Store Admin";
    case "subadmin":
      return "Store Sub-admin";
    case "pos_employee":
      return "POS Employee";
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
/* Shape adapters                                                */
/* ------------------------------------------------------------- */

function adaptMerchantUser(mu) {
  const user = mu?.user || mu?.User || mu;

  return {
    merchantUserId: String(
      mu?.merchantUserId ??
      mu?.id ??
      mu?.userId ??
      mu?.merchantUser?.id ??
      ""
    ),
    userId: String(mu?.userId ?? user?.id ?? ""),
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
    merchantUserId: String(
      mu?.id ??
      mu?.merchantUserId ??
      su?.merchantUserId ??
      su?.merchant_user_id ??
      ""
    ),
    userId: String(mu?.userId ?? user?.id ?? su?.userId ?? ""),
    permissionLevel: String(su?.permissionLevel ?? su?.permission_level ?? ""),
    status: String(su?.status ?? ""),
    firstName: user?.firstName ?? user?.first_name ?? "",
    lastName: user?.lastName ?? user?.last_name ?? "",
    email: user?.email ?? mu?.email ?? su?.email ?? "",
    phone:
      user?.phoneE164 ??
      user?.phone_e164 ??
      user?.phoneRaw ??
      user?.phone_raw ??
      mu?.contactPhone ??
      "",
  };
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

  const [merchantId, setMerchantId] = React.useState(null);

  const [team, setTeam] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  const [pickId, setPickId] = React.useState("");
  const [pickPerm, setPickPerm] = React.useState("");

  const [primaryId, setPrimaryId] = React.useState(
    primaryContactStoreUserId ? String(primaryContactStoreUserId) : ""
  );

  const cancelledRef = React.useRef(false);

  /* --------------------------------------------------------- */
  /* Load data                                                 */
  /* --------------------------------------------------------- */

  const load = React.useCallback(async () => {
    if (!storeId) return;

    setLoading(true);
    setErr("");

    pvUiHook("merchant.store.team.load_start", { stable: "merchant:store:team", storeId });

    try {
      let mid = merchantId;

      if (!mid) {
        const prof = await me();

        mid =
          prof?.user?.merchantUsers?.[0]?.merchantId ??
          prof?.merchantId ??
          null;

        if (mid) setMerchantId(mid);
      }

      const teamRaw = await merchantListStoreTeam(storeId);
      const usersRaw = mid
        ? await merchantListUsers({ merchantId: mid })
        : [];

      const teamItems = Array.isArray(teamRaw)
        ? teamRaw
        : teamRaw?.items || teamRaw?.team || teamRaw?.assigned || [];

      const userItems = Array.isArray(usersRaw)
        ? usersRaw
        : usersRaw?.items || usersRaw?.users || [];

      const t = teamItems.map(adaptStoreUser);
      const u = userItems.map(adaptMerchantUser);

      if (!cancelledRef.current) {
        setTeam(t);
        setUsers(u);
      }

      pvUiHook("merchant.store.team.load_success", {
        stable: "merchant:store:team",
        storeId,
        teamCount: t.length,
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
  }, [storeId, merchantId]);

  React.useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [storeId, load]);

  React.useEffect(() => {
    setPrimaryId(primaryContactStoreUserId ? String(primaryContactStoreUserId) : "");
  }, [primaryContactStoreUserId]);

  /* --------------------------------------------------------- */
  /* Enrich team names from merchant user directory            */
  /* --------------------------------------------------------- */

  const usersByMerchantUserId = React.useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (u.merchantUserId) map.set(String(u.merchantUserId), u);
      if (u.userId) map.set(`user:${String(u.userId)}`, u);
    }
    return map;
  }, [users]);

  const resolvedTeam = React.useMemo(() => {
    return [...team]
      .map((t) => {
        const byMerchantUserId = t.merchantUserId ? usersByMerchantUserId.get(String(t.merchantUserId)) : null;
        const byUserId = t.userId ? usersByMerchantUserId.get(`user:${String(t.userId)}`) : null;
        const match = byMerchantUserId || byUserId;

        return {
          ...t,
          firstName: t.firstName || match?.firstName || "",
          lastName: t.lastName || match?.lastName || "",
          email: t.email || match?.email || "",
          phone: t.phone || match?.phone || "",
        };
      })
      .sort((a, b) => {
        const aPrimary = String(a.storeUserId) === String(primaryId) ? 1 : 0;
        const bPrimary = String(b.storeUserId) === String(primaryId) ? 1 : 0;
        if (aPrimary !== bPrimary) return bPrimary - aPrimary;

        const aActive = String(a.status || "").toLowerCase() === "active" ? 1 : 0;
        const bActive = String(b.status || "").toLowerCase() === "active" ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        return nameOf(a).localeCompare(nameOf(b));
      });
  }, [team, usersByMerchantUserId, primaryId]);

  const assignedMerchantUserIds = React.useMemo(() => {
    return new Set(resolvedTeam.map((t) => String(t.merchantUserId || "")).filter(Boolean));
  }, [resolvedTeam]);

  const assignableUsers = React.useMemo(() => {
    return users
      .filter((u) => u.merchantUserId && !assignedMerchantUserIds.has(String(u.merchantUserId)))
      .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  }, [users, assignedMerchantUserIds]);

  /* --------------------------------------------------------- */
  /* Assign                                                    */
  /* --------------------------------------------------------- */

  async function assignMember() {
    if (!pickId || !pickPerm) return;

    try {
      setBusy(true);

      await merchantAssignStoreTeamMember(storeId, {
        merchantUserId: pickId,
        permissionLevel: pickPerm,
      });

      pvUiHook("merchant.store.team.assign", {
        stable: "merchant:store:team",
        storeId,
        merchantUserId: pickId,
        permissionLevel: pickPerm,
      });

      setPickId("");
      setPickPerm("");

      await load();
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------- */
  /* Remove                                                    */
  /* --------------------------------------------------------- */

  async function removeMember(storeUserId) {
    if (!window.confirm("Remove this employee from this store?")) return;

    try {
      setBusy(true);

      await merchantRemoveStoreTeamMember(storeUserId);

      pvUiHook("merchant.store.team.remove", {
        stable: "merchant:store:team",
        storeUserId,
        storeId,
      });

      await load();
    } finally {
      setBusy(false);
    }
  }

  /* --------------------------------------------------------- */
  /* Primary contact                                           */
  /* --------------------------------------------------------- */

  async function setPrimary(storeUserId) {
    try {
      await merchantUpdateStoreProfile(storeId, {
        primaryContactStoreUserId: Number(storeUserId),
      });

      setPrimaryId(String(storeUserId));

      pvUiHook("merchant.store.team.primary_set", {
        stable: "merchant:store:team",
        storeId,
        storeUserId,
      });

      onPrimaryContactChanged &&
        onPrimaryContactChanged({
          primaryContactStoreUserId: Number(storeUserId),
        });
    } catch (e) {
      pvUiHook("merchant.store.team.primary_fail", {
        stable: "merchant:store:team",
        storeId,
        error: e?.message,
      });
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
    <div
      style={{
        marginTop: 14,
        padding: 18,
        borderRadius: 14,
        border: `1px solid ${TOKENS.border}`,
        background: TOKENS.cardBg,
      }}
    >
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
            >
              <option value="">Role</option>
              <option value="admin">Store Admin</option>
              <option value="subadmin">Store Subadmin</option>
              <option value="pos_employee">POS Employee</option>
            </select>

            <button
              onClick={assignMember}
              disabled={busy || !pickId || !pickPerm}
              style={{
                background: busy || !pickId || !pickPerm ? "rgba(47,143,139,0.45)" : TOKENS.teal,
                color: "#fff",
                border: 0,
                borderRadius: 12,
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
            const isActive = String(t.status || "").toLowerCase() === "active";

            return (
              <div
                key={t.storeUserId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: `1px solid ${TOKENS.divider}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: TOKENS.text }}>
                    {nameOf(t)}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: TOKENS.muted,
                    }}
                  >
                    {[fmtPhone(t.phone), t.email].filter(Boolean).join(" • ")}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 12,
                      color: TOKENS.muted,
                    }}
                  >
                    {roleLabel(t.permissionLevel)} · {statusLabel(t.status)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {isPrimary ? (
                    <span
                      style={{
                        background: TOKENS.teal,
                        color: "#fff",
                        padding: "5px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      Primary Contact
                    </span>
                  ) : (
                    isActive &&
                    canManage && (
                      <button
                        onClick={() => setPrimary(t.storeUserId)}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 10px",
                          borderRadius: 10,
                          border: `1px solid ${TOKENS.border}`,
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        Set Primary
                      </button>
                    )
                  )}

                  {canManage ? (
                    <button
                      onClick={() => removeMember(t.storeUserId)}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(160,0,0,0.25)",
                        color: "rgba(160,0,0,0.9)",
                        background: "#fff",
                        cursor: "pointer",
                      }}
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
  );
}
