# PV Admin UI Style Guide (Canonical)

This document defines the canonical look/feel and interaction patterns for PerkValet Admin UI pages.
Use this guide for all new/updated admin screens to keep the product cohesive and predictable.

---

## 1) Visual Tokens (Canonical)

Use these values (or equivalents) consistently.

- Page background: `#FEFCF7`
- Card surface: `#FFFFFF`
- Primary text (navy): `#0B2A33`
- Muted text: `rgba(11,42,51,0.60)`
- Border: `rgba(0,0,0,0.10)`
- Divider: `rgba(0,0,0,0.06)`
- Primary accent (teal): `#2F8F8B`
- Accent hover: `#277D79`

### Feedback states
- Error background: `rgba(255,0,0,0.06)`
- Error border: `rgba(255,0,0,0.15)`
- Success/confirmation background: `rgba(47,143,139,0.10)`
- Success/confirmation border: `rgba(47,143,139,0.50)`

### Standard radii
- Cards: `14px`
- Buttons: `10px`
- Pills/chips: `999px`

---

## 2) Typography & Hierarchy

- Page title: `<h2>` with tight margins (top 0, bottom ~6)
- Subheader/help text:
  - Font size: 12–14
  - Color: muted token
- Code-like values (IDs, roles, states):
  - Monospace stack:
    `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
  - Font size: 12
  - Use sparingly

---

## 3) Page Layout

### Frame
- Use a centered/narrow frame to keep content readable:
  - `maxWidth: 980px`
- Do not let primary content stretch edge-to-edge.

### Header row pattern
Use a consistent header row:
- `display: flex`
- `justify-content: space-between`
- `align-items: baseline`
- `gap: 12px`
- `flex-wrap: wrap`

Primary actions live on the right side of the header row (Refresh, Create, etc.) without overflow.

### Cards
Cards are used for sections.
- Border: `1px solid border token`
- Radius: 14px
- Padding: 14px
- Background: surface token

---

## 4) Scrolling Strategy (Default)

Default is **Option A: page scroll**.
- Avoid nested scroll containers unless there is a deliberate fixed header/column requirement.
- If you must use an inner scroll area, it must be the **only vertical scrollbar** in the content region.

---

## 5) Actions: Pills vs Buttons

- **Primary actions** (Save, Create, Issue, etc.) use a consistent button style:
  - Solid weight (fontWeight 800+)
  - No absolute-position overlays
  - Never “float” over a header
- Navigation uses links/breadcrumbs (e.g., “← Back to …”)
- Use pills/chips for light toggles or secondary actions (Advanced, Filter chips, etc.)

---

## 6) Expand/Collapse & Mutually Exclusive Cards

Where applicable:
- Only **one expanded row** at a time.
- If a “Create” panel is open, row expansion is blocked (and vice versa).
- When switching panels and there are unsaved edits:
  - Prompt user to discard changes.

---

## 7) Filters & Search Contract (Canonical)

### 7.1 Purpose
Filters/search are required on any list expected to grow beyond ~20–30 rows.

### 7.2 Search behavior
- One text search box with placeholder:
  - `Search email, name, phone, role, status…` (tailor fields to the page)
- Search matches on a normalized “haystack”:
  - `lowercase(trim(value))`
  - phone: digits-only and formatted variants if shown
- For very large lists:
  - Optional: debounce 150–250ms
  - Client-side filtering is OK for small-to-medium lists; prefer server-side for very large lists

### 7.3 Filter controls
- Use dropdowns for enumerations:
  - Role, Status, Department, Invoice State, etc.
- Always include an `All` option per filter.
- Provide a **Clear** action that resets search + all filters.

### 7.4 Filter ordering (recommended)
1) Search box
2) Enum dropdown filters (Role/Status/etc.)
3) Clear button

---

## 8) Status Reason Pattern (Canonical)

When a record has “status reason”:
- Provide a dropdown with common reasons
- Provide free-text “Other details” input (enabled always or only when “Other” chosen)
- Store/submit both fields:
  - `statusReasonCode` (dropdown value)
  - `statusReasonText` (free text)

---

## 9) Encoding Rules (Non-negotiable)

To prevent mojibake like `â†`:
- All `.js/.jsx/.ts/.tsx/.md` files must be saved as **UTF-8 (no BOM)**.
- Avoid “smart” punctuation introduced by editors.
- If a glyph must be used (e.g., `←`), ensure encoding is correct across the repo.

---

## 10) Hooks

Preserve PV hooks:
- `pvUiHook(...)` must never throw.
- Add hooks for key UI actions (filter changed, save succeeded/failed, expand toggled) where appropriate.