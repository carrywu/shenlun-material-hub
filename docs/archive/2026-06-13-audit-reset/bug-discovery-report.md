# Bug Discovery Report

Date: 2026-06-13

Scope: read-only bug discovery and evidence collection. No fixes applied.

## Verification Baseline

- `pnpm test`: passed, 53 test files / 371 tests.
- `pnpm build`: passed.
- `pnpm lint`: passed with 0 errors / 18 warnings.
- `pnpm exec playwright test`: interrupted after user requested planning pause. Before interruption, Playwright produced reproducible failures and runtime warnings recorded below.

## 1. Admin Users 创建用户后表格不显示新用户

Status: confirmed E2E failure; root cause not fully isolated.

Observed behavior:
- `e2e/admin.spec.ts:236` (`Admin Users › 用户管理：创建用户成功`) failed waiting for the newly created username cell.
- Error context shows toast text `用户 "e2e_test_user_1781319294657" 创建成功`, so the create request likely succeeded.
- The table snapshot still shows older `2026/6/12` users and does not include the new username.

Relevant evidence:
- Failure artifact: `test-results/admin-Admin-Users-用户管理：创建用户成功-anonymous/error-context.md`
- Test assertion: `e2e/admin.spec.ts:258`
- Client create flow: `src/app/admin/users/page.tsx:121` posts to `/api/admin/users`, shows success at `src/app/admin/users/page.tsx:137`, then calls `fetchUsers()` at `src/app/admin/users/page.tsx:144`.
- User list API orders all users by `createdAt desc`: `src/app/api/admin/users/route.ts:14` and `src/app/api/admin/users/route.ts:26`.

Current hypothesis:
- Since toast success appears but table does not update, likely candidates are refresh race, stale response overwriting fresh state, parallel E2E data interference, or DOM/table visibility not reflecting the latest API response.
- Pagination is less likely in current API because `/api/admin/users` returns all users with no pagination, but UI/test-visible range may still need verification.

Next evidence to collect:
- Capture the `POST /api/admin/users` response body and the subsequent `GET /api/admin/users` response in the Playwright trace or a focused test.
- Verify whether `fetchUsers()` returns the created username immediately after creation.
- Check whether an earlier initial-load request can finish after the post-create refresh and overwrite state with stale data.

## 2. 素材卡详情跳转或详情加载失败

Status: confirmed E2E failure; root cause not fully isolated.

Observed behavior:
- `e2e/cards.spec.ts:83` failed in two ways:
  - Initial run: clicking the first card did not navigate to `/cards/[id]` within 10s.
  - Retry: navigation occurred, but the page stayed at `main: 加载中...` and `text=素材卡详情` never appeared.
- Separate detail tests such as `素材卡详情：页面加载` and `素材卡详情：编辑按钮` also show `main: 加载中...` while waiting for `素材卡详情`.

Relevant evidence:
- Failure artifacts:
  - `test-results/cards-素材卡列表-cards-素材卡列表：点击卡片跳转详情-anonymous/error-context.md`
  - `test-results/cards-素材卡列表-cards-素材卡列表：点击卡片跳转详情-anonymous-retry1/error-context.md`
  - `test-results/cards-素材卡详情-cards-id-素材卡详情：页面加载-anonymous/error-context.md`
  - `test-results/cards-素材卡详情-cards-id-素材卡详情：编辑按钮-anonymous/error-context.md`
- List click handler: `src/app/cards/page.tsx:339` to `src/app/cards/page.tsx:342` calls `router.push(`/cards/${card.id}`)`.
- Detail page fetches `/api/material-cards/${cardId}` and should clear loading in `finally`: `src/app/cards/[id]/page.tsx:94` to `src/app/cards/[id]/page.tsx:106`.
- Detail heading is rendered only after loading clears and `card` is present: `src/app/cards/[id]/page.tsx:153` to `src/app/cards/[id]/page.tsx:186`.
- Detail API can return 404, 403, or 500 depending on data and ownership: `src/app/api/material-cards/[id]/route.ts:33` to `src/app/api/material-cards/[id]/route.ts:44`.

Current hypothesis:
- The initial no-navigation failure may be a test click-target problem because `.grid .cursor-pointer` includes nested controls and broad card content.
- The repeated `加载中...` failures point to a separate detail-load issue, likely pending `/api/material-cards/[id]`, auth/storage-state mismatch, route data dependency, or a client-side fetch that never resolves under the E2E environment.

Next evidence to collect:
- Inspect trace network events for `/api/material-cards/[id]`: status, response body, and whether the request completes.
- Add a focused Playwright diagnostic around one seeded card: log `card.id`, page URL after navigation, failed requests, and console/page errors.
- Confirm whether `ensureCardExists()` creates a card accessible to the admin storage state used by the spec.

## 3. AdminLogsPage React key warning

Status: confirmed runtime warning; root cause likely identified.

Observed behavior:
- During Playwright run, browser logs repeatedly printed React warning: `Each child in a list should have a unique "key" prop. Check the render method of TableBody. It was passed a child from AdminLogsPage.`

