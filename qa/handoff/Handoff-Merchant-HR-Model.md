Thread title: Merchant HR Model – Users, Status, Store Assignment



Goal: Editable merchant-level employee management (no duplicates; reversible lifecycle), including store assignment/reassignment from the merchant Team page.



Locked decisions:



No duplicate users for rehire; status toggles instead.



Employment lifecycle lives on MerchantUser.status (active/suspended/archived).



Store assignment lifecycle lives on StoreUser.status.



Merchant Team page is primary for reassignment.



Current state:



/merchant/users exists and lists employees.



/me returns user + memberships\[]; merchantId comes from memberships\[0].merchantId.



Console shows React list key warning (needs stable row keys).



No edit/reassign UI yet.



Next deliverables:



Backend: expand GET /merchant/users to include store assignments + contact fields.



Backend: add PATCH/PUT endpoints for:



membership role/status (+ reason)



user contact fields (phone required for owner/merchant\_admin/ap\_clerk)



store assignment reassignment/status



UI: MerchantUsers page adds row-select edit drawer:



contact fields



employment status + reason



store reassignment



UI: remove internal IDs from display; show merchant/store names.



Needed inputs to proceed (paste full files):



Backend: the route file that implements /merchant/users (and any service it uses)



Backend: Prisma models for User/MerchantUser/StoreUser (or schema excerpt)



Admin: current src/api/client.js (merchant users section is fine if you prefer)

