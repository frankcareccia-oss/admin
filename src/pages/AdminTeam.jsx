/**
 * AdminTeam.jsx — PV Team management
 * Route: /admin/team
 * Access: pv_admin only
 *
 * Manage platform users: pv_admin, support, pv_ar_clerk, pv_ap_clerk
 */

import React from "react";
import { color, btn } from "../theme";
import { API_BASE, getAccessToken } from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";

const ROLE_LABELS = {
  pv_admin: "Admin",
  support: "Support",
  pv_ar_clerk: "AR Clerk",
  pv_ap_clerk: "AP Clerk",
};

const ROLE_OPTIONS = [
  { value: "pv_admin", label: "Admin — full platform access" },
  { value: "support", label: "Support — tickets, read-only merchant access" },
  { value: "pv_ar_clerk", label: "AR Clerk — invoices, billing, payments" },
  { value: "pv_ap_clerk", label: "AP Clerk — vendor payments, expenses" },
];

const STATUS_COLORS = {
  active: { background: "rgba(0,150,80,0.10)", color: "rgba(0,110,50,1)" },
  inactive: { background: "rgba(0,0,0,0.06)", color: "rgba(0,0,0,0.50)" },
};

async function apiFetch(path, opts = {}) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `API error ${res.status}`);
  }
  return res.json();
}

