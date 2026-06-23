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

## In Progress

- Batch 0 shell tests and implementation.

## Next Step

Write failing shell regression tests, then implement route-aware app/auth/admin shell ownership and text-only navigation/account surfaces.

## Risks

- Full-route design implementation cannot be honestly completed from current Figma file because final route frames are missing.
- Article reader is a large client component; changes must preserve export, annotation, card generation, IMA, and role behavior.

