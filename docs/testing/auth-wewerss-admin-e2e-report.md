# Auth / WeWeRSS / Admin Test Report

## Verified So Far

- `pnpm test`: 49 files, 310 tests passed.
- Focused tests added for registration, login, account nickname update, invitation upgrade, and WeWeRSS config helper.
- `pnpm lint`: passed with existing warnings.
- `pnpm build`: passed and generated `/login`, `/admin/dashboard`, `/admin/invitations`, `/api/settings/account`, and `/api/settings/account/upgrade`.

## Pending

- Update Playwright specs to the new `/login` and numeric-account behavior.
- Run `pnpm exec playwright test`.
- Add browser evidence for registration, nickname update, invitation upgrade, admin invitations, and WeWeRSS missing-config dialog.