export default function AdminTeam() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ email: "", firstName: "", lastName: "", phoneRaw: "", systemRole: "support" });
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState("");
  const [tempPassword, setTempPassword] = React.useState(null);
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({});
  const [editSaving, setEditSaving] = React.useState(false);
  const [resetPwResult, setResetPwResult] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/team");
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    setCreating(true); setCreateError(""); setTempPassword(null);
    try {
      const data = await apiFetch("/admin/team", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setTempPassword(data.tempPassword);
      setUsers(prev => [...prev, data.user]);
      setCreateForm({ email: "", firstName: "", lastName: "", phoneRaw: "", systemRole: "support" });
    } catch (e) {
      setCreateError(e?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user) {
    setEditingId(user.id);
    setEditForm({ firstName: user.firstName || "", lastName: user.lastName || "", phoneRaw: user.phoneRaw || "", systemRole: user.systemRole });
  }

  async function handleEditSave() {
    setEditSaving(true);
    try {
      const data = await apiFetch(`/admin/team/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setUsers(prev => prev.map(u => u.id === editingId ? data.user : u));
      setEditingId(null);
    } catch (e) {
      alert(e?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleResetPassword(userId) {
    if (!confirm("Generate a new temporary password for this user?")) return;
    try {
      const data = await apiFetch(`/admin/team/${userId}/reset-password`, { method: "POST" });
      setResetPwResult({ userId, password: data.tempPassword });
    } catch (e) {
      alert(e?.message || "Reset failed");
    }
  }

  async function handleToggleStatus(user) {
    const newStatus = user.status === "active" ? "inactive" : "active";
    try {
      const data = await apiFetch(`/admin/team/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setUsers(prev => prev.map(u => u.id === user.id ? data.user : u));
    } catch (e) {
      alert(e?.message || "Failed");
    }
  }

  if (loading) return <PageContainer><div style={{ padding: 24, color: color.textMuted }}>Loading...</div></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title="PV Team"
        subtitle={`${users.length} platform user${users.length !== 1 ? "s" : ""}`}
        right={
          <button onClick={() => { setShowCreate(!showCreate); setTempPassword(null); setCreateError(""); }} style={{ ...btn.primary, padding: "10px 20px" }}>
            {showCreate ? "Cancel" : "+ Add Team Member"}
          </button>
        }
      />

      {/* Create form */}
      {showCreate && (
        <div style={{ background: color.cardBg, border: `1px solid ${color.border}`, borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>New Platform User</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Email *</label>
              <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="name@perksvalet.com" style={{ padding: "8px 12px", border: `1px solid ${color.border}`, borderRadius: 8, fontSize: 13, width: 220 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>First Name *</label>
              <input value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} style={{ padding: "8px 12px", border: `1px solid ${color.border}`, borderRadius: 8, fontSize: 13, width: 140 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Last Name</label>
              <input value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} style={{ padding: "8px 12px", border: `1px solid ${color.border}`, borderRadius: 8, fontSize: 13, width: 140 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Phone</label>
              <input value={createForm.phoneRaw} onChange={e => setCreateForm(f => ({ ...f, phoneRaw: e.target.value }))} placeholder="(555) 123-4567" style={{ padding: "8px 12px", border: `1px solid ${color.border}`, borderRadius: 8, fontSize: 13, width: 140 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Role *</label>
              <select value={createForm.systemRole} onChange={e => setCreateForm(f => ({ ...f, systemRole: e.target.value }))} style={{ padding: "8px 12px", border: `1px solid ${color.border}`, borderRadius: 8, fontSize: 13, width: 280 }}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={handleCreate} disabled={creating || !createForm.email || !createForm.firstName} style={{ ...btn.primary, padding: "8px 20px", opacity: creating ? 0.6 : 1 }}>
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
          {createError && <div style={{ marginTop: 8, fontSize: 13, color: color.danger }}>{createError}</div>}
          {tempPassword && (
            <div style={{ marginTop: 12, padding: "12px 16px", background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Temporary password (shown once):</div>
              <code style={{ fontSize: 15, fontWeight: 700, color: color.navy || "#0B2A33", userSelect: "all" }}>{tempPassword}</code>
              <div style={{ fontSize: 11, color: color.textMuted, marginTop: 4 }}>Share this with the user. They should change it after first login.</div>
            </div>
          )}
        </div>
      )}

      {/* Team table */}
      <div style={{ marginTop: 16, border: `1px solid ${color.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${color.border}`, background: color.pageBg }}>
              <th style={{ padding: "10px 14px", fontWeight: 700, color: color.textMuted, fontSize: 11, textAlign: "left" }}>NAME</th>
              <th style={{ padding: "10px 14px", fontWeight: 700, color: color.textMuted, fontSize: 11, textAlign: "left" }}>EMAIL</th>
              <th style={{ padding: "10px 14px", fontWeight: 700, color: color.textMuted, fontSize: 11, textAlign: "left" }}>ROLE</th>
              <th style={{ padding: "10px 14px", fontWeight: 700, color: color.textMuted, fontSize: 11, textAlign: "left" }}>STATUS</th>
              <th style={{ padding: "10px 14px", fontWeight: 700, color: color.textMuted, fontSize: 11, textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <React.Fragment key={u.id}>
                <tr style={{ borderBottom: `1px solid ${color.borderSubtle || color.border}` }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                    {u.firstName} {u.lastName || ""}
                    {u.phoneRaw && <div style={{ fontSize: 11, color: color.textMuted }}>{u.phoneRaw}</div>}
                  </td>
                  <td style={{ padding: "10px 14px", color: color.textMuted }}>{u.email}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "rgba(47,143,139,0.08)", color: color.primary }}>
                      {ROLE_LABELS[u.systemRole] || u.systemRole}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 999, ...(STATUS_COLORS[u.status] || STATUS_COLORS.active) }}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button onClick={() => startEdit(u)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Edit</button>
                      <button onClick={() => handleResetPassword(u.id)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${color.border}`, background: color.cardBg, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Reset Pwd</button>
                      <button onClick={() => handleToggleStatus(u)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${u.status === "active" ? "rgba(200,50,50,0.3)" : "rgba(0,150,80,0.3)"}`, background: color.cardBg, cursor: "pointer", fontSize: 12, fontWeight: 600, color: u.status === "active" ? "rgba(200,50,50,1)" : "rgba(0,150,80,1)" }}>
                        {u.status === "active" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                    {resetPwResult?.userId === u.id && (
                      <div style={{ marginTop: 6, padding: "6px 10px", background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 6, fontSize: 12, textAlign: "left" }}>
                        New password: <code style={{ fontWeight: 700, userSelect: "all" }}>{resetPwResult.password}</code>
                      </div>
                    )}
                  </td>
                </tr>
                {editingId === u.id && (
                  <tr style={{ background: color.pageBg, borderBottom: `1px solid ${color.border}` }}>
                    <td colSpan={5} style={{ padding: 14 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>First Name</label>
                          <input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} style={{ padding: "6px 10px", border: `1px solid ${color.border}`, borderRadius: 6, fontSize: 13, width: 140 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Last Name</label>
                          <input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} style={{ padding: "6px 10px", border: `1px solid ${color.border}`, borderRadius: 6, fontSize: 13, width: 140 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Phone</label>
                          <input value={editForm.phoneRaw} onChange={e => setEditForm(f => ({ ...f, phoneRaw: e.target.value }))} style={{ padding: "6px 10px", border: `1px solid ${color.border}`, borderRadius: 6, fontSize: 13, width: 140 }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: color.textMuted, display: "block", marginBottom: 4 }}>Role</label>
                          <select value={editForm.systemRole} onChange={e => setEditForm(f => ({ ...f, systemRole: e.target.value }))} style={{ padding: "6px 10px", border: `1px solid ${color.border}`, borderRadius: 6, fontSize: 13, width: 200 }}>
                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                        <button onClick={handleEditSave} disabled={editSaving} style={{ ...btn.primary, padding: "6px 16px", fontSize: 13 }}>{editSaving ? "Saving..." : "Save"}</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "6px 16px", border: `1px solid ${color.border}`, borderRadius: 6, background: color.cardBg, cursor: "pointer", fontSize: 13 }}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
