# Figma Handoff

Date: 2026-06-21

## File

- Name: `申论素材系统｜Frontend Redesign`
- URL: https://www.figma.com/design/eDNdcn58oWO1xagFvJf68b
- File key: `eDNdcn58oWO1xagFvJf68b`

## Pages

- `00 Cover & Index`: `0:1`
- `01 Current UI`: `1:2`
- `02 Foundations`: `1:3`
- `03 Components`: `1:4`
- `04 User Experience`: `1:5`
- `05 Admin Experience`: `1:6`
- `06 Prototype`: `1:7`
- `07 Dev Handoff`: `1:8`
- `99 Archive`: `1:9`

## Current UI

- Capture index: `16:33`
- Editable article capture: `6:2`
- Secondary editable capture: `7:2`
- Route/role/viewport source of truth: `evidence/current/` and `capture-report.json`.

## Foundations

- Review board: `17:2`
- Semantic color collection: `2:2`, Light `2:0`, Dark `2:1`
- Spacing collection: `2:29`
- Radius collection: `2:41`
- Typography and elevation styles are local and use Inter without downloaded font assets.

## Components

- Inventory and mapping: `17:89`
- Button: `4:26`
- Navigation Item: `5:29`
- Badge: `5:40`
- Card: `5:68`
- Account Menu: `5:95`
- AI Evaluation Summary: `5:126`
- Annotation Item: `5:139`
- Admin Sidebar Group: `12:18`

## Batch 1 Frames

- Frontend Shell Desktop: `8:2`
- Frontend Shell Mobile: `8:48`
- Admin Shell Desktop: `12:19`
- Admin Shell Mobile: `12:162`

## Batch 4 Frames

- Article Reader Desktop / VERIFIED_USER: `14:20`
- Article Reader Mobile / VERIFIED_USER: `14:103`
- Reading column: `14:33`
- Learning sidebar: `14:75`
- Mobile action bar: `14:131`
- USER / VERIFIED_USER / ADMIN roles and state matrix: `15:20`
- Dark-mode reader sample: `15:89`

## Prototype And Handoff

- Core flow overview: `16:50`
- Article desktop destination: `16:229`
- Article mobile destination: `16:312`
- Admin desktop destination: `16:354`
- Figma-to-code handoff table: `16:113`

## Responsive And Accessibility Rules

- 390px has no page-level horizontal scroll; article actions sit above the safe-area tab.
- Desktop reader uses 760px content and 320px sidebar inside a 1240px shell.
- Long Chinese titles wrap horizontally and remain readable.
- Selection remains expressible through `aria-pressed`; menus, sheets, dialogs, image previews, and accordions require keyboard close/focus behavior.
- Existing test IDs and accessible names remain implementation contracts.

## Recommended First Implementation

Implement Batch 1 first, then Batch 4 in the same approved Figma-to-code loop. Keep them as separate small commits and validation checkpoints.

## Expected Files

- `src/app/layout.tsx`
- `src/app/admin/layout.tsx`
- `src/components/RootNav.tsx`
- `src/components/MobileBottomTab.tsx`
- `src/components/admin/AdminShell.tsx`
- `src/app/articles/[id]/page.tsx`
- `src/components/articles/ArticleContentRenderer.tsx` only if approved layout hooks require it
- Focused Playwright specs for shell/navigation and article detail

## Approval Gate

No implementation is authorized until the user supplies the Figma URL, approved Batch list, and approved Frame / Node IDs.
