# PerkValet Roles & Capabilities Architecture
Version: 1.0
Status: Authoritative Contract

---

## Executive Summary

PerkValet uses a capability-based authorization model.

Roles are bundles of capabilities.
Capabilities are evaluated within scope.
Roles are never checked directly in new code.

Authorization pattern:

    can("domain.action", { scope })

---

## Context Separation

| Context | URL Surface | Namespace | Scope |
|----------|-------------|------------|--------|
| PV Org | /admin/* | pv_* | Global |
| Merchant | /merchant/* | mr_* | Merchant |
| Store | /store/* | st_* | Store |

Hard Rule:
- PV Org and Merchant contexts must never mix responsibilities.

---

## Scope Hierarchy

1. Global
2. Merchant
3. Store

Store scope implies merchant.
Merchant scope does not automatically imply store permissions.

---

## Capability Naming Standard

Format:

    domain.verb[.subverb]

Examples:

Billing:
- invoice.view
- invoice.pay
- invoice.issue
- invoice.void

Merchant:
- merchant.user.invite
- merchant.profile.edit

Promotions:
- promo.create
- promo.publish
- promo.media.upload

Integration:
- integration.square.catalog.read
- integration.square.catalog.map

---

## Governance Rules

1. No direct role-string checks in new code.
2. All new features must define capability keys first.
3. Capability keys cannot be casually renamed.
4. pv_qa must be blocked in production.

---

## Future Expansion

Designed to support:
- Multi-store merchants
- Promotion lifecycle
- Marketing teams
- Approval workflows
- AI/Chatbot scoped access
