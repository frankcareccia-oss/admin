/**
 * MerchantProducts.jsx
 *
 * Product catalog management for a merchant.
 * Accessible by pv_admin (read + manage) and merchant_admin / owner.
 *
 * Template: List + Create (style guide)
 * Breadcrumb → Page Title → Helper Text → Create Card → Filter → Table
 */

import React from "react";
import { Link, useParams } from "react-router-dom";
import { color, btn, palette, inputStyle as themeInput } from "../theme";
import {
  getMerchant,
  me,
  getSystemRole,
  merchantListProducts,
  merchantCreateProduct,
  merchantUpdateProduct,
  merchantDeactivateProduct,
  merchantReactivateProduct,
  merchantActivateProduct,
  merchantListCategories,
  merchantCreateCategory,
  adminListMerchantProducts,
  adminCreateMerchantProduct,
  adminUpdateMerchantProduct,
  adminDeactivateMerchantProduct,
  adminReactivateMerchantProduct,
  adminActivateMerchantProduct,
  adminListMerchantCategories,
  adminCreateMerchantCategory,
  generateProductInfo,
} from "../api/client";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import SupportInfo from "../components/SupportInfo";
import ProductAvatar from "../components/ProductAvatar";
import SuggestionBanner from "../components/SuggestionBanner";

// ─── pvUiHook ────────────────────────────────────────────────
function pvUiHook(event, fields = {}) {
  try {
    console.log(JSON.stringify({ pvUiHook: event, ts: new Date().toISOString(), ...fields }));
  } catch {
    // never break UI
  }
}

// ─── Category suggestions ─────────────────────────────────────

const CATEGORY_SUGGESTIONS = {
  coffee:    ["Coffee", "Espresso", "Tea", "Pastry", "Cold Brew", "Smoothie"],
  fitness:   ["Supplement", "Protein", "Apparel", "Equipment", "Recovery", "Hydration", "Bottled Water"],
  restaurant:["Food", "Beverage", "Dessert", "Appetizer", "Entree", "Sides"],
  retail:    ["Clothing", "Accessories", "Electronics", "Home", "Beauty", "Gift"],
  generic:   ["Product", "Service", "Membership", "Add-on"],
};

function detectMerchantType(name) {
  const n = String(name || "").toLowerCase();
  if (/coffee|brew|café|cafe|espresso|roast|bean/.test(n)) return "coffee";
  if (/fit|gym|sport|perf|health|wellness|yoga|crossfit|train/.test(n)) return "fitness";
  if (/restaurant|bistro|grill|kitchen|eatery|diner|food|pizza|taco|burger/.test(n)) return "restaurant";
  if (/shop|store|boutique|market|retail/.test(n)) return "retail";
  return "generic";
}

// ─── Helpers ─────────────────────────────────────────────────

const STATUS_COLORS = {
  draft:    { background: "rgba(100,100,200,0.08)", color: "rgba(60,60,160,1)", border: "1px solid rgba(100,100,200,0.20)" },
  active:   { background: "rgba(0,150,80,0.10)",   color: "rgba(0,110,50,1)",  border: "1px solid rgba(0,150,80,0.25)" },
  inactive: { background: "rgba(0,0,0,0.06)",      color: "rgba(0,0,0,0.50)",  border: "1px solid rgba(0,0,0,0.12)" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.inactive;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...s }}>
      {status || "unknown"}
    </span>
  );
}


const ALLERGENS = ["gluten", "dairy", "eggs", "tree nuts", "peanuts", "soy", "shellfish", "sesame"];
const DIETARY   = ["vegan", "vegetarian", "halal", "kosher", "gluten-free", "dairy-free", "nut-free"];

const EMPTY_FORM = { name: "", description: "", sku: "", imageUrl: "", categoryId: "", complianceText: "", allergens: [], dietaryFlags: [] };

