# Admin Console Design

## Routing

The admin console stays in the same Next.js app under `/admin/*`.

- `/admin/login`: admin login
- `/admin` and `/admin/dashboard`: dashboard
- `/admin/users`: user management
- `/admin/invitations`: invitation management

## Boundaries

- Admin pages use `AdminShell`, not the frontend navigation.
- Page access is guarded in `proxy.ts`; only `ADMIN` can access `/admin/*`.
- Admin APIs remain under `/api/admin/*` and require `ADMIN`.

## User Management

Admins can list users, update role/status, reset passwords, and delete users. The backend prevents disabling, deleting, or demoting the last active administrator.

## Invitation Management

Admins can create invitations with max uses, expiry, enabled state, and note. The invitation list shows used count, remaining count, status, note, and bound users.