Relevant evidence:
- `src/app/admin/logs/page.tsx:230` maps over `data`.
- The `map()` returns a fragment shorthand `<>...</>` at `src/app/admin/logs/page.tsx:234`.
- Keys are placed on inner `TableRow` elements at `src/app/admin/logs/page.tsx:235` and `src/app/admin/logs/page.tsx:259`, not on the top-level fragment returned by the map.

Root cause:
- React requires the top-level element returned by an array map to have the key. A shorthand fragment cannot carry a key, so the inner row keys do not satisfy the list key requirement.

Expected fix shape:
- Import `Fragment` from React and return `<Fragment key={log.id}>...</Fragment>`, with the detail row retaining a distinct key only if needed.

## 4. `PUT /api/admin/users/[id]` malformed JSON produces server exception

Status: confirmed runtime server error log; root cause identified.

Observed behavior:
- Playwright run emitted server error:
  - `SyntaxError: Unexpected end of JSON input`
  - at `PUT (src/app/api/admin/users/[id]/route.ts:55:30)`
- This occurs when the request body is empty or invalid JSON.

Relevant evidence:
- `src/app/api/admin/users/[id]/route.ts:55` directly calls `await request.json()` without a parse guard.
- The route already returns structured 400 responses for business validation later in the handler, but malformed JSON fails before those checks.

Root cause:
- `request.json()` throws on empty or malformed JSON, and the route does not catch that parse error.

Expected behavior:
- Return a structured 400 response such as `{ error: "请求体必须是有效 JSON" }`.
- Avoid noisy server exception logs for client input errors.

Related note:
- `src/app/api/admin/users/route.ts:46` has the same direct `await request.json()` pattern for `POST /api/admin/users`; it should be checked for the same malformed-body behavior when planning a shared fix.

## 5. `pnpm lint` unused warnings

Status: confirmed lint warnings; mostly cleanup, with a few possible logic omissions.

Command result:
- `pnpm lint`: exit code 0.
- ESLint result: `18 problems (0 errors, 18 warnings)`.
- pnpm also warns that the `pnpm` field in `package.json` is no longer read for `pnpm.onlyBuiltDependencies`.

Warning inventory:
- E2E-only unused variables/args:
  - `e2e/api-security.spec.ts:177` unused `testInfo`
  - `e2e/articles.spec.ts:36` unused `initialRows`
  - `e2e/articles.spec.ts:275` unused `loading`
  - `e2e/error-states.spec.ts:59` unused `errorOverlay`
  - `e2e/explore-discover.spec.ts:99` unused `count`
  - `e2e/review.spec.ts:212` unused `hasLoading`
  - `e2e/wewe-rss.spec.ts:22` unused `testInfo`
- API/application unused imports or variables:
  - `src/app/api/auth/change-password/route.ts:2` unused `AUTH_COOKIE_NAME`
  - `src/app/api/content-items/reassess/route.ts:5` unused `enqueueAsyncTask`
  - `src/app/api/material-cards/[id]/route.ts:3` unused `forbiddenResponse`
  - `src/app/api/settings/integrations/wewe-rss/route.ts:4` unused `checkHealth`
  - `src/app/layout.tsx:31` unused `isAdmin`
  - `src/app/settings/integrations/page.tsx:6` unused `XCircle`
  - `src/services/collectors/mediacrawler/bilibili.ts:104` unused `filteredCount`
  - `src/services/collectors/mediacrawler/xiaohongshu.ts:91` unused `filteredCount`
- Test-only unused imports:
  - `src/app/api/material-cards/[id]/__tests__/route.test.ts:64` unused `GET`
  - `src/lib/__tests__/display-labels.test.ts:9` unused `CONTENT_TYPE_LABELS`
  - `src/lib/__tests__/display-labels.test.ts:10` unused `TRUST_LEVEL_LABELS`

Initial classification:
- Likely cleanup-only: most E2E variables, test imports, unused icons, unused `isAdmin`, unused `forbiddenResponse`.
- Needs logic review before deletion:
  - `enqueueAsyncTask` in reassess route may indicate reassessment work was intended to enqueue asynchronously but now runs differently or was left unfinished.
  - `checkHealth` in WeWe RSS settings route may indicate a removed/unfinished health-check behavior.
  - `filteredCount` in MediaCrawler collectors may indicate filter metrics are calculated but never surfaced.
  - `AUTH_COOKIE_NAME` in change-password route may indicate intended cookie/session handling was removed or incomplete.

## Open Follow-up Plan

1. Run focused Playwright specs instead of the full 1505-test suite:
   - `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`
   - `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情：页面加载" --project=admin`
2. For Admin Users, inspect trace network requests around `POST /api/admin/users` and the following `GET /api/admin/users`.
3. For cards, inspect trace network requests and failed requests for `/api/material-cards/[id]`.
4. Add regression tests only after root causes are confirmed.
5. Fix low-risk warning cleanup separately from behavior fixes to keep diffs reviewable.
