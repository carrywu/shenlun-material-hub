# Database Migration Drift Reconciliation Report

**Date:** 2026-06-12
**Task:** P1-005
**Migration:** `20260612000003_backfill_drift`

## Problem

The local development database contained 7 tables and several column/index changes that were not recorded in any migration file. This happened because tables were created via `prisma db push` or `prisma migrate dev --create-only` without properly recording the DDL in migration history.

Running `prisma migrate status` showed drift: the database schema did not match what the cumulative migration history would produce.

## Drift Items

### New Tables (5 tables in schema.prisma but not in any migration)

| Table | Phase | Description |
|-------|-------|-------------|
| `UserIntegration` | Phase 3 | User integration configs (we-mp-rss, external WeRSS, etc.) |
| `ImaTarget` | Phase 3 | IMA knowledge base target configs |
| `Invitation` | Phase 4 | Invitation codes for user registration |
| `InvitationUse` | Phase 4 | Invitation code usage records |
| `AuditLog` | Phase 4 | Audit trail for user actions |

### Column Changes (AiConfig)

| Change | Old (0_init) | Current (schema.prisma) |
|--------|-------------|------------------------|
| `userId` column | Not present | `TEXT` nullable, FK to User |
| `baseUrl` default | `'https://api.openai.com/v1'` | `'https://api.deepseek.com/v1'` |
| `model` default | `'gpt-4o'` | `'deepseek-chat'` |
| Unique constraint | `AiConfig_name_key` on (`name`) | `AiConfig_name_userId_key` on (`name`, `userId`) |
| Index | None on `userId` | `AiConfig_userId_idx` on (`userId`) |

### Orphan Tables (2 tables in database but NOT in schema.prisma)

| Table | Description | Action |
|-------|-------------|--------|
| `WeweAccount` | Legacy we-mp-rss account table | Not in migration; to be dropped separately |
| `WeweSubscription` | Legacy we-mp-rss subscription table | Not in migration; to be dropped separately |

These orphan tables exist in the database but are not modeled in `schema.prisma` and are not referenced by any source code. They should be dropped in a future cleanup migration after confirming no data is needed.

### Extra Columns in Invitation Table

The database `Invitation` table has 3 columns not in `schema.prisma`: `isEnabled`, `note`, `updatedAt`. These are legacy columns from a previous schema iteration. Prisma does not auto-drop extra columns, so they remain in the database but are harmless.

## Fix

Created migration `20260612000003_backfill_drift` with idempotent SQL:

- All `CREATE TABLE` statements use `IF NOT EXISTS`
- All `CREATE INDEX` statements use `IF NOT EXISTS`
- All `ALTER TABLE ADD COLUMN` statements use `IF NOT EXISTS`
- All `ADD CONSTRAINT` (foreign keys) are wrapped in `DO $$ ... IF NOT EXISTS ... $$` blocks
- `DROP INDEX IF EXISTS` for the old `AiConfig_name_key` before creating the new composite index
- Default value changes use `ALTER TABLE ... SET DEFAULT`
- No data is deleted or modified

## Verification

```
$ pnpm exec prisma migrate status
4 migrations found in prisma/migrations
Database schema is up to date!
```

All 4 migrations are now recorded in `_prisma_migrations`:
1. `0_init`
2. `20260611175652_review_flow`
3. `20260612000002_task_dedupe`
4. `20260612000003_backfill_drift`

## Production Safety

This migration is safe to run on production because:

1. All `CREATE TABLE IF NOT EXISTS` are no-ops if the table already exists
2. All `CREATE INDEX IF NOT EXISTS` are no-ops if the index already exists
3. `ALTER TABLE ADD COLUMN IF NOT EXISTS` is a no-op if the column exists
4. Foreign key additions are guarded by existence checks
5. The `DROP INDEX IF EXISTS` for `AiConfig_name_key` is safe because the new composite index `AiConfig_name_userId_key` is created immediately after
6. Default value changes only affect future INSERTs, not existing rows
7. No data is deleted, truncated, or modified

## Remaining Items

- [ ] Drop orphan tables `WeweAccount` and `WeweSubscription` after confirming no data migration is needed
- [ ] Consider dropping extra columns `isEnabled`, `note`, `updatedAt` from `Invitation` table if they are confirmed unused
