# Store Staffing Roadmap (UI Tickets)

Status key:
- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked

---

## Phase 0 — Spec lock + safety rails
- [ ] T0.1 Add “authority boundary” notes/comments in UI pages (Merchant Team vs Store Team)
- [ ] T0.2 Standardize tooltip/info-caret pattern for status explanations

## Phase 1 — Store physical entity completion + gating
- [ ] T1.1 Define “store completeness” rules (required fields list)
- [ ] T1.2 Gate/hide “Staff this store” until complete + saved
- [ ] T1.3 Directive warning when incomplete: “Complete and save all required fields to staff this store.”

## Phase 2 — Employee definition flow (merchant-level)
- [ ] T2.1 Merchant Team/Employees page: list + create employees cleanly
- [ ] T2.2 Employee identity fields: name, email, phone, optional “Ask for”
- [ ] T2.3 Employee status rules + how they affect staffing eligibility

## Phase 3 — Staffing UI (Store Team & Access)
- [ ] T3.1 Assign employee to store (Admin/SubAdmin)
- [ ] T3.2 Remove employee from store
- [ ] T3.3 Primary Contact single-select column (select one clears prior)
- [ ] T3.4 Primary Contact eligibility: only active StoreUser, clear error UX

## Phase 4 — Status semantics + UI clarity
- [ ] T4.1 Introduce store `staging` in UI (while keeping existing statuses working)
- [ ] T4.2 Replace free-text status reason in UI (controlled reasons or none in V1)
- [ ] T4.3 Add info-tooltips for status meanings wherever status is shown/changed

## Phase 5 — Cleanup + schema alignment
- [ ] T5.1 Remove/stop using free-text store contact fields in UI
- [ ] T5.2 Ensure Primary Contact is the only store-contact concept in UI
- [ ] T5.3 Plan/execute any migration/backfill if we decide to remove fields physically

---

## Notes / Decisions Log
- 2026-03-02: Boundaries locked: MerchantUser.role = merchant-wide; StoreUser.permissionLevel = store-local.
- 2026-03-02: Primary Contact is StoreUser (single-select).
- 2026-03-02: “Staff this store” CTA is gated by store completeness + saved.
- 2026-03-02: Introduce store status = `staging` for setup/training.