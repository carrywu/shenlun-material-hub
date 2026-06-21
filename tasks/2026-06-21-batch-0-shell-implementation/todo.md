# Batch 0 TodoList

## Baseline And Figma

- [x] Confirm the official Figma MCP identity and file access.
- [x] Re-read approved Foundations, Components, frontend shell, and admin shell nodes.
- [x] Confirm there is no V2/V3 or separate Auth Shell frame.
- [x] Record the user-approved palette and brand override.
- [x] Create `feat/batch-0-shell-implementation` from current `origin/main`.
- [x] Preserve prior Figma design evidence in separate commits.
- [x] Create Batch 0 plan, TodoList, validation, and handoff documents.

## Layout Boundaries

- [x] Add failing tests for frontend/admin/auth shell exclusivity.
- [x] Add a route-aware root shell boundary.
- [x] Ensure `/admin/*` has no RootNav or MobileBottomTab.
- [x] Ensure `/login`, `/register`, and `/admin/login` have no application shell.
- [x] Introduce and apply a shared `AuthShell` without changing form behavior.
- [x] Verify the `/register` login link targets `/login`.

## Frontend Navigation

- [x] Add failing role-navigation and active-state tests.
- [x] Implement reusable role-aware navigation definitions.
- [ ] Implement desktop active states with `aria-current`.
- [ ] Implement the responsive Account Menu.
- [ ] Verify Account Menu keyboard, Escape, outside-click, and role behavior.
- [ ] Refine MobileBottomTab permissions, active state, and safe-area spacing.
- [ ] Ensure page content is not covered by the bottom tab.

## Admin Shell

- [ ] Add failing grouped-sidebar and drawer behavior tests.
- [ ] Implement grouped admin navigation and distinct semantic icons.
- [ ] Implement desktop sidebar expansion and collapse.
- [ ] Add collapsed-item tooltips.
- [ ] Implement mobile/tablet Drawer with focus management and scroll lock.
- [ ] Close the Drawer on overlay, Escape, close button, and route change.
- [ ] Remove fabricated online/system/date status content.
- [ ] Preserve return-to-frontend, account, and logout actions.

## Theme And Responsive

- [ ] Add approved frontend and admin shell token mappings.
- [ ] Verify Light and Dark navigation, menu, sidebar, drawer, focus, and destructive states.
- [ ] Verify 390x844 without horizontal overflow or overlap.
- [ ] Verify 768x1024 without navigation or account-menu overflow.
- [ ] Verify 1440x900 desktop layout and scrolling.

## Validation And Delivery

- [x] Run targeted unit tests after the layout-boundary implementation slice.
- [ ] Run targeted unit tests after each remaining implementation slice.
- [ ] Run focused Batch 0 Playwright tests.
- [ ] Run axe and resolve serious/critical findings.
- [ ] Capture all required role, viewport, auth, menu, drawer, and dark screenshots.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run critical existing Playwright regressions.
- [ ] Update validation and handoff documents.
- [ ] Confirm only Batch 0 files changed.
- [ ] Push the feature branch.
- [ ] Create a Draft PR linked to Issue #8.
- [ ] Stop without merging or beginning Batch 1.
