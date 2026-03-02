// admin/src/pages/components/StoreTeamPanel.jsx
import React from "react";
import {
  merchantListStoreTeam,
  merchantAssignStoreTeamMember,
  merchantRemoveStoreTeamMember,
  merchantListUsers,
  me,
} from "../../api/client";

/** pvUiHook: structured UI events for QA/docs/chatbot. Must never throw. */
function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {}
}

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

// Best-effort shape adapters (backend can evolve)
function adaptMerchantUser(mu) {
  const user = mu?.user || mu?.User || mu;
  return {
    merchantUserId: String(mu?.id ?? mu?.merchantUserId ?? ""),
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

const TOKENS = {
  surface: "#FFFFFF",
  text: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.10)",
  divider: "rgba(0,0,0,0.06)",
  teal: "#2F8F8B",
  dangerBg: "rgba(255,0,0,0.06)",
  dangerBorder: "rgba(255,0,0,0.15)",
};

const styles = {
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    border: `1px solid ${TOKENS.border}`,
    background: TOKENS.surface,
    color: TOKENS.text,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  title: { fontWeight: 900, marginBottom: 2 },
  subtitle: { fontSize: 12, color: TOKENS.muted },
  sectionTitle: { marginTop: 14, fontWeight: 800, marginBottom: 8 },
  errorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    border: `1px solid ${TOKENS.dangerBorder}`,
    background: TOKENS.dangerBg,
    fontSize: 13,
    color: TOKENS.text,
  },
  // Inputs
  input: {
    padding: 10,
    borderRadius: 12,
    border: `1px solid ${TOKENS.border}`,
    background: TOKENS.surface,
    color: TOKENS.text,
  },
  selectPlaceholder: { color: TOKENS.muted },
  selectValue: { color: TOKENS.text },
  // Buttons
  pillBtn: (disabled) => ({
    border: `1px solid ${TOKENS.border}`,
    background: disabled ? "rgba(0,0,0,0.04)" : TOKENS.surface,
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    color: TOKENS.text,
    opacity: disabled ? 0.65 : 1,
  }),
  primaryBtn: (disabled) => ({
    border: "none",
    background: disabled ? "rgba(47,143,139,0.25)" : TOKENS.teal,
    color: disabled ? "rgba(11,42,51,0.55)" : "#FFFFFF",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.8 : 1,
  }),
  dangerBtn: (disabled) => ({
    border: "1px solid rgba(160,0,0,0.25)",
    background: disabled ? "rgba(0,0,0,0.04)" : "rgba(255,0,0,0.06)",
    color: disabled ? "rgba(11,42,51,0.55)" : "rgba(160,0,0,0.85)",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.75 : 1,
  }),
  tableHeaderRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "6px 0 4px",
    borderBottom: `1px solid ${TOKENS.divider}`,
  },
  tableRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "10px 0",
    borderBottom: `1px solid ${TOKENS.divider}`,
  },
  th: { fontSize: 12, fontWeight: 800, color: "rgba(11,42,51,0.85)", lineHeight: 1.1 },
  mono: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
  },
};

