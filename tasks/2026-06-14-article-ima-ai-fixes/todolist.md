# Todo List

## Task 0: Workflow Setup

- [x] Create carry workflow task artifacts.
- [x] Record initial git status.
- [x] Commit or preserve existing planning docs intentionally.

## Task 1: Shared Chinese Display Labels

- [x] Add failing unit tests for AI decision labels.
- [x] Add failing unit tests for sync status labels.
- [x] Implement AI decision label helpers.
- [x] Implement sync status label helpers.
- [x] Run targeted display-label tests.
- [x] Update handoff and validation notes.
- [x] Commit label localization slice.

## Task 2: AI Evaluation Provenance

- [x] Add failing tests for AI provenance writes.
- [x] Add failing tests for admin-only reassess.
- [x] Add failing tests for reassess failure preserving old result.
- [x] Add nullable Prisma AI provenance fields.
- [x] Add migration SQL.
- [x] Update AI assess/reassess write paths.
- [x] Update article detail AI provenance display.
- [x] Run targeted route tests.
- [ ] Commit AI provenance slice.

## Task 3: Article Content Renderer

- [x] Add renderer tests for paragraphs.
- [x] Add renderer tests for HTML structure preservation.
- [x] Add renderer tests for XSS sanitization.
- [x] Add renderer tests for relative image URLs.
- [x] Implement `ArticleContentRenderer`.
- [x] Replace inline article detail renderer.
- [x] Run renderer tests.
- [ ] Commit content rendering slice.

## Task 4: Unified IMA Service and APIs

- [x] Add service tests for config missing.
- [x] Add service tests for sync success.
- [x] Add service tests for duplicate skip.
- [x] Add service tests for batch partial failure.
- [ ] Add API tests for article sync permission boundaries.
- [x] Add API tests for health check.
- [ ] Update `SyncRecord` schema for article-only sync.
- [x] Implement unified service operations.
- [x] Add IMA health route.
- [ ] Add article sync route.
- [x] Run targeted IMA tests.
- [ ] Commit IMA service slice.

## Task 5: Material Card Batch Sync UI

- [ ] Add E2E or component test for no-selection feedback.
- [ ] Add E2E or component test for partial result display.
- [ ] Update batch sync UI.
- [ ] Run targeted UI/E2E validation.
- [ ] Commit batch sync UI slice.

## Task 6: Article Detail IMA Sync UI

- [ ] Add E2E for sync button presence.
- [ ] Add E2E for material-card selection.
- [ ] Add E2E for unconfirmed card disabled.
- [ ] Add E2E for article-body sync confirmation.
- [ ] Implement article detail sync UI.
- [ ] Run targeted E2E validation.
- [ ] Commit article detail sync slice.

## Task 7: IMA Health UI

- [ ] Add E2E for health status success.
- [ ] Add E2E for missing config.
- [ ] Add E2E for auth failure.
- [ ] Implement settings health status card.
- [ ] Run targeted E2E validation.
- [ ] Commit health UI slice.

## Task 8: Final Validation

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm exec playwright test`.
- [ ] Update final handoff.
- [ ] Prepare final report.
