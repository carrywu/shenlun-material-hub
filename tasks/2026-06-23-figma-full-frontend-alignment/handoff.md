# Handoff

## Status

Started. Scope is locked to Figma-verifiable Shell + Article Reader alignment. Missing final Figma frames for the rest of the requested routes are recorded as blockers, not implementation targets.

## Current Branch

`feat/figma-full-frontend-alignment`

## Completed

- Cleaned authorized `.mcp.json` local MCP config change.
- Created feature branch from current `main`.
- Re-read approved Figma nodes with official Figma MCP.
- Created task directory and initial planning/mapping/validation docs.
- Brought in route-aware Shell implementation from the prior Batch 0 branch.
- Added and passed Shell regression tests for text-only brand, mobile active state, and admin brand contract.
- Removed the stale green admin palette and made Admin/Auth shell surfaces inherit the global brand tokens.
- Audited legacy `wewe-rss`, `subscriptions`, and `sync-records` route pages.
- Added route redirect regression tests for the compatibility routes.

## In Progress

- Article reader Figma/code alignment.

## Next Step

Read the live article reader code against Figma nodes `14:20`, `14:103`, and `15:20`, then add focused regression tests before changing the reader layout.

## Risks

- Full-route design implementation cannot be honestly completed from current Figma file because final route frames are missing.
- Article reader is a large client component; changes must preserve export, annotation, card generation, IMA, and role behavior.
- Browser validation and screenshots are currently blocked by unavailable local PostgreSQL on `localhost:5432`; Playwright global setup cannot seed/login roles without it.
