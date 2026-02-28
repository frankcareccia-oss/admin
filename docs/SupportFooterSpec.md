# SupportFooterSpec.md
PerkValet — Global Support / Troubleshooting Footer Specification
Version: v1 (Planning Baseline)
Status: Approved for Next Implementation Thread

---

## 1. Purpose

The Support Footer provides structured, collapsible diagnostic information
available on every authenticated screen of the Admin and Merchant UI.

Goals:
- Help support quickly diagnose user-reported issues
- Provide structured context for future chatbot analysis
- Reduce back-and-forth during troubleshooting
- Avoid exposing sensitive data

This component is informational only.
It must never modify application state.

---

## 2. UX Requirements

### 2.1 Visibility
- Collapsed by default
- Small, subtle link or button: "Support" or "Troubleshooting"
- Fixed to bottom of layout (non-intrusive)
- No bold or attention-grabbing styling

### 2.2 Expansion Behavior
- Click toggles panel open/closed
- Must close when navigating pages (optional enhancement)
- No modal overlay; inline expandable region only

---

## 3. Data Categories (MVP)

All data must be non-sensitive.

### 3.1 Session / Identity
- systemRole (from localStorage)
- Logged-in email (from /me, if available)
- Current route path
- merchantId (if page context includes it)
- storeId (if page context includes it)

### 3.2 Authentication / Device
- JWT present? (boolean only)
- Device ID present? (display first 8 chars only)
- Device verification required? (if available in state)

Never display:
- Full JWT
- Full device UUID
- Passwords
- API keys

### 3.3 Environment
- API_BASE value
- Build tag / version (if available)
- Browser user agent (shortened)
- Viewport size (width x height)

### 3.4 API Diagnostics
- Last API error message (if page exposes one)
- Timestamp of last successful save/fetch (if available)
- Soft 401 events observed (optional future)

---

## 4. Component Architecture

File:
src/components/SupportInfo.jsx

Design:
- Stateless display component
- Accepts optional `context` prop from pages

Example prop shape:

{
  page: "MerchantStoreDetail",
  merchantId: "...",
  storeId: "...",
  lastError: "...",
  lastSuccessTs: "..."
}

Layout:
- Small header row
- Section dividers for categories
- Monospace for values
- Light grey background panel

---

## 5. Global Mounting Strategy

Phase 1 (MVP):
- Mount once in App.jsx or shared layout component
- Auto-detect basic session + environment data

Phase 2:
- Pages pass additional context data

---

## 6. Security Guardrails

Strictly prohibited:
- Full JWT tokens
- Passwords
- Reset tokens
- API keys
- Raw device verification tokens

Allowed:
- Booleans
- Shortened identifiers
- Status flags
- Timestamps

---

## 7. Estimated Effort

MVP component:
~1 hour

Global mounting:
~20 minutes

Future enrichment:
Incremental

---

## 8. Future Enhancements (Optional)

- Copy-to-clipboard diagnostic bundle
- JSON export
- Correlation ID display
- Recent API event buffer
- Auto-attach to support ticket system

---

## 9. Implementation Order (When Started)

1. Build SupportInfo.jsx (standalone)
2. Mount in layout
3. Verify across:
   - Admin screens
   - Merchant screens
   - POS (optional later)
4. Lock baseline tag

---

End of Spec