export default function MerchantProducts() {
  const { merchantId } = useParams();
  const systemRole = getSystemRole();
  const isPvAdmin = systemRole === "pv_admin";

  const [merchant, setMerchant] = React.useState(null);
  const [products, setProducts] = React.useState([]);
  const [categories, setCategories] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Category management
  const [showCatCreate, setShowCatCreate] = React.useState(false);
  const [catName, setCatName] = React.useState("");
  const [catSaving, setCatSaving] = React.useState(false);
  const [catError, setCatError] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("draft");

  // Create panel
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // AI compliance generation
  const [generatingInfo, setGeneratingInfo] = React.useState(false);
  const [editGeneratingInfo, setEditGeneratingInfo] = React.useState(false);

  // Edit row
  const [editingId, setEditingId] = React.useState(null);
  const [editForm, setEditForm] = React.useState({});
  const [editError, setEditError] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);

  // Last error for SupportInfo
  const [lastError, setLastError] = React.useState("");
  const [lastSuccessTs, setLastSuccessTs] = React.useState("");

  // ─── Load ──────────────────────────────────────────────────
  async function load(filter = statusFilter) {
    setLoading(true);
    setError("");
    try {
      const [mRes, pRes, cRes] = await Promise.all([
        isPvAdmin ? getMerchant(merchantId) : me(),
        isPvAdmin
          ? adminListMerchantProducts(merchantId, { status: filter })
          : merchantListProducts({ status: filter }),
        isPvAdmin
          ? adminListMerchantCategories(merchantId)
          : merchantListCategories(),
      ]);
      const merchantObj = isPvAdmin
        ? (mRes?.merchant || mRes)
        : (mRes?.user?.merchantUsers?.[0]?.merchant || null);
      setMerchant(merchantObj);
      setProducts(pRes?.items || []);
      setCategories(cRes?.categories || []);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.products.list.loaded", { merchantId, count: (pRes?.items || []).length, statusFilter: filter });
    } catch (e) {
      const msg = e?.message || "Failed to load products";
      setError(msg);
      setLastError(msg);
      pvUiHook("merchant.products.list.error", { merchantId, error: msg });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load(statusFilter);
  }, [merchantId, statusFilter]);

  // ─── AI compliance generation ──────────────────────────────
  async function handleGenerateInfo() {
    setGeneratingInfo(true);
    setFormError("");
    try {
      const cat = categories.find(c => String(c.id) === String(form.categoryId));
      const data = await generateProductInfo({
        productName: form.name || "Product",
        categoryName: cat?.name || null,
        description: form.description || null,
        allergens: form.allergens,
        dietaryFlags: form.dietaryFlags,
      });
      setForm(f => ({ ...f, complianceText: data.draft || "" }));
    } catch (e) {
      setFormError(e?.message || "Failed to generate product info draft");
    } finally {
      setGeneratingInfo(false);
    }
  }

  async function handleEditGenerateInfo(product) {
    setEditGeneratingInfo(true);
    setEditError("");
    try {
      const cat = categories.find(c => c.id === (editForm.categoryId ? parseInt(editForm.categoryId, 10) : product.categoryId));
      const data = await generateProductInfo({
        productName: editForm.name || product.name,
        categoryName: cat?.name || null,
        description: editForm.description || product.description || null,
        allergens: editForm.allergens || [],
        dietaryFlags: editForm.dietaryFlags || [],
      });
      setEditForm(f => ({ ...f, complianceText: data.draft || "" }));
    } catch (e) {
      setEditError(e?.message || "Failed to generate product info draft");
    } finally {
      setEditGeneratingInfo(false);
    }
  }

  // ─── Create ────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    const name = form.name.trim();
    if (!name) { setFormError("Name is required"); return; }
    const imageUrl = form.imageUrl.trim();
    if (imageUrl && imageUrl.startsWith("data:")) { setFormError("Image URL must be a hosted URL (https://…), not a base64 data URI. Upload the image to an image host first."); return; }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) { setFormError("Image URL must start with https:// or http://"); return; }

    setSaving(true);
    pvUiHook("merchant.products.create.submit", { merchantId, hasCustomSku: Boolean(form.sku.trim()) });
    try {
      const payload = {
        name,
        description: form.description.trim() || undefined,
        complianceText: form.complianceText?.trim() || undefined,
        sku: form.sku.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        categoryId: form.categoryId ? parseInt(form.categoryId, 10) : undefined,
      };
      if (isPvAdmin) {
        await adminCreateMerchantProduct(merchantId, payload);
      } else {
        await merchantCreateProduct(payload);
      }
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.products.create.success", { merchantId });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to create product";
      setFormError(msg);
      setLastError(msg);
      pvUiHook("merchant.products.create.error", { merchantId, error: msg });
    } finally {
      setSaving(false);
    }
  }

  // ─── Edit ──────────────────────────────────────────────────
  function startEdit(product) {
    if (showCreate) setShowCreate(false);
    setEditingId(product.id);
    setEditForm({ name: product.name, description: product.description || "", complianceText: product.complianceText || "", imageUrl: product.imageUrl || "", categoryId: product.categoryId ? String(product.categoryId) : "", allergens: [], dietaryFlags: [] });
    setEditError("");
    pvUiHook("merchant.products.edit.open", { merchantId, productId: product.id, sku: product.sku });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setEditError("");
    pvUiHook("merchant.products.edit.cancel", { merchantId });
  }

  async function handleEditSave(productId) {
    setEditError("");
    const name = (editForm.name || "").trim();
    if (!name) { setEditError("Name is required"); return; }
    const imageUrl = (editForm.imageUrl || "").trim();
    if (imageUrl && imageUrl.startsWith("data:")) { setEditError("Image URL must be a hosted URL (https://…), not a base64 data URI."); return; }
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) { setEditError("Image URL must start with https:// or http://"); return; }

    setEditSaving(true);
    pvUiHook("merchant.products.edit.submit", { merchantId, productId });
    try {
      const payload = {
        name,
        description: editForm.description?.trim() || undefined,
        complianceText: editForm.complianceText?.trim() || null,
        imageUrl: editForm.imageUrl?.trim() || null,
        categoryId: editForm.categoryId ? parseInt(editForm.categoryId, 10) : null,
      };
      if (isPvAdmin) {
        await adminUpdateMerchantProduct(merchantId, productId, payload);
      } else {
        await merchantUpdateProduct(productId, payload);
      }
      setEditingId(null);
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.products.edit.success", { merchantId, productId });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to update product";
      setEditError(msg);
      setLastError(msg);
      pvUiHook("merchant.products.edit.error", { merchantId, productId, error: msg });
    } finally {
      setEditSaving(false);
    }
  }

  // ─── Inline category auto-save ───────────────────────────
  const [catSavingIds, setCatSavingIds] = React.useState(new Set());

  async function handleCategoryChange(productId, rawValue) {
    const categoryId = rawValue ? parseInt(rawValue, 10) : null;
    setCatSavingIds(prev => new Set([...prev, productId]));
    pvUiHook("merchant.products.category.autosave.submit", { merchantId, productId, categoryId });
    try {
      if (isPvAdmin) {
        await adminUpdateMerchantProduct(merchantId, productId, { categoryId });
      } else {
        await merchantUpdateProduct(productId, { categoryId });
      }
      setProducts(prev => prev.map(p => {
        if (p.id !== productId) return p;
        const cat = categoryId ? categories.find(c => c.id === categoryId) : null;
        return { ...p, categoryId, category: cat || null };
      }));
      pvUiHook("merchant.products.category.autosave.success", { merchantId, productId, categoryId });
    } catch (e) {
      const msg = e?.message || "Failed to update category";
      setLastError(msg);
      pvUiHook("merchant.products.category.autosave.error", { merchantId, productId, error: msg });
    } finally {
      setCatSavingIds(prev => { const s = new Set(prev); s.delete(productId); return s; });
    }
  }

  // ─── Category quick-create ────────────────────────────────
  async function handleCatCreate(e) {
    e.preventDefault();
    setCatError("");
    const name = catName.trim();
    if (!name) { setCatError("Name is required"); return; }
    setCatSaving(true);
    try {
      const res = isPvAdmin
        ? await adminCreateMerchantCategory(merchantId, { name })
        : await merchantCreateCategory({ name });
      const newCat = res?.category;
      setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
      setCatName("");
      setShowCatCreate(false);
      pvUiHook("merchant.products.category.created", { merchantId, categoryId: newCat?.id });
    } catch (e) {
      setCatError(e?.message || "Failed to create category");
    } finally {
      setCatSaving(false);
    }
  }

  // ─── Deactivate / Reactivate ───────────────────────────────
  async function handleDeactivate(product) {
    pvUiHook("merchant.products.deactivate.submit", { merchantId, productId: product.id, sku: product.sku });
    try {
      if (isPvAdmin) {
        await adminDeactivateMerchantProduct(merchantId, product.id);
      } else {
        await merchantDeactivateProduct(product.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.products.deactivate.success", { merchantId, productId: product.id });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to deactivate product";
      setLastError(msg);
      pvUiHook("merchant.products.deactivate.error", { merchantId, productId: product.id, error: msg });
    }
  }

  async function handleReactivate(product) {
    pvUiHook("merchant.products.reactivate.submit", { merchantId, productId: product.id, sku: product.sku });
    try {
      if (isPvAdmin) {
        await adminReactivateMerchantProduct(merchantId, product.id);
      } else {
        await merchantReactivateProduct(product.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.products.reactivate.success", { merchantId, productId: product.id });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to reactivate product";
      setLastError(msg);
      pvUiHook("merchant.products.reactivate.error", { merchantId, productId: product.id, error: msg });
    }
  }

  async function handleActivate(product) {
    pvUiHook("merchant.products.activate.submit", { merchantId, productId: product.id, sku: product.sku });
    try {
      if (isPvAdmin) {
        await adminActivateMerchantProduct(merchantId, product.id);
      } else {
        await merchantActivateProduct(product.id);
      }
      setLastSuccessTs(new Date().toISOString());
      pvUiHook("merchant.products.activate.success", { merchantId, productId: product.id });
      await load(statusFilter);
    } catch (e) {
      const msg = e?.message || "Failed to activate product";
      setLastError(msg);
      pvUiHook("merchant.products.activate.error", { merchantId, productId: product.id, error: msg });
    }
  }

  // ─── Render ────────────────────────────────────────────────
  const merchantName = merchant?.name || `Merchant ${merchantId}`;

  return (
    <PageContainer>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: color.textMuted, marginBottom: 12 }}>
        <Link to="/merchants" style={{ color: "inherit", textDecoration: "none" }}>Merchants</Link>
        {" / "}
        <Link to={`/merchants/${merchantId}`} style={{ color: "inherit", textDecoration: "none" }}>{merchantName}</Link>
        {" / "}
        <span>Products</span>
      </div>

      <PageHeader
        title="Products"
        subtitle={`Catalog for ${merchantName}`}
      />

      <div style={{ marginTop: 24 }} />

      {/* ── Categories Panel ── */}
      <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, padding: "14px 20px", marginBottom: 20, background: color.pageBg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCatCreate ? 12 : 0 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: color.text }}>Categories</span>
            {categories.length > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, color: color.textMuted, fontWeight: 600 }}>
                {categories.filter(c => c.status === "active").map(c => c.name).join(" · ")}
              </span>
            )}
            {categories.length === 0 && <span style={{ marginLeft: 10, fontSize: 12, color: color.textFaint }}>No categories yet</span>}
          </div>
          {!showCatCreate && (
            <button type="button" style={btnSecondary} onClick={() => { setShowCatCreate(true); setCatName(""); setCatError(""); }}>
              + Add Category
            </button>
          )}
        </div>
        {showCatCreate && (
          <form onSubmit={handleCatCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <input
                  style={inputStyle}
                  value={catName}
                  onChange={e => setCatName(e.target.value)}
                  placeholder="Category name (e.g. Coffee, Pastry)"
                  autoFocus
                />
                {catError && <div style={{ ...errorStyle, marginTop: 4 }}>{catError}</div>}
              </div>
              <button type="submit" style={btnPrimary} disabled={catSaving}>{catSaving ? "Saving…" : "Save"}</button>
              <button type="button" style={btnSecondary} onClick={() => { setShowCatCreate(false); setCatName(""); setCatError(""); }}>Cancel</button>
            </div>
            {/* Suggestion chips */}
            {(() => {
              const type = detectMerchantType(merchant?.name || "");
              const existing = new Set(categories.map(c => c.name.toLowerCase()));
              const suggestions = (CATEGORY_SUGGESTIONS[type] || CATEGORY_SUGGESTIONS.generic)
                .filter(s => !existing.has(s.toLowerCase()));
              if (!suggestions.length) return null;
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>Suggestions:</span>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCatName(s)}
                      style={{
                        padding: "3px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(0,0,0,0.18)",
                        background: catName === s ? "rgba(80,100,220,0.10)" : "#fff",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                        color: catName === s ? "rgba(50,70,200,1)" : "#444",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              );
            })()}
          </form>
        )}
      </div>

      {/* ── Suggestion Banner ── */}
      {!isPvAdmin && merchant?.merchantType && (
        <SuggestionBanner
          merchantType={merchant.merchantType}
          entityType="products"
          onFill={(s) => {
            setForm(f => ({ ...f, name: s.name || "", description: s.description || "" }));
            setShowCreate(true);
          }}
        />
      )}

      {/* ── Create Card ── */}
      {!showCreate ? (
        <div
          style={{
            border: `1px solid ${color.border}`,
            borderRadius: 14,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: color.pageBg,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: color.text }}>Add a product</div>
            <div style={{ color: color.textMuted, fontSize: 13, marginTop: 2 }}>
              SKU is auto-generated if not provided.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
              pvUiHook("merchant.products.create.open", { merchantId });
            }}
            style={btnPrimary}
          >
            + Add Product
          </button>
        </div>
      ) : (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, padding: 20, marginBottom: 20, background: color.cardBg }}>
          <div style={{ fontWeight: 800, marginBottom: 14, color: color.text }}>New Product</div>
          <form onSubmit={handleCreate}>
            <div style={fieldRow}>
              <label style={labelStyle}>Name <span style={{ color: color.danger }}>*</span></label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Latte"
                autoFocus
              />
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Category</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <select
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">— none —</option>
                  {categories.filter(c => c.status === "active").map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <span style={{ fontSize: 12, color: color.textFaint }}>Add categories above first</span>
                )}
              </div>
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>SKU</label>
              <input
                style={inputStyle}
                value={form.sku}
                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                placeholder="Leave blank to auto-generate (e.g. PRD-0001)"
              />
            </div>
            <div style={fieldRow}>
              <label style={labelStyle}>Image URL</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <input
                    style={inputStyle}
                    value={form.imageUrl}
                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://images.unsplash.com/photo-… (direct image link)"
                  />
                  <div style={{ fontSize: 11, color: color.textFaint, marginTop: 4 }}>
                    Must be a direct link to an image file, not a webpage. Right-click any image → "Copy image address".
                  </div>
                </div>
                <ProductAvatar name={form.name || "?"} imageUrl={form.imageUrl || undefined} size={40} radius={8} />
              </div>
            </div>
            <div style={fieldRow}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={labelStyle}>Product Info & Compliance</label>
                <button
                  type="button"
                  style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, borderRadius: 999 }}
                  disabled={generatingInfo}
                  onClick={handleGenerateInfo}
                >
                  {generatingInfo ? "Generating…" : "✦ Generate Draft"}
                </button>
              </div>
              {/* Allergen checkboxes */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 4 }}>Contains allergens:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                  {ALLERGENS.map(a => (
                    <label key={a} style={{ fontSize: 12, color: color.textMuted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.allergens.includes(a)}
                        onChange={e => setForm(f => ({ ...f, allergens: e.target.checked ? [...f.allergens, a] : f.allergens.filter(x => x !== a) }))}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
              {/* Dietary flags */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 4 }}>Dietary claims:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                  {DIETARY.map(d => (
                    <label key={d} style={{ fontSize: 12, color: color.textMuted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.dietaryFlags.includes(d)}
                        onChange={e => setForm(f => ({ ...f, dietaryFlags: e.target.checked ? [...f.dietaryFlags, d] : f.dietaryFlags.filter(x => x !== d) }))}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <textarea
                style={{ ...inputStyle, width: "100%", minHeight: 90, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }}
                value={form.complianceText}
                onChange={e => setForm(f => ({ ...f, complianceText: e.target.value }))}
                placeholder="Click 'Generate Draft' — AI will write a product description + allergen/dietary statement based on your selections above."
              />
              <div style={{ fontSize: 11, color: color.textFaint, marginTop: 3 }}>AI-generated draft — review before saving. Select allergens/dietary claims above to improve accuracy.</div>
            </div>
            {formError && <div style={errorStyle}>{formError}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button type="submit" style={btnPrimary} disabled={saving}>
                {saving ? "Saving…" : "Save Product"}
              </button>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => {
                  setShowCreate(false);
                  setForm(EMPTY_FORM);
                  setFormError("");
                  pvUiHook("merchant.products.create.cancel", { merchantId });
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["draft", "active", "inactive", ""].map(f => (
          <button
            key={f || "all"}
            type="button"
            style={statusFilter === f ? btnFilterActive : btnFilter}
            onClick={() => {
              setStatusFilter(f);
              pvUiHook("merchant.products.filter.change", { merchantId, statusFilter: f || "all" });
            }}
          >
            {f === "" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ color: color.textFaint, padding: 20 }}>Loading…</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : products.length === 0 ? (
        <div style={{ color: color.textFaint, padding: 20 }}>No products found.</div>
      ) : (
        <div style={{ border: `1px solid ${color.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: color.pageBg, borderBottom: `1px solid ${color.border}` }}>
                <th style={th}>Name</th>
                <th style={th}>SKU</th>
                <th style={th}>Category</th>
                <th style={th}>Description</th>
                <th style={th}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <React.Fragment key={p.id}>
                  <tr style={{ borderTop: idx === 0 ? "none" : `1px solid ${color.borderSubtle}`, background: editingId === p.id ? color.pageBg : "transparent" }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <ProductAvatar name={p.name} imageUrl={p.imageUrl} size={36} radius={8} />
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{p.sku}</td>
                    <td style={td}>
                      <select
                        style={{
                          padding: "4px 8px",
                          border: `1px solid ${color.border}`,
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          background: catSavingIds.has(p.id) ? color.pageBg : color.cardBg,
                          color: color.text,
                          cursor: "pointer",
                          minWidth: 110,
                        }}
                        value={p.categoryId ? String(p.categoryId) : ""}
                        disabled={catSavingIds.has(p.id)}
                        onChange={e => handleCategoryChange(p.id, e.target.value)}
                      >
                        <option value="">— none —</option>
                        {categories.filter(c => c.status === "active").map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {catSavingIds.has(p.id) && (
                        <span style={{ fontSize: 11, color: color.textFaint, marginLeft: 6 }}>saving…</span>
                      )}
                    </td>
                    <td style={{ ...td, color: color.textMuted }}>{p.description || "—"}</td>
                    <td style={td}><StatusBadge status={p.status} /></td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        {editingId !== p.id && (
                          <button type="button" style={btnSmall} onClick={() => startEdit(p)}>Edit</button>
                        )}
                        {p.status === "draft" && (
                          <button type="button" style={btnSmallSuccess} onClick={() => handleActivate(p)}>Activate</button>
                        )}
                        {p.status === "active" && (
                          <button type="button" style={btnSmallDanger} onClick={() => handleDeactivate(p)}>Deactivate</button>
                        )}
                        {p.status === "inactive" && (
                          <button type="button" style={btnSmall} onClick={() => handleReactivate(p)}>Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {editingId === p.id && (
                    <tr style={{ borderTop: `1px solid ${color.borderSubtle}`, background: color.pageBg }}>
                      <td colSpan={6} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <div>
                            <label style={labelStyle}>Name <span style={{ color: color.danger }}>*</span></label>
                            <input
                              style={{ ...inputStyle, width: 220 }}
                              value={editForm.name || ""}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Category</label>
                            <select
                              style={{ ...inputStyle, width: 160 }}
                              value={editForm.categoryId || ""}
                              onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}
                            >
                              <option value="">— none —</option>
                              {categories.filter(c => c.status === "active").map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Description</label>
                            <input
                              style={{ ...inputStyle, width: 260 }}
                              value={editForm.description || ""}
                              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Image URL</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <div>
                                <input
                                  style={{ ...inputStyle, width: 220 }}
                                  value={editForm.imageUrl || ""}
                                  onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))}
                                  placeholder="Direct image link (https://…)"
                                />
                                <div style={{ fontSize: 11, color: color.textFaint, marginTop: 3 }}>
                                  Right-click image → "Copy image address"
                                </div>
                              </div>
                              <ProductAvatar name={editForm.name || p.name} imageUrl={editForm.imageUrl || undefined} size={32} radius={6} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" style={btnPrimary} disabled={editSaving} onClick={() => handleEditSave(p.id)}>
                              {editSaving ? "Saving…" : "Save"}
                            </button>
                            <button type="button" style={btnSecondary} onClick={cancelEdit}>Cancel</button>
                          </div>
                        </div>
                        {/* Compliance section */}
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <label style={labelStyle}>Product Info & Compliance</label>
                            <button
                              type="button"
                              style={{ ...btnSecondary, padding: "4px 12px", fontSize: 12, borderRadius: 999 }}
                              disabled={editGeneratingInfo}
                              onClick={() => handleEditGenerateInfo(p)}
                            >
                              {editGeneratingInfo ? "Generating…" : "✦ Generate Draft"}
                            </button>
                          </div>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 4 }}>Contains allergens:</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                              {ALLERGENS.map(a => (
                                <label key={a} style={{ fontSize: 12, color: color.textMuted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={(editForm.allergens || []).includes(a)}
                                    onChange={e => setEditForm(f => ({ ...f, allergens: e.target.checked ? [...(f.allergens || []), a] : (f.allergens || []).filter(x => x !== a) }))}
                                  />
                                  {a}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 4 }}>Dietary claims:</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                              {DIETARY.map(d => (
                                <label key={d} style={{ fontSize: 12, color: color.textMuted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                  <input
                                    type="checkbox"
                                    checked={(editForm.dietaryFlags || []).includes(d)}
                                    onChange={e => setEditForm(f => ({ ...f, dietaryFlags: e.target.checked ? [...(f.dietaryFlags || []), d] : (f.dietaryFlags || []).filter(x => x !== d) }))}
                                  />
                                  {d}
                                </label>
                              ))}
                            </div>
                          </div>
                          <textarea
                            style={{ ...inputStyle, width: "100%", minHeight: 90, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5 }}
                            value={editForm.complianceText || ""}
                            onChange={e => setEditForm(f => ({ ...f, complianceText: e.target.value }))}
                            placeholder="Click 'Generate Draft' for an AI-drafted compliance statement."
                          />
                          <div style={{ fontSize: 11, color: color.textFaint, marginTop: 3 }}>Tick allergens/dietary above before generating for best results.</div>
                        </div>
                        {editError && <div style={{ ...errorStyle, marginTop: 8 }}>{editError}</div>}
                        <div style={{ fontSize: 12, color: color.textFaint, marginTop: 6 }}>
                          SKU <strong>{p.sku}</strong> is stable and cannot be changed.
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SupportInfo
        context={{
          page: "MerchantProducts",
          merchantId,
          lastError,
          lastSuccessTs,
        }}
      />
    </PageContainer>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const btnPrimary     = { ...btn.primary,   padding: "8px 18px",  borderRadius: 999, fontSize: 13 };
const btnSecondary   = { ...btn.secondary, padding: "8px 18px",  borderRadius: 999, fontSize: 13 };
const btnSmall        = { ...btn.pill,    padding: "4px 12px",  fontSize: 12 };
const btnSmallDanger  = { ...btn.danger,  padding: "4px 12px",  fontSize: 12 };
const btnSmallSuccess = { ...btn.primary, padding: "4px 12px",  fontSize: 12 };
const btnFilter      = { ...btn.pill,      padding: "6px 14px",  fontSize: 12 };
const btnFilterActive = { ...btnFilter, background: color.primarySubtle, borderColor: color.primaryBorder, color: color.primary };

const fieldRow   = { marginBottom: 12 };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: color.textMuted, marginBottom: 4 };
const inputStyle = { ...themeInput, padding: "8px 12px", fontSize: 14 };

const errorStyle = {
  color: color.danger, fontSize: 13, padding: "8px 12px",
  background: color.dangerSubtle, border: `1px solid ${color.dangerBorder}`, borderRadius: 8, marginTop: 4,
};

const th = { padding: "10px 16px", textAlign: "left", fontWeight: 700, fontSize: 12, color: color.textMuted };
const td = { padding: "12px 16px", verticalAlign: "middle" };

const catPill = {
  display: "inline-flex", alignItems: "center", padding: "2px 10px",
  borderRadius: 999, fontSize: 12, fontWeight: 700,
  background: "rgba(47,143,139,0.10)", color: color.primary,
};
