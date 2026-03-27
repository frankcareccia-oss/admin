// admin/src/pages/MerchantUsers.jsx
import React from "react";
import { Link } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import {
  merchantListUsers,
  merchantCreateUser,
  merchantUpdateUserProfile,
  merchantUpdateStoreProfile,
  listMerchantStores,
  me,
  getSystemRole,
  // NOTE: adminGetMerchantUser is only used in readOnly mode (pv_admin views)
  // If your client exports it, keep this import; otherwise remove the readOnly detail fetch block.
  adminGetMerchantUser,
} from "../api/client";

// PV Admin UI Contract v1.0 (LOCKED)
// Landscape: Model B (single scroll)
// Row Pattern: B (inline expand)
// Hooks: pvUiHook preserved (must never throw)

const ROLE_OPTIONS = [
  { value: "owner", label: "Merchant Owner" },
  { value: "merchant_admin", label: "Merchant Admin" },
  { value: "ap_clerk", label: "AP Clerk" }, // changed for v2.00 contract
  { value: "merchant_employee", label: "Merchant Employee" }, // changed for v2.00 contract
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

const ROLE_LABEL_BY_VALUE = ROLE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const STATUS_LABEL_BY_VALUE = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

function displayRoleLabel(value) {
  return ROLE_LABEL_BY_VALUE[String(value || "").trim()] || "—";
}

function displayStatusLabel(value) {
  return STATUS_LABEL_BY_VALUE[String(value || "").trim()] || "—";
}

const PHONE_COUNTRY_OPTIONS = [
  { value: "US", label: "+1", name: "United States" },
  { value: "CA", label: "+1", name: "Canada" },
  { value: "MX", label: "+52", name: "Mexico" },
  { value: "GB", label: "+44", name: "United Kingdom" },
];

/**
 * pvUiHook: structured UI events for QA/docs/chatbot.
 * Must never throw.
 */
function pvUiHook(event, fields = {}) {
  try {
    console.log(
      JSON.stringify({
        pvUiHook: event,
        ts: new Date().toISOString(),
        ...fields,
      })
    );
  } catch {
    // never break UI for logging
  }
}

function normOptionalText(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v || "").trim();
  return s ? s : null;
}

function normEmail(v) {
  const s = String(v || "").trim().toLowerCase();
  return s || "";
}

function normPhoneDigits(v, maxLen = 20) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const digits = String(v || "").replace(/\D+/g, "");
  return digits ? digits.slice(0, maxLen) : null;
}

function resolveMerchantContextFromMe(meRes) {
  const membership = Array.isArray(meRes?.memberships) ? meRes.memberships[0] : null;

  const merchantIdRaw =
    meRes?.merchantId ??
    meRes?.merchant?.id ??
    membership?.merchantId ??
    membership?.merchant?.id ??
    null;

  const merchantId = merchantIdRaw != null ? Number(merchantIdRaw) : null;

  const merchantName =
    membership?.merchant?.name || meRes?.merchant?.name || meRes?.merchantName || "";

  const tenantRole = membership?.role || membership?.tenantRole || "";

  return { merchantId, merchantName, tenantRole, membership };
}

