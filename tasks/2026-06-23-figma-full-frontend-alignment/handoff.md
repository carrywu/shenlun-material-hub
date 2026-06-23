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

## In Progress

- Batch 0 Playwright/visual validation.

## Next Step

Run targeted lint and browser validation for Batch 0, then capture Shell screenshots before committing the local Shell polish.

## Risks

- Full-route design implementation cannot be honestly completed from current Figma file because final route frames are missing.
- Article reader is a large client component; changes must preserve export, annotation, card generation, IMA, and role behavior.
