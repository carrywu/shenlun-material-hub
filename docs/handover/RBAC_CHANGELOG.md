# RBAC Changelog

Audit date: 2026-06-05

This changelog is derived from Git history and current code. It does not rely on prior chat context.

## Recent Relevant Commits

- `97da329 feat: complete Phase 1 auth + fix Phase 2 data isolation gaps`
  - Current HEAD during this handover.
  - Current code contains DB session auth, route guards, ownership helpers, and schema owner fields.
- `103ab0f feat: global auth protection, RBAC hardening, and codebase overview`
  - Indicates global auth and RBAC hardening work entered the branch before HEAD.
- `7a6789a Stabilize production admin and async task workflows`
  - Current code contains admin shell, async task models, and admin task routes.
- `ad05797 feat: optimize AI prompts, support configurable annotations, and add source type filter`
  - Current code contains AI prompt routes and annotation routes.
- `e7bf31c Record rollout notes and align legacy card migration`
  - Related to migration/rollout documentation, but current Prisma migrations still require RBAC drift resolution.
- `8185c8a Stabilize WeWe RSS content cleanup and browser QA workflow`
  - Related to content cleanup and browser QA.
- `cf93c54 feat: WeWe RSS deep integration - SQLite fallback, preview-sync, delete confirmation`
  - Current code includes WeWe RSS integration routes and SQLite fallback.

## Current RBAC State

- DB-backed session model is present in schema and code.
- Most admin APIs use `requireAdmin`.
- Some user-facing APIs use `requireAuth` and owner helpers.
- Several route-level gaps remain and are documented in `RBAC_API_AUDIT.md`.

## Migration Drift Note

The generated Prisma client reflects current schema, but migration SQL under `prisma/migrations` does not include RBAC table/column DDL. Future schema changes must not proceed until this drift is resolved or explicitly explained.

## Forward Directive

Do not claim multi-user readiness until:

- RBAC migration drift is fixed.
- P0 API risks are fixed.
- A/B isolation tests exist and pass.
- Public API policy is documented and tested.