const TOKENS = {
  pageBg: "#FEFCF7",
  surface: "#FFFFFF",
  text: "#0B2A33",
  muted: "rgba(11,42,51,0.60)",
  border: "rgba(0,0,0,0.10)",
  divider: "rgba(0,0,0,0.06)",
  teal: "#2F8F8B",
  tealHover: "#277D79",
  errBg: "rgba(255,0,0,0.06)",
  errBorder: "rgba(255,0,0,0.15)",
  okBg: "rgba(47,143,139,0.10)",
  okBorder: "rgba(47,143,139,0.50)",
  mono:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

const styles = {
  page: { minHeight: "100vh", background: TOKENS.pageBg, color: TOKENS.text, overflowX: "hidden" },

  breadcrumbRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
    fontSize: 13,
    color: TOKENS.muted,
  },
  breadcrumbLink: {
    color: TOKENS.teal,
    textDecoration: "none",
    fontWeight: 800,
  },

  headerRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  titleWrap: { minWidth: 280 },
  h2: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: TOKENS.muted,
    maxWidth: 760,
    lineHeight: 1.45,
  },
  actions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  card: {
    border: `1px solid ${TOKENS.border}`,
    borderRadius: 14,
    padding: 14,
    background: TOKENS.surface,
    boxShadow: "0 3px 10px rgba(0,0,0,0.10)",
  },

  editCard: {
    border: `2px solid ${TOKENS.okBorder}`,
    borderRadius: 16,
    padding: 16,
    background: TOKENS.okBg,
    boxShadow: "0 8px 24px rgba(11,42,51,0.10)",
    position: "sticky",
    top: 12,
    zIndex: 3,
  },
  activeRow: {
    background: "rgba(47,143,139,0.04)",
  },
  savedRow: {
    background: "rgba(47,143,139,0.12)",
    transition: "background 180ms ease",
  },

  cardTitleRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  cardTitle: { margin: 0, fontSize: 14, fontWeight: 900, letterSpacing: "0.01em" },
  cardHelp: { marginTop: 4, fontSize: 12.5, color: TOKENS.muted },

  divider: { height: 1, background: TOKENS.divider, margin: "12px 0" },

  filterHeading: {
    fontSize: 12,
    fontWeight: 800,
    color: TOKENS.muted,
    marginBottom: 8,
  },

  toolbar: { display: "flex", gap: 10, flexWrap: "nowrap", alignItems: "center" },
  input: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    color: "#0B2A33",
  },
  select: {
    minWidth: 140,
    flexShrink: 0,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    color: "#0B2A33",
  },

  btnPrimary: {
    padding: "9px 14px",
    borderRadius: 10,
    border: "1px solid transparent",
    background: TOKENS.teal,
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  btnPrimaryDisabled: { opacity: 0.55, cursor: "not-allowed" },

  btnGhost: {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${TOKENS.border}`,
    background: "white",
    color: TOKENS.text,
    fontWeight: 800,
    cursor: "pointer",
  },
  btnLink: { padding: 0, border: 0, background: "transparent", color: TOKENS.teal, fontWeight: 800, cursor: "pointer" },

  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 860 },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: TOKENS.muted,
    fontWeight: 800,
    padding: "10px 10px",
    borderBottom: `1px solid ${TOKENS.divider}`,
    whiteSpace: "nowrap",
  },
  td: { padding: "10px 10px", borderBottom: `1px solid ${TOKENS.divider}`, verticalAlign: "top" },

  caretBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: `1px solid ${TOKENS.border}`,
    background: "white",
    color: TOKENS.text,
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: "26px",
    textAlign: "center",
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${TOKENS.border}`,
    background: "rgba(0,0,0,0.02)",
    fontSize: 12,
    fontFamily: TOKENS.mono,
    whiteSpace: "nowrap",
  },
  statusOk: { border: `1px solid ${TOKENS.okBorder}`, background: TOKENS.okBg },
  statusErr: { border: `1px solid ${TOKENS.errBorder}`, background: TOKENS.errBg },
  contactPill: { border: `1px solid ${TOKENS.okBorder}`, background: TOKENS.okBg, fontFamily: "inherit", fontWeight: 800 },

  errBox: {
    marginTop: 12,
    border: `1px solid ${TOKENS.errBorder}`,
    background: TOKENS.errBg,
    padding: 10,
    borderRadius: 10,
    color: TOKENS.text,
    fontSize: 13,
  },
  okBox: {
    marginTop: 12,
    border: `1px solid ${TOKENS.okBorder}`,
    background: TOKENS.okBg,
    padding: 10,
    borderRadius: 10,
    color: TOKENS.text,
    fontSize: 13,
  },

  grid3: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 },

  label: { display: "block", fontSize: 12, color: TOKENS.muted, marginBottom: 6, fontWeight: 800 },
  phoneFieldRow: { display: "flex", alignItems: "stretch", gap: 8 },
  phonePrefixSelect: {
    width: 86,
    flexShrink: 0,
    padding: "10px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    color: "#0B2A33",
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    color: "#0B2A33",
  },
  formActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 12 },
};

function resolveUserId(mu) {
  return mu?.userId ?? mu?.user?.id ?? mu?.id ?? null;
}

