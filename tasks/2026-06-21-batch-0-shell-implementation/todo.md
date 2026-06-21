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
- [x] Implement desktop active states with `aria-current`.
- [x] Implement the responsive Account Menu.
- [x] Verify Account Menu keyboard, Escape, outside-click, and role behavior.
- [x] Verify Account Menu role items and Escape behavior in focused component tests.
- [x] Refine MobileBottomTab permissions, active state, and safe-area spacing.
- [x] Add shell content spacing for the bottom tab and safe-area inset.
- [x] Verify page content is not covered by the bottom tab in Playwright.

## Admin Shell

- [x] Add failing grouped-sidebar tests and focused Drawer behavior tests.
- [x] Implement grouped admin navigation and distinct semantic icons.
- [x] Implement desktop sidebar expansion and collapse.
- [x] Add collapsed-item tooltips.
- [x] Implement mobile/tablet Drawer with Base UI focus management and scroll lock.
- [x] Close the Drawer on overlay, Escape, close button, and route change.
- [x] Verify Escape and close-button behavior in focused component tests.
- [x] Derive Drawer closure from route changes and close on navigation selection.
- [x] Remove fabricated online/system/date status content.
- [x] Preserve return-to-frontend, account, and logout actions.

## Theme And Responsive

- [x] Add approved frontend and scoped admin shell token mappings.
- [x] Verify Light and Dark navigation, menu, sidebar, drawer, focus, and destructive states.
- [x] Verify 390x844 without horizontal overflow or overlap.
- [x] Verify 768x1024 without navigation or account-menu overflow.
- [x] Verify 1440x900 desktop layout and scrolling.

## Validation And Delivery

- [x] Run targeted unit tests after the layout-boundary implementation slice.
- [x] Run targeted unit tests after each remaining implementation slice.
- [x] Run focused Batch 0 Playwright tests.
- [x] Run axe and resolve serious/critical findings.
- [x] Capture all required role, viewport, auth, menu, drawer, and dark screenshots.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run critical existing Playwright regressions.
- [x] Update validation and handoff documents.
- [x] Confirm changes remain limited to Batch 0 implementation and its regression evidence.
- [x] Push the feature branch.
- [x] Create a Draft PR linked to Issue #8.
- [x] Stop without merging or beginning Batch 1.
