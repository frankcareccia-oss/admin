/**
 * MerchantPromotions.jsx
 *
 * Reward program management — v3.5 blended model.
 * Flat RewardProgramForm: Category → Threshold → Reward → Timeframe → Scope → Status
 *
 * Route: /merchants/:merchantId/promotions
 * Accessible by pv_admin and merchant_admin / owner.
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { color, btn, palette, inputStyle as themeInput } from "../theme";
import PromotionLaunchSequence from "../components/PromotionLaunchSequence";
import PromotionMonitor from "../components/PromotionMonitor";
import {
  getMerchant,
  me,
  getSystemRole,
  merchantListCategories,
  merchantListProducts,
  merchantListPromotions,
  merchantCreatePromotion,
  merchantUpdatePromotion,
  merchantArchivePromotion,
  merchantTransitionPromotion,
  merchantDuplicatePromotion,
  adminListMerchantCategories,
  adminListMerchantProducts,
  adminListMerchantPromotions,
  adminCreateMerchantPromotion,
  adminUpdateMerchantPromotion,
  adminArchiveMerchantPromotion,
  adminTransitionPromotion,
  adminDuplicateMerchantPromotion,
  generatePromoTerms,
  generatePromoDescription,
  getPromotionOutcome,
  listMerchantStores,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";
import SuggestionBanner from "../components/SuggestionBanner";
import GuidanceCard from "../components/GuidanceCard";

// ─── pvUiHook ────────────────────────────────────────────────
function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch { /* never break UI */ }
}

// ─── Constants ───────────────────────────────────────────────

const REWARD_TYPE_LABELS = {
  free_item:      "Free Item",
  discount_pct:   "Discount %",
  discount_fixed: "Discount $ (fixed)",
  custom:         "Custom",
};

const SCOPE_LABELS = {
  merchant: "All Stores",
  store:    "Specific Store",
};

const STATUS_COLORS = {
  draft:    { background: "rgba(100,100,200,0.08)", color: "rgba(60,60,160,1)",  border: "1px solid rgba(100,100,200,0.20)" },
  staged:   { background: "rgba(0,120,200,0.08)",   color: "rgba(0,90,170,1)",   border: "1px solid rgba(0,120,200,0.20)" },
  active:   { background: "rgba(0,150,80,0.10)",    color: "rgba(0,110,50,1)",   border: "1px solid rgba(0,150,80,0.25)" },
  paused:   { background: "rgba(200,120,0,0.10)",   color: "rgba(160,90,0,1)",   border: "1px solid rgba(200,120,0,0.25)" },
  archived: { background: "rgba(0,0,0,0.06)",       color: "rgba(0,0,0,0.45)",   border: "1px solid rgba(0,0,0,0.10)" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.archived;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

function CatPill({ name }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "rgba(11,42,51,0.08)", color: "#0B2A33" }}>
      {name}
    </span>
  );
}

// ─── Empty form ───────────────────────────────────────────────
const EMPTY_TIER = { tierName: "", threshold: "", rewardType: "discount_fixed", rewardValue: "", rewardNote: "" };

const EMPTY_FORM = {
  name: "",
  description: "",
  promotionType: "stamp",
  categoryId: "",
  threshold: "",
  rewardType: "free_item",
  rewardValue: "",
  rewardSku: "",
  rewardNote: "",
  timeframeDays: "",
  scope: "merchant",
  storeId: "",
  legalText: "",
  tiers: [
    { tierName: "Bronze", threshold: "5", rewardType: "discount_fixed", rewardValue: "200", rewardNote: "" },
    { tierName: "Silver", threshold: "15", rewardType: "discount_fixed", rewardValue: "500", rewardNote: "" },
    { tierName: "Gold", threshold: "30", rewardType: "discount_fixed", rewardValue: "1000", rewardNote: "" },
  ],
};

// ══════════════════════════════════════════════════════════════
//  Main Component
// ══════════════════════════════════════════════════════════════

