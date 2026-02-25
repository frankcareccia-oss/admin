# PV Admin UI Contract (Master) — v1.0 (LOCKED)

**Status:** Locked source of truth for Admin UI look/feel + layout/landscape + row interaction patterns.  
**Applies to:** `C:\Users\frank\perkvalet\admin` (React/Vite Admin Portal)  
**Last updated:** 2026-02-25

## How to use this document (non-negotiable)

Every UI thread (and every UI PR) MUST begin by stating:

- **Contract version:** v1.0
- **Landscape model:** Model B (Single scroll)
- **Row interaction pattern:** A (Navigate) or B (Inline expand), never both
- **Role scope:** which roles can see actions vs read-only surfaces
- **Instrumentation:** pvUiHook events preserved/added (must never throw)

If the thread/PR does not declare these, stop and fix first.

---

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

---

## 2) Page Landscape / App Shell (LOCKED)

### Model B: Single-scroll page (required default)
**Goal:** No “mystery scroll” panes. The browser window scrolls; cards/tables do not own vertical scrolling.

**DO**
- Use `PageContainer` as the only horizontal constraint (`maxWidth`).
- Let the page scroll naturally (document scroll).
- Allow **horizontal** scroll only on tables (`overflowX: auto` wrapper).
- Keep top navigation stable and visually aligned with the `PageContainer` gutter.

**DON’T**
- Don’t create vertical scroll panes inside cards (no `overflowY: auto` for page content).
- Don’t “fix” alignment with ad-hoc margins like `marginRight: 72` on random buttons.
- Don’t allow horizontal page scroll (bottom scrollbar on the whole page is a bug).

### Right-edge / “missing edge” rule
If you see “no edge on the right” or content looks flush:
- Verify `PageContainer` padding is applied to the same parent that contains the screen content.
- Ensure no child wrappers use `width: 100vw` or negative margins.
- Ensure header/tab components don’t exceed container width.

### Bottom horizontal scrollbar rule
If a bottom scrollbar appears:
- Something is wider than the viewport. Common causes:
  - `width: 100vw` on a child inside a padded container
  - Long unbroken strings in a flex row (no wrap)
  - Tab/header components using fixed widths
  - Table wrapper missing `overflowX: auto`

**Fix order**
1) Remove `100vw` usage inside the content area.
2) Add `flexWrap: "wrap"` to pill rows / action rows.
3) Wrap tables with `overflowX: "auto"`.
4) As a last resort, apply `minWidth: 0` to flex children.

---

## 3) PageHeader / Top Controls Contract

### PageHeader
**DO**
- Title: consistent size/weight across pages.
- Subtitle: muted text; one line if possible.
- Right slot: action pills/buttons; aligned; never hugging the right edge (use container gutter, not random per-page offsets).

**DON’T**
- Don’t add right padding hacks per page. If spacing is needed, fix the shared component or shared container rule.

### Section Tabs / Header Pills
**DO**
- Tabs must fit within container width at common breakpoints.
- Use wrapping or responsive collapse before causing horizontal overflow.
- Provide consistent pill sizing; avoid mixed font sizes.

**DON’T**
- Don’t hard-code widths that exceed container.
- Don’t rely on `overflow: hidden` to “hide” the problem.

---

## 4) Row Interaction Patterns (LOCKED)

### Pattern A: Navigate (recommended when a dedicated detail page exists)
- Table rows are not expandable.
- **Only one navigation affordance** (e.g., invoice number is the only link).
- No caret column.
- Detail screen provides a “Back to list” link.
- Return-to-row is implemented.

### Pattern B: Inline Expand (only when no dedicated detail page exists)
- Caret column is allowed as the single expand affordance.
- Expanded content is a single inline card region.
- Inline expand must not introduce nested vertical scroll.
- Actions must be clear buttons, not “hidden behind expand”.

### Prohibited Hybrid
- No caret + link + “View” button simultaneously.
- No row click + caret click simultaneously.
- One row interaction model per screen.

---

## 5) Return-to-Row Standard (LOCKED)

When navigating List → Detail → Back, returning should land the user at the same row.

### Minimum implementation (required)
- Detail page receives a `return=` URL.
- Back link uses that `return=` URL.
- List page accepts `?focus=<rowId>` and scrolls that row into view.

### Recommended implementation (allowed)
- After focusing, briefly highlight the row (≤ 1.5s).
- Remove `focus` from the URL with `navigate(..., { replace: true })` so refresh does not keep jumping.

### Rules
- Focus/scroll must never throw.
- Focus logic must run only once per navigation.
- Focus is driven by row id (stable key), not list index.

---

## 6) Role-aware Copy and Surfaces (LOCKED)

### Read-only vs action
- `pv_admin`, `pv_support`: read-only surfaces unless explicitly stated.
- `pv_ar_clerk`: action surfaces (issue/void/etc.) in dedicated areas.
- `store_admin`: no invoice payment actions; hide/disable invoice actions.

### Role-aware subtitles (example)
- pv_admin Merchants page: “Manage merchant lifecycle and view merchant details.”
- merchant_admin equivalent should be personalized: “Manage your stores and view store details.”

Do not reuse pv_admin copy verbatim where it changes meaning.

---

## 7) Thread Start Template (paste into every new UI thread)

**Thread:** <name>  
**Contract:** PV Admin UI Contract (Master) v1.0  
**Landscape:** Model B (single scroll)  
**Row Pattern:** A or B (choose one)  
**Role scope:** <roles affected>  
**No hacks:** No `100vw` inside container; no per-page right padding hacks; no nested vertical scroll panes  
**Hooks:** pvUiHook preserved/added; must never throw

---

## 8) Repo Hygiene for Contracts

### Replace the bad file (do this once)
`doc/ui/PV-UI-Contract.md` currently contains source code and is not a contract.

**Required action**
- Move it to archive:
  - `doc/ui/_archive/PV-UI-Contract.bad.md`
- Add this master contract as:
  - `doc/ui/PV-Admin-UI-Contract.md`

After that, all references should point to **PV-Admin-UI-Contract.md** only.

