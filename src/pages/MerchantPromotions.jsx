/**
 * MerchantPromotions.jsx
 *
 * Promotions & Loyalty management for a merchant.
 * Three sections: Earn Items → Promotion Rules → Offer Sets
 *
 * Accessible by pv_admin (read + manage) and merchant_admin / owner.
 * Route: /merchants/:merchantId/promotions
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import {
  getMerchant,
  getSystemRole,
  merchantListProducts,
  merchantListPromoItems,
  merchantCreatePromoItem,
  merchantUpdatePromoItem,
  merchantArchivePromoItem,
  merchantListPromotions,
  merchantCreatePromotion,
  merchantUpdatePromotion,
  merchantArchivePromotion,
  merchantListOfferSets,
  merchantCreateOfferSet,
  merchantPublishOfferSet,
  merchantExpireOfferSet,
  adminListMerchantProducts,
  adminListMerchantPromoItems,
  adminCreateMerchantPromoItem,
  adminUpdateMerchantPromoItem,
  adminArchiveMerchantPromoItem,
  adminListMerchantPromotions,
  adminCreateMerchantPromotion,
  adminUpdateMerchantPromotion,
  adminArchiveMerchantPromotion,
  adminListMerchantOfferSets,
  adminCreateMerchantOfferSet,
  adminUpdateMerchantOfferSet,
  adminArchiveMerchantOfferSet,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";

// ─── pvUiHook ────────────────────────────────────────────────
function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never break UI
  }
}

// ─── Constants ───────────────────────────────────────────────

const ITEM_TYPE_LABELS = {
  visit:          "Visit",
  any_purchase:   "Any Purchase",
  single_product: "Single Product",
  product_bundle: "Product Bundle",
};

const MECHANIC_LABELS = {
  stamps: "Stamps",
  points: "Points",
};

const REWARD_TYPE_LABELS = {
  free_item:      "Free Item",
  discount_pct:   "Discount %",
  discount_fixed: "Discount $",
  custom:         "Custom",
};

const OS_SCOPE_LABELS = {
  merchant: "All Stores",
  store:    "Specific Store",
};

const OS_STATUS_COLORS = {
  draft:    { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.55)",  border: "1px solid rgba(0,0,0,0.12)" },
  active:   { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  expired:  { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  archived: { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.45)",  border: "1px solid rgba(0,0,0,0.10)" },
};

const PROMO_STATUS_COLORS = {
  active:   { background: "rgba(0,150,80,0.10)",  color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  paused:   { background: "rgba(200,120,0,0.10)", color: "rgba(160,90,0,1)",  border: "1px solid rgba(200,120,0,0.25)" },
  archived: { background: "rgba(0,0,0,0.06)",     color: "rgba(0,0,0,0.45)",  border: "1px solid rgba(0,0,0,0.10)" },
};

function StatusBadge({ status, colorMap }) {
  const s = colorMap[status] || colorMap.archived || {};
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}

// ─── Section Card wrapper ──────────────────────────────────
function SectionCard({ title, count, children }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
      <div style={{ background: "rgba(0,0,0,0.025)", borderBottom: "1px solid rgba(0,0,0,0.08)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        {count != null && <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)", fontWeight: 700 }}>{count} item{count !== 1 ? "s" : ""}</div>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ─── Empty / Loading states ───────────────────────────────
function EmptyRow({ message }) {
  return <div style={{ color: "rgba(0,0,0,0.45)", fontSize: 13, padding: "8px 0" }}>{message}</div>;
}

// ══════════════════════════════════════════════════════════════
//  Main Component
// ══════════════════════════════════════════════════════════════

const EMPTY_ITEM_FORM = { name: "", description: "", type: "visit", skus: [] };
const EMPTY_PROMO_FORM = {
  name: "", promoItemId: "", mechanic: "stamps", threshold: 10, earnPerUnit: "",
  rewardType: "free_item", rewardValue: "", rewardSku: "", rewardNote: "",
};
const EMPTY_OS_FORM = { name: "", scope: "merchant", promotionIds: [], storeId: "" };

export default function MerchantPromotions() {
  const { merchantId } = useParams();
  const systemRole = getSystemRole();
  const isPvAdmin = systemRole === "pv_admin";

  // ─── Data ──────────────────────────────────────────────
  const [merchant, setMerchant]     = React.useState(null);
  const [products, setProducts]     = React.useState([]);
  const [promoItems, setPromoItems] = React.useState([]);
  const [promotions, setPromotions] = React.useState([]);
  const [offerSets, setOfferSets]   = React.useState([]);

  const [loading, setLoading]   = React.useState(true);
  const [error, setError]       = React.useState("");
  const [lastError, setLastError]       = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");

  // ─── Earn Items form ───────────────────────────────────
  const [showItemCreate, setShowItemCreate] = React.useState(false);
  const [itemForm, setItemForm]   = React.useState(EMPTY_ITEM_FORM);
  const [itemFormErr, setItemFormErr] = React.useState("");
  const [itemSaving, setItemSaving]   = React.useState(false);
  const [editItemId, setEditItemId]   = React.useState(null);
  const [editItemForm, setEditItemForm] = React.useState({});
  const [editItemErr, setEditItemErr]   = React.useState("");
  const [editItemSaving, setEditItemSaving] = React.useState(false);
  const [itemStatusFilter, setItemStatusFilter] = React.useState("active");

  // ─── Promotion Rules form ──────────────────────────────
  const [showPromoCreate, setShowPromoCreate] = React.useState(false);
  const [promoForm, setPromoForm]   = React.useState(EMPTY_PROMO_FORM);
  const [promoFormErr, setPromoFormErr] = React.useState("");
  const [promoSaving, setPromoSaving]   = React.useState(false);
  const [editPromoId, setEditPromoId]   = React.useState(null);
  const [editPromoForm, setEditPromoForm] = React.useState({});
  const [editPromoErr, setEditPromoErr]   = React.useState("");
  const [editPromoSaving, setEditPromoSaving] = React.useState(false);
  const [promoStatusFilter, setPromoStatusFilter] = React.useState("active");

  // ─── Offer Sets form ───────────────────────────────────
  const [showOsCreate, setShowOsCreate] = React.useState(false);
  const [osForm, setOsForm]   = React.useState(EMPTY_OS_FORM);
  const [osFormErr, setOsFormErr] = React.useState("");
  const [osSaving, setOsSaving]   = React.useState(false);
  const [osStatusFilter, setOsStatusFilter] = React.useState("draft");
  const [osLifecycleErr, setOsLifecycleErr] = React.useState("");

  // ─── Load ──────────────────────────────────────────────
  async function load(iFilter = itemStatusFilter, pFilter = promoStatusFilter, oFilter = osStatusFilter) {
    setLoading(true);
    setError("");
    pvUiHook("merchant.promotions.load.started", { stable: "promo:load", merchantId });
    try {
      const [mRes, prodRes, itemRes, promoRes, osRes] = await Promise.all([
        getMerchant(merchantId),
        isPvAdmin
          ? adminListMerchantProducts(merchantId, { status: "active" })
          : merchantListProducts({ status: "active" }),
        isPvAdmin
          ? adminListMerchantPromoItems(merchantId, { status: iFilter || undefined })
          : merchantListPromoItems({ status: iFilter || undefined }),
        isPvAdmin
          ? adminListMerchantPromotions(merchantId, { status: pFilter || undefined })
          : merchantListPromotions({ status: pFilter || undefined }),
        isPvAdmin
          ? adminListMerchantOfferSets(merchantId, { status: oFilter || undefined })
          : merchantListOfferSets({ status: oFilter || undefined }),
      ]);

      setMerchant(mRes?.merchant || mRes);
      setProducts(prodRes?.items || []);
      setPromoItems(itemRes?.items || []);
      setPromotions(promoRes?.promotions || []);
      setOfferSets(osRes?.offerSets || []);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.load.succeeded", {
        stable: "promo:load", merchantId,
        itemCount: (itemRes?.items || []).length,
        promoCount: (promoRes?.promotions || []).length,
        osCount: (osRes?.offerSets || []).length,
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

  // ══════════════════════════════════════════════════════
  //  EARN ITEMS
  // ══════════════════════════════════════════════════════

  function buildSkuRows(form) {
    // Returns parsed skus array or error string
    const type = form.type;
    if (type === "visit" || type === "any_purchase") return [];
    const raw = (form.skus || []);
    if (!raw.length) {
      if (type === "single_product") return "Enter 1 product SKU";
      if (type === "product_bundle") return "Enter at least 2 product SKUs";
    }
    return raw;
  }

  async function handleItemCreate(e) {
    e.preventDefault();
    setItemFormErr("");
    const name = itemForm.name.trim();
    if (!name) { setItemFormErr("Name is required"); return; }

    const skus = buildSkuRows(itemForm);
    if (typeof skus === "string") { setItemFormErr(skus); return; }

    setItemSaving(true);
    pvUiHook("merchant.promotions.item.create.started", { stable: "promo:item:create", merchantId, type: itemForm.type });
    try {
      const payload = { name, description: itemForm.description.trim() || undefined, type: itemForm.type, skus };
      if (isPvAdmin) {
        await adminCreateMerchantPromoItem(merchantId, payload);
      } else {
        await merchantCreatePromoItem(payload);
      }
      setItemForm(EMPTY_ITEM_FORM);
      setShowItemCreate(false);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.item.create.succeeded", { stable: "promo:item:create", merchantId });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to create earn item";
      setItemFormErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.item.create.failed", { stable: "promo:item:create", merchantId, error: msg });
    } finally {
      setItemSaving(false);
    }
  }

  function startEditItem(item) {
    setEditItemId(item.id);
    setEditItemForm({ name: item.name, description: item.description || "" });
    setEditItemErr("");
    pvUiHook("merchant.promotions.item.edit.open", { stable: "promo:item:edit", merchantId, itemId: item.id });
  }

  function cancelEditItem() {
    setEditItemId(null);
    setEditItemForm({});
    setEditItemErr("");
  }

  async function handleItemEditSave(itemId) {
    setEditItemErr("");
    const name = (editItemForm.name || "").trim();
    if (!name) { setEditItemErr("Name is required"); return; }
    setEditItemSaving(true);
    pvUiHook("merchant.promotions.item.edit.started", { stable: "promo:item:edit", merchantId, itemId });
    try {
      const payload = { name, description: editItemForm.description?.trim() || undefined };
      if (isPvAdmin) {
        await adminUpdateMerchantPromoItem(merchantId, itemId, payload);
      } else {
        await merchantUpdatePromoItem(itemId, payload);
      }
      setEditItemId(null);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.item.edit.succeeded", { stable: "promo:item:edit", merchantId, itemId });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to update earn item";
      setEditItemErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.item.edit.failed", { stable: "promo:item:edit", merchantId, itemId, error: msg });
    } finally {
      setEditItemSaving(false);
    }
  }

  async function handleItemArchive(item) {
    pvUiHook("merchant.promotions.item.archive.started", { stable: "promo:item:archive", merchantId, itemId: item.id });
    try {
      if (isPvAdmin) {
        await adminArchiveMerchantPromoItem(merchantId, item.id);
      } else {
        await merchantArchivePromoItem(item.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.item.archive.succeeded", { stable: "promo:item:archive", merchantId, itemId: item.id });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to archive earn item";
      setLastError(msg);
      pvUiHook("merchant.promotions.item.archive.failed", { stable: "promo:item:archive", merchantId, itemId: item.id, error: msg });
    }
  }

  // ══════════════════════════════════════════════════════
  //  PROMOTION RULES
  // ══════════════════════════════════════════════════════

  async function handlePromoCreate(e) {
    e.preventDefault();
    setPromoFormErr("");
    const name = promoForm.name.trim();
    if (!name) { setPromoFormErr("Name is required"); return; }
    if (!promoForm.promoItemId) { setPromoFormErr("Select an earn item"); return; }
    const threshold = parseInt(promoForm.threshold, 10);
    if (!threshold || threshold < 1) { setPromoFormErr("Threshold must be a positive integer"); return; }
    if (promoForm.mechanic === "points") {
      const epu = parseInt(promoForm.earnPerUnit, 10);
      if (!epu || epu < 1) { setPromoFormErr("Earn per unit must be a positive integer for points mechanic"); return; }
    }
    if (promoForm.rewardType === "free_item" && !promoForm.rewardSku.trim()) {
      setPromoFormErr("Reward SKU is required for free_item reward type"); return;
    }
    if (promoForm.rewardType === "custom" && !promoForm.rewardNote.trim()) {
      setPromoFormErr("Reward note is required for custom reward type"); return;
    }
    if ((promoForm.rewardType === "discount_pct" || promoForm.rewardType === "discount_fixed") && !promoForm.rewardValue) {
      setPromoFormErr("Reward value is required for discount reward types"); return;
    }

    setPromoSaving(true);
    pvUiHook("merchant.promotions.promo.create.started", { stable: "promo:promo:create", merchantId, mechanic: promoForm.mechanic });
    try {
      const payload = {
        name,
        promoItemId: parseInt(promoForm.promoItemId, 10),
        mechanic: promoForm.mechanic,
        threshold,
        earnPerUnit: promoForm.mechanic === "points" ? parseInt(promoForm.earnPerUnit, 10) : undefined,
        rewardType: promoForm.rewardType,
        rewardValue: (promoForm.rewardType === "discount_pct" || promoForm.rewardType === "discount_fixed")
          ? parseInt(promoForm.rewardValue, 10)
          : undefined,
        rewardSku: promoForm.rewardType === "free_item" ? promoForm.rewardSku.trim() : undefined,
        rewardNote: promoForm.rewardType === "custom" ? promoForm.rewardNote.trim() : undefined,
      };
      if (isPvAdmin) {
        await adminCreateMerchantPromotion(merchantId, payload);
      } else {
        await merchantCreatePromotion(payload);
      }
      setPromoForm(EMPTY_PROMO_FORM);
      setShowPromoCreate(false);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.promo.create.succeeded", { stable: "promo:promo:create", merchantId });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to create promotion";
      setPromoFormErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.promo.create.failed", { stable: "promo:promo:create", merchantId, error: msg });
    } finally {
      setPromoSaving(false);
    }
  }

  function startEditPromo(promo) {
    setEditPromoId(promo.id);
    setEditPromoForm({ name: promo.name, status: promo.status });
    setEditPromoErr("");
    pvUiHook("merchant.promotions.promo.edit.open", { stable: "promo:promo:edit", merchantId, promoId: promo.id });
  }

  function cancelEditPromo() {
    setEditPromoId(null);
    setEditPromoForm({});
    setEditPromoErr("");
  }

  async function handlePromoEditSave(promoId) {
    setEditPromoErr("");
    const name = (editPromoForm.name || "").trim();
    if (!name) { setEditPromoErr("Name is required"); return; }
    setEditPromoSaving(true);
    pvUiHook("merchant.promotions.promo.edit.started", { stable: "promo:promo:edit", merchantId, promoId });
    try {
      const payload = { name, status: editPromoForm.status };
      if (isPvAdmin) {
        await adminUpdateMerchantPromotion(merchantId, promoId, payload);
      } else {
        await merchantUpdatePromotion(promoId, payload);
      }
      setEditPromoId(null);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.promo.edit.succeeded", { stable: "promo:promo:edit", merchantId, promoId });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to update promotion";
      setEditPromoErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.promo.edit.failed", { stable: "promo:promo:edit", merchantId, promoId, error: msg });
    } finally {
      setEditPromoSaving(false);
    }
  }

  async function handlePromoArchive(promo) {
    pvUiHook("merchant.promotions.promo.archive.started", { stable: "promo:promo:archive", merchantId, promoId: promo.id });
    try {
      if (isPvAdmin) {
        await adminArchiveMerchantPromotion(merchantId, promo.id);
      } else {
        await merchantArchivePromotion(promo.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.promo.archive.succeeded", { stable: "promo:promo:archive", merchantId, promoId: promo.id });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to archive promotion";
      setLastError(msg);
      pvUiHook("merchant.promotions.promo.archive.failed", { stable: "promo:promo:archive", merchantId, promoId: promo.id, error: msg });
    }
  }

  // ══════════════════════════════════════════════════════
  //  OFFER SETS
  // ══════════════════════════════════════════════════════

  async function handleOsCreate(e) {
    e.preventDefault();
    setOsFormErr("");
    const name = osForm.name.trim();
    if (!name) { setOsFormErr("Name is required"); return; }
    if (!osForm.promotionIds.length) { setOsFormErr("Select at least one promotion rule"); return; }
    if (osForm.scope === "store" && !osForm.storeId) { setOsFormErr("Select a store for store-scoped offer sets"); return; }

    setOsSaving(true);
    pvUiHook("merchant.promotions.os.create.started", { stable: "promo:os:create", merchantId, scope: osForm.scope });
    try {
      const payload = {
        name,
        scope: osForm.scope,
        promotionIds: osForm.promotionIds.map(Number),
        storeIds: osForm.scope === "store" ? [parseInt(osForm.storeId, 10)] : undefined,
      };
      if (isPvAdmin) {
        await adminCreateMerchantOfferSet(merchantId, payload);
      } else {
        await merchantCreateOfferSet(payload);
      }
      setOsForm(EMPTY_OS_FORM);
      setShowOsCreate(false);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.os.create.succeeded", { stable: "promo:os:create", merchantId });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to create offer set";
      setOsFormErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.os.create.failed", { stable: "promo:os:create", merchantId, error: msg });
    } finally {
      setOsSaving(false);
    }
  }

  async function handleOsPublish(os) {
    setOsLifecycleErr("");
    pvUiHook("merchant.promotions.os.publish.started", { stable: "promo:os:publish", merchantId, osId: os.id });
    try {
      if (isPvAdmin) {
        await adminUpdateMerchantOfferSet(merchantId, os.id, { action: "publish" });
      } else {
        await merchantPublishOfferSet(os.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.os.publish.succeeded", { stable: "promo:os:publish", merchantId, osId: os.id });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to publish offer set";
      setOsLifecycleErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.os.publish.failed", { stable: "promo:os:publish", merchantId, osId: os.id, error: msg });
    }
  }

  async function handleOsExpire(os) {
    setOsLifecycleErr("");
    pvUiHook("merchant.promotions.os.expire.started", { stable: "promo:os:expire", merchantId, osId: os.id });
    try {
      if (isPvAdmin) {
        await adminUpdateMerchantOfferSet(merchantId, os.id, { action: "expire" });
      } else {
        await merchantExpireOfferSet(os.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.os.expire.succeeded", { stable: "promo:os:expire", merchantId, osId: os.id });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to expire offer set";
      setOsLifecycleErr(msg);
      setLastError(msg);
      pvUiHook("merchant.promotions.os.expire.failed", { stable: "promo:os:expire", merchantId, osId: os.id, error: msg });
    }
  }

  async function handleOsArchive(os) {
    pvUiHook("merchant.promotions.os.archive.started", { stable: "promo:os:archive", merchantId, osId: os.id });
    try {
      if (isPvAdmin) {
        await adminArchiveMerchantOfferSet(merchantId, os.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.promotions.os.archive.succeeded", { stable: "promo:os:archive", merchantId, osId: os.id });
      await load(itemStatusFilter, promoStatusFilter, osStatusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to archive offer set";
      setLastError(msg);
      pvUiHook("merchant.promotions.os.archive.failed", { stable: "promo:os:archive", merchantId, osId: os.id, error: msg });
    }
  }

  // ─── Helpers ──────────────────────────────────────────
  const merchantName = merchant?.name || `Merchant ${merchantId}`;
  const merchantStores = merchant?.stores || [];
  const activePromoItems = promoItems.filter(i => i.status === "active");
  const activePromotions = promotions.filter(p => p.status === "active");

  function toggleOsPromoId(id) {
    const sid = String(id);
    setOsForm(f => ({
      ...f,
      promotionIds: f.promotionIds.includes(sid)
        ? f.promotionIds.filter(x => x !== sid)
        : [...f.promotionIds, sid],
    }));
  }

  // ─── Render ────────────────────────────────────────────
  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "rgba(0,0,0,0.55)", marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Promotions</span>
      </div>

      <PageHeader
        title="Promotions"
        subtitle={`Loyalty program for ${merchantName}`}
        right={
          <button
            type="button"
            style={btnSecondary}
            onClick={() => {
              pvUiHook("merchant.promotions.refresh.clicked", { stable: "promo:refresh", merchantId });
              load(itemStatusFilter, promoStatusFilter, osStatusFilter);
            }}
          >
            Refresh
          </button>
        }
      />

      <div style={{ marginTop: 20 }} />

      {loading ? (
        <div style={{ color: "rgba(0,0,0,0.45)", padding: 20 }}>Loading…</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════
              SECTION 1 — Earn Items
          ══════════════════════════════════════════════ */}
          <SectionCard title="Earn Items" count={promoItems.length}>
            <div style={{ marginBottom: 14, fontSize: 13, color: "rgba(0,0,0,0.55)" }}>
              Define what actions earn stamps or points — a visit, any purchase, or a specific product / bundle.
            </div>

            {/* Status filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["active", "paused", "archived", ""].map(f => (
                <button
                  key={f || "all"}
                  type="button"
                  style={itemStatusFilter === f ? btnFilterActive : btnFilter}
                  onClick={() => {
                    setItemStatusFilter(f);
                    load(f, promoStatusFilter, osStatusFilter);
                    pvUiHook("merchant.promotions.item.filter.changed", { stable: "promo:item:filter", merchantId, filter: f || "all" });
                  }}
                >
                  {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Create toggle */}
            {!showItemCreate ? (
              <button
                type="button"
                style={{ ...btnPrimary, marginBottom: 16 }}
                onClick={() => {
                  setShowItemCreate(true);
                  setEditItemId(null);
                  pvUiHook("merchant.promotions.item.create.open", { stable: "promo:item:create", merchantId });
                }}
              >
                + Add Earn Item
              </button>
            ) : (
              <div style={createCard}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>New Earn Item</div>
                <form onSubmit={handleItemCreate}>
                  <div style={fieldRow}>
                    <label style={labelStyle}>Name <span style={reqStar}>*</span></label>
                    <input style={inputStyle} value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Coffee Purchase" autoFocus />
                  </div>
                  <div style={fieldRow}>
                    <label style={labelStyle}>Description</label>
                    <input style={inputStyle} value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div style={fieldRow}>
                    <label style={labelStyle}>Type <span style={reqStar}>*</span></label>
                    <select
                      style={selectStyle}
                      value={itemForm.type}
                      onChange={e => setItemForm(f => ({ ...f, type: e.target.value, skus: [] }))}
                    >
                      <option value="visit">Visit</option>
                      <option value="any_purchase">Any Purchase</option>
                      <option value="single_product">Single Product</option>
                      <option value="product_bundle">Product Bundle</option>
                    </select>
                  </div>

                  {/* SKU entry for product types */}
                  {(itemForm.type === "single_product" || itemForm.type === "product_bundle") && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>
                        Product SKU{itemForm.type === "product_bundle" ? "s (comma-separated)" : ""} <span style={reqStar}>*</span>
                      </label>
                      <input
                        style={inputStyle}
                        placeholder={itemForm.type === "product_bundle" ? "e.g. PRD-0001, PRD-0002" : "e.g. PRD-0001"}
                        value={(itemForm.skus || []).map(s => s.sku).join(", ")}
                        onChange={e => {
                          const parts = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                          setItemForm(f => ({ ...f, skus: parts.map(sku => ({ sku, quantity: 1 })) }));
                        }}
                      />
                      {products.length > 0 && (
                        <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 4 }}>
                          Active SKUs: {products.map(p => p.sku).join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {itemFormErr && <div style={errorStyle}>{itemFormErr}</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button type="submit" style={btnPrimary} disabled={itemSaving}>{itemSaving ? "Saving…" : "Save Item"}</button>
                    <button type="button" style={btnSecondary} onClick={() => { setShowItemCreate(false); setItemForm(EMPTY_ITEM_FORM); setItemFormErr(""); pvUiHook("merchant.promotions.item.create.cancel", { merchantId }); }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* List */}
            {promoItems.length === 0 ? (
              <EmptyRow message="No earn items found." />
            ) : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <th style={th}>Name</th>
                      <th style={th}>Type</th>
                      <th style={th}>SKUs</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promoItems.map((item, idx) => (
                      <React.Fragment key={item.id}>
                        <tr style={{ borderTop: idx === 0 ? "none" : rowBorder, background: editItemId === item.id ? "rgba(0,0,0,0.015)" : "transparent" }}>
                          <td style={td}><span style={{ fontWeight: 700 }}>{item.name}</span>{item.description && <div style={{ fontSize: 12, color: "rgba(0,0,0,0.50)", marginTop: 2 }}>{item.description}</div>}</td>
                          <td style={td}><span style={typePill}>{ITEM_TYPE_LABELS[item.type] || item.type}</span></td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>
                            {item.skus?.length ? item.skus.map(s => s.quantity > 1 ? `${s.sku}×${s.quantity}` : s.sku).join(", ") : "—"}
                          </td>
                          <td style={td}><StatusBadge status={item.status} colorMap={PROMO_STATUS_COLORS} /></td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 8 }}>
                              {editItemId !== item.id && item.status !== "archived" && (
                                <button type="button" style={btnSmall} onClick={() => startEditItem(item)}>Edit</button>
                              )}
                              {item.status !== "archived" && (
                                <button type="button" style={btnSmallDanger} onClick={() => handleItemArchive(item)}>Archive</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {editItemId === item.id && (
                          <tr style={{ borderTop: rowBorder, background: "rgba(0,0,0,0.015)" }}>
                            <td colSpan={5} style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                                <div>
                                  <label style={labelStyle}>Name <span style={reqStar}>*</span></label>
                                  <input style={{ ...inputStyle, width: 220 }} value={editItemForm.name || ""} onChange={e => setEditItemForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                                </div>
                                <div>
                                  <label style={labelStyle}>Description</label>
                                  <input style={{ ...inputStyle, width: 260 }} value={editItemForm.description || ""} onChange={e => setEditItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button type="button" style={btnPrimary} disabled={editItemSaving} onClick={() => handleItemEditSave(item.id)}>{editItemSaving ? "Saving…" : "Save"}</button>
                                  <button type="button" style={btnSecondary} onClick={cancelEditItem}>Cancel</button>
                                </div>
                              </div>
                              {editItemErr && <div style={{ ...errorStyle, marginTop: 8 }}>{editItemErr}</div>}
                              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.40)", marginTop: 6 }}>Type and SKUs cannot be changed after creation.</div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ══════════════════════════════════════════════
              SECTION 2 — Promotion Rules
          ══════════════════════════════════════════════ */}
          <SectionCard title="Promotion Rules" count={promotions.length}>
            <div style={{ marginBottom: 14, fontSize: 13, color: "rgba(0,0,0,0.55)" }}>
              Link an earn item to a mechanic (stamps or points), set a threshold, and define the reward.
            </div>

            {/* Status filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["active", "paused", "archived", ""].map(f => (
                <button
                  key={f || "all"}
                  type="button"
                  style={promoStatusFilter === f ? btnFilterActive : btnFilter}
                  onClick={() => {
                    setPromoStatusFilter(f);
                    load(itemStatusFilter, f, osStatusFilter);
                    pvUiHook("merchant.promotions.promo.filter.changed", { stable: "promo:promo:filter", merchantId, filter: f || "all" });
                  }}
                >
                  {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Create toggle */}
            {!showPromoCreate ? (
              <button
                type="button"
                style={{ ...btnPrimary, marginBottom: 16 }}
                onClick={() => {
                  setShowPromoCreate(true);
                  setEditPromoId(null);
                  pvUiHook("merchant.promotions.promo.create.open", { stable: "promo:promo:create", merchantId });
                }}
              >
                + Add Promotion Rule
              </button>
            ) : (
              <div style={createCard}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>New Promotion Rule</div>
                {activePromoItems.length === 0 && (
                  <div style={{ ...errorStyle, marginBottom: 12 }}>No active earn items. Create an earn item first.</div>
                )}
                <form onSubmit={handlePromoCreate}>
                  <div style={twoCol}>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Name <span style={reqStar}>*</span></label>
                      <input style={inputStyle} value={promoForm.name} onChange={e => setPromoForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Coffee Stamp Card" autoFocus />
                    </div>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Earn Item <span style={reqStar}>*</span></label>
                      <select style={selectStyle} value={promoForm.promoItemId} onChange={e => setPromoForm(f => ({ ...f, promoItemId: e.target.value }))}>
                        <option value="">— select —</option>
                        {activePromoItems.map(i => <option key={i.id} value={i.id}>{i.name} ({ITEM_TYPE_LABELS[i.type] || i.type})</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={twoCol}>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Mechanic <span style={reqStar}>*</span></label>
                      <select style={selectStyle} value={promoForm.mechanic} onChange={e => setPromoForm(f => ({ ...f, mechanic: e.target.value }))}>
                        <option value="stamps">Stamps — 1 per qualifying event</option>
                        <option value="points">Points — earn per unit × events</option>
                      </select>
                    </div>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Threshold <span style={reqStar}>*</span></label>
                      <input style={inputStyle} type="number" min="1" value={promoForm.threshold} onChange={e => setPromoForm(f => ({ ...f, threshold: e.target.value }))} placeholder="e.g. 10" />
                      <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 3 }}>How many stamps/points to earn a reward milestone</div>
                    </div>
                  </div>

                  {promoForm.mechanic === "points" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Earn Per Unit <span style={reqStar}>*</span></label>
                      <input style={{ ...inputStyle, maxWidth: 200 }} type="number" min="1" value={promoForm.earnPerUnit} onChange={e => setPromoForm(f => ({ ...f, earnPerUnit: e.target.value }))} placeholder="e.g. 5" />
                      <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 3 }}>Points earned per qualifying event (e.g. $1 spent = 5 points)</div>
                    </div>
                  )}

                  <div style={twoCol}>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Reward Type <span style={reqStar}>*</span></label>
                      <select style={selectStyle} value={promoForm.rewardType} onChange={e => setPromoForm(f => ({ ...f, rewardType: e.target.value, rewardValue: "", rewardSku: "", rewardNote: "" }))}>
                        <option value="free_item">Free Item</option>
                        <option value="discount_pct">Discount %</option>
                        <option value="discount_fixed">Discount $ (fixed)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    {(promoForm.rewardType === "discount_pct" || promoForm.rewardType === "discount_fixed") && (
                      <div style={fieldRow}>
                        <label style={labelStyle}>
                          {promoForm.rewardType === "discount_pct" ? "Discount %" : "Discount Amount (cents)"} <span style={reqStar}>*</span>
                        </label>
                        <input style={inputStyle} type="number" min="1" value={promoForm.rewardValue} onChange={e => setPromoForm(f => ({ ...f, rewardValue: e.target.value }))} placeholder={promoForm.rewardType === "discount_pct" ? "e.g. 10" : "e.g. 500"} />
                        {promoForm.rewardType === "discount_fixed" && <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 3 }}>In cents — e.g. 500 = $5.00</div>}
                      </div>
                    )}
                  </div>

                  {promoForm.rewardType === "free_item" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Reward SKU <span style={reqStar}>*</span></label>
                      <input style={inputStyle} value={promoForm.rewardSku} onChange={e => setPromoForm(f => ({ ...f, rewardSku: e.target.value }))} placeholder="e.g. PRD-0001" />
                      {products.length > 0 && <div style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", marginTop: 3 }}>Active SKUs: {products.map(p => p.sku).join(", ")}</div>}
                    </div>
                  )}

                  {promoForm.rewardType === "custom" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Reward Note <span style={reqStar}>*</span></label>
                      <input style={inputStyle} value={promoForm.rewardNote} onChange={e => setPromoForm(f => ({ ...f, rewardNote: e.target.value }))} placeholder="e.g. Free upgrade to large" />
                    </div>
                  )}

                  {promoFormErr && <div style={errorStyle}>{promoFormErr}</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button type="submit" style={btnPrimary} disabled={promoSaving}>{promoSaving ? "Saving…" : "Save Promotion"}</button>
                    <button type="button" style={btnSecondary} onClick={() => { setShowPromoCreate(false); setPromoForm(EMPTY_PROMO_FORM); setPromoFormErr(""); pvUiHook("merchant.promotions.promo.create.cancel", { merchantId }); }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* List */}
            {promotions.length === 0 ? (
              <EmptyRow message="No promotion rules found." />
            ) : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <th style={th}>Name</th>
                      <th style={th}>Earn Item</th>
                      <th style={th}>Mechanic</th>
                      <th style={th}>Threshold</th>
                      <th style={th}>Reward</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotions.map((promo, idx) => (
                      <React.Fragment key={promo.id}>
                        <tr style={{ borderTop: idx === 0 ? "none" : rowBorder, background: editPromoId === promo.id ? "rgba(0,0,0,0.015)" : "transparent" }}>
                          <td style={td}><span style={{ fontWeight: 700 }}>{promo.name}</span></td>
                          <td style={{ ...td, fontSize: 13 }}>{promo.promoItem?.name || `#${promo.promoItemId}`}</td>
                          <td style={td}><span style={typePill}>{MECHANIC_LABELS[promo.mechanic] || promo.mechanic}</span></td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 13 }}>
                            {promo.mechanic === "points" && promo.earnPerUnit != null
                              ? `${promo.earnPerUnit}pts/event → ${promo.threshold}`
                              : promo.threshold}
                          </td>
                          <td style={{ ...td, fontSize: 13 }}>
                            {REWARD_TYPE_LABELS[promo.rewardType] || promo.rewardType}
                            {promo.rewardValue != null ? ` (${promo.rewardValue})` : ""}
                            {promo.rewardSku ? ` — ${promo.rewardSku}` : ""}
                            {promo.rewardNote ? ` — ${promo.rewardNote}` : ""}
                          </td>
                          <td style={td}><StatusBadge status={promo.status} colorMap={PROMO_STATUS_COLORS} /></td>
                          <td style={{ ...td, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 8 }}>
                              {editPromoId !== promo.id && promo.status !== "archived" && (
                                <button type="button" style={btnSmall} onClick={() => startEditPromo(promo)}>Edit</button>
                              )}
                              {promo.status !== "archived" && (
                                <button type="button" style={btnSmallDanger} onClick={() => handlePromoArchive(promo)}>Archive</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {editPromoId === promo.id && (
                          <tr style={{ borderTop: rowBorder, background: "rgba(0,0,0,0.015)" }}>
                            <td colSpan={7} style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                                <div>
                                  <label style={labelStyle}>Name <span style={reqStar}>*</span></label>
                                  <input style={{ ...inputStyle, width: 220 }} value={editPromoForm.name || ""} onChange={e => setEditPromoForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                                </div>
                                <div>
                                  <label style={labelStyle}>Status</label>
                                  <select style={{ ...selectStyle, width: 160 }} value={editPromoForm.status || ""} onChange={e => setEditPromoForm(f => ({ ...f, status: e.target.value }))}>
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                  </select>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button type="button" style={btnPrimary} disabled={editPromoSaving} onClick={() => handlePromoEditSave(promo.id)}>{editPromoSaving ? "Saving…" : "Save"}</button>
                                  <button type="button" style={btnSecondary} onClick={cancelEditPromo}>Cancel</button>
                                </div>
                              </div>
                              {editPromoErr && <div style={{ ...errorStyle, marginTop: 8 }}>{editPromoErr}</div>}
                              <div style={{ fontSize: 12, color: "rgba(0,0,0,0.40)", marginTop: 6 }}>Mechanic, threshold, and reward cannot be changed after creation.</div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* ══════════════════════════════════════════════
              SECTION 3 — Offer Sets
          ══════════════════════════════════════════════ */}
          <SectionCard title="Offer Sets" count={offerSets.length}>
            <div style={{ marginBottom: 14, fontSize: 13, color: "rgba(0,0,0,0.55)" }}>
              Bundle promotion rules into a published offer set. Draft → Active → Expired lifecycle.
            </div>

            {/* Status filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["draft", "active", "expired", "archived", ""].map(f => (
                <button
                  key={f || "all"}
                  type="button"
                  style={osStatusFilter === f ? btnFilterActive : btnFilter}
                  onClick={() => {
                    setOsStatusFilter(f);
                    load(itemStatusFilter, promoStatusFilter, f);
                    pvUiHook("merchant.promotions.os.filter.changed", { stable: "promo:os:filter", merchantId, filter: f || "all" });
                  }}
                >
                  {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Create toggle */}
            {!showOsCreate ? (
              <button
                type="button"
                style={{ ...btnPrimary, marginBottom: 16 }}
                onClick={() => {
                  setShowOsCreate(true);
                  pvUiHook("merchant.promotions.os.create.open", { stable: "promo:os:create", merchantId });
                }}
              >
                + New Offer Set
              </button>
            ) : (
              <div style={createCard}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>New Offer Set</div>
                {activePromotions.length === 0 && (
                  <div style={{ ...errorStyle, marginBottom: 12 }}>No active promotions. Create a promotion rule first.</div>
                )}
                <form onSubmit={handleOsCreate}>
                  <div style={twoCol}>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Name <span style={reqStar}>*</span></label>
                      <input style={inputStyle} value={osForm.name} onChange={e => setOsForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer 2026 Loyalty" autoFocus />
                    </div>
                    <div style={fieldRow}>
                      <label style={labelStyle}>Scope <span style={reqStar}>*</span></label>
                      <select style={selectStyle} value={osForm.scope} onChange={e => setOsForm(f => ({ ...f, scope: e.target.value, storeId: "" }))}>
                        <option value="merchant">All Stores</option>
                        <option value="store">Specific Store</option>
                      </select>
                    </div>
                  </div>

                  {osForm.scope === "store" && (
                    <div style={fieldRow}>
                      <label style={labelStyle}>Store <span style={reqStar}>*</span></label>
                      {merchantStores.length > 0 ? (
                        <select style={selectStyle} value={osForm.storeId} onChange={e => setOsForm(f => ({ ...f, storeId: e.target.value }))}>
                          <option value="">— select store —</option>
                          {merchantStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      ) : (
                        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.50)" }}>No stores available. Store data not loaded — try refreshing.</div>
                      )}
                    </div>
                  )}

                  <div style={fieldRow}>
                    <label style={labelStyle}>Promotion Rules <span style={reqStar}>*</span></label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      {activePromotions.length === 0 ? (
                        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.45)" }}>No active promotions available.</div>
                      ) : activePromotions.map(p => (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={osForm.promotionIds.includes(String(p.id))}
                            onChange={() => toggleOsPromoId(p.id)}
                          />
                          <span>{p.name}</span>
                          <span style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }}>
                            — {MECHANIC_LABELS[p.mechanic] || p.mechanic}, threshold {p.threshold}, {REWARD_TYPE_LABELS[p.rewardType] || p.rewardType}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {osFormErr && <div style={errorStyle}>{osFormErr}</div>}
                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button type="submit" style={btnPrimary} disabled={osSaving}>{osSaving ? "Saving…" : "Create Draft"}</button>
                    <button type="button" style={btnSecondary} onClick={() => { setShowOsCreate(false); setOsForm(EMPTY_OS_FORM); setOsFormErr(""); pvUiHook("merchant.promotions.os.create.cancel", { merchantId }); }}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {osLifecycleErr && <div style={{ ...errorStyle, marginBottom: 12 }}>{osLifecycleErr}</div>}

            {/* List */}
            {offerSets.length === 0 ? (
              <EmptyRow message="No offer sets found." />
            ) : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRow}>
                      <th style={th}>Name</th>
                      <th style={th}>Scope</th>
                      <th style={th}>Promotions</th>
                      <th style={th}>Token</th>
                      <th style={th}>Status</th>
                      <th style={{ ...th, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offerSets.map((os, idx) => (
                      <tr key={os.id} style={{ borderTop: idx === 0 ? "none" : rowBorder }}>
                        <td style={td}><span style={{ fontWeight: 700 }}>{os.name}</span></td>
                        <td style={td}>{OS_SCOPE_LABELS[os.scope] || os.scope}</td>
                        <td style={{ ...td, fontSize: 12 }}>
                          {os.offerSetPromotions?.length
                            ? os.offerSetPromotions.map(op => op.promotion?.name || `#${op.promotionId}`).join(", ")
                            : "—"}
                        </td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "rgba(0,0,0,0.55)" }}>
                          {os.token || "—"}
                        </td>
                        <td style={td}><StatusBadge status={os.status} colorMap={OS_STATUS_COLORS} /></td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8 }}>
                            {os.status === "draft" && (
                              <button type="button" style={btnSmall} onClick={() => handleOsPublish(os)}>Publish</button>
                            )}
                            {os.status === "active" && (
                              <button type="button" style={btnSmallDanger} onClick={() => handleOsExpire(os)}>Expire</button>
                            )}
                            {os.status !== "archived" && isPvAdmin && (
                              <button type="button" style={btnSmallDanger} onClick={() => handleOsArchive(os)}>Archive</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      <SupportInfo
        context={{ page: "MerchantPromotions", merchantId, lastError, lastSuccessTs }}
      />
    </PageContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const btnPrimary = {
  background: "#0B2A33",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "8px 18px",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};

const btnSecondary = {
  background: "transparent",
  color: "#0B2A33",
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 999,
  padding: "8px 18px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const btnSmall = {
  background: "transparent",
  color: "#0B2A33",
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 999,
  padding: "4px 12px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const btnSmallDanger = {
  ...btnSmall,
  color: "rgba(160,0,0,0.85)",
  borderColor: "rgba(160,0,0,0.20)",
};

const btnFilter = {
  background: "white",
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 999,
  padding: "6px 14px",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  color: "#0B2A33",
};

const btnFilterActive = {
  ...btnFilter,
  background: "rgba(0,0,0,0.08)",
  borderColor: "rgba(0,0,0,0.30)",
};

const fieldRow = { marginBottom: 12 };

const twoCol = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginBottom: 0,
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(0,0,0,0.60)",
  marginBottom: 4,
};

const reqStar = { color: "red" };

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid rgba(0,0,0,0.18)",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
};

const selectStyle = {
  ...inputStyle,
  background: "white",
};

const errorStyle = {
  color: "rgba(160,0,0,0.90)",
  fontSize: 13,
  padding: "8px 12px",
  background: "rgba(160,0,0,0.06)",
  borderRadius: 8,
  marginTop: 4,
};

const createCard = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 18,
  background: "#fff",
};

const tableWrap = {
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 12,
  overflow: "hidden",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const theadRow = {
  background: "rgba(0,0,0,0.03)",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const th = {
  padding: "10px 16px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 12,
  color: "rgba(0,0,0,0.55)",
};

const td = {
  padding: "12px 16px",
  verticalAlign: "middle",
};

const rowBorder = "1px solid rgba(0,0,0,0.06)";

const typePill = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(11,42,51,0.08)",
  color: "#0B2A33",
};
