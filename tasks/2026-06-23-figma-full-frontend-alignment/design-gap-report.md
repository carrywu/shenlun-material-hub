# Design Gap Report

## Figma Coverage

Verified by Figma MCP on 2026-06-23:

- Present: foundations, component inventory, frontend shell desktop/mobile, admin shell desktop/mobile, article reader desktop/mobile, reader roles/states, dev handoff.
- Current approval scope: the file cover (`0:1`, text node `16:7`) says "当前审批范围：Batch 1 应用 Shell 与导航；Batch 4 文章阅读器。"
- Approval gate: node `16:30` says source/API/Prisma/database/RBAC/business-semantic changes require an approved Figma URL, Frame/Node ID, and Batch.
- Missing as approved final frames: auth pages, home, article list, cards, card detail, search, review, settings, most admin content/system pages.

## Current Code Gaps

1. Root layout renders frontend chrome for all routes.
2. Auth pages hide `RootNav` only by checks inside `RootNav`/`MobileBottomTab`; root shell still owns layout padding and surfaces globally.
3. Admin pages can show frontend chrome plus `AdminShell`.
4. `RootNav` uses a brand icon and flat account actions instead of a text-only brand plus Account Menu.
5. `MobileBottomTab` lacks the approved active background treatment and safe-area polish.
6. `AdminShell` needs Figma-aligned navigation grouping, mobile drawer, and route-safe shell ownership.
7. Article reader layout was capability-rich but not Figma-aligned around the 700-760px reading column and 300-340px sidebar. Implemented: 1240px reader grid, 760px reading column marker, 320px learning sidebar marker, mobile article action bar, VERIFIED_USER private-card sidebar title, and role-gated IMA surfaces.
8. `wewe-rss` routes exist outside the requested route contract. Audit result: both are explicit redirects to `/admin/integrations/wechat-rss`; `/subscriptions` and `/sync-records` are explicit redirects to their admin equivalents.

## Requirement Conflicts

- The prompt asks for full-route implementation, but current Figma evidence explicitly approves only Batch 1 and Batch 4. Resolution: implement only approved/verifiable Figma scope and mark missing pages as `有阻塞`.
- Previous Batch 0 handoff said a per-frame green admin palette and icon brand were approved. Current user instruction requires text-only brand and scheme A active state. Resolution: current user instruction wins.

## Business Preservation Notes

- Do not change USER / VERIFIED_USER / ADMIN capability rules.
- Do not change `/api/articles` authentication requirement.
- Do not change reject/downlist semantics.
- Do not change private material-card ownership or IMA ownership.
- Do not use legacy `src/components/ArticleDetail.tsx` as the reader source of truth.
- Reader business preservation: export menu, AI score detail, summary/reason, annotation renderer/tooltip, admin annotations, material card list, image preview, raw HTML warning, no-body fallback, favorite/read/ignore, original link, and metadata remain in `src/app/articles/[id]/page.tsx`.

## Browser Evidence Gaps

- `/login`, `/register`, and `/admin/login` now have no-DB Playwright evidence for 390 / 768 / 1440, light / dark auth shell rendering, no application navigation, no horizontal overflow, axe serious/critical checks, and screenshots.
- `/articles/[id]` cannot be browser-verified without PostgreSQL because middleware correctly redirects protected article pages to `/login` when no valid DB-backed session exists.
- Role-aware frontend/admin shell screenshots still require real USER / VERIFIED_USER / ADMIN sessions from a PostgreSQL-backed E2E environment.
