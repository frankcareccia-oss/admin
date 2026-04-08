/**
 * MerchantBundles.jsx
 *
 * Bundle lifecycle management: WIP → Staged → Live → Suspended → Archived
 * Rule-tree based (PRODUCT / AND / OR, max 3 levels — supports nested groups).
 * Phase A: Define and manage bundles. Sell/redeem (Phase B/C) deferred.
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { color, btn, palette, inputStyle as themeInput } from "../theme";
import {
  getMerchant,
  me,
  getSystemRole,
  merchantListBundles,
  merchantCreateBundle,
  merchantUpdateBundle,
  merchantGetBundleAudit,
  merchantDeleteBundle,
  merchantDuplicateBundle,
  merchantListProducts,
  adminListMerchantBundles,
  adminCreateMerchantBundle,
  adminUpdateMerchantBundle,
  adminGetBundleAudit,
  adminDeleteMerchantBundle,
  adminDuplicateMerchantBundle,
  adminListMerchantProducts,
  generateBundleTerms,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";
import SuggestionBanner from "../components/SuggestionBanner";

function pvUiHook(event, fields = {}) {
  try { console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields })); } catch { }
}

// ─── Status config ────────────────────────────────────────────
const STATUS_CONFIG = {
  wip:       { label: "WIP",       bg: "rgba(0,0,0,0.07)",       color: "rgba(0,0,0,0.55)",    border: "1px solid rgba(0,0,0,0.15)",       desc: "Work in progress — not visible or sellable" },
  staged:    { label: "Staged",    bg: "rgba(80,100,200,0.10)",  color: "rgba(40,60,180,1)",   border: "1px solid rgba(80,100,200,0.25)",  desc: "Scheduled to go live on start date" },
  live:      { label: "Live",      bg: "rgba(0,150,80,0.10)",    color: "rgba(0,110,50,1)",    border: "1px solid rgba(0,150,80,0.25)",    desc: "Active and sellable" },
  suspended: { label: "Suspended", bg: "rgba(200,120,0,0.10)",   color: "rgba(160,90,0,1)",    border: "1px solid rgba(200,120,0,0.25)",   desc: "Halted — existing credits still redeemable, no new sales" },
  archived:  { label: "Archived",  bg: "rgba(0,0,0,0.05)",       color: "rgba(0,0,0,0.40)",    border: "1px solid rgba(0,0,0,0.12)",       desc: "Ended — can be duplicated as a new WIP bundle" },
};

const TRANSITIONS = {
  wip:       [{ to: "staged", label: "Stage" }],
  staged:    [{ to: "wip", label: "Revert to WIP" }, { to: "live", label: "Go Live" }],
  live:      [{ to: "suspended", label: "Suspend" }, { to: "archived", label: "Archive" }],
  suspended: [{ to: "live", label: "Resume" }, { to: "archived", label: "Archive" }],
  archived:  [],
};

const ALL_STATUSES = ["wip", "staged", "live", "suspended", "archived"];

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

// ─── Rule tree helpers ────────────────────────────────────────

function describeRuleTree(tree) {
  if (!tree) return "—";
  if (tree.type === "PRODUCT") return `${tree.quantity}× ${tree.productName}`;
  const joiner = tree.type === "AND" ? " + " : " or ";
  return (tree.children || []).map(child => {
    if (child.type === "PRODUCT") return `${child.quantity}× ${child.productName}`;
    const subJoiner = child.type === "AND" ? " + " : " or ";
    const subParts = (child.children || []).map(p => `${p.quantity}× ${p.productName}`).join(subJoiner);
    return `(${subParts})`;
  }).join(joiner);
}

// Flatten all product slots from UI items (includes products inside groups)
function getAllProducts(items) {
  return items.flatMap(item => item.type === "group" ? item.products : [item]);
}

// Convert UI items + matchType → rule tree JSON
function uiToRuleTree(items, matchType) {
  if (!items || items.length === 0) return null;
  const children = items.map(item => {
    if (item.type === "group") {
      if (item.products.length === 1) {
        const p = item.products[0];
        return { type: "PRODUCT", productId: p.productId, productName: p.productName, quantity: p.quantity };
      }
      return { type: item.matchType, children: item.products.map(p => ({ type: "PRODUCT", productId: p.productId, productName: p.productName, quantity: p.quantity })) };
    }
    return { type: "PRODUCT", productId: item.productId, productName: item.productName, quantity: item.quantity };
  });
  if (children.length === 1 && children[0].type === "PRODUCT") return children[0];
  return { type: matchType, children };
}

// Convert rule tree JSON → UI items + matchType
function ruleTreeToUi(tree) {
  if (!tree) return { items: [{ type: "product", productId: "", productName: "", quantity: 1 }], matchType: "AND" };
  if (tree.type === "PRODUCT") {
    return { items: [{ type: "product", productId: tree.productId, productName: tree.productName, quantity: tree.quantity }], matchType: "AND" };
  }
  const items = (tree.children || []).map(child => {
    if (child.type === "PRODUCT") {
      return { type: "product", productId: child.productId, productName: child.productName, quantity: child.quantity };
    }
    // Nested AND / OR → group item
    return {
      type: "group",
      matchType: child.type,
      products: (child.children || []).map(p => ({ productId: p.productId, productName: p.productName, quantity: p.quantity })),
    };
  });
  return { items, matchType: tree.type };
}

// ─── Tree Builder component ───────────────────────────────────
// Supports flat product rows and nested group rows (one level deep).
// UI items:
//   product: { type:"product", productId, productName, quantity }
//   group:   { type:"group", matchType:"AND"|"OR", products:[{productId,productName,quantity}] }

function RuleTreeBuilder({ items, matchType, onItemsChange, onMatchTypeChange, products, disabled }) {
  // Scoped duplicate guard:
  //   flat items → block products used in other flat items at root level
  //   group items → block products used in other slots within the SAME group
  //   cross-group: NO restriction (same product may appear in different groups)
  const flatUsedIds = React.useMemo(() => {
    const used = new Set();
    items.forEach(item => { if (item.type !== "group" && item.productId) used.add(String(item.productId)); });
    return used;
  }, [items]);

  function addProductItem() {
    onItemsChange([...items, { type: "product", productId: "", productName: "", quantity: 1 }]);
  }
  function addGroupItem() {
    const groupType = matchType === "AND" ? "OR" : "AND";
    onItemsChange([...items, { type: "group", matchType: groupType, products: [{ productId: "", productName: "", quantity: 1 }, { productId: "", productName: "", quantity: 1 }] }]);
  }
  function removeItem(idx) {
    onItemsChange(items.filter((_, i) => i !== idx));
  }
  function updateProductItem(idx, field, value) {
    onItemsChange(items.map((item, i) => {
      if (i !== idx) return item;
      if (field === "productId") { const prod = products.find(p => String(p.id) === String(value)); return { ...item, productId: value ? parseInt(value, 10) : "", productName: prod?.name || "" }; }
      if (field === "quantity") return { ...item, quantity: parseInt(value, 10) || 1 };
      return item;
    }));
  }
  function updateGroupMatchType(idx, mt) {
    onItemsChange(items.map((item, i) => i !== idx ? item : { ...item, matchType: mt }));
  }
  function addGroupProduct(groupIdx) {
    onItemsChange(items.map((item, i) => i !== groupIdx ? item : { ...item, products: [...item.products, { productId: "", productName: "", quantity: 1 }] }));
  }
  function removeGroupProduct(groupIdx, prodIdx) {
    onItemsChange(items.map((item, i) => i !== groupIdx ? item : { ...item, products: item.products.filter((_, j) => j !== prodIdx) }));
  }
  function updateGroupProduct(groupIdx, prodIdx, field, value) {
    onItemsChange(items.map((item, i) => {
      if (i !== groupIdx) return item;
      return { ...item, products: item.products.map((p, j) => {
        if (j !== prodIdx) return p;
        if (field === "productId") { const prod = products.find(pr => String(pr.id) === String(value)); return { ...p, productId: value ? parseInt(value, 10) : "", productName: prod?.name || "" }; }
        if (field === "quantity") return { ...p, quantity: parseInt(value, 10) || 1 };
        return p;
      })};
    }));
  }

  return (
    <div>
      {/* Root match rule — shown when multiple items */}
      {items.length > 1 && (
        <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: color.primarySubtle, border: `1px solid ${color.primaryBorder}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: color.textMuted, marginBottom: 8 }}>Match Rule <span style={{ color: color.danger }}>*</span></div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            {["AND", "OR"].map(t => (
              <button key={t} type="button" disabled={disabled} onClick={() => onMatchTypeChange(t)} style={{
                padding: "7px 18px", borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: "pointer",
                border: matchType === t ? `2px solid ${color.primary}` : `1.5px solid ${color.border}`,
                background: matchType === t ? color.primarySubtle : color.cardBg,
                color: matchType === t ? color.primary : color.textFaint,
                boxShadow: matchType === t ? `0 1px 4px ${color.primarySubtle}` : "none",
              }}>
                {t === "AND" ? "ALL of these" : "ANY of these"}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: color.textMuted }}>
            {matchType === "AND"
              ? "Customer must redeem ALL items listed."
              : "Customer can redeem ANY ONE of the items listed."}
          </div>
        </div>
      )}

      {/* Items */}
      {items.map((item, idx) => {
        const rowLabel = items.length > 1 ? (
          <span style={{ fontSize: 11, color: color.textFaint, width: 28, textAlign: "right", flexShrink: 0 }}>
            {matchType === "AND" ? `${idx + 1}.` : "or"}
          </span>
        ) : null;

        if (item.type === "group") {
          return (
            <div key={idx} style={{ marginBottom: 10, padding: "12px 14px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.pageBg }}>
              {/* Group header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                {rowLabel}
                <span style={{ fontSize: 12, fontWeight: 700, color: color.textFaint }}>Group —</span>
                {["AND", "OR"].map(t => (
                  <button key={t} type="button" disabled={disabled} onClick={() => updateGroupMatchType(idx, t)} style={{
                    padding: "3px 10px", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer",
                    border: item.matchType === t ? `1.5px solid ${color.primary}` : `1px solid ${color.border}`,
                    background: item.matchType === t ? color.primarySubtle : color.cardBg,
                    color: item.matchType === t ? color.primary : color.textFaint,
                  }}>
                    {t === "AND" ? "ALL" : "ANY"}
                  </button>
                ))}
                {items.length > 1 && (
                  <button type="button" style={{ ...btnSmallDelete, marginLeft: "auto" }} disabled={disabled} onClick={() => removeItem(idx)}>× Remove</button>
                )}
              </div>
              {/* Group product rows — duplicate guard scoped to this group only */}
              {item.products.map((p, pi) => {
                const groupUsedIds = new Set(item.products.filter((_, j) => j !== pi && item.products[j]?.productId).map(gp => String(gp.productId)));
                return (
                <div key={pi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  {item.products.length > 1 && (
                    <span style={{ fontSize: 11, color: color.textFaint, width: 28, textAlign: "right", flexShrink: 0 }}>
                      {item.matchType === "AND" ? `${pi + 1}.` : "or"}
                    </span>
                  )}
                  <select style={{ ...inputStyle, flex: 2, minWidth: 0 }} value={p.productId || ""} disabled={disabled} onChange={e => updateGroupProduct(idx, pi, "productId", e.target.value)}>
                    <option value="">— select product —</option>
                    {products.map(pr => {
                      const usedElsewhere = groupUsedIds.has(String(pr.id));
                      return <option key={pr.id} value={pr.id} disabled={usedElsewhere}>{pr.name}{usedElsewhere ? " (already added)" : ""}</option>;
                    })}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: color.textFaint }}>×</span>
                    <input style={{ ...inputStyle, width: 64, textAlign: "center" }} type="number" min="1" step="1" value={p.quantity} disabled={disabled} onChange={e => updateGroupProduct(idx, pi, "quantity", e.target.value)} />
                    <span style={{ fontSize: 12, color: color.textFaint }}>uses</span>
                  </div>
                  {item.products.length > 1 && (
                    <button type="button" style={btnSmallDelete} disabled={disabled} onClick={() => removeGroupProduct(idx, pi)}>×</button>
                  )}
                </div>
                );
              })}
              {item.products.length < 10 && (
                <button type="button" style={{ ...btnSmall, marginTop: 4 }} disabled={disabled} onClick={() => addGroupProduct(idx)}>+ Add to group</button>
              )}
            </div>
          );
        }

        // Product item
        return (
          <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            {rowLabel}
            <select style={{ ...inputStyle, flex: 2, minWidth: 0 }} value={item.productId || ""} disabled={disabled} onChange={e => updateProductItem(idx, "productId", e.target.value)}>
              <option value="">— select product —</option>
              {products.map(p => {
                const usedElsewhere = flatUsedIds.has(String(p.id)) && String(p.id) !== String(item.productId);
                return <option key={p.id} value={p.id} disabled={usedElsewhere}>{p.name}{usedElsewhere ? " (already added)" : ""}</option>;
              })}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: color.textFaint }}>×</span>
              <input style={{ ...inputStyle, width: 64, textAlign: "center" }} type="number" min="1" step="1" value={item.quantity} disabled={disabled} onChange={e => updateProductItem(idx, "quantity", e.target.value)} />
              <span style={{ fontSize: 12, color: color.textFaint }}>uses</span>
            </div>
            {items.length > 1 && (
              <button type="button" style={btnSmallDelete} disabled={disabled} onClick={() => removeItem(idx)}>×</button>
            )}
          </div>
        );
      })}

      {/* Add buttons */}
      {items.length < 10 && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="button" style={btnSmall} disabled={disabled} onClick={addProductItem}>+ Add product</button>
          <button type="button" style={{ ...btnSmall, color: color.primary, borderColor: color.primaryBorder, background: color.primarySubtle }} disabled={disabled} onClick={addGroupItem}>
            + Add group
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = { name: "", price: "", startAt: "", endAt: "", legalText: "" };
const EMPTY_ITEMS = [{ type: "product", productId: "", productName: "", quantity: 1 }];

export default function MerchantBundles() {
  const { merchantId } = useParams();
  const systemRole = getSystemRole();
  const isPvAdmin = systemRole === "pv_admin";

  const [merchant, setMerchant] = React.useState(null);
  const [bundles, setBundles] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("live");

  // Create form
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [createItems, setCreateItems] = React.useState(EMPTY_ITEMS);
  const [createMatchType, setCreateMatchType] = React.useState("AND");
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Edit row
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({});
  const [editItems, setEditItems] = React.useState(EMPTY_ITEMS);
  const [editMatchType, setEditMatchType] = React.useState("AND");
  const [editError, setEditError] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  // AI terms generation
  const [generatingTerms, setGeneratingTerms] = React.useState(false);
  const [editGeneratingTerms, setEditGeneratingTerms] = React.useState(false);

  // Lifecycle
  const [transitionBusy, setTransitionBusy] = React.useState(null);
  const [rowErrors, setRowErrors] = React.useState({});
  const [deleteBusy, setDeleteBusy] = React.useState(null);
  const [duplicateBusy, setDuplicateBusy] = React.useState(null);
  const [dropdownOpenId, setDropdownOpenId] = React.useState(null);
  const dropdownRef = React.useRef(null);

  // Audit
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
      const [mRes, bRes, pRes] = await Promise.all([
        isPvAdmin ? getMerchant(merchantId) : me(),
        isPvAdmin ? adminListMerchantBundles(merchantId, params) : merchantListBundles(params),
        isPvAdmin ? adminListMerchantProducts(merchantId, { status: "active" }) : merchantListProducts({ status: "active" }),
      ]);
      setMerchant(isPvAdmin ? (mRes?.merchant || mRes) : (mRes?.user?.merchantUsers?.[0]?.merchant || null));
      setBundles(bRes?.bundles || []);
      setProducts(pRes?.items || pRes?.products || []);
      setLastSuccessTs(new Date().toISOString());
    } catch (e) {
      const msg = e?.message || "Failed to load bundles";
      setError(msg); setLastError(msg);
    } finally { setLoading(false); }
  }

  React.useEffect(() => { load(statusFilter); }, [merchantId, statusFilter]);

  // Click-outside for dropdown
  React.useEffect(() => {
    if (!dropdownOpenId) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpenId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpenId]);

  // ─── AI terms generation ───────────────────────────────────
  async function handleGenerateTerms() {
    setGeneratingTerms(true);
    setFormError("");
    try {
      const ruleTree = uiToRuleTree(createItems, createMatchType);
      const data = await generateBundleTerms({
        name: form.name || "Bundle",
        price: form.price ? parseFloat(form.price) : null,
        componentsDesc: ruleTree ? describeRuleTree(ruleTree) : null,
        startAt: form.startAt || null,
        endAt: form.endAt || null,
      });
      setForm(f => ({ ...f, legalText: data.draft || "" }));
    } catch (e) {
      setFormError(e?.message || "Failed to generate terms draft");
    } finally {
      setGeneratingTerms(false);
    }
  }

  async function handleEditGenerateTerms(bundle) {
    setEditGeneratingTerms(true);
    setEditError("");
    try {
      const ruleTree = uiToRuleTree(editItems, editMatchType);
      const data = await generateBundleTerms({
        name: editForm.name || bundle.name,
        price: editForm.price !== "" ? parseFloat(editForm.price) : bundle.price,
        componentsDesc: ruleTree ? describeRuleTree(ruleTree) : describeRuleTree(bundle.ruleTreeJson),
        startAt: editForm.startAt || bundle.startAt || null,
        endAt: editForm.endAt || bundle.endAt || null,
      });
      setEditForm(f => ({ ...f, legalText: data.draft || "" }));
    } catch (e) {
      setEditError(e?.message || "Failed to generate terms draft");
    } finally {
      setEditGeneratingTerms(false);
    }
  }

  // ─── Create ────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    const errs = [];
    if (!form.name.trim()) errs.push("Name is required.");
    const pr = parseFloat(form.price);
    if (form.price === "" || isNaN(pr) || pr < 0) errs.push("Price must be 0 or greater.");
    const allCreateProds = getAllProducts(createItems);
    if (allCreateProds.some(i => !i.productId)) errs.push("All products must be selected.");
    if (allCreateProds.some(i => !i.quantity || i.quantity < 1)) errs.push("All quantities must be ≥ 1.");
    if (form.startAt && form.endAt && new Date(form.endAt) < new Date(form.startAt))
      errs.push("End Date cannot be before Start Date.");
    if (errs.length) { setFormError(errs.join(" ")); return; }

    setSaving(true); setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        price: pr,
        ruleTree: uiToRuleTree(createItems, createMatchType),
        startAt: form.startAt || null,
        endAt: form.endAt || null,
        legalText: form.legalText?.trim() || null,
      };
      if (isPvAdmin) await adminCreateMerchantBundle(merchantId, payload);
      else await merchantCreateBundle(payload);
      setForm(EMPTY_FORM); setCreateItems(EMPTY_ITEMS); setCreateMatchType("AND");
      setShowCreate(false);
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
      startAt: toDateInput(bundle.startAt),
      endAt: toDateInput(bundle.endAt),
      legalText: bundle.legalText || "",
    });
    const { items, matchType } = ruleTreeToUi(bundle.ruleTreeJson);
    setEditItems(items);
    setEditMatchType(matchType);
    setEditError("");
  }

  function cancelEdit() { setEditingId(null); setEditForm({}); setEditItems(EMPTY_ITEMS); setEditError(""); }

  async function handleEditSave(bundle) {
    setEditError("");
    if (!editForm.name?.trim()) { setEditError("Name is required"); return; }
    if (getAllProducts(editItems).some(i => !i.productId)) { setEditError("All products must be selected"); return; }
    if (editForm.startAt && editForm.endAt && new Date(editForm.endAt) < new Date(editForm.startAt)) {
      setEditError("End Date cannot be before Start Date"); return;
    }
    setEditSaving(true);
    pvUiHook("merchant.bundles.edit.submit", { merchantId, bundleId: bundle.id });
    try {
      const canEditRules = ["wip", "staged"].includes(bundle.status);
      const fields = {
        name: editForm.name.trim(),
        price: editForm.price !== "" ? parseFloat(editForm.price) : undefined,
        startAt: editForm.startAt || null,
        endAt: editForm.endAt || null,
        legalText: editForm.legalText?.trim() || null,
      };
      if (canEditRules) fields.ruleTree = uiToRuleTree(editItems, editMatchType);
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

  // ─── Delete (WIP only) ────────────────────────────────────
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
      setStatusFilter("wip");
      await load("wip");
    } catch (e) {
      setRowErrors(prev => ({ ...prev, [bundle.id]: e?.message || "Failed to duplicate" }));
    } finally { setDuplicateBusy(null); }
  }

  // ─── Audit ────────────────────────────────────────────────
  async function toggleAudit(bundleId) {
    if (auditBundleId === bundleId) { setAuditBundleId(null); return; }
    setAuditBundleId(bundleId); setAuditLoading(true);
    try {
      const res = isPvAdmin ? await adminGetBundleAudit(merchantId, bundleId) : await merchantGetBundleAudit(bundleId);
      setAuditLogs(res?.logs || []);
    } catch { setAuditLogs([]); } finally { setAuditLoading(false); }
  }

  const merchantName = merchant?.name || `Merchant ${merchantId}`;
  const canEditRules = (status) => ["wip", "staged"].includes(status);

  return (
    <PageContainer>
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        {isPvAdmin ? (
          <>
            <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
            {" / "}
            <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
          </>
        ) : (
          <Link to="/merchant/dashboard" style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        )}
        {" / "}
        <span>Bundles</span>
      </div>

      <PageHeader title="Bundles" subtitle={`Prepaid credit packs for ${merchantName}`} />

      <div style={{ marginTop: 16, marginBottom: 20, padding: "10px 16px", borderRadius: 10, background: color.primarySubtle, border: `1px solid ${color.primaryBorder}`, fontSize: 13, color: color.textMuted }}>
        <strong style={{ color: color.text }}>Phase A — Bundle Setup.</strong>
        {" "}POS sell &amp; redeem available once consumer identity is live.
      </div>

      {/* Status legend */}
      <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ALL_STATUSES.map(s => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textMuted }}>
            <StatusBadge status={s} />
            <span>{STATUS_CONFIG[s].desc}</span>
          </span>
        ))}
      </div>

      {/* ── Suggestion Banner ── */}
      {!isPvAdmin && merchant?.merchantType && (
        <SuggestionBanner
          merchantType={merchant.merchantType}
          entityType="bundles"
          onFill={(s) => {
            setForm(f => ({
              ...f,
              name:  s.name  || "",
              price: s.price || "",
            }));
            setShowCreate(true);
          }}
        />
      )}

      {/* Create card */}
      {!showCreate ? (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", background: color.pageBg }}>
          <div>
            <div style={{ fontWeight: 700, color: color.text }}>Create a bundle</div>
            <div style={{ color: color.textMuted, fontSize: 13, marginTop: 2 }}>Starts as WIP. Rule tree is locked once live.</div>
          </div>
          <button type="button" style={btnPrimary} onClick={() => { setShowCreate(true); setEditingId(null); }}>+ Create Bundle</button>
        </div>
      ) : (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, padding: 20, marginBottom: 20, background: color.cardBg }}>
          <div style={{ fontWeight: 800, marginBottom: 14 }}>New Bundle</div>
          <form onSubmit={handleCreate}>
            <div style={twoCol}>
              <div style={fieldRow}>
                <label style={labelStyle}>Bundle Name <span style={req}>*</span></label>
                <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 10 Coffee Credits" autoFocus />
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
                <label style={labelStyle}>End Date <span style={{ fontSize: 11, color: color.textFaint }}>(optional)</span></label>
                <input style={inputStyle} type="date" min={form.startAt || "2024-01-01"} max="2099-12-31" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
                <div style={hint}>Leave blank to run until manually stopped.</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...labelStyle, marginBottom: 10 }}>Products <span style={req}>*</span></label>
              <RuleTreeBuilder
                items={createItems}
                matchType={createMatchType}
                onItemsChange={setCreateItems}
                onMatchTypeChange={setCreateMatchType}
                products={products}
                disabled={saving}
              />
            </div>
            <div style={fieldRow}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={labelStyle}>Terms & Conditions (shown to consumers)</label>
                <button
                  type="button"
                  style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, borderRadius: 999 }}
                  disabled={generatingTerms}
                  onClick={handleGenerateTerms}
                >
                  {generatingTerms ? "Generating…" : "✦ Generate Draft"}
                </button>
              </div>
              <textarea
                style={{ ...inputStyle, width: "100%", minHeight: 120, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }}
                value={form.legalText}
                onChange={e => setForm(f => ({ ...f, legalText: e.target.value }))}
                placeholder="Click 'Generate Draft' for an AI-drafted terms template, then review and edit as needed."
              />
              <div style={hint}>AI-generated draft — always review before saving. Includes bundle contents, price, validity, non-refund, and merchant cancellation clauses.</div>
            </div>
            {formError && <div style={errorStyle}>{formError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="submit" style={btnPrimary} disabled={saving}>{saving ? "Saving…" : "Save Bundle"}</button>
              <button type="button" style={btnSecondary} onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setCreateItems(EMPTY_ITEMS); setFormError(""); }}>Cancel</button>
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
        <div style={{ color: color.textFaint, padding: 20 }}>Loading…</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : bundles.length === 0 ? (
        <div style={{ color: color.textFaint, padding: 20 }}>No bundles found.</div>
      ) : (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, overflow: "visible" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: color.pageBg, borderBottom: `1px solid ${color.border}` }}>
                <th style={th}>Bundle</th>
                <th style={th}>Products</th>
                <th style={th}>Price</th>
                <th style={th}>Start</th>
                <th style={th}>End</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "center" }}>Edit</th>
                <th style={{ ...th, textAlign: "center", color: color.primary }}>Lifecycle →</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b, idx) => (
                <React.Fragment key={b.id}>
                  {/* Main row */}
                  <tr style={{ borderTop: idx === 0 ? "none" : `1px solid ${color.borderSubtle}`, background: editingId === b.id ? color.pageBg : "transparent" }}>
                    <td style={{ ...td, fontWeight: 700 }}>{b.name}</td>
                    <td style={{ ...td, fontSize: 12, color: color.textMuted, maxWidth: 240 }}>
                      {b.ruleTreeJson ? describeRuleTree(b.ruleTreeJson) : <span style={{ color: color.textFaint }}>—</span>}
                    </td>
                    <td style={td}>{formatPrice(b.price)}</td>
                    <td style={{ ...td, fontSize: 12, color: color.textMuted }}>{fmtDate(b.startAt)}</td>
                    <td style={{ ...td, fontSize: 12, color: color.textMuted }}>{b.endAt ? fmtDate(b.endAt) : <span style={{ color: color.textFaint }}>No end</span>}</td>
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
                                const itemColor = isDestructive ? color.danger : isBack ? color.textMuted : color.primary;
                                return (
                                  <button
                                    key={t.to}
                                    type="button"
                                    style={{ ...dropdownItem, color: itemColor, borderBottom: ti < (TRANSITIONS[b.status].length - 1) ? `1px solid ${color.borderSubtle}` : "none" }}
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
                        <span style={{ fontSize: 12, color: color.textFaint }}>—</span>
                      )}
                    </td>
                  </tr>

                  {/* Per-row error */}
                  {rowErrors[b.id] && (
                    <tr style={{ borderTop: `1px solid ${color.dangerBorder}` }}>
                      <td colSpan={8} style={{ padding: "6px 16px", background: color.dangerSubtle }}>
                        <span style={{ fontSize: 12, color: color.danger }}>⚠ {rowErrors[b.id]}</span>
                        <button type="button" onClick={() => setRowErrors(prev => ({ ...prev, [b.id]: null }))} style={{ marginLeft: 10, fontSize: 11, color: color.textFaint, background: "none", border: "none", cursor: "pointer" }}>dismiss</button>
                      </td>
                    </tr>
                  )}

                  {/* Inline edit row */}
                  {editingId === b.id && (
                    <tr style={{ borderTop: `1px solid ${color.borderSubtle}`, background: color.pageBg }}>
                      <td colSpan={8} style={{ padding: "16px 20px" }}>
                        <div style={twoCol}>
                          <div style={fieldRow}>
                            <label style={labelStyle}>Name <span style={req}>*</span></label>
                            <input style={inputStyle} value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                          </div>
                          <div style={fieldRow}>
                            <label style={labelStyle}>Price ($)</label>
                            <input style={inputStyle} type="number" min="0" step="0.01" value={editForm.price ?? ""} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div style={fieldRow}>
                            <label style={labelStyle}>Start Date</label>
                            <input style={inputStyle} type="date" min="2024-01-01" max="2099-12-31" value={editForm.startAt || ""} onChange={e => setEditForm(f => ({ ...f, startAt: e.target.value }))} />
                          </div>
                          <div style={fieldRow}>
                            <label style={labelStyle}>End Date</label>
                            <input style={inputStyle} type="date" min={editForm.startAt || "2024-01-01"} max="2099-12-31" value={editForm.endAt || ""} onChange={e => setEditForm(f => ({ ...f, endAt: e.target.value }))} />
                          </div>
                        </div>
                        {canEditRules(b.status) && (
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ ...labelStyle, marginBottom: 10 }}>Products</label>
                            <RuleTreeBuilder
                              items={editItems}
                              matchType={editMatchType}
                              onItemsChange={setEditItems}
                              onMatchTypeChange={setEditMatchType}
                              products={products}
                              disabled={editSaving}
                            />
                          </div>
                        )}
                        {!canEditRules(b.status) && (
                          <div style={{ fontSize: 12, color: color.textFaint, marginBottom: 12, padding: "8px 12px", background: color.pageBg, border: `1px solid ${color.border}`, borderRadius: 8 }}>
                            Products locked — rule tree cannot be changed once a bundle is <strong>{b.status}</strong>.
                          </div>
                        )}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <label style={labelStyle}>Terms & Conditions</label>
                            <button
                              type="button"
                              style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, borderRadius: 999 }}
                              disabled={editGeneratingTerms}
                              onClick={() => handleEditGenerateTerms(b)}
                            >
                              {editGeneratingTerms ? "Generating…" : "✦ Generate Draft"}
                            </button>
                          </div>
                          <textarea
                            style={{ ...inputStyle, width: "100%", minHeight: 110, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }}
                            value={editForm.legalText || ""}
                            onChange={e => setEditForm(f => ({ ...f, legalText: e.target.value }))}
                            placeholder="Click 'Generate Draft' for an AI-drafted terms template, then review and edit as needed."
                          />
                          <div style={hint}>Consumers see this at point of sale.</div>
                        </div>
                        {editError && <div style={{ ...errorStyle, marginBottom: 10 }}>{editError}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" style={btnPrimary} disabled={editSaving} onClick={() => handleEditSave(b)}>{editSaving ? "Saving…" : "Save"}</button>
                          <button type="button" style={btnSecondary} onClick={cancelEdit}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Audit log row */}
                  {auditBundleId === b.id && (
                    <tr style={{ borderTop: `1px solid ${color.borderSubtle}`, background: color.pageBg }}>
                      <td colSpan={8} style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: color.text }}>Change Log</div>
                        {auditLoading ? (
                          <div style={{ fontSize: 13, color: color.textFaint }}>Loading…</div>
                        ) : auditLogs.length === 0 ? (
                          <div style={{ fontSize: 13, color: color.textFaint }}>No log entries yet.</div>
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
                                  <td style={auditTd}>{log.actorUserId ?? <span style={{ color: color.textFaint }}>system</span>}</td>
                                  <td style={auditTd}><span style={{ fontFamily: "monospace" }}>{log.action}</span></td>
                                  <td style={auditTd}>
                                    <pre style={{ margin: 0, fontSize: 11, color: color.textMuted, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
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
const btnPrimary     = { ...btn.primary,   padding: "8px 18px",  borderRadius: 999, fontSize: 13 };
const btnSecondary   = { ...btn.secondary, padding: "8px 18px",  borderRadius: 999, fontSize: 13 };
const btnSmall       = { ...btn.pill,      padding: "4px 12px",  fontSize: 12 };
const btnSmallAction = { ...btnSmall, background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary };
const btnSmallGhost  = { ...btnSmall, color: color.textFaint, borderColor: color.borderSubtle };
const btnSmallDelete = { ...btn.danger,    padding: "4px 12px",  fontSize: 12 };
const btnFilter      = { ...btn.pill,      padding: "6px 14px",  fontSize: 12 };
const btnFilterActive = { ...btnFilter, background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary };
const btnLifecycle   = { ...btnSmall, background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary, whiteSpace: "nowrap" };
const twoCol         = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "0 20px" };
const fieldRow       = { marginBottom: 12 };
const labelStyle     = { display: "block", fontSize: 12, fontWeight: 700, color: color.textMuted, marginBottom: 4 };
const inputStyle     = { ...themeInput, padding: "8px 12px", fontSize: 14 };
const errorStyle     = { color: color.danger, fontSize: 13, padding: "8px 12px", background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`, borderRadius: 8, marginTop: 4 };
const hint           = { fontSize: 11, color: color.textFaint, marginTop: 3 };
const req            = { color: color.danger };
const th             = { padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 12, color: color.textMuted };
const td             = { padding: "12px 16px", verticalAlign: "middle" };
const auditTh        = { padding: "6px 10px", textAlign: "left", fontWeight: 700, fontSize: 11, color: color.textFaint, borderBottom: `1px solid ${color.borderSubtle}` };
const auditTd        = { padding: "6px 10px", verticalAlign: "top", fontSize: 12 };
const dropdownMenu   = { position: "absolute", bottom: "calc(100% + 4px)", right: 0, zIndex: 50, background: color.cardBg, border: `1px solid ${color.border}`, borderRadius: 10, boxShadow: "0 -4px 16px rgba(0,0,0,0.10)", minWidth: 180, overflow: "hidden" };
const dropdownItem   = { display: "flex", alignItems: "center", width: "100%", padding: "9px 14px", background: "none", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left", color: color.text };
