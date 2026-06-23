# Design Gap Report

## Figma Coverage

Verified by Figma MCP on 2026-06-23:

- Present: foundations, component inventory, frontend shell desktop/mobile, admin shell desktop/mobile, article reader desktop/mobile, reader roles/states, dev handoff.
- Missing as final frames: auth pages, home, article list, cards, card detail, search, review, settings, most admin content/system pages.

## Current Code Gaps

1. Root layout renders frontend chrome for all routes.
2. Auth pages hide `RootNav` only by checks inside `RootNav`/`MobileBottomTab`; root shell still owns layout padding and surfaces globally.
3. Admin pages can show frontend chrome plus `AdminShell`.
4. `RootNav` uses a brand icon and flat account actions instead of a text-only brand plus Account Menu.
5. `MobileBottomTab` lacks the approved active background treatment and safe-area polish.
6. `AdminShell` needs Figma-aligned navigation grouping, mobile drawer, and route-safe shell ownership.
7. Article reader layout is capability-rich but not yet Figma-aligned around the 700-760px reading column and 300-340px sidebar.
8. `wewe-rss` routes exist outside the requested route contract and require audit.

## Requirement Conflicts

- The prompt asks for full-route implementation, but current Figma evidence does not include final frames for most routes. Resolution: implement only verifiable Figma scope and mark missing pages as `有阻塞`.
- Previous Batch 0 handoff said a per-frame green admin palette and icon brand were approved. Current user instruction requires text-only brand and scheme A active state. Resolution: current user instruction wins.

## Business Preservation Notes

- Do not change USER / VERIFIED_USER / ADMIN capability rules.
- Do not change `/api/articles` authentication requirement.
- Do not change reject/downlist semantics.
- Do not change private material-card ownership or IMA ownership.
- Do not use legacy `src/components/ArticleDetail.tsx` as the reader source of truth.

