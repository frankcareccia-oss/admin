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

function pillBtn(disabled) {
  return {
    border: "1px solid rgba(0,0,0,0.18)",
    background: disabled ? "rgba(0,0,0,0.05)" : "white",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function pillBtnPrimary(disabled) {
  return {
    border: "1px solid rgba(0,0,0,0.18)",
    background: disabled ? "rgba(0,0,0,0.04)" : "rgba(0,0,0,0.10)",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
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
    phone: user?.phoneE164 ?? user?.phone_e164 ?? user?.phoneRaw ?? user?.phone_raw ?? mu?.contactPhone ?? "",
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
    phone: user?.phoneE164 ?? user?.phone_e164 ?? user?.phoneRaw ?? user?.phone_raw ?? mu?.contactPhone ?? "",
  };
}

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
        pvUiHook("merchant.store.team.load_warn_missing_merchantId.ui", { stable: "merchant:store:team", storeId });
      }

      const teamItems = Array.isArray(teamRaw) ? teamRaw : teamRaw?.items || teamRaw?.team || [];
      const userItems = Array.isArray(usersRaw) ? usersRaw : usersRaw?.items || usersRaw?.users || [];

      const t = teamItems.map(adaptStoreUser);
      const u = userItems.map(adaptMerchantUser);

      if (!cancelledRef.current) {
        setTeam(t);
        setUsers(u);

        const assigned = new Set(t.map((x) => x.merchantUserId).filter(Boolean));
        const first = u.find((x) => x.status !== "archived" && x.merchantUserId && !assigned.has(x.merchantUserId));
        setPickId(first?.merchantUserId || u[0]?.merchantUserId || "");
      }

      pvUiHook("merchant.store.team.load_succeeded.ui", { stable: "merchant:store:team", storeId, count: t.length });
    } catch (e) {
      const m = e?.message || "Failed to load store team";
      if (!cancelledRef.current) setErr(m);
      pvUiHook("merchant.store.team.load_failed.ui", { stable: "merchant:store:team", storeId, error: m });
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [storeId]);

  React.useEffect(() => {
    cancelledRef.current = false;
    load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);

  const assignedToThisStore = React.useMemo(() => new Set(team.map((t) => t.merchantUserId).filter(Boolean)), [team]);

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
      pvUiHook("merchant.store.team.assign_succeeded.ui", { stable: "merchant:store:team", storeId, merchantUserId: pickId });
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

  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px solid rgba(0,0,0,0.12)", background: "white" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, marginBottom: 2 }}>Store Team</div>
          <div style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>
            Employees are merchant-scoped. A user may be assigned to multiple stores.
          </div>
        </div>
        <button onClick={load} disabled={loading || busy} style={pillBtn(loading || busy)}>
          Refresh
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 12, border: "1px solid rgba(160,0,0,0.18)", background: "rgba(255,0,0,0.06)", fontSize: 13 }}>
          {err}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          <div style={{ marginTop: 14, fontWeight: 800, marginBottom: 8 }}>Assign to this store</div>

          {!canManage ? (
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.60)" }}>You do not have permission to edit store team.</div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", flex: "1 1 360px", minWidth: 260, lineHeight: 1.1 }}>Employee</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", width: 170, flex: "0 0 170px", textAlign: "center", lineHeight: 1.1 }}>Role</div>
                <div style={{ width: 120, flex: "0 0 120px", textAlign: "center", fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", lineHeight: 1.1 }} />
              </div>
              <select value={pickId} onChange={(e) => setPickId(e.target.value)} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.18)", flex: "1 1 360px", minWidth: 260 }}>
                <option value="">Select employee…</option>
                {users.map((u) => {
                  const label = `${nameOf(u)} • ${fmtPhone(u.phone)} • ${u.email}`;
                  const isAssigned = assignedToThisStore.has(u.merchantUserId);
                  return (
                    <option key={u.merchantUserId || label} value={u.merchantUserId} disabled={!u.merchantUserId || isAssigned}>
                      {label}{isAssigned ? " (already in this store)" : ""}
                    </option>
                  );
                })}
              </select>

              <select value={pickPerm} onChange={(e) => setPickPerm(e.target.value)} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,0.18)", width: 170, flex: "0 0 170px" }}>
                <option value="">Select role…</option>
                <option value="admin">admin</option>
                <option value="subadmin">subadmin</option>
              </select>

              <button onClick={onAssign} disabled={busy || !pickId || !pickPerm} style={{ ...pillBtnPrimary(busy || !pickId || !pickPerm), width: 120, flex: "0 0 120px" }}>
                {busy ? "Working…" : "Assign"}
              </button>
            </div>
          )}

          <div style={{ marginTop: 18, fontWeight: 800, marginBottom: 8 }}>Current store team ({team.length})</div>

          {team.length === 0 ? (
            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.60)" }}>No employees assigned to this store yet.</div>
          ) : (
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "6px 0 4px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ flex: "1 1 260px", minWidth: 220, fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", lineHeight: 1.1 }}>Employee</div>
                <div style={{ width: 160, flex: "0 0 160px", fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", textAlign: "center", lineHeight: 1.1 }}>Role</div>
                <div style={{ width: 140, flex: "0 0 140px", fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", textAlign: "center", lineHeight: 1.1 }}>Status</div>
                <div style={{ width: 120, flex: "0 0 120px", fontSize: 12, fontWeight: 800, color: "rgba(0,0,0,0.85)", textAlign: "right", lineHeight: 1.1 }}>Action</div>
              </div>
              {team.map((t) => (
                <div key={t.storeUserId || `${t.email}-${t.permissionLevel}`} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                    <div style={{ fontWeight: 800 }}>{nameOf(t)}</div>
                    <div style={{ fontSize: 12, color: "rgba(0,0,0,0.60)" }}>{fmtPhone(t.phone)} • {t.email || "—"}</div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, width: 160, flex: "0 0 160px" }}>{t.permissionLevel || "—"}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, width: 140, flex: "0 0 140px" }}>{t.status || "—"}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", width: 120, flex: "0 0 120px" }}>
                    <button
                      onClick={() => onRemove(t.storeUserId)}
                      disabled={!canManage || busy || !t.storeUserId}
                      style={{ ...pillBtn(!canManage || busy || !t.storeUserId), border: "1px solid rgba(160,0,0,0.25)" }}
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