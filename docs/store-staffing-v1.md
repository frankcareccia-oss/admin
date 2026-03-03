# PerkValet V1 — Store + Staffing Model (Source of Truth)

Status: LOCKED  
Last updated: 2026-03-02  
Owner: Product/UI

---

## 1. Purpose

Define the canonical V1 flows and boundaries for:
- Store (physical location) definition and maintenance
- Merchant employee creation (people)
- Store staffing (assigning people to stores)
- Store Primary Contact behavior

This document is the single source of truth for UI + API contract expectations.

---

## 2. Core Entities

### 2.1 Store (physical location)
A Store represents a physical location and its attributes (name, address, phones, status).

### 2.2 Employee (person identity)
An Employee is a `User` with person-level identity fields (name, phone, etc).

### 2.3 Merchant-level membership
`MerchantUser` links a `User` to a `Merchant` and assigns a **merchant-level role**.

### 2.4 Store-level membership (staffing)
`StoreUser` links a `MerchantUser` to a `Store` and assigns **store permission**.

### 2.5 Primary Contact
Primary Contact is the store’s official point of contact and must be an **assigned StoreUser**.

Implementation:
- `Store.primaryContactStoreUserId` references `StoreUser.id`

Rule:
- Exactly one StoreUser may be Primary Contact per Store (or none if not set).
- Setting a new Primary Contact automatically clears the old one.

---

## 3. Authority Boundaries (LOCKED)

### 3.1 MerchantUser.role controls merchant-wide powers
Examples:
- Billing / invoices / payment methods (merchant aggregated; stores show as line items)
- Create/invite/disable employees (merchant team management)
- Merchant-wide settings (POS integrations, global policies)
- (Optional policy) ability to create stores, if restricted in future

### 3.2 StoreUser.permissionLevel controls store-local powers
Examples:
- Store settings (location details)
- Staffing the store (assign/remove staff)
- Set Primary Contact for the store

Principle:
- Merchant role = “corporate powers”
- Store permission = “location powers”

---

## 4. Required UX Flows (LOCKED)

### Flow A — Define and maintain a physical store
1) Merchant navigates to Stores list  
2) Create store in **staging** (setup/training phase)  
3) Fill required physical attributes  
4) Once complete + saved, the store becomes eligible to staff

UI rule (gating):
- Do NOT show the “Staff this store” CTA until store is complete and saved.
- If incomplete, show a directive message explaining staffing is unavailable until required fields are completed and saved.

### Flow B — Create employees (merchant-level)
1) Merchant navigates to Merchant Team / Employees  
2) Add employees to merchant (creates `MerchantUser`)  
3) Employees exist independently of store assignments

### Flow C — Staff a store (store-level)
1) Merchant opens store Team & Access  
2) Assign employees to store with permission level (Admin/SubAdmin in V1)  
3) Set Primary Contact using a single-select control (select one clears prior)

---

## 5. Store Status Semantics (LOCKED)

We introduce `staging` for store setup/training.

Interpretations:
- `staging` = being set up / training; not “live”
- `active` = live/operational
- `suspended` = merchant cancelled PV or invoice/payment issue (platform-imposed)
- `archived` = removed from use / historical

UI expectations:
- Status definitions are explained via info-tooltips next to status controls.
- Avoid free-text status reason in V1 UI (use controlled reasons where needed).

Billing note:
- Billing is merchant-level; stores appear as line items. Store status mainly affects UI + operational gating in V1.

---

## 6. Phone + Contact Strategy (LOCKED)

### 6.1 Store phone (location-level)
Store keeps:
- Store public phone (location-level)

### 6.2 Primary Contact (assigned employee)
Store contact should not rely on free-text “contact person” fields long-term.
Instead:
- Primary Contact is a staffed employee (StoreUser)
- Display their person identity fields

### 6.3 “Whom to ask for”
“Whom to ask for” (a display/ask-for property) belongs to the employee identity, not the store model.
This prevents polluting the store physical model/page and supports multi-store staff.

---

## 7. UI Page Responsibilities (LOCKED)

### Stores list page
- Lists stores and summary attributes
- Caret expands for physical store details edit/view
- Shows “Staff this store” only when store is complete + saved

### Store detail page
Tabs:
- Settings (physical store details)
- Team & Access (staffing + primary contact)

### Merchant Team / Employees page
- Creates and manages merchant employees
- Does not assign to stores (store assignment happens from store context)

---

## 8. Non-goals (V1)
- Advanced RBAC beyond Admin/SubAdmin at store level
- Multi-contact routing models (call trees, departments)
- Fully automated billing behavior tied to store status