# Design Audit

Date: 2026-06-21

## Status

Phase 0-3.5 complete. This document records current code and browser evidence; the historical `docs/audit/ui-assessment.md` is not treated as current fact.

## Recovery Baseline

- Current branch: `rescue/stitch-article-reader-recovery-20260620`.
- Initial worktree: clean.
- Existing checkpoint: `644dc08 Preserve interrupted Stitch reader recovery checkpoint`.
- The checkpoint contains local screenshots and a Stitch-oriented design specification, but no verified Figma file, Frame ID, or human-approved screen.

## Requirement Conflicts

- `CLAUDE.md` names legacy critical paths `/materials` and `/sources`; current code and current requirements use `/cards` and `/admin/sources`. Current user requirements and real routes take precedence.
- Legacy WeWe RSS routes still exist in code, but the target capture list uses the current we-mp-rss integration route. They will not be promoted into the redesign.

## Browser Baseline

- Existing repository server verified at `http://localhost:3001`; no Docker or database reset was used.
- Authenticated storage states verified for USER, VERIFIED_USER, and ADMIN.
- Real shared article: `cmqhjuyf500adpavy617ca578`.
- Real admin-owned material card: `cmpwgeww10004yhvyymgs20mi`.
- Playwright captured 52 core viewport screenshots and 27 route screenshots; all navigations returned HTTP 200.
- USER and VERIFIED_USER each saw 2 accessible articles and 0 cards. ADMIN saw 10 article results and 1 card.
- Four USER `/articles` captures logged a 403 resource response. The page itself remained HTTP 200; this was recorded rather than hidden or fixed during the design-only phase.

## Current Findings

1. **Critical: admin shell duplication.** The root layout renders `RootNav`, while the admin layout renders `AdminShell`. Current `/admin/*` pages therefore show frontend and admin navigation together.
2. **High: admin height ownership.** `AdminShell` owns `h-screen` below the root shell, creating height and double-scroll risk.
3. **Critical: mobile reader overflow.** At 390px the current article title collapses into a near-vertical column, horizontal actions overflow, and fixed actions compete with `MobileBottomTab`.
4. **High: mobile admin compression.** `/admin/articles` compresses desktop management UI rather than using a mobile management pattern.
5. **High: reading hierarchy.** AI/debug output appears before the reading body without enough progressive disclosure; required actions and long diagnostic content compete with the article.
6. **Medium: navigation state.** `RootNav` lacks a sufficiently clear current-route state, and account/role/admin/settings/logout controls are fragmented.

## Proposed Direction

- Separate frontend and admin shell ownership. Hide `RootNav` on `/admin/*`; hide `AdminShell` on `/admin/login`.
- Replace fixed full-viewport nesting with one shell height owner and one predictable scroll container.
- Use a 680-760px desktop reading column with a 300-340px learning sidebar; use a single-column mobile reader.
- Present AI decision, score, and summary first; reveal five dimensions, reasoning, directions, citations, and admin debug on demand.
- Keep USER, VERIFIED_USER, and ADMIN actions role-specific without changing RBAC or API semantics.
- Place article mobile actions above the global safe-area tab with no overlap.
- Adapt admin article rows to management cards at 390px rather than compressing the desktop table.

## Not Adopted

- No second component library or community Figma UI kit.
- No new brand palette, broad gradient hero, downloaded font, or Figma-generated production code.
- No API, Prisma, database, RBAC, ownership, review-state, export, sanitization, image-proxy, or IMA semantic change.
