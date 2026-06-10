# Auth / WeWeRSS / Admin Refactor Handoff

## Implemented In This Pass

- Added task todolist.
- Updated registration API for alphanumeric account, required nickname, 6-18 character password, optional invitation, and `VERIFIED_USER` invitation registration.
- Added account settings APIs for nickname update and invitation upgrade.
- Split frontend login route `/login` from `/admin/login`.
- Updated proxy routing for frontend/admin login and ADMIN-only `/admin/*` pages.
- Added WeWeRSS config helper and removed production localhost fallback from key server routes.
- Added `/admin/dashboard` and `/admin/invitations`.
- Added additive invitation fields: `isEnabled`, `note`, `updatedAt`.

## Verification

- `pnpm test`: passed.
- `pnpm lint`: passed with warnings.
- `pnpm build`: passed.

## Remaining Work

- Finish MissingConfigDialog integration across AI/WeWeRSS UI actions.
- Update and run Playwright E2E.
- Confirm production reverse proxy exposes `http://47.119.182.210/wewerss`.
- Complete any remaining admin invitation edit UX beyond enable/disable.
