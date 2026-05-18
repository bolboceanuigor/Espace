# Tenant Isolation Checklist

Use this checklist after ES-130 changes or before production deploys. Do not run destructive database resets.

## Admin and Staff

- Login as an ADMIN from association A.
- Call `GET /api/admin/context` and confirm the returned `activeAssociation.id` is association A.
- Try to request an apartment ID from association B through an admin endpoint. Expected: `404` or `403`.
- Try to request an invoice/payment/meter ID from association B. Expected: `404` or `403`.
- Set `X-Association-Id` to an association where the user has no ACTIVE membership. Expected: `403`.
- Suspend the staff membership and retry an admin endpoint. Expected: `403` with suspended access message.
- Use a staff member without the required permission for a protected action. Expected: `403`.

## Resident

- Login as a RESIDENT with ACTIVE portal access.
- Call `GET /api/resident/context` and confirm only linked apartments are returned.
- Try to access an invoice for another apartment. Expected: `404` or `403`.
- Try to access meter or meter reading data for another apartment. Expected: `404` or `403`.
- Suspend or revoke portal access and retry resident endpoints. Expected: `403`.

## Superadmin

- Verify global operations are done through `/api/superadmin/*`.
- Verify regular `/api/admin/*` endpoints do not become global for SUPERADMIN without explicit association access.

## Frontend

- Confirm the admin header shows the active APC name/code and role.
- Confirm the admin sidebar hides modules without permissions.
- Confirm the resident header shows the resident's linked APC/apartment.
- Confirm `/ro/403` displays the tenant/permission access message.
