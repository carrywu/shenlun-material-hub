# Batch 10: Sync Security

## Goal

Fix IMA sync and SyncRecord owner isolation.

## Scope

- `src/services/ima-sync.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/articles/[id]/sync-to-ima/route.ts`
- related tests
- e2e sync/api-security specs

## Requirements

- `syncMaterialCard` checks owner at service layer.
- `syncMaterialCard` excludes archived cards.
- `syncArticle` only syncs current user's own confirmed non-archived cards.
- `getSyncStatus` enforces userId or ADMIN management access.
- `getSyncHistory` enforces card owner or ADMIN management access.
- ADMIN cannot sync other users' cards into own IMA.
- Missing personal IMA target must fail with a clear configuration error.
- Env/global IMA fallback is forbidden.

## Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/sync-records.spec.ts
```
