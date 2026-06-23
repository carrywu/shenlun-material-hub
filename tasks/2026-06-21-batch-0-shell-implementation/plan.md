# Batch 0 Shell Implementation Plan

Date: 2026-06-21

## Problem Summary

The root layout renders the frontend navigation for admin routes while the admin layout also renders `AdminShell`. Authentication pages also duplicate their visual shells and `/register` can inherit frontend navigation. Navigation and account actions are not consistently role-aware or responsive.

## Current Behavior

- `/admin/*` can combine frontend and admin shells, creating navigation and scroll conflicts.
- `/login`, `/register`, and `/admin/login` do not share an explicit navigation-free shell boundary.
- Frontend account, role, admin, and logout actions are spread across the header.
- Admin navigation is flat, uses repeated icon semantics, and lacks a complete accessible mobile drawer contract.
- Dark variables exist, but shell-specific light/dark behavior is not covered by focused tests.

## Expected Behavior

- Frontend, admin, and authentication routes have exclusive shell ownership.
- USER, VERIFIED_USER, and ADMIN see only their permitted frontend navigation and account actions.
- Admin navigation is grouped and works as a desktop sidebar and accessible mobile drawer.
- Shells match the approved Figma nodes at 390, 768, and 1440 widths in light and dark states.
- Existing APIs, RBAC, redirects, and business-page behavior remain unchanged.

## Requirement Conflict

The approved Figma nodes use a purple frontend shell and a green admin/foundations shell, and include branded icon marks. This conflicts with earlier requirements for one palette and a text-only brand. The user explicitly approved literal per-Frame styling and confirmed that this approval overrides those earlier constraints.

## Implementation Sequence

1. Add failing tests for route shell ownership and role navigation.
2. Introduce a route-aware root shell boundary and shared authentication shell.
3. Implement accessible desktop navigation and account menu.
4. Refine the mobile bottom tab with role gating, active semantics, and safe-area spacing.
5. Refactor the admin shell into grouped desktop navigation and an accessible mobile drawer.
6. Align shell tokens and dark states with the approved Figma frames.
7. Run targeted tests, full validation, axe, and screenshot capture.
8. Commit each independent slice, push the branch, and open a Draft PR.

## Validation Commands

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test e2e/auth.spec.ts e2e/batch-0-shell.spec.ts
pnpm exec playwright test e2e/accessibility.spec.ts
```

Critical existing Playwright suites will be run after the focused Batch 0 suite.

## Risks And Rollback

- Route classification can hide required chrome; focused anonymous and role tests guard every shell boundary.
- Header changes can invalidate selectors; existing accessible names and test IDs will be preserved or strengthened.
- Drawer focus and scroll locking can regress mobile behavior; keyboard and overflow assertions are required.
- Each implementation phase is committed separately and can be reverted independently.