function resolvePrimaryContactStoreId(mu) {
  if (Array.isArray(mu?.primaryContactStores) && mu.primaryContactStores.length === 1) {
    return String(mu.primaryContactStores[0].storeId);
  }
  if (Array.isArray(mu?.primaryContactStores) && mu.primaryContactStores.length > 1) {
    return "__MULTI__";
  }
  return "";
}

function resolveEmail(mu) {
  return String(mu?.email ?? mu?.user?.email ?? mu?.userEmail ?? "").trim();
}

function resolveFirstName(mu) {
  return String(mu?.firstName ?? mu?.user?.firstName ?? "").trim();
}

function resolveLastName(mu) {
  return String(mu?.lastName ?? mu?.user?.lastName ?? "").trim();
}

function resolvePhoneCountry(mu) {
  return String(mu?.phoneCountry ?? mu?.user?.phoneCountry ?? "US").trim() || "US";
}

function resolvePhoneRaw(mu) {
  return String(mu?.phoneRaw ?? mu?.user?.phoneRaw ?? "").trim();
}

function normalizeMerchantUserRow(mu) {
  return {
    ...mu,
    userId: resolveUserId(mu),
    email: resolveEmail(mu),
    firstName: resolveFirstName(mu),
    lastName: resolveLastName(mu),
    phoneCountry: resolvePhoneCountry(mu),
    phoneRaw: resolvePhoneRaw(mu),
    primaryContactStoreId: resolvePrimaryContactStoreId(mu),
  };
}

function buildMerchantUserEditSnapshot(mu) {
  const normalized = normalizeMerchantUserRow(mu);
  return {
    userId: resolveUserId(normalized),
    merchantUserId: normalized?.id ?? normalized?.merchantUserId ?? null,
    email: resolveEmail(normalized),
    role: String(normalized?.role ?? "merchant_admin"),
    status: String(normalized?.status ?? "active"),
    firstName: resolveFirstName(normalized),
    lastName: resolveLastName(normalized),
    phoneCountry: resolvePhoneCountry(normalized),
    phoneRaw: resolvePhoneRaw(normalized),
    primaryContactStoreId: String(normalized?.primaryContactStoreId ?? ""),
  };
}

function displayName(mu) {
  const fn = String(mu?.firstName || "").trim();
  const ln = String(mu?.lastName || "").trim();
  const full = [fn, ln].filter(Boolean).join(" ").trim();
  return full || "—";
}

function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "—";
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function displayPhone(mu) {
  const raw = String(mu?.phoneRaw || "").trim();
  return formatPhone(raw);
}

