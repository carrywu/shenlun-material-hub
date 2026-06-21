# Figma Frontend Optimization Plan

Date: 2026-06-21

## Problem Summary

Create an approval-ready Figma redesign grounded in the live application without changing production code, APIs, Prisma, database behavior, RBAC, or business semantics.

## Current Behavior

- The current branch is `rescue/stitch-article-reader-recovery-20260620` with a clean worktree.
- A prior Stitch recovery checkpoint contains reader screenshots and a local design specification, but no verified Figma file or approved screen.
- The root layout renders the frontend navigation while the admin layout also renders `AdminShell`.
- The article detail page contains the required reading, AI, annotation, export, material-card, and IMA behaviors in one large client page.

## Expected Behavior

- Capture the real application for USER, VERIFIED_USER, and ADMIN roles.
- Build a code-aligned Figma foundation and the components needed by Batch 1 and Batch 4.
- Deliver high-fidelity shell/navigation and article-reader designs with responsive, dark-mode, role, and state coverage.
- Stop before implementation and require explicit approval containing the Figma URL, Frame IDs, and approved batches.

## Planned Work

1. Preserve and document the current Git and application baseline.
2. Start the repository-defined Playwright web server on port 3001 without Docker or database resets.
3. Capture real routes and states with existing role storage states.
4. Create `申论素材系统｜Frontend Redesign` in the Figma `codex` plan.
5. Create the required pages, variables, text/effect styles, and Batch 1/4 components.
6. Produce and validate Batch 1 and Batch 4 frames and prototype links.
7. Record all file/page/frame IDs and hand off for human approval.

## Validation

- Playwright navigation and screenshot capture at 390x844, 768x1024, 1280x900, and 1440x1000.
- Console and page-error collection for captured routes.
- Figma metadata and screenshots after each meaningful canvas operation.
- No claims about lint, unit tests, or build unless rerun during this task.

## Risks And Rollback

- Real state coverage depends on existing seeded accounts and database content; missing states will be documented rather than fabricated.
- Figma writes are incremental and identified by returned node IDs. Incorrect nodes can be removed by those IDs without touching code.
- Repository rollback is deletion of this task directory only; no business files are in scope before approval.