export default function MerchantPromotions() {
  const { merchantId } = useParams();
  const systemRole = getSystemRole();
  const isPvAdmin = systemRole === "pv_admin";

  const [merchant, setMerchant]         = React.useState(null);
  const [categories, setCategories]     = React.useState([]);
  const [products, setProducts]         = React.useState([]);
  const [stores, setStores]             = React.useState([]);
  const [promotions, setPromotions]     = React.useState([]);
  const [loading, setLoading]           = React.useState(true);
  const [error, setError]               = React.useState("");
  const [lastError, setLastError]       = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("active");

  // Create form
  const [showCreate, setShowCreate]   = React.useState(false);
  const [form, setForm]               = React.useState(EMPTY_FORM);
  const [formErr, setFormErr]         = React.useState("");
  const [saving, setSaving]           = React.useState(false);
  const [generatingTerms, setGeneratingTerms] = React.useState(false);

  // Edit
  const [editId, setEditId]           = React.useState(null);
  const [editForm, setEditForm]       = React.useState({});
  const [editErr, setEditErr]         = React.useState("");
  const [editSaving, setEditSaving]   = React.useState(false);
  const [editGeneratingTerms, setEditGeneratingTerms] = React.useState(false);
  const [generatingDesc, setGeneratingDesc] = React.useState(false);
  const [descVersions, setDescVersions] = React.useState(null); // { versionA, versionB }

  // Performance outcomes
  const [outcomeId, setOutcomeId]     = React.useState(null);
  const [outcome, setOutcome]         = React.useState(null);
  const [outcomeLoading, setOutcomeLoading] = React.useState(false);

  // ─── Load ──────────────────────────────────────────────────
  async function load(filter = statusFilter) {
    setLoading(true);
    setError("");
    pvUiHook("merchant.promotions.load.started", { stable: "promo:load", merchantId });
    try {
      const [mRes, catRes, prodRes, promoRes, storeRes] = await Promise.all([
        isPvAdmin ? getMerchant(merchantId) : me(),
        isPvAdmin
          ? adminListMerchantCategories(merchantId)
          : merchantListCategories(),
        isPvAdmin
          ? adminListMerchantProducts(merchantId, { status: "active" })
          : merchantListProducts({ status: "active" }),
        isPvAdmin
          ? adminListMerchantPromotions(merchantId, { status: filter || undefined })
          : merchantListPromotions({ status: filter || undefined }),
        Promise.resolve().then(() => listMerchantStores()).catch(() => ({ stores: [] })),
      ]);
      setMerchant(isPvAdmin ? (mRes?.merchant || mRes) : (mRes?.user?.merchantUsers?.[0]?.merchant || null));
      setCategories(catRes?.categories || []);
      setProducts(prodRes?.items || prodRes?.products || []);
      setPromotions(promoRes?.promotions || []);
      setStores(Array.isArray(storeRes?.stores) ? storeRes.stores : Array.isArray(storeRes?.items) ? storeRes.items : Array.isArray(storeRes) ? storeRes : []);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.load.succeeded", {
        stable: "promo:load", merchantId,
        promoCount: (promoRes?.promotions || []).length,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load promotions";
      setError(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.load.failed", { stable: "promo:load", merchantId, error: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, [merchantId]);

  // ─── Validation ────────────────────────────────────────────
  function validateForm(f) {
    if (!f.name.trim()) return "Name is required";
    if (!f.categoryId) return "Qualifying category is required";
    const t = parseInt(f.threshold, 10);
    if (!t || t < 1) return "Threshold must be a positive whole number";
    if (f.rewardType === "free_item" && !f.rewardSku.trim()) return "Reward SKU is required for Free Item";
    if (f.rewardType === "custom" && !f.rewardNote.trim()) return "Reward note is required for Custom reward";
    if ((f.rewardType === "discount_pct" || f.rewardType === "discount_fixed") && !f.rewardValue) return "Reward value is required";
    if (f.rewardType === "discount_pct") {
      const v = parseInt(f.rewardValue, 10);
      if (!v || v < 1 || v > 100) return "Discount % must be between 1 and 100";
    }
    if (f.rewardType === "discount_fixed") {
      const v = parseInt(f.rewardValue, 10);
      if (!v || v < 1) return "Discount amount must be at least 1 cent";
    }
    if (f.timeframeDays) {
      const td = parseInt(f.timeframeDays, 10);
      if (!td || td < 1) return "Timeframe must be a positive number of days";
    }
    return null;
  }

  function buildPayload(f) {
    return {
      name: f.name.trim(),
      description: f.description?.trim() || undefined,
      promotionType: f.promotionType || "stamp",
      categoryId: parseInt(f.categoryId, 10),
      mechanic: "stamps",
      threshold: parseInt(f.threshold, 10),
      rewardType: f.rewardType,
      rewardValue: (f.rewardType === "discount_pct" || f.rewardType === "discount_fixed")
        ? parseInt(f.rewardValue, 10) : undefined,
      rewardSku:  f.rewardType === "free_item"  ? f.rewardSku.trim()  : undefined,
      rewardNote: f.rewardType === "custom"      ? f.rewardNote.trim() : undefined,
      timeframeDays: f.timeframeDays ? parseInt(f.timeframeDays, 10) : undefined,
      scope: f.scope,
      storeId: f.scope === "store" && f.storeId ? parseInt(f.storeId, 10) : null,
      legalText: f.legalText?.trim() || undefined,
      ...(f.promotionType === "tiered" && Array.isArray(f.tiers) ? {
        tiers: f.tiers.filter(t => t.tierName && t.threshold).map((t, idx) => ({
          tierName: t.tierName.trim(),
          tierLevel: idx + 1,
          threshold: parseInt(t.threshold, 10),
          rewardType: t.rewardType || "discount_fixed",
          rewardValue: t.rewardValue ? parseInt(t.rewardValue, 10) : null,
          rewardNote: t.rewardNote?.trim() || null,
        })),
      } : {}),
    };
  }

  async function handleGenerateTerms() {
    const cat = activeCategories.find(c => String(c.id) === String(form.categoryId));
    setGeneratingTerms(true);
    setFormErr("");
    try {
      const data = await generatePromoTerms({
        name: form.name || "Loyalty Program",
        categoryName: cat?.name || null,
        mechanic: "stamps",
        threshold: parseInt(form.threshold, 10) || null,
        rewardType: form.rewardType,
        rewardValue: (form.rewardType === "discount_pct" || form.rewardType === "discount_fixed")
          ? parseInt(form.rewardValue, 10) : undefined,
        rewardSku: form.rewardType === "free_item" ? form.rewardSku : undefined,
        rewardNote: form.rewardType === "custom" ? form.rewardNote : undefined,
        timeframeDays: form.timeframeDays ? parseInt(form.timeframeDays, 10) : null,
      });
      setF("legalText", data.draft || "");
    } catch (e) {
      setFormErr(e?.message || "Failed to generate terms draft");
    } finally {
      setGeneratingTerms(false);
    }
  }

  async function handleEditGenerateTerms(promo) {
    const cat = activeCategories.find(c => c.id === promo.categoryId);
    setEditGeneratingTerms(true);
    setEditErr("");
    try {
      const data = await generatePromoTerms({
        name: editForm.name || promo.name,
        categoryName: cat?.name || null,
        mechanic: "stamps",
        threshold: promo.threshold,
        rewardType: promo.rewardType,
        rewardValue: promo.rewardValue,
        rewardSku: promo.rewardSku,
        rewardNote: promo.rewardNote,
        timeframeDays: promo.timeframeDays,
      });
      setEditForm(f => ({ ...f, legalText: data.draft || "" }));
    } catch (e) {
      setEditErr(e?.message || "Failed to generate terms draft");
    } finally {
      setEditGeneratingTerms(false);
    }
  }

  // ─── AI description generation (two versions) ──────────────
  async function handleGenerateDesc() {
    if (!form.name.trim()) { setFormErr("Enter a program name first"); return; }
    setGeneratingDesc(true);
    setFormErr("");
    setDescVersions(null);
    try {
      const cat = activeCategories.find(c => String(c.id) === String(form.categoryId));
      const data = await generatePromoDescription({
        name: form.name,
        categoryName: cat?.name || null,
        promotionType: "stamp",
        threshold: parseInt(form.threshold, 10) || null,
        rewardType: form.rewardType,
        rewardValue: (form.rewardType === "discount_pct" || form.rewardType === "discount_fixed")
          ? parseInt(form.rewardValue, 10) : undefined,
        rewardSku: form.rewardType === "free_item" ? form.rewardSku : undefined,
        rewardNote: form.rewardType === "custom" ? form.rewardNote : undefined,
        timeframeDays: form.timeframeDays ? parseInt(form.timeframeDays, 10) : null,
      });
      if (data.versionA && data.versionB) {
        setDescVersions({ versionA: data.versionA, versionB: data.versionB });
      } else {
        // Fallback: single version
        setF("description", data.versionA || data.draft || "");
      }
    } catch (e) {
      setFormErr(e?.message || "Failed to generate description");
    } finally {
      setGeneratingDesc(false);
    }
  }

  function selectDescVersion(version) {
    setF("description", version);
    setDescVersions(null);
  }

  // ─── Create ────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setFormErr("");
    const err = validateForm(form);
    if (err) { setFormErr(err); return; }

    setSaving(true);
    pvUiHook("merchant.promotions.create.started", { stable: "promo:create", merchantId });
    try {
      if (isPvAdmin) {
        await adminCreateMerchantPromotion(merchantId, buildPayload(form));
      } else {
        await merchantCreatePromotion(buildPayload(form));
      }
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.create.succeeded", { stable: "promo:create", merchantId });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to create reward program";
      setFormErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.create.failed", { stable: "promo:create", merchantId, error: msg });
    } finally {
      setSaving(false);
    }
  }

  // ─── Performance ───────────────────────────────────────────
  async function toggleOutcome(promoId) {
    if (outcomeId === promoId) { setOutcomeId(null); setOutcome(null); return; }
    setOutcomeId(promoId);
    setOutcomeLoading(true);
    try {
      const data = await getPromotionOutcome(promoId);
      setOutcome(data);
    } catch { setOutcome(null); }
    setOutcomeLoading(false);
  }

  // ─── Edit ──────────────────────────────────────────────────
  function startEdit(promo) {
    setEditId(promo.id);
    setEditForm({ name: promo.name, description: promo.description || "", legalText: promo.legalText || "" });
    setEditErr("");
    pvUiHook("merchant.promotions.edit.open", { stable: "promo:edit", merchantId, promoId: promo.id });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({});
    setEditErr("");
  }

  async function handleEditSave(promoId) {
    setEditErr("");
    if (!editForm.name?.trim()) { setEditErr("Name is required"); return; }
    setEditSaving(true);
    pvUiHook("merchant.promotions.edit.started", { stable: "promo:edit", merchantId, promoId });
    try {
      const payload = {
        name: editForm.name.trim(),
        description: editForm.description?.trim() || null,
        legalText: editForm.legalText?.trim() || null,
      };
      if (isPvAdmin) {
        await adminUpdateMerchantPromotion(merchantId, promoId, payload);
      } else {
        await merchantUpdatePromotion(promoId, payload);
      }
      setEditId(null);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.edit.succeeded", { stable: "promo:edit", merchantId, promoId });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to update reward program";
      setEditErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.edit.failed", { stable: "promo:edit", merchantId, promoId, error: msg });
    } finally {
      setEditSaving(false);
    }
  }

  // Launch sequence modal state
  const [launchPromo, setLaunchPromo] = React.useState(null);

  // ─── Status transitions ────────────────────────────────────
  async function handleTransition(promo, toStatus) {
    // Intercept "active" transitions — show launch sequence first
    if (toStatus === "active" && promo.status !== "paused") {
      setLaunchPromo(promo);
      return;
    }
    pvUiHook(`merchant.promotions.transition.${toStatus}`, { stable: "promo:transition", merchantId, promoId: promo.id, toStatus });
    try {
      if (isPvAdmin) {
        await adminTransitionPromotion(merchantId, promo.id, toStatus);
      } else {
        await merchantTransitionPromotion(promo.id, toStatus);
      }
      setLastSuccessTs(new Date().toISOString());
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || `Failed to transition to ${toStatus}`;
      setLastError(msg);
      pvUiHook(`merchant.promotions.transition.failed`, { stable: "promo:transition", merchantId, promoId: promo.id, toStatus, error: msg });
    }
  }

  async function handleArchive(promo) {
    pvUiHook("merchant.promotions.archive.started", { stable: "promo:archive", merchantId, promoId: promo.id });
    try {
      if (isPvAdmin) {
        await adminArchiveMerchantPromotion(merchantId, promo.id);
      } else {
        await merchantArchivePromotion(promo.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.archive.succeeded", { stable: "promo:archive", merchantId, promoId: promo.id });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to archive reward program";
      setLastError(msg);
      pvUiHook("merchant.promotions.archive.failed", { stable: "promo:archive", merchantId, promoId: promo.id, error: msg });
    }
  }

  async function handleDuplicate(promo) {
    pvUiHook("merchant.promotions.duplicate.started", { stable: "promo:duplicate", merchantId, promoId: promo.id });
    try {
      if (isPvAdmin) {
        await adminDuplicateMerchantPromotion(merchantId, promo.id);
      } else {
        await merchantDuplicatePromotion(promo.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.duplicate.succeeded", { stable: "promo:duplicate", merchantId, promoId: promo.id });
      await load("draft");
      setStatusFilter("draft");
    } catch (e) {
      const msg = e?.message || "Failed to duplicate reward program";
      setLastError(msg);
      pvUiHook("merchant.promotions.duplicate.failed", { stable: "promo:duplicate", merchantId, promoId: promo.id, error: msg });
    }
  }

  // ─── Helpers ──────────────────────────────────────────────
  const merchantName = merchant?.name || `Merchant ${merchantId}`;
  const activeCategories = categories.filter(c => c.status === "active");
  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  function rewardSummary(promo) {
    const label = REWARD_TYPE_LABELS[promo.rewardType] || promo.rewardType;
    if (promo.rewardType === "discount_pct")   return `${label}: ${promo.rewardValue}%`;
    if (promo.rewardType === "discount_fixed") return `${label}: $${(promo.rewardValue / 100).toFixed(2)}`;
    if (promo.rewardType === "free_item")      return `${label}: ${promo.rewardSku}`;
    if (promo.rewardType === "custom")         return `${label}: ${promo.rewardNote}`;
    return label;
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <PageContainer>
      {/* Breadcrumb */}
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
        <span>Promotions</span>
      </div>

      <PageHeader
        title="Reward Programs"
        subtitle={`Loyalty promotions for ${merchantName}`}
        right={
          <button
            type="button"
            style={btnSecondary}
            onClick={() => {
              pvUiHook("merchant.promotions.refresh.clicked", { stable: "promo:refresh", merchantId });
              load(statusFilter);
            }}
          >
            Refresh
          </button>
        }
      />

      <div style={{ marginTop: 20 }} />

      {/* No categories warning */}
      {!loading && activeCategories.length === 0 && (
        <div style={infoBox}>
          <strong>No product categories yet.</strong> Go to{" "}
          <Link to={`/merchants/${merchantId}/products`} style={{ color: color.text }}>Products</Link>{" "}
          and add categories before creating reward programs.
        </div>
      )}

      {loading ? (
        <div style={{ color: color.textFaint, padding: 20 }}>Loading…</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : (
        <>
          {/* ── Status filter ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {["draft", "staged", "active", "paused", "archived", ""].map(f => (
              <button
                key={f || "all"}
                type="button"
                style={statusFilter === f ? btnFilterActive : btnFilter}
                onClick={() => {
                  setStatusFilter(f);
                  load(f);
                  pvUiHook("merchant.promotions.filter.changed", { stable: "promo:filter", merchantId, filter: f || "all" });
                }}
              >
                {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Suggestion Banner ── */}
          {!isPvAdmin && merchant?.merchantType && (
            <SuggestionBanner
              merchantType={merchant.merchantType}
              entityType="promotions"
              onFill={(s) => {
                setForm(f => ({
                  ...f,
                  name:         s.name         || "",
                  threshold:    s.threshold    != null ? String(s.threshold) : "",
                  rewardType:   s.rewardType   || "custom",
                  rewardNote:   s.rewardNote   || "",
                  timeframeDays: s.timeframeDays != null ? String(s.timeframeDays) : "",
                  scope:        s.scope        || "merchant",
                }));
                setShowCreate(true);
              }}
            />
          )}

          {/* ── Create toggle ── */}
          {!showCreate ? (
            <div style={summaryBar}>
              <div>
                <div style={{ fontWeight: 700 }}>Add a reward program</div>
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
                  e.g. Buy 5 Coffee → Free Coffee (30 days)
                </div>
              </div>
              <button
                type="button"
                style={btnPrimary}
                disabled={activeCategories.length === 0}
                onClick={() => {
                  setShowCreate(true);
                  setEditId(null);
                  pvUiHook("merchant.promotions.create.open", { stable: "promo:create", merchantId });
                }}
              >
                + Add Program
              </button>
            </div>
          ) : (
            <div style={createCard}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>New Reward Program</div>
              <GuidanceCard type="promotion" />
              <form onSubmit={handleCreate}>

                {/* Name */}
                <div style={fieldRow}>
                  <label style={labelStyle}>Program Name <span style={reqStar}>*</span></label>
                  <input style={inputStyle} value={form.name} onChange={e => setF("name", e.target.value)} placeholder="e.g. Coffee Stamp Card" autoFocus />
                </div>

                {/* Program Type */}
                <div style={fieldRow}>
                  <label style={labelStyle}>Program Type</label>
                  <select style={selectStyle} value={form.promotionType} onChange={e => setF("promotionType", e.target.value)}>
                    <option value="stamp">Stamp Card — visit N times, earn a reward</option>
                    <option value="tiered">Tiered — escalating rewards at Bronze / Silver / Gold</option>
                  </select>
                </div>

                {/* Tier Configuration (only for tiered) */}
                {form.promotionType === "tiered" && (
                  <div style={{ ...fieldRow, background: "rgba(47,143,139,0.04)", borderRadius: 10, padding: "12px 16px", border: `1px solid rgba(47,143,139,0.15)` }}>
                    <label style={{ ...labelStyle, marginBottom: 8 }}>Reward Tiers</label>
                    {form.tiers.map((tier, idx) => (
                      <div key={idx} style={{ display: "grid", gridTemplateColumns: "120px 80px 140px 100px 1fr 40px", gap: 8, marginBottom: 6, alignItems: "center" }}>
                        <input style={{ ...inputStyle, fontSize: 13 }} value={tier.tierName} placeholder="Tier name"
                          onChange={e => { const t = [...form.tiers]; t[idx] = { ...t[idx], tierName: e.target.value }; setF("tiers", t); }} />
                        <input style={{ ...inputStyle, fontSize: 13 }} type="number" min="1" value={tier.threshold} placeholder="Visits"
                          onChange={e => { const t = [...form.tiers]; t[idx] = { ...t[idx], threshold: e.target.value }; setF("tiers", t); }} />
                        <select style={{ ...selectStyle, fontSize: 12 }} value={tier.rewardType}
                          onChange={e => { const t = [...form.tiers]; t[idx] = { ...t[idx], rewardType: e.target.value }; setF("tiers", t); }}>
                          <option value="discount_fixed">$ off</option>
                          <option value="discount_pct">% off</option>
                          <option value="free_item">Free item</option>
                          <option value="custom">Custom</option>
                        </select>
                        <input style={{ ...inputStyle, fontSize: 13 }} value={tier.rewardValue} placeholder={tier.rewardType === "discount_fixed" ? "cents" : "%"}
                          onChange={e => { const t = [...form.tiers]; t[idx] = { ...t[idx], rewardValue: e.target.value }; setF("tiers", t); }} />
                        <input style={{ ...inputStyle, fontSize: 13 }} value={tier.rewardNote || ""} placeholder="Note (optional)"
                          onChange={e => { const t = [...form.tiers]; t[idx] = { ...t[idx], rewardNote: e.target.value }; setF("tiers", t); }} />
                        {form.tiers.length > 1 && (
                          <button type="button" style={{ background: "none", border: "none", color: "#C62828", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
                            onClick={() => { const t = form.tiers.filter((_, i) => i !== idx); setF("tiers", t); }}>x</button>
                        )}
                      </div>
                    ))}
                    <button type="button" style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, marginTop: 4 }}
                      onClick={() => setF("tiers", [...form.tiers, { ...EMPTY_TIER, tierName: `Tier ${form.tiers.length + 1}` }])}>
                      + Add Tier
                    </button>
                    <div style={hint}>Each tier has its own visit threshold and reward. Consumers progress through tiers permanently — never reset.</div>
                  </div>
                )}

                {/* Description — consumer-facing pitch */}
                <div style={fieldRow}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Description <span style={{ fontWeight: 400, color: color.textFaint }}>(shown to consumers)</span></label>
                    <button
                      type="button"
                      style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, borderRadius: 999 }}
                      disabled={generatingDesc || !form.name.trim()}
                      onClick={handleGenerateDesc}
                    >
                      {generatingDesc ? "Writing..." : "✦ Write for me"}
                    </button>
                  </div>
                  {/* A/B version picker */}
                  {descVersions ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                      <div
                        onClick={() => selectDescVersion(descVersions.versionA)}
                        style={{
                          padding: "10px 12px", borderRadius: 8, cursor: "pointer", lineHeight: 1.5,
                          border: form.description === descVersions.versionA ? "2px solid #1D9E75" : `1px solid ${color.border}`,
                          background: form.description === descVersions.versionA ? "rgba(29,158,117,0.06)" : color.cardBg,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1D9E75", marginBottom: 4 }}>A — Reward-led</div>
                        {descVersions.versionA}
                      </div>
                      <div
                        onClick={() => selectDescVersion(descVersions.versionB)}
                        style={{
                          padding: "10px 12px", borderRadius: 8, cursor: "pointer", lineHeight: 1.5,
                          border: form.description === descVersions.versionB ? "2px solid #1D9E75" : `1px solid ${color.border}`,
                          background: form.description === descVersions.versionB ? "rgba(29,158,117,0.06)" : color.cardBg,
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1D9E75", marginBottom: 4 }}>B — Experience-led</div>
                        {descVersions.versionB}
                      </div>
                    </div>
                  ) : null}
                  <textarea
                    style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }}
                    value={form.description}
                    onChange={e => setF("description", e.target.value)}
                    placeholder="Enter a pitch or click 'Write for me' — this is what consumers see when deciding whether to join."
                  />
                </div>

                <div style={twoCol}>
                  {/* Qualifying Category */}
                  <div style={fieldRow}>
                    <label style={labelStyle}>Qualifying Category <span style={reqStar}>*</span></label>
                    <select style={selectStyle} value={form.categoryId} onChange={e => setF("categoryId", e.target.value)}>
                      <option value="">— select category —</option>
                      {activeCategories.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.categoryType === "visit" ? `${c.name} ★` : c.name}
                        </option>
                      ))}
                    </select>
                    <div style={hint}>
                      {form.categoryId && activeCategories.find(c => String(c.id) === String(form.categoryId))?.categoryType === "visit"
                        ? "Every identified store visit earns 1 stamp — no product purchase required."
                        : "Every purchase of a product in this category earns 1 stamp."}
                    </div>
                  </div>

                  {/* Threshold */}
                  <div style={fieldRow}>
                    <label style={labelStyle}>Threshold <span style={reqStar}>*</span></label>
                    <input style={inputStyle} type="number" min="1" value={form.threshold} onChange={e => setF("threshold", e.target.value)} placeholder="e.g. 5" />
                    <div style={hint}>Stamps needed to earn one reward.</div>
                  </div>
                </div>

                <div style={twoCol}>
                  {/* Reward Type */}
                  <div style={fieldRow}>
                    <label style={labelStyle}>Reward Type <span style={reqStar}>*</span></label>
                    <select style={selectStyle} value={form.rewardType} onChange={e => setF("rewardType", e.target.value)}>
                      <option value="free_item">Free Item</option>
                      <option value="discount_pct">Discount %</option>
                      <option value="discount_fixed">Discount $ (fixed)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {/* Reward detail — depends on type */}
                  {form.rewardType === "free_item" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Reward Product <span style={reqStar}>*</span></label>
                      <select style={selectStyle} value={form.rewardSku} onChange={e => setF("rewardSku", e.target.value)}>
                        <option value="">— select product —</option>
                        {products.map(p => <option key={p.id} value={p.sku}>{p.name} ({p.sku})</option>)}
                      </select>
                      <div style={hint}>Product awarded to the consumer when they hit the threshold.</div>
                    </div>
                  )}
                  {form.rewardType === "discount_pct" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Discount % <span style={reqStar}>*</span></label>
                      <input style={inputStyle} type="number" min="1" max="100" value={form.rewardValue} onChange={e => setF("rewardValue", e.target.value)} placeholder="e.g. 10" />
                    </div>
                  )}
                  {form.rewardType === "discount_fixed" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Discount Amount (cents) <span style={reqStar}>*</span></label>
                      <input style={inputStyle} type="number" min="1" value={form.rewardValue} onChange={e => setF("rewardValue", e.target.value)} placeholder="e.g. 500 = $5.00" />
                      <div style={hint}>Enter in cents. 500 = $5.00.</div>
                    </div>
                  )}
                  {form.rewardType === "custom" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Reward Description <span style={reqStar}>*</span></label>
                      <input style={inputStyle} value={form.rewardNote} onChange={e => setF("rewardNote", e.target.value)} placeholder="e.g. Free upgrade to large" />
                    </div>
                  )}
                </div>

                <div style={twoCol}>
                  {/* Stamp Duration */}
                  <div style={fieldRow}>
                    <label style={labelStyle}>Stamp Duration</label>
                    <select style={selectStyle} value={form.timeframeDays || ""} onChange={e => setF("timeframeDays", e.target.value)}>
                      <option value="">No expiry — stamps never expire</option>
                      <option value="30">30 days (1 month)</option>
                      <option value="60">60 days (2 months)</option>
                      <option value="90">90 days (3 months)</option>
                      <option value="180">6 months</option>
                      <option value="365">1 year</option>
                    </select>
                    <div style={hint}>How long each stamp stays active after it's earned. Most programs use 90 days or no expiry.</div>
                  </div>

                  {/* Scope */}
                  <div style={fieldRow}>
                    <label style={labelStyle}>Scope</label>
                    <select style={selectStyle} value={form.scope === "store" && form.storeId ? `store:${form.storeId}` : "merchant"} onChange={e => {
                      const val = e.target.value;
                      if (val === "merchant") {
                        setF("scope", "merchant");
                        setF("storeId", "");
                      } else if (val.startsWith("store:")) {
                        setF("scope", "store");
                        setF("storeId", val.split(":")[1]);
                      }
                    }}>
                      <option value="merchant">All Stores</option>
                      {(stores || []).map(st => (
                        <option key={st.id} value={`store:${st.id}`}>{st.name}</option>
                      ))}
                    </select>
                    <div style={hint}>Select a specific store to limit this program to one location, or "All Stores" for merchant-wide.</div>
                  </div>
                </div>

                {/* Terms & Conditions */}
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
                    onChange={e => setF("legalText", e.target.value)}
                    placeholder="Click 'Generate Draft' for an AI-drafted terms template, then review and edit as needed."
                  />
                  <div style={hint}>AI-generated draft — always review before saving. Consumers see this in the program detail view.</div>
                </div>

                {formErr && <div style={errorStyle}>{formErr}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button type="submit" style={btnPrimary} disabled={saving}>{saving ? "Saving…" : "Save Program"}</button>
                  <button
                    type="button"
                    style={btnSecondary}
                    onClick={() => {
                      setShowCreate(false);
                      setForm(EMPTY_FORM);
                      setFormErr("");
                      pvUiHook("merchant.promotions.create.cancel", { merchantId });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Programs list ── */}
          {promotions.length === 0 ? (
            <div style={{ color: color.textFaint, padding: "16px 0", fontSize: 13 }}>No reward programs found.</div>
          ) : (
            <div style={tableWrap}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Program</th>
                    <th style={th}>Category</th>
                    <th style={th}>Threshold</th>
                    <th style={th}>Reward</th>
                    <th style={th}>Timeframe</th>
                    <th style={th}>Scope</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((promo, idx) => (
                    <React.Fragment key={promo.id}>
                      <tr style={{ borderTop: idx === 0 ? "none" : rowBorder, background: editId === promo.id ? "rgba(0,0,0,0.015)" : "transparent" }}>
                        <td style={td}>
                          <span style={{ fontWeight: 700 }}>{promo.name}</span>
                          {promo.promotionType === "tiered" && (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(100,100,200,0.10)", color: "rgba(60,60,160,1)" }}>Tiered</span>
                          )}
                        </td>
                        <td style={td}>
                          {promo.category
                            ? <CatPill name={promo.category.name} />
                            : <span style={{ color: color.textFaint, fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ ...td, fontFamily: "monospace" }}>{promo.threshold}</td>
                        <td style={{ ...td, fontSize: 13 }}>
                          {promo.tiers && promo.tiers.length > 0
                            ? promo.tiers.map(t => `${t.tierName}: ${t.rewardType === "discount_fixed" ? `$${(t.rewardValue / 100).toFixed(2)}` : t.rewardType === "discount_pct" ? `${t.rewardValue}%` : t.rewardNote || "Reward"}`).join(" → ")
                            : rewardSummary(promo)}
                        </td>
                        <td style={{ ...td, fontSize: 13 }}>
                          {promo.timeframeDays ? `${promo.timeframeDays}d` : <span style={{ color: color.textFaint }}>No expiry</span>}
                        </td>
                        <td style={{ ...td, fontSize: 13 }}>
                          {promo.storeId
                            ? (stores.find(st => st.id === promo.storeId)?.name || `Store #${promo.storeId}`)
                            : "All Stores"}
                        </td>
                        <td style={td}><StatusBadge status={promo.status} /></td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {promo.status === "draft" && <>
                              <button type="button" style={btnSmall} onClick={() => handleTransition(promo, "staged")}>Stage</button>
                              {editId !== promo.id && <button type="button" style={btnSmall} onClick={() => startEdit(promo)}>Edit</button>}
                              <button type="button" style={btnSmallDanger} onClick={() => handleArchive(promo)}>Archive</button>
                            </>}
                            {promo.status === "staged" && <>
                              <button type="button" style={btnSmallSuccess} onClick={() => handleTransition(promo, "active")}>Go Live</button>
                              <button type="button" style={btnSmall} onClick={() => handleTransition(promo, "draft")}>Revert</button>
                              {editId !== promo.id && <button type="button" style={btnSmall} onClick={() => startEdit(promo)}>Edit</button>}
                            </>}
                            {promo.status === "active" && <>
                              <button type="button" style={btnSmall} onClick={() => toggleOutcome(promo.id)}>Performance</button>
                              <button type="button" style={btnSmall} onClick={() => handleTransition(promo, "paused")}>Pause</button>
                              {editId !== promo.id && <button type="button" style={btnSmall} onClick={() => startEdit(promo)}>Edit</button>}
                              <button type="button" style={btnSmallDanger} onClick={() => handleArchive(promo)}>Archive</button>
                            </>}
                            {promo.status === "paused" && <>
                              <button type="button" style={btnSmall} onClick={() => toggleOutcome(promo.id)}>Performance</button>
                              <button type="button" style={btnSmallSuccess} onClick={() => handleTransition(promo, "active")}>Resume</button>
                              {editId !== promo.id && <button type="button" style={btnSmall} onClick={() => startEdit(promo)}>Edit</button>}
                              <button type="button" style={btnSmallDanger} onClick={() => handleArchive(promo)}>Archive</button>
                            </>}
                            {promo.status === "archived" && (
                              <button type="button" style={btnSmall} onClick={() => handleDuplicate(promo)}>Duplicate</button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline edit row */}
                      {editId === promo.id && (
                        <tr style={{ borderTop: rowBorder, background: "rgba(0,0,0,0.015)" }}>
                          <td colSpan={8} style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                              <div>
                                <label style={labelStyle}>Name <span style={reqStar}>*</span></label>
                                <input style={{ ...inputStyle, width: 240 }} value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button type="button" style={btnPrimary} disabled={editSaving} onClick={() => handleEditSave(promo.id)}>{editSaving ? "Saving…" : "Save"}</button>
                                <button type="button" style={btnSecondary} onClick={cancelEdit}>Cancel</button>
                              </div>
                            </div>
                            <div style={{ marginTop: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <label style={labelStyle}>Terms & Conditions</label>
                                <button
                                  type="button"
                                  style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, borderRadius: 999 }}
                                  disabled={editGeneratingTerms}
                                  onClick={() => handleEditGenerateTerms(promo)}
                                >
                                  {editGeneratingTerms ? "Generating…" : "✦ Generate Draft"}
                                </button>
                              </div>
                              <textarea
                                style={{ ...inputStyle, width: "100%", minHeight: 100, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }}
                                value={editForm.legalText || ""}
                                onChange={e => setEditForm(f => ({ ...f, legalText: e.target.value }))}
                                placeholder="Click 'Generate Draft' for an AI-drafted terms template, then review and edit as needed."
                              />
                              <div style={hint}>Consumers see this in the program detail view.</div>
                            </div>
                            {editErr && <div style={{ ...errorStyle, marginTop: 8 }}>{editErr}</div>}
                            <div style={{ fontSize: 12, color: color.textFaint, marginTop: 6 }}>
                              Category, threshold, and reward cannot be changed after creation.
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Performance outcome row */}
                      {outcomeId === promo.id && (
                        <tr style={{ borderTop: rowBorder, background: "rgba(47,143,139,0.04)" }}>
                          <td colSpan={8} style={{ padding: "16px 20px" }}>
                            {outcomeLoading ? (
                              <div style={{ color: color.textMuted, fontSize: 13 }}>Loading performance data...</div>
                            ) : outcome?.metrics ? (
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: color.text }}>Promotion Performance</div>
                                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: color.primary }}>{outcome.activity?.clips ?? "—"}</div>
                                    <div style={{ fontSize: 11, color: color.textMuted }}>Stamps</div>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: color.primary }}>{outcome.activity?.rewardsGranted ?? "—"}</div>
                                    <div style={{ fontSize: 11, color: color.textMuted }}>Rewards Earned</div>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: color.primary }}>{outcome.activity?.rewardsRedeemed ?? "—"}</div>
                                    <div style={{ fontSize: 11, color: color.textMuted }}>Redeemed</div>
                                  </div>
                                  <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: color.primary }}>{outcome.metrics?.redemptionRate != null ? `${Math.round(outcome.metrics.redemptionRate * 100)}%` : "—"}</div>
                                    <div style={{ fontSize: 11, color: color.textMuted }}>Redemption Rate</div>
                                  </div>
                                  {outcome.metrics?.aovLift != null && (
                                    <div style={{ textAlign: "center" }}>
                                      <div style={{ fontSize: 20, fontWeight: 800, color: outcome.metrics.aovLift >= 0 ? "#059669" : "#dc2626" }}>{outcome.metrics.aovLift >= 0 ? "+" : ""}{Math.round(outcome.metrics.aovLift * 100)}%</div>
                                      <div style={{ fontSize: 11, color: color.textMuted }}>AOV Lift</div>
                                    </div>
                                  )}
                                  {outcome.metrics?.revenueLift != null && (
                                    <div style={{ textAlign: "center" }}>
                                      <div style={{ fontSize: 20, fontWeight: 800, color: outcome.metrics.revenueLift >= 0 ? "#059669" : "#dc2626" }}>{outcome.metrics.revenueLift >= 0 ? "+" : ""}{Math.round(outcome.metrics.revenueLift * 100)}%</div>
                                      <div style={{ fontSize: 11, color: color.textMuted }}>Revenue Lift</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: color.textMuted, fontSize: 13 }}>No performance data available yet.</div>
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
        </>
      )}

      {/* Live promotion monitors for active promos */}
      {promotions.filter(p => p.status === "active").length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: color.text, marginBottom: 10 }}>Live Monitoring</div>
          {promotions.filter(p => p.status === "active").map(p => (
            <PromotionMonitor key={p.id} promotionId={p.id} promotionName={p.name} promotionStatus={p.status} />
          ))}
        </div>
      )}

      <SupportInfo context={{ page: "MerchantPromotions", merchantId, lastError, lastSuccessTs }} />

      {/* Launch sequence modal */}
      {launchPromo && (
        <PromotionLaunchSequence
          promotion={launchPromo}
          onLaunch={async () => {
            await handleTransition({ ...launchPromo, status: "staged" }, "active");
            setLaunchPromo(null);
          }}
          onCancel={() => setLaunchPromo(null)}
        />
      )}
    </PageContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const btnPrimary    = { ...btn.primary,   padding: "8px 18px",  borderRadius: 999, fontSize: 13 };
const btnSecondary  = { ...btn.secondary, padding: "8px 18px",  borderRadius: 999, fontSize: 13 };
const btnSmall        = { ...btn.pill,    padding: "4px 12px",  fontSize: 12 };
const btnSmallDanger  = { ...btn.danger,  padding: "4px 12px",  fontSize: 12 };
const btnSmallSuccess = { ...btn.primary, padding: "4px 12px",  fontSize: 12 };
const btnFilter     = { ...btn.pill,      padding: "6px 14px",  fontSize: 12 };
const btnFilterActive = { ...btnFilter, background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary };

const fieldRow   = { marginBottom: 12 };
const twoCol     = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: color.textMuted, marginBottom: 4 };
const reqStar    = { color: color.danger };
const hint       = { fontSize: 11, color: color.textFaint, marginTop: 3 };

const inputStyle = { ...themeInput, padding: "8px 12px", fontSize: 14 };
const selectStyle = { ...inputStyle, background: color.inputBg };

const errorStyle = {
  color: color.danger, fontSize: 13, padding: "8px 12px",
  background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`, borderRadius: 8, marginTop: 4,
};
const infoBox = {
  fontSize: 13, padding: "10px 14px", borderRadius: 10,
  background: color.primarySubtle, border: `1px solid ${color.primaryBorder}`,
  marginBottom: 18, color: color.text,
};
const summaryBar = {
  border: `1px solid ${color.border}`, borderRadius: 14, padding: "16px 20px",
  marginBottom: 20, display: "flex", alignItems: "center",
  justifyContent: "space-between", background: color.pageBg,
};
const createCard = {
  border: `1px solid ${color.border}`, borderRadius: 14, padding: 20,
  marginBottom: 20, background: color.cardBg,
};
const tableWrap  = { border: `1px solid ${color.border}`, borderRadius: 14, overflow: "hidden" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const theadRow   = { background: color.pageBg, borderBottom: `1px solid ${color.border}` };
const th         = { padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 12, color: color.textMuted };
const td         = { padding: "12px 16px", verticalAlign: "middle" };
const rowBorder  = `1px solid ${color.borderSubtle}`;
