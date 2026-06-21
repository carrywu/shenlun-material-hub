# TodoList

## Phase 0 - Recovery And Audit

- [x] Read project rules and required audit/testing documents.
- [x] Inspect Git branch, log, diffs, stash, worktrees, and reflog.
- [x] Classify the existing Stitch recovery checkpoint.
- [x] Verify the official Figma Remote MCP connection and authenticated plans.
- [x] Select the `codex` Figma plan and Batch 1 + Batch 4 scope.
- [x] Record requirement conflicts and current code findings in `design-audit.md`.

## Phase 1 - Current UI

- [x] Reuse the repository-defined local application on port 3001 without Docker.
- [x] Verify USER, VERIFIED_USER, and ADMIN browser sessions.
- [x] Resolve real article and material-card IDs from the authenticated UI/API.
- [x] Capture core routes and responsive viewports with Playwright.
- [x] Capture available article-reader role and data states; document unavailable states in the design matrix.
- [x] Record console errors, page errors, and unavailable states.
- [x] Import representative Current UI pages into Figma as editable layers.

## Phase 2 - Foundations And Components

- [x] Create the Figma design file and required page structure.
- [x] Create Light/Dark semantic color variables mapped to CSS variables.
- [x] Create spacing, radius, typography, and minimal elevation foundations.
- [x] Create and validate Batch 1/4 component variants.
- [x] Create the Figma-to-code mapping table.

## Phase 3 - Approved Design Candidate

- [x] Design frontend and admin shell frames for desktop/mobile and document dark-mode rules.
- [x] Design the article reader high-fidelity reference and USER/VERIFIED_USER/ADMIN capability matrix.
- [x] Cover AI, annotation, material-card, export, preview, empty, failure, long-title, and menu states.
- [x] Connect core prototype steps to same-page reader/admin destinations.
- [x] Annotate frames with route, role, viewport, permissions, component mapping, and test requirements.

## Phase 3.5 - Handoff And Stop

- [x] Complete `design-audit.md`.
- [x] Complete `figma-handoff.md` with real URLs and Node IDs.
- [x] Complete `handoff.md` and evidence inventory.
- [x] Stop before modifying `src/` or creating implementation components.