function areEditSnapshotsEqual(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function friendlyErrorMessage(error, fallback) {
  const raw =
    String(error?.message || error?.error?.message || error || "")
      .trim();

  const lower = raw.toLowerCase();

  if (
    lower.includes("unique constraint") ||
    lower.includes("already exists") ||
    lower.includes("duplicate")
  ) {
    return "That email address is already in use.";
  }

  return raw || fallback;
}

export default function MerchantUsers({ readOnly = false }) {
  const [profile, setProfile] = React.useState(null);
  const [sysRole, setSysRole] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [merchantStores, setMerchantStores] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [result, setResult] = React.useState(null);
  const editCardRef = React.useRef(null);
  const [lastSavedUserId, setLastSavedUserId] = React.useState(null);
  const [flashRowId, setFlashRowId] = React.useState(null);

  // Create form fields (preserved)
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phoneCountry, setPhoneCountry] = React.useState("US");
  const [phoneRaw, setPhoneRaw] = React.useState("");

  const [showCreate, setShowCreate] = React.useState(false);

  // Expand/edit (Pattern B)
  const [expandedId, setExpandedId] = React.useState(null);
  const [editOriginal, setEditOriginal] = React.useState(null);
  const [editDraft, setEditDraft] = React.useState(null);

  // Filters/search
  const [q, setQ] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const expandedMu = React.useMemo(() => {
    if (!expandedId) return null;
    return items.find((x) => String(resolveUserId(x)) === String(expandedId)) || null;
  }, [items, expandedId]);

  function scrollEditCardIntoView() {
    window.requestAnimationFrame(() => {
      const el = editCardRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });

      window.setTimeout(() => {
        const top = window.scrollY - 24;
        window.scrollTo({ top: Math.max(top, 0), behavior: "auto" });
      }, 220);
    });
  }

  function scrollRowIntoView(userId) {
    if (!userId) return;
    window.requestAnimationFrame(() => {
      const row = document.getElementById(`mu-row-${userId}`);
      if (!row) return;
      const top = row.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
    });
  }

  function clearEditState() {
    setExpandedId(null);
    setEditOriginal(null);
    setEditDraft(null);
  }

  function patchEditDraft(patch) {
    setEditDraft((prev) => ({ ...(prev || {}), ...patch }));
  }

  function isEditDirty() {
    if (!editOriginal || !editDraft) return false;
    return !areEditSnapshotsEqual(editOriginal, editDraft);
  }

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await me();
      setProfile(r);
      try {
        setSysRole(getSystemRole());
      } catch {
        setSysRole("");
      }

      pvUiHook("merchant.users.load.ui", { stable: "merchant:users:load", readOnly });

      const m = await me();
      setProfile(m);

      const ctx = resolveMerchantContextFromMe(m);
      if (!ctx?.merchantId) throw new Error("merchantId is required");

      const [list, storesRes] = await Promise.all([
        merchantListUsers({ merchantId: ctx.merchantId }),
        listMerchantStores(),
      ]);

      const rawItems = Array.isArray(list) ? list : list?.items || [];
      setItems(rawItems.map(normalizeMerchantUserRow));
      setMerchantStores(Array.isArray(storesRes?.items) ? storesRes.items : []);
    } catch (e) {
      setErr(e?.message || "Failed to load team members.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  React.useEffect(() => {
    if (!expandedId || !editDraft) return;
    scrollEditCardIntoView();
  }, [expandedId, editDraft]);

  React.useEffect(() => {
    if (!lastSavedUserId) return;

    scrollRowIntoView(lastSavedUserId);
    setFlashRowId(lastSavedUserId);

    const t = window.setTimeout(() => {
      setFlashRowId(null);
      setLastSavedUserId(null);
    }, 1800);

    return () => window.clearTimeout(t);
  }, [lastSavedUserId]);

  function guardDiscardIfDirty() {
    if (busy) return false;
    if (expandedMu && isEditDirty()) {
      const ok = window.confirm("You have unsaved edits. Discard changes?");
      if (!ok) return false;
    }
    return true;
  }

  function toggleCreatePanel() {
    if (!guardDiscardIfDirty()) return;

    if (expandedId) {
      clearEditState();
    }

    const next = !showCreate;
    setShowCreate(next);
    if (next) {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    }
    pvUiHook("merchant.users.create_panel_toggle.ui", { stable: "merchant:users:create_panel_toggle", open: next });
  }

  function toggleExpand(mu) {
    if (!mu) return;

    // contract: mutually exclusive
    if (showCreate) {
      setShowCreate(false);
      pvUiHook("merchant.users.create_panel_auto_closed.ui", {
        stable: "merchant:users:create_panel_auto_closed",
        reason: "row_expand",
      });
    }

    if (!guardDiscardIfDirty()) return;

    const id = resolveUserId(mu);
    if (!id) {
      setErr("Cannot expand: missing userId");
      return;
    }

    const isClosing = String(expandedId) === String(id);
    if (isClosing) {
      clearEditState();
      pvUiHook("merchant.users.row_expand_toggle.ui", { stable: "merchant:users:row_expand_toggle", userId: id, open: false });
      return;
    }

    const snapshot = buildMerchantUserEditSnapshot(mu);
    setExpandedId(id);
    setEditOriginal({ ...snapshot });
    setEditDraft({ ...snapshot });

    window.setTimeout(scrollEditCardIntoView, 60);

    pvUiHook("merchant.users.row_expand_toggle.ui", { stable: "merchant:users:row_expand_toggle", userId: id, open: true });
  }

  async function onCreate(e) {
    e.preventDefault();
    if (readOnly) return;

    setErr("");
    setResult(null);

    const fn = String(firstName || "").trim();
    if (!fn) {
      setErr("First name is required.");
      return;
    }

    const ln = String(lastName || "").trim();
    if (!ln) {
      setErr("Last name is required.");
      return;
    }

    const em = normEmail(email);
    if (!em) {
      setErr("Email is required.");
      return;
    }

    const roleNorm = String(role || "").trim();
    if (!roleNorm) {
      setErr("Select a role.");
      return;
    }

    const ctx = resolveMerchantContextFromMe(profile);
    if (!ctx.merchantId) {
      setErr("merchantId is required");
      return;
    }

    const body = {
      merchantId: ctx.merchantId,
      email: em,
      role: roleNorm,
      status,
      firstName: normOptionalText(fn),
      lastName: normOptionalText(ln),
      phoneCountry: normOptionalText(phoneCountry)?.toUpperCase() || "US",
      phoneRaw: normPhoneDigits(phoneRaw),
    };

    setBusy(true);
    try {
      pvUiHook("merchant.users.create_clicked.ui", { stable: "merchant:users:create", merchantId: ctx.merchantId, role: roleNorm, status });
      const r = await merchantCreateUser(body);
      setResult(r);
      pvUiHook("merchant.users.create_ok.ui", { stable: "merchant:users:create_ok", merchantId: ctx.merchantId });

      setEmail("");
      setFirstName("");
      setLastName("");
      setPhoneRaw("");
      setPhoneCountry("US");
      setRole("");
      setStatus("active");
      setShowCreate(false);

      await load();
    } catch (e) {
      const message = friendlyErrorMessage(e, "Failed to create user.");
      setErr(message);
      pvUiHook("merchant.users.create_fail.ui", {
        stable: "merchant:users:create_fail",
        message
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(expandedMu) {
    if (!expandedMu || !editDraft) return;
    if (readOnly) return;

    const ctx = resolveMerchantContextFromMe(profile);
    const merchantId = ctx.merchantId;

    if (!merchantId) {
      setErr("merchantId is required");
      return;
    }

    const userId = resolveUserId(expandedMu);
    if (!userId) {
      setErr("Cannot save: missing userId");
      return;
    }

    const nextEmail = normEmail(editDraft.email);
    if (!nextEmail) {
      setErr("Email is required.");
      return;
    }

    const fields = {
      email: nextEmail,
      role: String(editDraft.role || "").trim(),
      status: String(editDraft.status || "active").trim(),
      firstName: normOptionalText(editDraft.firstName),
      lastName: normOptionalText(editDraft.lastName),
      phoneCountry: normOptionalText(editDraft.phoneCountry)?.toUpperCase() || "US",
      phoneRaw: normPhoneDigits(editDraft.phoneRaw),
    };

    setBusy(true);
    setErr("");
    try {
      pvUiHook("merchant.users.row_save.ui", { stable: "merchant:users:row_save", merchantId, userId });
      await merchantUpdateUserProfile(userId, merchantId, fields);

      const assignedStores = Array.isArray(expandedMu?.stores) ? expandedMu.stores : [];
      const currentPrimary = Array.isArray(expandedMu?.primaryContactStores) ? expandedMu.primaryContactStores : [];
      const desiredStoreIdRaw = editDraft.primaryContactStoreId;

      if (desiredStoreIdRaw !== "__MULTI__") {
        if (desiredStoreIdRaw) {
          const desiredStoreId = Number(desiredStoreIdRaw);
          const targetStore = assignedStores.find((s) => Number(s.storeId) === desiredStoreId);
          if (targetStore?.storeUserId) {
            await merchantUpdateStoreProfile(desiredStoreId, {
              primaryContactStoreUserId: Number(targetStore.storeUserId),
            });
          }
        } else if (currentPrimary.length === 1) {
          await merchantUpdateStoreProfile(Number(currentPrimary[0].storeId), {
            primaryContactStoreUserId: null,
          });
        }
      }

      pvUiHook("merchant.users.row_save_ok.ui", { stable: "merchant:users:row_save_ok", merchantId, userId });
      setLastSavedUserId(userId);
      await load();
      clearEditState();
    } catch (e) {
      const message = friendlyErrorMessage(e, "Failed to save changes.");
      setErr(message);

      pvUiHook("merchant.users.row_save_fail.ui", {
        stable: "merchant:users:row_save_fail",
        message
      });
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setQ("");
    setRoleFilter("all");
    setStatusFilter("all");
    pvUiHook("merchant.users.filters_clear.ui", { stable: "merchant:users:filters_clear" });
  }

  const filtered = React.useMemo(() => {
    const needle = String(q || "").trim().toLowerCase();
    const needleDigits = needle.replace(/\D/g, "");

    return (items || []).filter((mu) => {
      if (roleFilter !== "all" && String(mu?.role || "") !== roleFilter) return false;
      if (statusFilter !== "all" && String(mu?.status || "") !== statusFilter) return false;

      if (!needle) return true;

      const parts = [
        mu?.email,
        mu?.firstName,
        mu?.lastName,
        mu?.phoneRaw,
        mu?.role,
        mu?.status,
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase().trim());

      const hay = parts.join(" ");
      if (hay.includes(needle)) return true;

      if (needleDigits) {
        const digitsHay = hay.replace(/\D/g, "");
        return digitsHay.includes(needleDigits);
      }
      return false;
    });
  }, [items, q, roleFilter, statusFilter]);

  const createRoleSelected = String(role || "").trim();
  const createCanSave =
    !busy &&
    Boolean(String(firstName || "").trim()) &&
    Boolean(String(lastName || "").trim()) &&
    Boolean(normEmail(email)) &&
    Boolean(createRoleSelected);

  const merchantCtx = resolveMerchantContextFromMe(profile);
  const merchantLabel = merchantCtx?.merchantName || "your merchant";
  const storeAssignmentTip =
    merchantStores.length === 1
      ? "After creating the employee, assign them to your store from that store’s Team & Access page."
      : "After creating the employee, assign them to a store from that store’s Team & Access page.";

  return (
    <div style={styles.page}>
      <PageContainer size="page">
        <div style={styles.breadcrumbRow}>
          <Link
            to="/merchant/stores"
            style={styles.breadcrumbLink}
            onClick={() => pvUiHook("merchant.users.back.ui", { stable: "merchant:users:back" })}
          >
            Stores
          </Link>
          <span style={{ color: TOKENS.muted }}>›</span>
          <span>Team</span>
        </div>

        <div style={styles.headerRow}>
          <div style={styles.titleWrap}>
            <h2 style={styles.h2}>Team</h2>
            <div style={styles.sub}>
              Manage people who work for your business. Assign people to specific stores from each store’s Team &amp; Access page.
            </div>
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => {
                pvUiHook("merchant.users.refresh.ui", { stable: "merchant:users:refresh" });
                load();
              }}
              disabled={busy}
              style={{ ...styles.btnGhost, ...(busy ? styles.btnPrimaryDisabled : null) }}
            >
              Refresh
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={toggleCreatePanel}
                disabled={busy}
                style={{ ...styles.btnPrimary, ...(busy ? styles.btnPrimaryDisabled : null) }}
              >
                {showCreate ? "Close" : "Add Employee"}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {showCreate && !readOnly && (
            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <div>
                  <div style={styles.cardTitle}>{`Add Employee to ${merchantLabel}`}</div>
                  <div style={styles.cardHelp}>{`Add a new employee to ${merchantLabel} and choose their role. Assign them to a store and grant POS access from that store’s Team & Access page.`}</div>
                </div>
              </div>

              <form onSubmit={onCreate}>
                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>First name</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={styles.input} disabled={busy} />
                  </div>
                  <div>
                    <label style={styles.label}>Last name</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={styles.input} disabled={busy} />
                  </div>
                  <div>
                    <label style={styles.label}>Phone</label>
                    <div style={styles.phoneFieldRow}>
                      <select value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)} style={styles.phonePrefixSelect} disabled={busy}>
                        {PHONE_COUNTRY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={formatPhone(phoneRaw) === "—" ? "" : formatPhone(phoneRaw)}
                        onChange={(e) => setPhoneRaw(normPhoneDigits(e.target.value) ?? "")}
                        style={styles.phoneInput}
                        disabled={busy}
                        placeholder="(415) 555-1212"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)} style={styles.select} disabled={busy}>
                      <option value="">Select role</option>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={styles.label}>Email</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} disabled={busy} />
                  </div>
                  <div>
                    <label style={styles.label}>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} style={styles.select} disabled={busy}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 10 }}>
                  First name, last name, email, and role are required. Store access and POS permissions are assigned later from the store’s Team & Access page.
                </div>

                <div style={styles.formActions}>
                  <button
                    type="submit"
                    disabled={!createCanSave}
                    style={{ ...styles.btnPrimary, ...(!createCanSave ? styles.btnPrimaryDisabled : null) }}
                  >
                    {busy ? "Saving…" : "Save Employee"}
                  </button>

                  <button type="button" onClick={toggleCreatePanel} disabled={busy} style={styles.btnGhost}>
                    Close
                  </button>

                  <span style={{ fontSize: 12, color: TOKENS.muted }}>
                    {storeAssignmentTip}
                  </span>
                </div>
              </form>
            </div>
          )}

          <div style={styles.card}>
            <div style={styles.cardTitleRow}>
              <div>
                <div style={styles.cardTitle}>Team Members</div>
                <div style={styles.cardHelp}>
                  View and update your team members here. Store-specific assignment happens from each store’s Team & Access page. Store permissions, including POS access, are assigned at the store level, not as a merchant role.
                </div>
              </div>
            </div>

            <div style={styles.filterHeading}>Find team members</div>

            <div style={styles.toolbar}>
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  pvUiHook("merchant.users.search_changed.ui", { stable: "merchant:users:search_changed" });
                }}
                placeholder="Search by name, phone, email, role, or status"
                style={styles.input}
              />

              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  pvUiHook("merchant.users.role_filter.ui", { stable: "merchant:users:role_filter", value: e.target.value });
                }}
                style={styles.select}
              >
                <option value="all">All roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  pvUiHook("merchant.users.status_filter.ui", { stable: "merchant:users:status_filter", value: e.target.value });
                }}
                style={styles.select}
              >
                <option value="all">All status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button type="button" onClick={clearFilters} style={styles.btnGhost} disabled={busy}>
                Clear
              </button>
            </div>

            <div style={styles.divider} />

            {loading ? (
              <div style={{ fontSize: 13, color: TOKENS.muted }}>Loading…</div>
            ) : (
              <>
                {expandedMu && editDraft && (
                  <div style={{ marginTop: 12 }}>
                    <div ref={editCardRef} style={styles.editCard}>
                      <div style={styles.cardTitleRow}>
                        <div>
                          <div style={styles.cardTitle}>Edit Employee</div>
                          <div style={styles.cardHelp}>
                            {displayName(expandedMu) !== "—" ? displayName(expandedMu) : expandedMu?.email || "—"}
                          </div>
                          <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 4 }}>
                            Changes apply to this merchant-level employee.
                          </div>
                        </div>
                      </div>

                      <div style={styles.grid3}>
                        <div>
                          <label style={styles.label}>First name</label>
                          <input
                            value={editDraft.firstName}
                            onChange={(e) => patchEditDraft({ firstName: e.target.value })}
                            style={styles.input}
                            disabled={busy}
                          />
                        </div>
                        <div>
                          <label style={styles.label}>Last name</label>
                          <input
                            value={editDraft.lastName}
                            onChange={(e) => patchEditDraft({ lastName: e.target.value })}
                            style={styles.input}
                            disabled={busy}
                          />
                        </div>
                        <div>
                          <label style={styles.label}>Phone</label>
                          <div style={styles.phoneFieldRow}>
                            <select
                              value={editDraft.phoneCountry}
                              onChange={(e) => patchEditDraft({ phoneCountry: e.target.value })}
                              style={styles.phonePrefixSelect}
                              disabled={busy}
                            >
                              {PHONE_COUNTRY_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <input
                              value={formatPhone(editDraft.phoneRaw) === "—" ? "" : formatPhone(editDraft.phoneRaw)}
                              onChange={(e) => patchEditDraft({ phoneRaw: normPhoneDigits(e.target.value) ?? "" })}
                              style={styles.phoneInput}
                              disabled={busy}
                              placeholder="(415) 555-1212"
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ height: 12 }} />

                      <div style={styles.grid3}>
                        <div>
                          <label style={styles.label}>Role</label>
                          <select
                            value={editDraft.role}
                            onChange={(e) => patchEditDraft({ role: e.target.value })}
                            style={styles.select}
                            disabled={busy}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={styles.label}>Email</label>
                          <input
                            value={editDraft.email}
                            onChange={(e) => patchEditDraft({ email: e.target.value })}
                            style={styles.input}
                            disabled={busy}
                          />
                        </div>

                        <div>
                          <label style={styles.label}>Status</label>
                          <select
                            value={editDraft.status}
                            onChange={(e) => patchEditDraft({ status: e.target.value })}
                            style={styles.select}
                            disabled={busy}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {Array.isArray(expandedMu?.primaryContactStores) && expandedMu.primaryContactStores.length > 1 ? (
                        <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 8 }}>
                          This employee is the contact for multiple stores. Manage changes from the store pages.
                        </div>
                      ) : null}

                      <div style={styles.formActions}>
                        <button
                          type="button"
                          onClick={() => onSaveEdit(expandedMu)}
                          disabled={busy || !isEditDirty()}
                          style={{
                            ...styles.btnPrimary,
                            ...(busy || !isEditDirty() ? styles.btnPrimaryDisabled : null)
                          }}
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!guardDiscardIfDirty()) return;
                            clearEditState();
                          }}
                          disabled={busy}
                          style={styles.btnGhost}
                        >
                          Close
                        </button>

                        {isEditDirty() && <span style={{ fontSize: 12, color: TOKENS.muted }}>Unsaved changes</span>}
                      </div>
                      {err && <div style={styles.errBox}>{err}</div>}
                    </div>
                  </div>
                )}

                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}></th>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Phone</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Role</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((mu) => {
                        const id = resolveUserId(mu);
                        const isOpen = expandedId && id && String(expandedId) === String(id);
                        const st = String(mu?.status || "active");
                        const isFlash = flashRowId && String(flashRowId) === String(id);

                        return (
                          <React.Fragment key={id || mu?.email || Math.random()}>
                            <tr
                              id={id ? `mu-row-${id}` : undefined}
                              style={isOpen ? styles.activeRow : isFlash ? styles.savedRow : undefined}
                            >
                              <td style={{ ...styles.td, width: 42 }}>
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(mu)}
                                  style={styles.caretBtn}
                                  aria-label={isOpen ? "Collapse row" : "Expand row"}
                                >
                                  {isOpen ? "▾" : "▸"}
                                </button>
                              </td>
                              <td style={styles.td}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 800 }}>{displayName(mu)}</span>
                                  {mu?.isPrimaryContact ? (
                                    <span style={{ ...styles.pill, ...styles.contactPill }} title={mu?.primaryContactStoreNames || "Primary contact"}>
                                      Primary contact
                                    </span>
                                  ) : null}
                                </div>
                                {mu?.primaryContactStoreNames ? (
                                  <div style={{ fontSize: 12, color: TOKENS.muted, marginTop: 4 }}>
                                    {mu.primaryContactStoreNames}
                                  </div>
                                ) : null}
                              </td>
                              <td style={styles.td}>{displayPhone(mu)}</td>
                              <td style={styles.td}>
                                <div style={{ fontWeight: 700 }}>{mu?.email || "—"}</div>
                              </td>
                              <td style={styles.td}>
                                <span style={styles.pill}>{displayRoleLabel(mu?.role)}</span>
                              </td>
                              <td style={styles.td}>
                                <span style={{ ...styles.pill, ...(st === "active" ? styles.statusOk : styles.statusErr) }}>
                                  {displayStatusLabel(mu?.status || "active")}
                                </span>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}

                      {filtered.length === 0 && (
                        <tr>
                          <td style={styles.td} colSpan={6}>
                            <div style={{ fontSize: 13, color: TOKENS.muted }}>No team members match your filters.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {result && <div style={styles.okBox}>Changes saved successfully.</div>}
          </div>
        </div>
      </PageContainer>
    </div>
  );
}