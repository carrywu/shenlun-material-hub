# Handover Index

Audit date: 2026-06-05

This directory is the project handover surface for future Codex, Claude Code, Gemini, or human maintainers. It is based on the current repository state, not prior chat history.

## Audit Baseline

- Branch: `feat/production-hardening`
- HEAD: `97da329 feat: complete Phase 1 auth + fix Phase 2 data isolation gaps`
- Working tree before handover docs: no `git diff --stat` output
- API routes found: 58 `src/app/api/**/route.ts`
- Route-local API tests found: 10 `__tests__/route.test.ts`
- Playwright specs found: 5
- Validation baseline from the audit pass:
  - `pnpm lint`: passed
  - `pnpm test`: passed, 27 files / 144 tests
  - `pnpm build`: passed

## Reading Order

1. `PROJECT_MASTER_TODO.md` - global source of truth for project work.
2. `RBAC_HANDOVER.md` - RBAC completion and blocking assessment.
3. `RBAC_API_AUDIT.md` - route-by-route guard and isolation table.
4. `RBAC_RISK_REGISTER.md` - risks mapped to TODO items.
5. `RBAC_RESUME_PROMPT.md` - prompt for the next agent.

## Document Map

- `RBAC_ARCHITECTURE.md` - auth/RBAC/data-isolation architecture.
- `RBAC_CHANGELOG.md` - evidence-based RBAC change history from Git and code.
- `RBAC_MASTER_TODO.md` - RBAC-only TODO slice.
- `PROJECT_MASTER_TODO.md` - all project TODOs including evidence-backed and planning-derived work.

## Evidence Labels

- `证据：代码审计` means the task is directly supported by current code, schema, migrations, tests, or Git output.
- `证据：规划推导` means the task is inferred from current module boundaries and long-term maintainability goals.

## Non-Goals Of This Handover

- No business code was changed for RBAC fixes.
- No database migration was generated or applied.
- No `.env`, SQLite database, Docker service, or external WeWe RSS state was modified.