export default function StoreTeamPanel({ storeId, canManage }) {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  const [merchantId, setMerchantId] = React.useState(null);

  const [team, setTeam] = React.useState([]);
  const [users, setUsers] = React.useState([]);

  const [pickId, setPickId] = React.useState("");
  const [pickPerm, setPickPerm] = React.useState("");

  const cancelledRef = React.useRef(false);

  const assignedToThisStore = React.useMemo(
    () => new Set(team.map((t) => t.merchantUserId).filter(Boolean)),
    [team]
  );

  function pickNextAssignable(nextUsers, nextTeam) {
    const assigned = new Set(nextTeam.map((x) => x.merchantUserId).filter(Boolean));
    const first = nextUsers.find(
      (x) => x.status !== "archived" && x.merchantUserId && !assigned.has(x.merchantUserId)
    );
    return first?.merchantUserId || "";
  }

  const load = React.useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setErr("");

    pvUiHook("merchant.store.team.load_started.ui", { stable: "merchant:store:team", storeId });

    try {
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
      if (mid == null) {
        usersRaw = [];
      } else {
        usersRaw = await merchantListUsers({ merchantId: mid });
      }

      if (mid == null) {
        setErr("merchantId is required");
        pvUiHook("merchant.store.team.load_warn_missing_merchantId.ui", {
          stable: "merchant:store:team",
          storeId,
        });
      }

      const teamItems = Array.isArray(teamRaw) ? teamRaw : teamRaw?.items || teamRaw?.team || [];
      const userItems = Array.isArray(usersRaw) ? usersRaw : usersRaw?.items || usersRaw?.users || [];

      const t = teamItems.map(adaptStoreUser);
      const u = userItems.map(adaptMerchantUser);

      if (!cancelledRef.current) {
        setTeam(t);
        setUsers(u);

        const nextPick = pickNextAssignable(u, t);
        setPickId((prev) => (prev && !new Set(t.map((x) => x.merchantUserId)).has(prev) ? prev : nextPick));
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
  }, [load]);

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
        permissionLevel: pickPerm,
      });

      // Reset role to placeholder every time (your rule #2: always)
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

      // Reset role to placeholder every time (your rule #2: always)
      setPickPerm("");
      await load();
    } catch (e) {
      const m = e?.message || "Failed to remove employee";
      setErr(m);
      pvUiHook("merchant.store.team.remove_failed.ui", { stable: "merchant:store:team", storeId, error: m });
    } finally {
      setBusy(false);
    }
  }

  const employeeSelectStyle = {
    ...styles.input,
    flex: "1 1 360px",
    minWidth: 260,
    ...(pickId ? styles.selectValue : styles.selectPlaceholder),
  };

  const roleSelectStyle = {
    ...styles.input,
    width: 170,
    flex: "0 0 170px",
    ...(pickPerm ? styles.selectValue : styles.selectPlaceholder),
  };

  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <div style={styles.title}>Store Team</div>
          <div style={styles.subtitle}>Team members can be assigned to more than one store.</div>
        </div>
        <button onClick={load} disabled={loading || busy} style={styles.pillBtn(loading || busy)}>
          Refresh
        </button>
      </div>

      {err ? <div style={styles.errorBox}>{err}</div> : null}

      {loading ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div style={styles.sectionTitle}>Assign to this store</div>

          {!canManage ? (
            <div style={{ fontSize: 13, color: TOKENS.muted }}>You do not have permission to edit store team.</div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {/* Field labels (always visible) */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", marginBottom: 2 }}>
                <div style={{ ...styles.th, flex: "1 1 360px", minWidth: 260 }}>Employee</div>
                <div style={{ ...styles.th, width: 170, flex: "0 0 170px", textAlign: "center" }}>Role</div>
                <div style={{ width: 140, flex: "0 0 140px" }} />
              </div>

              <select
                value={pickId}
                onChange={(e) => {
                  setPickId(e.target.value);
                  pvUiHook("merchant.store.team.assign_employee_changed.ui", {
                    stable: "merchant:store:team",
                    storeId,
                    merchantUserId: e.target.value,
                  });
                }}
                style={employeeSelectStyle}
              >
                <option value="" disabled>
                  Select employee…
                </option>
                {users.map((u) => {
                  const label = `${nameOf(u)} • ${fmtPhone(u.phone)} • ${u.email}`;
                  const isAssigned = assignedToThisStore.has(u.merchantUserId);
                  return (
                    <option key={u.merchantUserId || label} value={u.merchantUserId} disabled={!u.merchantUserId || isAssigned}>
                      {label}
                      {isAssigned ? " (already assigned)" : ""}
                    </option>
                  );
                })}
              </select>

              <select
                value={pickPerm}
                onChange={(e) => {
                  setPickPerm(e.target.value);
                  pvUiHook("merchant.store.team.assign_role_changed.ui", {
                    stable: "merchant:store:team",
                    storeId,
                    permissionLevel: e.target.value,
                  });
                }}
                style={roleSelectStyle}
              >
                <option value="" disabled>
                  Select role…
                </option>
                <option value="admin">admin</option>
                <option value="subadmin">subadmin</option>
              </select>

              <button onClick={onAssign} disabled={busy || !pickId || !pickPerm} style={styles.primaryBtn(busy || !pickId || !pickPerm)}>
                {busy ? "Working…" : "Assign"}
              </button>
            </div>
          )}

          <div style={{ marginTop: 18, fontWeight: 900, marginBottom: 8 }}>
            Team members assigned to this store ({team.length})
          </div>

          {team.length === 0 ? (
            <div style={{ fontSize: 13, color: TOKENS.muted }}>No team members assigned yet.</div>
          ) : (
            <div style={{ borderTop: `1px solid ${TOKENS.divider}` }}>
              <div style={styles.tableHeaderRow}>
                <div style={{ ...styles.th, flex: "1 1 260px", minWidth: 220 }}>Employee</div>
                <div style={{ ...styles.th, width: 160, flex: "0 0 160px", textAlign: "center" }}>Role</div>
                <div style={{ ...styles.th, width: 140, flex: "0 0 140px", textAlign: "center" }}>Status</div>
                <div style={{ ...styles.th, width: 120, flex: "0 0 120px", textAlign: "right" }}>Action</div>
              </div>

              {team.map((t) => (
                <div key={t.storeUserId || `${t.email}-${t.permissionLevel}`} style={styles.tableRow}>
                  <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                    <div style={{ fontWeight: 800 }}>{nameOf(t)}</div>
                    <div style={{ fontSize: 12, color: TOKENS.muted }}>
                      {fmtPhone(t.phone)} • {t.email || "—"}
                    </div>
                  </div>
                  <div style={{ ...styles.mono, width: 160, flex: "0 0 160px", textAlign: "center" }}>
                    {t.permissionLevel || "—"}
                  </div>
                  <div style={{ ...styles.mono, width: 140, flex: "0 0 140px", textAlign: "center" }}>
                    {t.status || "—"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", width: 120, flex: "0 0 120px" }}>
                    <button
                      onClick={() => onRemove(t.storeUserId)}
                      disabled={!canManage || busy || !t.storeUserId}
                      style={styles.dangerBtn(!canManage || busy || !t.storeUserId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
