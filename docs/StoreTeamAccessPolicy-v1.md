# Store Team & Access — Policy Baseline (v1)

Status: **LOCKED**  
Scope: PerkValet (PV) access only — **not HR onboarding**.

## 1) Concepts

### Merchant-level PV Identity (Source of Truth)
A person who can authenticate into PerkValet under a merchant.

- Created at the merchant level first.
- Then assigned to one or more stores (store-scoped access).

### Store Assignment (Store Team Member)
A merchant-level PV identity granted access to a specific store with a store role and status.

- Role is per-store.
- Status is per-store.
- No destructive deletes; use status transitions.

## 2) Store Roles (v1)

- pos_employee — operational, in-store usage
- store_admin — privileged store manager
- merchant_admin — merchant owner/admin (global merchant scope)

## 3) POS Employee Access Policy (LOCKED)

Assumption: pos_employee access is in-store only (store devices/terminals).  
There is no expected need for pos_employee to access PV from home or a personal phone.

### Authentication
- Identifier: phone number (server-normalized; UI uses phoneRaw + phoneCountry)
- Enrollment: phone + one-time setup code
- Daily login: phone + 6-digit PIN
- Email is not required for pos_employee

### PIN Rules
- Exactly 6 digits
- Reject weak patterns:
  - sequential (e.g., 123456)
  - repeated (e.g., 111111)
- PIN is stored as a secure hash (never plaintext)

### Session Controls
- pos_employee sessions auto-logout after 10 minutes of inactivity (LOCKED)
- Optional UI affordance: “End Shift” logout button

### Recovery / Reset
- No self-service “forgot PIN” for pos_employee
- PIN reset is merchant_admin only (LOCKED)
- Reset issues a new one-time setup code and forces setting a new 6-digit PIN

### Abuse / Attack Surface Reduction
- Rate-limit setup-code and PIN attempts
- Temporary lockout after repeated failures
- Audit/log events for create/assign/reset/lockout

## 4) Privileged Roles (store_admin / merchant_admin)

- Do not use the lightweight POS employee flow
- Require stronger authentication and security controls (per Security-V1 / device trust policies)
- Role elevation and privileged access changes require merchant_admin control

## 5) Store UI (Team & Access) UX Principles

- PV context only; avoid HR/technical language
- Store UI supports:
  1) Discover/select existing merchant-level PV identities
  2) Create minimal PV identity (merchant-level) and then assign to this store
- Assignment is explicit: role + status (active/disabled)
- No display of E.164 or internal identifiers

## 6) Change Control

Any change to:
- idle timeout
- reset authority
- identifier type (phone/email)
- PIN rules
- role gates

...must be done via a new versioned doc and tagged lock (e.g., StoreTeamAccessPolicy-v2).
