# PerkValet Authorization Contract v1

## Core Rule

Roles grant capabilities.
Capabilities are checked in scope.

Never check role directly.

Correct pattern:

    can("capability.key", { scope })

---

## Namespaces

pv_*  -> PV Org (Global)
mr_*  -> Merchant (Merchant scope)
st_*  -> Store (Store scope)

---

## Visual Rules

- UI never displays role names.
- UI renders based on capability availability.
- No PV Org financial controls inside Merchant UI.
- No Merchant payment logic inside PV Org UI.

---

## Production Safety

pv_qa must be blocked in production via middleware.
