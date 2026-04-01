// admin/src/pages/AdminTeam.jsx
// FULL MODULE (REPLACEMENT)
// PerkValet Team (Admin UI)
// - Palette compliant (PerkValet Color Usage Contract - LOCKED)
// - Elevated Panel spec
// - Staff-only (pv_admin) UI gate; backend enforces too
// - List scrolls only when required (overflow auto; no forced panel height)
// - Create card is collapsed by default (progressive disclosure)
// - Hooks for QA/Support/Docs via pvUiHook (never throw)

import React from "react";
import {
  adminListTeam,
  adminCreateTeamMember,
  adminUpdateTeamMember,
  getSystemRole,
} from "../api/client";
import { color, btn, inputStyle as themeInput } from "../theme";

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

function fmt(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function safeTrim(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}


function isValidEmailSimple(email) {
  const v = String(email || "").trim();
  // simple sanity: something@something.something
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizePhoneDigits(input) {
  const raw = String(input || "");
  const digits = raw.replace(/\D+/g, "");
  // Accept 10 digits (US). If 11 digits and leading 1, drop it.
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function formatPhoneUS(digitsInput) {
  const d = normalizePhoneDigits(digitsInput);
  if (!d) return "";
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${a}) ${b}`.trim();
  return `(${a}) ${b}-${c}`.trim();
}

function passwordHasLetterAndDigit(pw) {
  const s = String(pw || "");
  return /[A-Za-z]/.test(s) && /\d/.test(s);
}


const STAFF_ROLES = ["pv_admin", "pv_support", "pv_qa"];
const DEPTS = ["IT", "FINANCE", "SUPPORT", "EXECUTIVE", "OTHER"];

function isProdBuild() {
  // Vite
  try {
    return String(import.meta?.env?.MODE || "").toLowerCase() === "production";
  } catch {
    return false;
  }
}

function isDraftCreate(fields) {
  return Object.values(fields).some((v) => String(v || "").trim() !== "");
}

export default function AdminTeam() {
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [items, setItems] = React.useState([]);

  // Filters (client-side)
  const [filterQuery, setFilterQuery] = React.useState("");
  const [filterRole, setFilterRole] = React.useState("all");
  const [filterDept, setFilterDept] = React.useState("all");

  // Create form (collapsed by default)
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState("Draft");

  const [cEmail, setCEmail] = React.useState("");
  const [cPassword, setCPassword] = React.useState("");
  const [cPasswordVisible, setCPasswordVisible] = React.useState(false);
  const [cFirstName, setCFirstName] = React.useState("");
  const [cLastName, setCLastName] = React.useState("");
  const [cPhone, setCPhone] = React.useState("");
  const [cRole, setCRole] = React.useState("");
  const [cDept, setCDept] = React.useState("");
  const [cShowPassword, setCShowPassword] = React.useState(false);
  const [cFieldErrs, setCFieldErrs] = React.useState({});

  // Per-row password visibility + field errors
  const [showPwById, setShowPwById] = React.useState({}); // { [id]: boolean }
  const [rowFieldErrById, setRowFieldErrById] = React.useState({}); // { [id]: { field: msg } }

  // Row expand/edit
  const [expandedById, setExpandedById] = React.useState({});
  const [editById, setEditById] = React.useState({}); // { [id]: { firstName,lastName,systemRole,department,password } }
  const [rowBusyById, setRowBusyById] = React.useState({});
  const [rowErrById, setRowErrById] = React.useState({});
  const [rowStatusById, setRowStatusById] = React.useState({}); // { [id]: "Draft" | "Saved" }
  const [pwdVisibleById, setPwdVisibleById] = React.useState({}); // { [id]: boolean }
  const [copyStateById, setCopyStateById] = React.useState({}); // idle/copied/failed

  const prod = isProdBuild();

  function clearCreate(nextOpen) {
    setCEmail("");
    setCPassword("");
    setCFirstName("");
    setCLastName("");
    setCPhone("");
    setCRole("");
    setCDept("");
    setCreateStatus("Draft");
    setCShowPassword(false);
    setCFieldErrs({});
    if (typeof nextOpen === "boolean") setCreateOpen(nextOpen);
  }

  function bumpCreateDraft() {
    setCreateStatus("Draft");
  }

  async function load() {
    setLoading(true);
    setErr("");

    const sysRole = getSystemRole();
    if (sysRole !== "pv_admin") {
      setItems([]);
      setErr("This page is for pv_admin only.");
      setLoading(false);
      return;
    }

    try {
      pvUiHook("screen.enter", { screen: "AdminTeam" });

      const res = await adminListTeam();
      const list = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];

      setItems(list);

      // Prime edit drafts
      const drafts = {};
      list.forEach((u) => {
        if (!u?.id) return;
        drafts[u.id] = {
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          phone: u.phoneRaw ?? u.phoneE164 ?? "",
          systemRole: u.systemRole ?? "",
          department: u.department ?? "",
          password: "",
        };
      });
      setEditById(drafts);

      pvUiHook("admin.team.list_load_succeeded.ui", {
        stable: "admin.team:list",
        count: list.length,
      });
    } catch (e) {
      const msg = e?.message || "Failed to load team";
      setErr(msg);
      pvUiHook("admin.team.list_load_failed.ui", {
        stable: "admin.team:list",
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRefresh() {
    setBusy(true);
    try {
      await load();
    } finally {
      setBusy(false);
    }
  }


  function setDraft(id, patch) {
    setEditById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));

    // Any edit implies "Draft" again (clears saved banner)
    if (id) {
      setRowStatusById((p) => ({ ...p, [id]: "Draft" }));
    }
  }

  async function onCreate({ keepOpen } = { keepOpen: false }) {
    setErr("");

    const sysRole = getSystemRole();
    if (sysRole !== "pv_admin") {
      setErr("This action is for pv_admin only.");
      return;
    }

    const email = safeTrim(cEmail).toLowerCase();
    const password = String(cPassword || "");
    const firstName = safeTrim(cFirstName);
    const lastName = safeTrim(cLastName);
    const phoneRaw = safeTrim(cPhone);
    const phoneDigits = normalizePhoneDigits(phoneRaw);
    const systemRole = safeTrim(cRole);
    const department = safeTrim(cDept);

    if (!email) {
      setErr("Email is required.");
      return;
    }
    if (!isValidEmailSimple(email)) {
      setErr("Email must be a valid address (example@domain.com).");
      return;
    }
    if (!password || password.length < 10) {
      setErr("Temporary password must be at least 10 characters.");
      return;
    }
    if (!passwordHasLetterAndDigit(password)) {
      setErr("Temporary password must include at least one letter and one number.");
      return;
    }
    if (!phoneRaw) {
      setErr("Phone is required.");
      return;
    }
    if (phoneDigits.length !== 10) {
      setErr("Phone must be 10 digits (US).");
      return;
    }
    if (!systemRole) {
      setErr("Role is required.");
      return;
    }
    if (prod && systemRole === "pv_qa") {
      setErr("pv_qa is disabled in production.");
      return;
    }

    setBusy(true);
    pvUiHook("admin.team.create_start.ui", {
      stable: "admin.team:create",
      email,
      systemRole,
      department: department || null,
    });

    try {
      await adminCreateTeamMember({
        email,
        password,
        firstName: firstName || null,
        lastName: lastName || null,
        phoneRaw: phoneDigits, // normalized digits; backend may ignore until enabled
        systemRole,
        department: department || null,
      });

      // Always refresh from server after create
      await load();

      setCreateStatus("Saved");

      // Clear all fields (per spec)
      clearCreate(Boolean(keepOpen));

      // If we keep it open, keep status briefly visible as "Saved"
      if (keepOpen) {
        setCreateStatus("Saved");
        window.setTimeout(() => setCreateStatus("Draft"), 2500);
      }

      pvUiHook("admin.team.create_succeeded.ui", {
        stable: "admin.team:create",
        userId: null,
      });
    } catch (e) {
      const msg = e?.message || "Failed to create team member";
      setErr(msg);
      pvUiHook("admin.team.create_failed.ui", {
        stable: "admin.team:create",
        error: msg,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveRow(id) {
    if (!id) return;
    setRowErrById((p) => ({ ...p, [id]: "" }));
    setRowFieldErrById((p) => ({ ...p, [id]: {} }));

    const draft = editById[id] || {};
    const firstName = draft.firstName === "" ? null : safeTrim(draft.firstName);
    const lastName = draft.lastName === "" ? null : safeTrim(draft.lastName);
    const phoneRaw = draft.phone === "" ? null : safeTrim(draft.phone);
    const phoneDigits = normalizePhoneDigits(phoneRaw);
    const systemRole = safeTrim(draft.systemRole);
    const department = draft.department === "" ? null : safeTrim(draft.department);

    if (!department) {
      setRowFieldErrById((p) => ({ ...p, [id]: { ...(p[id] || {}), department: "Department is required for staff accounts." } }));
      setRowErrById((p) => ({ ...p, [id]: "Department is required for staff accounts." }));
      return;
    }
    const password = String(draft.password || "");

    if (!systemRole) {
      setRowErrById((p) => ({ ...p, [id]: "Role is required." }));
      return;
    }
    if (prod && systemRole === "pv_qa") {
      setRowErrById((p) => ({ ...p, [id]: "pv_qa is disabled in production." }));
      return;
    }
    if (password && password.length < 10) {
      setRowErrById((p) => ({ ...p, [id]: "Password must be at least 10 characters." }));
      return;
    }
    if (password && !passwordHasLetterAndDigit(password)) {
      setRowErrById((p) => ({ ...p, [id]: "Password must include at least one letter and one number." }));
      return;
    }
    if (phoneRaw && phoneDigits.length !== 10) {
      setRowErrById((p) => ({ ...p, [id]: "Phone must be 10 digits (US)." }));
      return;
    }

    const patch = {
      firstName,
      lastName,
      phoneRaw: phoneDigits,
      systemRole,
      department,
    };
    if (password) patch.password = password;

    setRowBusyById((p) => ({ ...p, [id]: true }));
    pvUiHook("admin.team.patch_start.ui", {
      stable: "admin.team:patch",
      userId: id,
      fields: Object.keys(patch),
    });

    try {
      const updated = await adminUpdateTeamMember(id, patch);

      // Update list
      setItems((prev) => prev.map((u) => (String(u?.id) === String(id) ? updated : u)));

      // Clear password in draft
      setDraft(id, { password: "" });      // Show success in the same card area (do not auto-collapse)
      setRowStatusById((p) => ({ ...p, [id]: "Saved" }));
      pvUiHook("admin.team.patch_succeeded.ui", {
        stable: "admin.team:patch",
        userId: id,
      });
    } catch (e) {
      const msg = e?.message || "Failed to update team member";
      setRowErrById((p) => ({ ...p, [id]: msg }));
      pvUiHook("admin.team.patch_failed.ui", {
        stable: "admin.team:patch",
        userId: id,
        error: msg,
      });
    } finally {
      setRowBusyById((p) => ({ ...p, [id]: false }));
    }
  }

  async function onCopyDiagnostics(id) {
    if (!id) return;
    const u = items.find((x) => x?.id === id) || null;
    if (!u) return;

    const payload = {
      screen: "AdminTeam",
      capturedAt: new Date().toISOString(),
      user: u,
    };

    try {
      if (!navigator?.clipboard?.writeText) throw new Error("clipboard_api_missing");
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStateById((p) => ({ ...p, [id]: "copied" }));
      window.setTimeout(() => setCopyStateById((p) => ({ ...p, [id]: "idle" })), 1500);
    } catch {
      setCopyStateById((p) => ({ ...p, [id]: "failed" }));
    }
  }

  const sysRole = getSystemRole();
  const roleOptions = prod ? STAFF_ROLES.filter((r) => r !== "pv_qa") : STAFF_ROLES;

  const createFields = React.useMemo(
    () => ({
      email: cEmail,
      password: cPassword,
      firstName: cFirstName,
      lastName: cLastName,
      phone: cPhone,
      systemRole: cRole,
      department: cDept,
    }),
    [cEmail, cPassword, cFirstName, cLastName, cPhone, cRole, cDept]
  );

  const createIsDraft = isDraftCreate(createFields);

  const roleFilterOptions = React.useMemo(() => {
    const s = new Set();
    (items || []).forEach((u) => {
      const r = safeTrim(u?.systemRole);
      if (r) s.add(r);
    });
    return Array.from(s).sort();
  }, [items]);

  const deptOptions = React.useMemo(() => {
    const s = new Set();
    (items || []).forEach((u) => {
      const d = safeTrim(u?.department);
      if (d) s.add(d);
    });
    return Array.from(s).sort();
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const q = safeTrim(filterQuery).toLowerCase();
    const role = safeTrim(filterRole || "all");
    const dept = safeTrim(filterDept || "all");

    return (items || []).filter((u) => {
      if (role !== "all" && safeTrim(u?.systemRole) !== role) return false;
      if (dept !== "all" && safeTrim(u?.department) !== dept) return false;
      if (!q) return true;

      const phoneDigits = normalizePhoneDigits(u?.phoneRaw || u?.phoneE164 || "");
      const hay = [
        safeTrim(u?.email),
        safeTrim(u?.firstName),
        safeTrim(u?.lastName),
        safeTrim(u?.systemRole),
        safeTrim(u?.department),
        phoneDigits,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, filterQuery, filterRole, filterDept]);

  function clearFilters() {
    setFilterQuery("");
    setFilterRole("all");
    setFilterDept("all");
  }

  
  // ---- Mutual Exclusivity + Dirty Protection ----


  function isRowDirty(id) {
    const draft = editById[id];
    const original = items.find((u) => u.id === id);
    if (!draft || !original) return false;

    return (
      draft.firstName !== original.firstName ||
      draft.lastName !== original.lastName ||
      draft.systemRole !== original.systemRole ||
      draft.department !== original.department ||
      draft.phone !== normalizePhoneDigits(original.phoneRaw || original.phoneE164 || "") ||
      (draft.password && draft.password.length > 0)
    );
  }

  function confirmDiscard() {
    pvUiHook("admin.team.discard_prompt.ui", { stable: "admin.team:discard_prompt" });
    return window.confirm(
      "You have unsaved changes. If you continue, your changes will be lost."
    );
  }

  function toggleCreateGuarded() {
    const openRowId = Object.keys(expandedById || {}).find((k) => expandedById[k]);

    // Opening create
    if (!createOpen) {
      if (openRowId) {
        if (isRowDirty(Number(openRowId))) {
          if (!confirmDiscard()) return;
        }
        setExpandedById({});
      }

      // Remember scroll so collapse returns to where you were.
      try {
        scrollPosCreateRef.current = window.scrollY;
      } catch {
        // ignore
      }

      pvUiHook("admin.team.create_toggle.ui", {
        stable: "admin.team:create_ui",
        open: true,
      });

      setCreateOpen(true);
      return;
    }

    // Closing create
    if ((createStatus === "Draft")) {
      if (!confirmDiscard()) return;
    }

    pvUiHook("admin.team.create_toggle.ui", {
      stable: "admin.team:create_ui",
      open: false,
    });

    setCreateOpen(false);
    clearCreate(false);

    // Restore prior scroll position (predictable collapse behavior)
    window.setTimeout(() => {
      try {
        if (typeof scrollPosCreateRef.current === "number") {
          window.scrollTo(0, scrollPosCreateRef.current);
        }
      } catch {
        // ignore
      }
    }, 0);
  }

  function toggleRowGuarded(id) {
    if (!id) return;

    const currentlyOpenId = Object.keys(expandedById || {}).find((k) => expandedById[k]);

    // If Create is open, close it (guarding dirty)
    if (createOpen) {
      if ((createStatus === "Draft")) {
        if (!confirmDiscard()) return;
      }
      setCreateOpen(false);
      clearCreate(false);
    }

    // If another row is open and dirty, guard
    if (currentlyOpenId && Number(currentlyOpenId) !== id) {
      if (isRowDirty(Number(currentlyOpenId))) {
        if (!confirmDiscard()) return;
      }
    }

    const wasOpen = Boolean(expandedById?.[id]);

    if (wasOpen) {
      // Collapse → restore prior scroll position
      setExpandedById({});
      pvUiHook("admin.team.row_expanded.ui", {
        stable: "admin.team:row",
        userId: id,
        expanded: false,
      });

      window.setTimeout(() => {
        try {
          const y = scrollPosByRowIdRef.current?.[id];
          if (typeof y === "number") window.scrollTo(0, y);
        } catch {
          // ignore
        }
      }, 0);

      return;
    }

    // Opening this row: remember scroll position
    try {
      scrollPosByRowIdRef.current[id] = window.scrollY;
    } catch {
      // ignore
    }

    setExpandedById({ [id]: true });
    pvUiHook("admin.team.row_expanded.ui", {
      stable: "admin.team:row",
      userId: id,
      expanded: true,
    });
  }



  // ---- Scroll expanded row into view (so card isn't cut off at bottom) ----
  const rowPanelRefs = React.useRef({});
  const scrollPosByRowIdRef = React.useRef({});
  const scrollPosCreateRef = React.useRef(null);

  React.useEffect(() => {
    const openId = Object.keys(expandedById || {}).find((k) => expandedById[k]);
    if (!openId) return;
    const el = rowPanelRefs.current?.[openId];
    if (!el) return;

    // Defer to allow layout to expand before scrolling.
    window.setTimeout(() => {
      try {
        el.scrollIntoView({ block: "start", behavior: "smooth" });
        // offset for sticky header/nav
        window.scrollBy(0, -120);
      } catch {
        // ignore
      }
    }, 0);
  }, [expandedById]);

  return (
    <div style={styles.page}>
      {/* Placeholder color + a11y autofill control */}
      <style>{`
        .pvInput::placeholder { color: rgba(11,42,51,0.35); }
        .pvSelect { color: ${NAVY}; }
      `}</style>

      <div style={styles.frame}>
        <div style={styles.elevatedPanel}>
          <div style={styles.headerRow}>
            <div>
              <h2 style={{ margin: 0 }}>PerkValet Team</h2>
              <div style={styles.muted}>Manage internal staff accounts (Admin, Support, QA).</div>
            </div>

            <button onClick={onRefresh} disabled={loading || busy} style={styles.refreshBtn}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {sysRole !== "pv_admin" ? (
            <div style={styles.errBox}>This page is for pv_admin only.</div>
          ) : null}

          {err ? <div style={styles.errBox}>{err}</div> : null}

          {/* Create (collapsed by default) */}
          <div style={styles.createShell}>
            <button
              type="button"
              onClick={() => toggleCreateGuarded()}
              style={styles.createBar}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={styles.caretPill}>{createOpen ? "▲" : "▼"}</span>
                <span style={{ fontWeight: 900 }}>Create team member</span>
              </div>
            </button>

            {createOpen ? (
              <div style={styles.createPanel}>
                <div style={styles.createPanelTop}>
                  <div style={styles.createPanelTitle}>Create team member</div>
                  <div style={createStatus === "Saved" ? styles.statusSaved : styles.statusDraft}>
                    {createStatus === "Saved" ? "Saved ✓" : "Draft"}
                  </div>
                </div>

                                <div style={styles.grid}>
                  <div>
                    <label style={styles.label}>Email</label>
                    <input
                      style={styles.input}
                      className="pvInput"
                      value={cEmail}
                      onChange={(e) => {
                        setCEmail(e.target.value);
                        bumpCreateDraft();
                      }}
                      placeholder="name@company.com"
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="email"
                      maxLength={320}
                    />
                    {cFieldErrs?.email ? <div style={styles.fieldErr}>{cFieldErrs.email}</div> : null}
                  </div>

                  <div>
                    <label style={styles.label}>System role</label>
                    <select
                      style={styles.select}
                      className="pvSelect"
                      value={cRole}
                      onChange={(e) => {
                        setCRole(e.target.value);
                        bumpCreateDraft();
                      }}
                    >
                      <option value="">Select role</option>
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {cFieldErrs?.systemRole ? <div style={styles.fieldErr}>{cFieldErrs.systemRole}</div> : null}
                  </div>

                  <div>
                    <label style={styles.label}>Temporary password</label>
                    <div style={styles.passwordWrap}>
                      <input
                        style={styles.input}
                        className="pvInput"
                        value={cPassword}
                        onChange={(e) => {
                          setCPassword(e.target.value);
                          bumpCreateDraft();
                        }}
                        placeholder="min 10 characters"
                        type={cPasswordVisible ? "text" : "password"}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setCPasswordVisible((v) => !v)}
                        style={styles.eyeBtn}
                        aria-label={cPasswordVisible ? "Hide password" : "Show password"}
                        title={cPasswordVisible ? "Hide" : "Show"}
                      >
                        {cPasswordVisible ? "🙈" : "👁"}
                      </button>
                    </div>
                    {cFieldErrs?.password ? <div style={styles.fieldErr}>{cFieldErrs.password}</div> : null}
                  </div>

                  <div>
                    <label style={styles.label}>Department</label>
                    <select
                      style={styles.select}
                      className="pvSelect"
                      value={cDept}
                      onChange={(e) => {
                        setCDept(e.target.value);
                        bumpCreateDraft();
                      }}
                    >
                      <option value="">Select department</option>
                      {DEPTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {cFieldErrs?.department ? <div style={styles.fieldErr}>{cFieldErrs.department}</div> : null}
                  </div>

                  <div>
                    <label style={styles.label}>
                      First name<span style={styles.reqMark}>*</span>
                    </label>
                    <input
                      style={styles.input}
                      className="pvInput"
                      value={cFirstName}
                      onChange={(e) => {
                        setCFirstName(e.target.value);
                        bumpCreateDraft();
                      }}
                      placeholder="First name"
                      autoComplete="off"
                      maxLength={100}
                    />
                    {cFieldErrs?.firstName ? <div style={styles.fieldErr}>{cFieldErrs.firstName}</div> : null}
                  </div>

                  <div>
                    <label style={styles.label}>
                      Last name<span style={styles.reqMark}>*</span>
                    </label>
                    <input
                      style={styles.input}
                      className="pvInput"
                      value={cLastName}
                      onChange={(e) => {
                        setCLastName(e.target.value);
                        bumpCreateDraft();
                      }}
                      placeholder="Last name"
                      autoComplete="off"
                      maxLength={100}
                    />
                    {cFieldErrs?.lastName ? <div style={styles.fieldErr}>{cFieldErrs.lastName}</div> : null}
                  </div>

                  <div>
                    <label style={styles.label}>Phone *</label>
                    <input
                      style={styles.input}
                      className="pvInput"
                      value={formatPhoneUS(cPhone)}
                      onChange={(e) => {
                        setCPhone(e.target.value);
                        bumpCreateDraft();
                      }}
                      placeholder="(555) 123-4567"
                      autoComplete="off"
                      inputMode="tel"
                      maxLength={32}
                    />
                    {cFieldErrs?.phone ? <div style={styles.fieldErr}>{cFieldErrs.phone}</div> : null}
                  </div>

                  <div />
                </div>

                <div style={styles.createActions}>
                  <button
                    onClick={() => onCreate({ keepOpen: true })}
                    disabled={busy || loading || sysRole !== "pv_admin"}
                    style={styles.primaryBtn}
                  >
                    {busy ? "Saving..." : "Save"}
                  </button>

                  <button
                    onClick={() => onCreate({ keepOpen: true })}
                    disabled={busy || loading || sysRole !== "pv_admin"}
                    style={styles.ghostBtn}
                  >
                    Save + Add Another
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      pvUiHook("admin.team.create_close.ui", { stable: "admin.team:create_ui" });
                      clearCreate(false);
                    }}
                    disabled={busy}
                    style={styles.ghostBtn}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Filters */}
          <div style={styles.filterBar}>
            <input
              style={{ ...styles.input, flex: 1, margin: 0 }}
              className="pvInput"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search email, name, phone, role, dept…"
              autoComplete="off"
            />

            <select
              style={{ ...styles.select, width: 160 }}
              className="pvSelect"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="all">All roles</option>
              {roleFilterOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              style={{ ...styles.select, width: 160 }}
              className="pvSelect"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="all">All depts</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <button
              type="button"
              style={styles.secondaryBtn}
              className="pvBtnSecondary"
              onClick={clearFilters}
              disabled={filterRole === "all" && filterDept === "all" && safeTrim(filterQuery) === ""}
              title="Clear filters"
            >
              Clear
            </button>
          </div>

          {/* List (scroll only when required) */}
          <div style={styles.scrollArea}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>Created</th>
                  <th style={{ ...styles.th, width: 56 }} />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} style={styles.empty}>
                      No staff users found.
                    </td>
                  </tr>
                ) : null}

                {filteredItems.map((u) => {
                  const id = u?.id;
                  const expanded = id ? Boolean(expandedById[id]) : false;
                  const draft = id ? editById[id] || {} : {};
                  const rowBusy = id ? Boolean(rowBusyById[id]) : false;
                  const rowErr = id ? rowErrById[id] || "" : "";
                  const copyState = id ? copyStateById[id] || "idle" : "idle";

                  return (
                    <React.Fragment key={id || u?.email}>
                      <tr id={id ? `pv-team-row-${id}` : undefined}>
                        <td style={styles.tdPrimary}>
                          <div style={styles.cellStack}>
                            <div>{u?.email || "—"}</div>
                            {(u?.firstName || u?.lastName || u?.phoneRaw || u?.phoneE164) ? (
                              <div style={styles.cellSub}>
                                {[u?.firstName, u?.lastName].filter(Boolean).join(" ") || ""}
                                {u?.phoneRaw ? (" • " + String(u.phoneRaw)) : u?.phoneE164 ? (" • " + String(u.phoneE164)) : ""}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td style={styles.tdCode}>{u?.systemRole || "—"}</td>
                        <td style={styles.tdCode}>{u?.department || "—"}</td>
                        <td style={styles.td}>{fmt(u?.createdAt)}</td>
                        <td style={styles.caretTd}>
                          {id ? (
                            <button onClick={() => toggleRowGuarded(Number(id))} style={styles.caretBtn} aria-label="Toggle row">
                              <span style={styles.caretGlyph}>{expanded ? "▲" : "▼"}</span>
                            </button>
                          ) : null}
                        </td>
                      </tr>

                      {expanded && id ? (
                        <tr>
                          <td colSpan={5} style={styles.detailCell}>
                            <div id={id ? `pv-team-panel-${id}` : undefined} ref={(el) => { if (id && el) rowPanelRefs.current[String(id)] = el; }} style={styles.detailPanel}>
                              <div style={styles.detailHeader}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ fontWeight: 900 }}>Edit team member</div>
                                  <div style={(rowStatusById[id] === "Saved") ? styles.statusSaved : styles.statusDraft}>
                                    {rowStatusById[id] === "Saved" ? "Saved ✓" : "Draft"}
                                  </div>
                                </div>
                                <div style={styles.detailHeaderRight}>
                                  <button onClick={() => onCopyDiagnostics(id)} style={styles.ghostBtn}>
                                    {copyState === "copied"
                                      ? "Copied"
                                      : copyState === "failed"
                                      ? "Copy failed"
                                      : "Copy diagnostics"}
                                  </button>
                                </div>
                              </div>
                              {rowErr ? <div style={styles.rowErr}>{rowErr}</div> : null}

                              <div style={styles.grid}>
                                <div>
                                  <label style={styles.label}>First name<span style={styles.reqMark}>*</span></label>
                                  <input
                                    style={styles.input}
                                    className="pvInput"
                                    value={draft.firstName ?? ""}
                                    onChange={(e) => setDraft(id, { firstName: e.target.value })}
                                    autoComplete="off"
                                  />
                                </div>

                                <div>
                                  <label style={styles.label}>Last name<span style={styles.reqMark}>*</span></label>
                                  <input
                                    style={styles.input}
                                    className="pvInput"
                                    value={draft.lastName ?? ""}
                                    onChange={(e) => setDraft(id, { lastName: e.target.value })}
                                    autoComplete="off"
                                  />
                                </div>

                                <div>
                                  <label style={styles.label}>Phone</label>
                                  <input
                                    style={styles.input}
                                    className="pvInput"
                                    value={formatPhoneUS(draft.phone ?? "")}
                                    onChange={(e) => setDraft(id, { phone: normalizePhoneDigits(e.target.value) })}
                                    placeholder="(555) 123-4567"
                                    autoComplete="off"
                                    inputMode="tel"
                                    maxLength={32}
                                  />
                                  {rowFieldErrById?.[id]?.phone ? (
                                    <div style={styles.fieldErr}>{rowFieldErrById[id].phone}</div>
                                  ) : null}
                                </div>


                                <div>
                                  <label style={styles.label}>System role</label>
                                  <select
                                    style={styles.select}
                                    className="pvSelect"
                                    value={draft.systemRole ?? ""}
                                    onChange={(e) => setDraft(id, { systemRole: e.target.value })}
                                  >
                                    {roleOptions.map((r) => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                  {rowFieldErrById?.[id]?.department ? (
                                    <div style={styles.fieldErr}>{rowFieldErrById[id].department}</div>
                                  ) : null}
                                </div>

                                <div>
                                  <label style={styles.label}>Department</label>
                                  <select
                                    style={styles.select}
                                    className="pvSelect"
                                    value={draft.department ?? ""}
                                    onChange={(e) => setDraft(id, { department: e.target.value })}
                                  >
                                    <option value="">Select department</option>
                                    {DEPTS.map((d) => (
                                      <option key={d} value={d}>
                                        {d}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label style={styles.label}>New password (optional)</label>
                                  <div style={styles.passwordWrap}>
                                    <input
                                      style={styles.input}
                                      className="pvInput"
                                      value={draft.password ?? ""}
                                      onChange={(e) => setDraft(id, { password: e.target.value })}
                                      placeholder="leave blank to keep unchanged"
                                      type={pwdVisibleById[id] ? "text" : "password"}
                                      autoComplete="new-password"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPwdVisibleById((p) => ({ ...p, [id]: !p[id] }))
                                      }
                                      style={styles.eyeBtn}
                                      aria-label={pwdVisibleById[id] ? "Hide password" : "Show password"}
                                      title={pwdVisibleById[id] ? "Hide" : "Show"}
                                    >
                                      {pwdVisibleById[id] ? "🙈" : "👁"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div style={styles.rowActions}>
                                <button
                                  onClick={() => onSaveRow(id)}
                                  disabled={rowBusy || busy}
                                  style={styles.primaryBtn}
                                >
                                  {rowBusy ? "Saving..." : "Save"}
                                </button>
                                <div style={styles.mutedSmall}>
                                  Updated: <span style={styles.code}>{fmt(u?.updatedAt)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, color: "rgba(11,42,51,0.60)", fontSize: 12 }}>
            Tip: Expand a row to edit role, department, or reset password.
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------
   Styles (LOCKED palette compliant)
-------------------------------------------------- */

const NAVY = "#0B2A33";
const PANEL = "#F4F2ED";

const styles = {
  page: {
    background: color.pageBg,
    color: color.text,
    minHeight: "100%",
  },
  frame: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: 16,
  },
  elevatedPanel: {
    background: color.pageBg,
    border: `1px solid ${color.border}`,
    borderRadius: 18,
    boxShadow: "0 10px 26px rgba(0,0,0,0.05)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  muted: {
    color: "rgba(11,42,51,0.60)",
    marginTop: 4,
    fontWeight: 700,
  },
  mutedSmall: {
    color: "rgba(11,42,51,0.60)",
    fontSize: 12,
    fontWeight: 800,
  },
  refreshBtn: {
    border: `1px solid ${color.border}`,
    background: color.cardBg,
    borderRadius: 12,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 900,
    color: color.text,
  },

  errBox: {
    background: "rgba(180, 40, 40, 0.10)",
    border: "1px solid rgba(180, 40, 40, 0.28)",
    color: "rgba(140, 20, 20, 0.98)",
    padding: 12,
    borderRadius: 14,
    fontWeight: 900,
  },
  rowErr: {
    background: "rgba(180, 40, 40, 0.10)",
    border: "1px solid rgba(180, 40, 40, 0.28)",
    color: "rgba(140, 20, 20, 0.98)",
    padding: 12,
    borderRadius: 14,
    fontWeight: 900,
  },
  fieldErr: {
    marginTop: 6,
    color: "rgba(140, 20, 20, 0.98)",
    fontSize: 12,
    fontWeight: 900,
  },

  createShell: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  createBar: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: color.cardBg,
    border: `1px solid ${color.border}`,
    borderRadius: 16,
    padding: 12,
    cursor: "pointer",
  },
  caretPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#FFFFFF",
    fontWeight: 900,
    lineHeight: "28px",
  },

  createPanel: {
    background: color.cardBg,
    border: `1px solid ${color.borderSubtle}`,
    borderRadius: 16,
    padding: 12,
  },
  createPanelTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  createPanelTitle: { fontWeight: 900, color: NAVY },

  statusDraft: {
    fontSize: 12,
    fontWeight: 900,
    color: NAVY,
    background: PANEL,
    border: "1px solid rgba(0,0,0,0.10)",
    padding: "4px 10px",
    borderRadius: 999,
  },
  statusSaved: {
    fontSize: 12,
    fontWeight: 900,
    color: NAVY,
    background: "rgba(47,143,139,0.12)",
    border: "1px solid rgba(47,143,139,0.25)",
    padding: "4px 10px",
    borderRadius: 999,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(11,42,51,0.70)",
    marginBottom: 6,
  },
  reqMark: {
    marginLeft: 4,
    color: "rgba(140, 20, 20, 0.98)",
    fontWeight: 900,
  },
  input: {
    ...themeInput,
    borderRadius: 12,
    padding: "10px 10px",
  },
  select: {
    ...themeInput,
    borderRadius: 12,
    padding: "10px 10px",
  },

  passwordWrap: { position: "relative", display: "flex", alignItems: "center" },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    border: `1px solid ${color.border}`,
    background: color.cardBg,
    borderRadius: 10,
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: 14,
    lineHeight: "14px",
    fontWeight: 900,
  },

  createActions: {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  primaryBtn: {
    border: "1px solid rgba(0,0,0,0.18)",
    background: "#2F8F8B",
    color: "#FFFFFF",
    borderRadius: 999,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  ghostBtn: {
    border: "1px solid rgba(0,0,0,0.14)",
    background: "#FFFFFF",
    color: NAVY,
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },

  scrollArea: {
    overflowY: "visible",
    overflowX: "auto",
    border: `1px solid ${color.borderSubtle}`,
    borderRadius: 14,
    minHeight: 0,
    maxHeight: "none",
    background: color.pageBg,
  },
  th: {
    padding: 12,
    textAlign: "left",
    background: "#F4F2ED",
    borderBottom: "1px solid rgba(0,0,0,0.10)",
    position: "sticky",
    top: 0,
    zIndex: 2,
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(11,42,51,0.60)",
  },
  td: {
    padding: 12,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    fontSize: 13,
    fontWeight: 800,
    color: NAVY,
  },
  tdPrimary: {
    padding: 12,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    fontSize: 13,
    fontWeight: 800,
    color: NAVY,
  },
  tdCode: {
    padding: 12,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: 800,
    color: NAVY,
  },

  cellStack: { display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.15 },
  cellSub: { color: "rgba(11,42,51,0.55)", fontSize: 12, fontWeight: 800 },

  caretTd: {
    padding: 10,
    textAlign: "right",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    verticalAlign: "middle",
    width: 56,
  },
  caretBtn: {
    border: `1px solid ${color.border}`,
    background: color.cardBg,
    borderRadius: 12,
    width: 34,
    height: 34,
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  caretGlyph: { lineHeight: 1 },

  detailCell: {
    padding: 14,
    background: "rgba(0,0,0,0.02)",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  detailPanel: {
    background: color.cardBg,
    border: `1px solid ${color.border}`,
    borderRadius: 16,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  detailHeaderRight: { display: "flex", alignItems: "center", gap: 8 },

  rowActions: {
    marginTop: 2,
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  empty: {
    padding: 14,
    color: "rgba(11,42,51,0.60)",
    textAlign: "center",
    fontWeight: 800,
  },
  code: { fontFamily: "monospace" },
};
