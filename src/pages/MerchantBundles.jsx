/**
 * MerchantBundles.jsx
 *
 * Bundle lifecycle management: WIP → Staged → Live → Suspended → Archived
 * Phase A: Define and manage bundles. Sell/redeem (Phase B/C) deferred.
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  getMerchant,
  getSystemRole,
  merchantListBundles,
  merchantCreateBundle,
  merchantUpdateBundle,
  merchantGetBundleAudit,
  merchantDeleteBundle,
  merchantDuplicateBundle,
  merchantListCategories,
  adminListMerchantBundles,
  adminCreateMerchantBundle,
  adminUpdateMerchantBundle,
  adminGetBundleAudit,
  adminDeleteMerchantBundle,
  adminDuplicateMerchantBundle,
  adminListMerchantCategories,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";

function pvUiHook(event, fields = {}) {
  try { console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields })); } catch { }
}

// ─── Status config ────────────────────────────────────────────
const STATUS_CONFIG = {
  wip:       { label: "WIP",       bg: "rgba(0,0,0,0.07)",       color: "rgba(0,0,0,0.55)",    border: "1px solid rgba(0,0,0,0.15)",       desc: "Work in progress — not visible or sellable" },
  staged:    { label: "Staged",    bg: "rgba(80,100,200,0.10)",  color: "rgba(40,60,180,1)",   border: "1px solid rgba(80,100,200,0.25)",  desc: "Scheduled to go live on start date" },
  live:      { label: "Live",      bg: "rgba(0,150,80,0.10)",    color: "rgba(0,110,50,1)",    border: "1px solid rgba(0,150,80,0.25)",    desc: "Active and sellable" },
  suspended: { label: "Suspended", bg: "rgba(200,120,0,0.10)",   color: "rgba(160,90,0,1)",    border: "1px solid rgba(200,120,0,0.25)",   desc: "Halted — existing credits still redeemable, no new sales" },
  archived:  { label: "Archived",  bg: "rgba(0,0,0,0.05)",       color: "rgba(0,0,0,0.40)",    border: "1px solid rgba(0,0,0,0.12)",       desc: "Ended — can be re-used as a new WIP bundle" },
};

// Valid transitions from each state.
// WIP/Staged are deleted (hard delete), not archived.
// Archived bundles are cloned via Duplicate — no status transition.
const TRANSITIONS = {
  wip:       [{ to: "staged", label: "Stage" }],
  staged:    [{ to: "wip", label: "Revert to WIP" }, { to: "live", label: "Go Live" }],
  live:      [{ to: "suspended", label: "Suspend" }, { to: "archived", label: "Archive" }],
  suspended: [{ to: "live", label: "Resume" }, { to: "archived", label: "Archive" }],
  archived:  [],
};

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.wip;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color, border: s.border }}>
      {s.label}
    </span>
  );
}

function formatPrice(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  return isNaN(n) ? "—" : `$${n.toFixed(2)}`;
}

function fmtDate(val) {
  if (!val) return "—";
  try { return new Date(val).toLocaleDateString(); } catch { return val; }
}

function toDateInput(val) {
  if (!val) return "";
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ""; }
}

const EMPTY_FORM = { name: "", categoryId: "", quantity: "", price: "", startAt: "", endAt: "" };

const ALL_STATUSES = ["wip", "staged", "live", "suspended", "archived"];

export default function MerchantBundles() {
  const { merchantId } = useParams();
  const systemRole = getSystemRole();
  const isPvAdmin = systemRole === "pv_admin";

  const [merchant, setMerchant] = React.useState(null);
  const [bundles, setBundles] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState(""); // "" = all

  // Create
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Edit row
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({});
  const [editError, setEditError] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  // Transition busy + per-row error
  const [transitionBusy, setTransitionBusy] = React.useState(null); // bundleId
  const [rowErrors, setRowErrors] = React.useState({}); // { [bundleId]: message }
  const [deleteBusy, setDeleteBusy] = React.useState(null);
  const [duplicateBusy, setDuplicateBusy] = React.useState(null);

  // Audit panel
  const [auditBundleId, setAuditBundleId] = React.useState(null);
  const [auditLogs, setAuditLogs] = React.useState([]);
  const [auditLoading, setAuditLoading] = React.useState(false);

  const [lastError, setLastError] = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");

  // ─── Load ──────────────────────────────────────────────────
  async function load(filter = statusFilter) {
    setLoading(true); setError("");
    try {
      const params = filter ? { status: filter } : {};
      const [mRes, bRes, cRes] = await Promise.all([
        getMerchant(merchantId),
        isPvAdmin ? adminListMerchantBundles(merchantId, params) : merchantListBundles(params),
        isPvAdmin ? adminListMerchantCategories(merchantId) : merchantListCategories(),
      ]);
      setMerchant(mRes?.merchant || mRes);
      setBundles(bRes?.bundles || []);
      setCategories((cRes?.categories || []).filter(c => c.status === "active"));
      setLastSuccessTs(new Date().toISOString());
    } catch (e) {
      const msg = e?.message || "Failed to load bundles";
      setError(msg); setLastError(msg);
    } finally { setLoading(false); }
  }

  React.useEffect(() => { load(statusFilter); }, [merchantId, statusFilter]);

  // ─── Create ────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    const errs = [];
    if (!form.name.trim()) errs.push("Name is required.");
    if (!form.categoryId) errs.push("Category is required.");
    const qty = parseInt(form.quantity, 10);
    if (!form.quantity || isNaN(qty) || qty < 1) errs.push("Quantity must be ≥ 1.");
    const pr = parseFloat(form.price);
    if (form.price === "" || isNaN(pr) || pr < 0) errs.push("Price must be 0 or greater.");
    if (form.startAt && form.endAt && new Date(form.endAt) < new Date(form.startAt))
      errs.push("End Date cannot be before Start Date.");
    if (errs.length) { setFormError(errs.join(" ")); return; }

    setSaving(true); setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        categoryId: parseInt(form.categoryId, 10),
        quantity: qty,
        price: pr,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
      };
      if (isPvAdmin) await adminCreateMerchantBundle(merchantId, payload);
      else await merchantCreateBundle(payload);
      setForm(EMPTY_FORM); setShowCreate(false);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.bundles.create.success", { merchantId });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to create bundle";
      setFormError(msg); setLastError(msg);
    } finally { setSaving(false); }
  }

  // ─── Edit ──────────────────────────────────────────────────
  function startEdit(bundle) {
    if (showCreate) setShowCreate(false);
    setAuditBundleId(null);
    setEditingId(bundle.id);
    setEditForm({
      name: bundle.name,
      price: bundle.price !== null ? String(bundle.price) : "",
      quantity: String(bundle.quantity),
      startAt: toDateInput(bundle.startAt),
      endAt: toDateInput(bundle.endAt),
    });
    setEditError("");
  }

  function cancelEdit() { setEditingId(null); setEditForm({}); setEditError(""); }

  async function handleEditSave(bundle) {
    setEditError("");
    if (!editForm.name?.trim()) { setEditError("Name is required"); return; }
    if (editForm.startAt && editForm.endAt && new Date(editForm.endAt) < new Date(editForm.startAt)) {
      setEditError("End Date cannot be before Start Date"); return;
    }
    setEditSaving(true);
    pvUiHook("merchant.bundles.edit.submit", { merchantId, bundleId: bundle.id });
    try {
      const fields = {
        name: editForm.name.trim(),
        price: editForm.price !== "" ? parseFloat(editForm.price) : undefined,
        quantity: editForm.quantity !== "" ? parseInt(editForm.quantity, 10) : undefined,
        startAt: editForm.startAt || null,
        endAt: editForm.endAt || null,
      };
      if (isPvAdmin) await adminUpdateMerchantBundle(merchantId, bundle.id, fields);
      else await merchantUpdateBundle(bundle.id, fields);
      setEditingId(null);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.bundles.edit.success", { merchantId, bundleId: bundle.id });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to update bundle";
      setEditError(msg); setLastError(msg);
    } finally { setEditSaving(false); }
  }

  // ─── Status transition ─────────────────────────────────────
  async function handleTransition(bundle, toStatus) {
    setTransitionBusy(bundle.id);
    setRowErrors(prev => ({ ...prev, [bundle.id]: null }));
    pvUiHook("merchant.bundles.transition.submit", { merchantId, bundleId: bundle.id, toStatus });
    try {
      if (isPvAdmin) await adminUpdateMerchantBundle(merchantId, bundle.id, { status: toStatus });
      else await merchantUpdateBundle(bundle.id, { status: toStatus });
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.bundles.transition.success", { merchantId, bundleId: bundle.id, toStatus });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to update status";
      setRowErrors(prev => ({ ...prev, [bundle.id]: msg }));
      pvUiHook("merchant.bundles.transition.error", { merchantId, bundleId: bundle.id, error: msg });
    } finally { setTransitionBusy(null); }
  }

  // ─── Delete (WIP / Staged only) ───────────────────────────
  async function handleDelete(bundle) {
    if (!window.confirm(`Delete "${bundle.name}"? This cannot be undone.`)) return;
    setDeleteBusy(bundle.id);
    try {
      if (isPvAdmin) await adminDeleteMerchantBundle(merchantId, bundle.id);
      else await merchantDeleteBundle(bundle.id);
      setLastSuccessTs(new Date().toISOString());
      await load(statusFilter);
    } catch (e) {
      setRowErrors(prev => ({ ...prev, [bundle.id]: e?.message || "Failed to delete" }));
    } finally { setDeleteBusy(null); }
  }

  // ─── Duplicate (Archived only) ────────────────────────────
  async function handleDuplicate(bundle) {
    setDuplicateBusy(bundle.id);
    try {
      if (isPvAdmin) await adminDuplicateMerchantBundle(merchantId, bundle.id);
      else await merchantDuplicateBundle(bundle.id);
      setLastSuccessTs(new Date().toISOString());
      // Switch to WIP filter so they see the new clone
      setStatusFilter("wip");
      await load("wip");
    } catch (e) {
      setRowErrors(prev => ({ ...prev, [bundle.id]: e?.message || "Failed to duplicate" }));
    } finally { setDuplicateBusy(null); }
  }

  // ─── Lifecycle dropdown ───────────────────────────────────
  const [dropdownOpenId, setDropdownOpenId] = React.useState(null);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (!dropdownOpenId) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpenId]);

  // ─── Audit ────────────────────────────────────────────────
  async function toggleAudit(bundleId) {
    if (auditBundleId === bundleId) { setAuditBundleId(null); return; }
    setAuditBundleId(bundleId);
    setAuditLoading(true);
    try {
      const res = isPvAdmin
        ? await adminGetBundleAudit(merchantId, bundleId)
        : await merchantGetBundleAudit(bundleId);
      setAuditLogs(res?.logs || []);
    } catch (e) {
      setAuditLogs([]);
    } finally { setAuditLoading(false); }
  }

  const merchantName = merchant?.name || `Merchant ${merchantId}`;
  const canEditQty = (status) => ["wip", "staged"].includes(status);

  return (
    <PageContainer>
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Bundles</span>
      </div>

      <PageHeader title="Bundles" subtitle={`Prepaid credit packs for ${merchantName}`} />

      {/* Phase notice */}
      <div style={{ marginTop: 16, marginBottom: 20, padding: "10px 16px", borderRadius: 10, background: "rgba(11,42,51,0.05)", border: "1px solid rgba(11,42,51,0.12)", fontSize: 13, color: "rgba(0,0,0,0.60)" }}>
        <strong style={{ color: "#0B2A33" }}>Phase A — Bundle Setup.</strong>
        {" "}POS sell &amp; redeem available once consumer identity is live.
      </div>

      {/* Status legend */}
      <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ALL_STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              <StatusBadge status={s} />
              <span>{cfg.desc}</span>
            </span>
          );
        })}
      </div>

      {/* Create card */}
      {!showCreate ? (
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.02)" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Create a bundle</div>
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 13, marginTop: 2 }}>Starts as WIP. Category is permanent once saved.</div>
          </div>
          <button type="button" style={btnPrimary} onClick={() => { setShowCreate(true); setEditingId(null); }}>+ Create Bundle</button>
        </div>
      ) : (
        <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 20, marginBottom: 20, background: "#fff" }}>
          <div style={{ fontWeight: 800, marginBottom: 14 }}>New Bundle</div>
          <form onSubmit={handleCreate}>
            <div style={twoCol}>
              <div style={fieldRow}>
                <label style={labelStyle}>Bundle Name <span style={req}>*</span></label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 10 Coffee Credits" autoFocus />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Category <span style={req}>*</span></label>
                <select style={inputStyle} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">— select —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Quantity (uses) <span style={req}>*</span></label>
                <input style={inputStyle} type="number" min="1" step="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 10" />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Sale Price ($) <span style={req}>*</span></label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 45.00" />
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>Start Date</label>
                <input style={inputStyle} type="date" min="2024-01-01" max="2099-12-31" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} />
                <div style={hint}>Required before staging. When the bundle goes live.</div>
              </div>
              <div style={fieldRow}>
                <label style={labelStyle}>End Date <span style={{ fontSize: 11, color: "rgba(0,0,0,0.40)" }}>(optional)</span></label>
                <input style={inputStyle} type="date" min={form.startAt || "2024-01-01"} max="2099-12-31" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
                <div style={hint}>Leave blank to run indefinitely until manually stopped.</div>
              </div>
            </div>
            {formError && <div style={errorStyle}>{formError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="submit" style={btnPrimary} disabled={saving}>{saving ? "Saving…" : "Save Bundle"}</button>
              <button type="button" style={btnSecondary} onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setFormError(""); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["", "All"], ...ALL_STATUSES.map(s => [s, STATUS_CONFIG[s].label])].map(([val, label]) => (
          <button key={val || "all"} type="button" style={statusFilter === val ? btnFilterActive : btnFilter} onClick={() => setStatusFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ color: "rgba(0,0,0,0.45)", padding: 20 }}>Loading…</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : bundles.length === 0 ? (
        <div style={{ color: "rgba(0,0,0,0.45)", padding: 20 }}>No bundles found.</div>
      ) : (
        <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, overflow: "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                <th style={th}>Bundle</th>
                <th style={th}>Category</th>
                <th style={th}>Qty</th>
                <th style={th}>Price</th>
                <th style={th}>Start</th>
                <th style={th}>End</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "center" }}>Edit</th>
                <th style={{ ...th, textAlign: "center", color: "rgba(40,60,180,0.80)" }}>Lifecycle →</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b, idx) => (
                <React.Fragment key={b.id}>
                  {/* Main row */}
                  <tr style={{ borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.06)", background: editingId === b.id ? "rgba(0,0,0,0.015)" : "transparent" }}>
                    <td style={{ ...td, fontWeight: 700 }}>{b.name}</td>
                    <td style={td}>
                      {b.category
                        ? <span style={catPill}>{b.category.name}</span>
                        : <span style={{ color: "rgba(0,0,0,0.30)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ ...td, fontFamily: "monospace" }}>{b.quantity}</td>
                    <td style={td}>{formatPrice(b.price)}</td>
                    <td style={{ ...td, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{fmtDate(b.startAt)}</td>
                    <td style={{ ...td, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{b.endAt ? fmtDate(b.endAt) : <span style={{ color: "rgba(0,0,0,0.30)" }}>No end</span>}</td>
                    <td style={td}><StatusBadge status={b.status} /></td>
                    {/* Edit column */}
                    <td style={{ ...td, textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                        {editingId !== b.id && b.status !== "archived" && (
                          <button type="button" style={btnSmall} onClick={() => startEdit(b)}>Edit</button>
                        )}
                        {b.status === "wip" && (
                          <button type="button" style={btnSmallDelete} disabled={deleteBusy === b.id} onClick={() => handleDelete(b)}>
                            {deleteBusy === b.id ? "…" : "Delete"}
                          </button>
                        )}
                        <button type="button" style={btnSmallGhost} onClick={() => toggleAudit(b.id)}>
                          {auditBundleId === b.id ? "Hide Log" : "Log"}
                        </button>
                      </div>
                    </td>

                    {/* Lifecycle column */}
                    <td style={{ ...td, textAlign: "center" }}>
                      {(TRANSITIONS[b.status] || []).length > 0 && (
                        <div style={{ position: "relative", display: "inline-block" }} ref={dropdownOpenId === b.id ? dropdownRef : null}>
                          <button
                            type="button"
                            style={btnLifecycle}
                            disabled={transitionBusy === b.id}
                            onClick={() => setDropdownOpenId(dropdownOpenId === b.id ? null : b.id)}
                          >
                            {transitionBusy === b.id ? "…" : "Move to ▾"}
                          </button>
                          {dropdownOpenId === b.id && (
                            <div style={dropdownMenu}>
                              {(TRANSITIONS[b.status] || []).map((t, ti) => {
                                const isDestructive = t.to === "archived" || t.to === "suspended";
                                const isBack = t.to === "wip";
                                const itemColor = isDestructive ? "rgba(160,80,0,1)" : isBack ? "rgba(0,0,0,0.55)" : "rgba(0,100,180,1)";
                                return (
                                  <button
                                    key={t.to}
                                    type="button"
                                    style={{
                                      ...dropdownItem,
                                      color: itemColor,
                                      borderBottom: ti < (TRANSITIONS[b.status].length - 1) ? "1px solid rgba(0,0,0,0.06)" : "none",
                                    }}
                                    onClick={() => { setDropdownOpenId(null); handleTransition(b, t.to); }}
                                  >
                                    <span style={{ marginRight: 6, opacity: 0.5 }}>{isBack ? "←" : "→"}</span>
                                    <span>{t.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {b.status === "archived" && (
                        <button type="button" style={btnSmallAction} disabled={duplicateBusy === b.id} onClick={() => handleDuplicate(b)}>
                          {duplicateBusy === b.id ? "…" : "⧉ Duplicate"}
                        </button>
                      )}
                      {(TRANSITIONS[b.status] || []).length === 0 && b.status !== "archived" && (
                        <span style={{ fontSize: 12, color: "rgba(0,0,0,0.30)" }}>—</span>
                      )}
                    </td>
                  </tr>

                  {/* Per-row error */}
                  {rowErrors[b.id] && (
                    <tr style={{ borderTop: "1px solid rgba(160,0,0,0.10)" }}>
                      <td colSpan={9} style={{ padding: "6px 16px", background: "rgba(160,0,0,0.04)" }}>
                        <span style={{ fontSize: 12, color: "rgba(160,0,0,0.85)" }}>⚠ {rowErrors[b.id]}</span>
                        <button type="button" onClick={() => setRowErrors(prev => ({ ...prev, [b.id]: null }))} style={{ marginLeft: 10, fontSize: 11, color: "rgba(0,0,0,0.40)", background: "none", border: "none", cursor: "pointer" }}>dismiss</button>
                      </td>
                    </tr>
                  )}

                  {/* Inline edit row */}
                  {editingId === b.id && (
                    <tr style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.015)" }}>
                      <td colSpan={9} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div>
                            <label style={labelStyle}>Name <span style={req}>*</span></label>
                            <input style={{ ...inputStyle, width: 220 }} value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                          </div>
                          {canEditQty(b.status) && (
                            <div>
                              <label style={labelStyle}>Quantity</label>
                              <input style={{ ...inputStyle, width: 90 }} type="number" min="1" step="1" value={editForm.quantity ?? ""} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} />
                            </div>
                          )}
                          <div>
                            <label style={labelStyle}>Price ($)</label>
                            <input style={{ ...inputStyle, width: 110 }} type="number" min="0" step="0.01" value={editForm.price ?? ""} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Start Date</label>
                            <input style={{ ...inputStyle, width: 150 }} type="date" min="2024-01-01" max="2099-12-31" value={editForm.startAt || ""} onChange={e => setEditForm(f => ({ ...f, startAt: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>End Date</label>
                            <input style={{ ...inputStyle, width: 150 }} type="date" min={editForm.startAt || "2024-01-01"} max="2099-12-31" value={editForm.endAt || ""} onChange={e => setEditForm(f => ({ ...f, endAt: e.target.value }))} />
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" style={btnPrimary} disabled={editSaving} onClick={() => handleEditSave(b)}>{editSaving ? "Saving…" : "Save"}</button>
                            <button type="button" style={btnSecondary} onClick={cancelEdit}>Cancel</button>
                          </div>
                        </div>
                        {editError && <div style={{ ...errorStyle, marginTop: 8 }}>{editError}</div>}
                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.40)", marginTop: 6 }}>
                          Category: <strong>{b.category?.name || "—"}</strong> (permanent).
                          {!canEditQty(b.status) && <span> Quantity locked — bundle is <strong>{b.status}</strong>.</span>}
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Audit log row */}
                  {auditBundleId === b.id && (
                    <tr style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.01)" }}>
                      <td colSpan={9} style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Change Log</div>
                        {auditLoading ? (
                          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)" }}>Loading…</div>
                        ) : auditLogs.length === 0 ? (
                          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)" }}>No log entries yet.</div>
                        ) : (
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={auditTh}>When</th>
                                <th style={auditTh}>Actor (user ID)</th>
                                <th style={auditTh}>Action</th>
                                <th style={auditTh}>Changes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {auditLogs.map(log => (
                                <tr key={log.id} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                                  <td style={auditTd}>{new Date(log.createdAt).toLocaleString()}</td>
                                  <td style={auditTd}>{log.actorUserId ?? <span style={{ color: "rgba(0,0,0,0.35)" }}>system</span>}</td>
                                  <td style={auditTd}><span style={{ fontFamily: "monospace" }}>{log.action}</span></td>
                                  <td style={auditTd}>
                                    <pre style={{ margin: 0, fontSize: 11, color: "rgba(0,0,0,0.55)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                      {log.changes ? JSON.stringify(log.changes, null, 2) : "—"}
                                    </pre>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SupportInfo context={{ page: "MerchantBundles", merchantId, lastError, lastSuccessTs }} />
    </PageContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const btnPrimary = { background: "#0B2A33", color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer" };
const btnSecondary = { background: "transparent", color: "#0B2A33", border: "1px solid rgba(0,0,0,0.18)", borderRadius: 999, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnSmall = { background: "transparent", color: "#0B2A33", border: "1px solid rgba(0,0,0,0.18)", borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer" };
const btnSmallAction = { ...btnSmall, color: "rgba(0,100,180,1)", borderColor: "rgba(0,100,180,0.25)", background: "rgba(0,100,180,0.06)" };
const btnSmallWarn = { ...btnSmall, color: "rgba(160,80,0,1)", borderColor: "rgba(200,120,0,0.25)", background: "rgba(200,120,0,0.06)" };
const btnSmallGhost = { ...btnSmall, color: "rgba(0,0,0,0.40)", borderColor: "rgba(0,0,0,0.12)" };
const btnSmallDelete = { ...btnSmall, color: "rgba(160,0,0,0.80)", borderColor: "rgba(160,0,0,0.20)", background: "rgba(160,0,0,0.04)" };
const btnFilter = { background: "white", border: "1px solid rgba(0,0,0,0.18)", borderRadius: 999, padding: "6px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#0B2A33" };
const btnFilterActive = { ...btnFilter, background: "rgba(0,0,0,0.08)", borderColor: "rgba(0,0,0,0.30)" };
const twoCol = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "0 20px" };
const fieldRow = { marginBottom: 12 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.60)", marginBottom: 4 };
const inputStyle = { width: "100%", padding: "8px 12px", border: "1px solid rgba(0,0,0,0.18)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" };
const errorStyle = { color: "rgba(160,0,0,0.90)", fontSize: 13, padding: "8px 12px", background: "rgba(160,0,0,0.06)", borderRadius: 8, marginTop: 4 };
const hint = { fontSize: 11, color: "rgba(0,0,0,0.40)", marginTop: 3 };
const req = { color: "red" };
const th = { padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 12, color: "rgba(0,0,0,0.55)" };
const td = { padding: "12px 16px", verticalAlign: "middle" };
const catPill = { display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "rgba(11,42,51,0.08)", color: "#0B2A33" };
const auditTh = { padding: "6px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "rgba(0,0,0,0.45)", borderBottom: "1px solid rgba(0,0,0,0.07)" };
const auditTd = { padding: "6px 10px", verticalAlign: "top", fontSize: 12 };
const btnLifecycle = { background: "rgba(40,60,180,0.07)", color: "rgba(40,60,180,1)", border: "1px solid rgba(40,60,180,0.25)", borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" };
const dropdownMenu = { position: "absolute", bottom: "calc(100% + 4px)", right: 0, zIndex: 50, background: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, boxShadow: "0 -4px 16px rgba(0,0,0,0.10)", minWidth: 180, overflow: "hidden" };
const dropdownItem = { display: "flex", alignItems: "center", width: "100%", padding: "9px 14px", background: "none", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.05)" };
