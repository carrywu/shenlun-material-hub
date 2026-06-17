# Fix Sync Skip + Cleanup we-mp-rss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the sync route bug that causes all articles to be skipped, and clean up all remaining we-mp-rss old references from the codebase.

**Architecture:** Add `getArticle()` content enrichment to the sync route (same pattern as confirm/preview), then systematically rename/remove we-mp-rss references across source code, tests, config, and docs.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7, MSW (test mocks), Vitest, Playwright

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/api/collectors/wechat/sync/route.ts` | Modify | Add `getArticle()` enrichment |
| `src/app/integrations/we-mp-rss/page.tsx` | Modify | Rename function |
| `src/app/admin/integrations/we-mp-rss/page.tsx` | Modify | Rename function |
| `src/components/subscriptions/SubscriptionsPage.tsx` | Modify | Rename `weweDeleteDialogOpen` |
| `src/test/mocks/handlers/we-mp-rss.ts` | Rename → `wechat-rss.ts` | Rename file + export |
| `src/test/mocks/handlers/index.ts` | Modify | Update re-export |
| `src/test/mocks/server.ts` | Modify | Update import |
| `e2e/error-states.spec.ts` | Modify | Update test names/comments |
| `README.md` | Modify | Update env var + route table |
| `DEPLOY.md` | Modify | Update section |
| `AGENTS.md` | Modify | Update rules |
| `AGENT_HANDOFF.md` | Modify | Full rewrite of old references |
| `scripts/deploy/server-pull-and-restart.sh` | Modify | Update comment |
| `infra/wechat-rss/we-mp-rss/` | Delete | Remove old data |
| `docs/local-wechat-rss.md` | Modify | Update references |
| `docs/mcp.md` | Modify | Update reference |
| `docs/DEPLOY.md` | Modify | Update reference |
| `docs/codebase-overview.md` | Modify | Update references |
| 25+ other docs files | Modify | Batch replace old names |

---

### Task 1: Fix sync route — add `getArticle()` enrichment

**Files:**
- Modify: `src/app/api/collectors/wechat/sync/route.ts:5-65`

- [ ] **Step 1: Add `getArticle` to the import**

Change line 5 from:
```ts
import { triggerFeedSync, listArticles, SYNC_ARTICLE_LIMIT } from "@/services/integrations/wechat-rss";
```
to:
```ts
import { triggerFeedSync, listArticles, getArticle, SYNC_ARTICLE_LIMIT } from "@/services/integrations/wechat-rss";
```

- [ ] **Step 2: Add enrichment logic after `listArticles` and before `fromWeMpRssArticle`**

Replace lines 62-65:
```ts
    // 3. 转换为 WechatArticle 并入库
    const wechatArticles = articlesData.list.map((a) =>
      fromWeMpRssArticle(a, source.name)
    );
```
with:
```ts
    // 3. 补全文章内容：listArticles 返回 ArticleBase（无 content/content_html），
    //    需要对 has_content=1 的文章调用 DETAIL 端点补充完整内容
    const enrichedArticles = await Promise.all(
      articlesData.list.map(async (a) => {
        if (a.hasContent === 1 && !a.content) {
          try {
            const detail = await getArticle(baseUrl, accessKey, secretKey, a.id);
            return { ...a, content: detail.content, contentHtml: detail.contentHtml };
          } catch {
            // 获取详情失败，保持原数据（后续会因无内容被标记 blocked）
            return a;
          }
        }
        return a;
      })
    );

    // 4. 转换为 WechatArticle 并入库
    const wechatArticles = enrichedArticles.map((a) =>
      fromWeMpRssArticle(a, source.name)
    );
```

- [ ] **Step 3: Run lint + type check**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 4: Run unit tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/collectors/wechat/sync/route.ts
git commit -m "fix(sync): add getArticle() enrichment to sync route, prevent all-skipped bug

listArticles() returns ArticleBase without content/contentHtml. The sync
route was missing the getArticle() enrichment that confirm and preview
routes already have, causing all articles to be filtered as 'no full text'
and counted as skipped."
```

---

### Task 2: Rename redirect page functions

**Files:**
- Modify: `src/app/integrations/we-mp-rss/page.tsx`
- Modify: `src/app/admin/integrations/we-mp-rss/page.tsx`

- [ ] **Step 1: Rename function in `src/app/integrations/we-mp-rss/page.tsx`**

Change:
```tsx
export default function WeweRssRedirectPage() {
```
to:
```tsx
export default function WechatRssRedirectPage() {
```

- [ ] **Step 2: Rename function in `src/app/admin/integrations/we-mp-rss/page.tsx`**

Change:
```tsx
export default function AdminWeweRssRedirectPage() {
```
to:
```tsx
export default function AdminWechatRssRedirectPage() {
```

- [ ] **Step 3: Run lint + type check**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/integrations/we-mp-rss/page.tsx src/app/admin/integrations/we-mp-rss/page.tsx
git commit -m "refactor: rename we-mp-rss redirect page functions to WechatRss"
```

---

### Task 3: Rename `weweDeleteDialogOpen` variable

**Files:**
- Modify: `src/components/subscriptions/SubscriptionsPage.tsx:236,1309`

- [ ] **Step 1: Rename the useState variable**

Change line 236 from:
```tsx
const [weweDeleteDialogOpen, setWeweDeleteDialogOpen] = useState(false);
```
to:
```tsx
const [wechatDeleteDialogOpen, setWechatDeleteDialogOpen] = useState(false);
```

- [ ] **Step 2: Update the Dialog prop binding**

Change line 1309 from:
```tsx
<Dialog open={weweDeleteDialogOpen} onOpenChange={setWeweDeleteDialogOpen}>
```
to:
```tsx
<Dialog open={wechatDeleteDialogOpen} onOpenChange={setWechatDeleteDialogOpen}>
```

- [ ] **Step 3: Search for any other usages of `weweDeleteDialogOpen` or `setWeweDeleteDialogOpen` in the file**

Run: `grep -n "weweDelete\|setWeweDelete" src/components/subscriptions/SubscriptionsPage.tsx`
Expected: 0 results (all renamed)

- [ ] **Step 4: Run lint + type check**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/subscriptions/SubscriptionsPage.tsx
git commit -m "refactor: rename weweDeleteDialogOpen to wechatDeleteDialogOpen"
```

---

### Task 4: Rename mock handler file and exports

**Files:**
- Rename: `src/test/mocks/handlers/we-mp-rss.ts` → `src/test/mocks/handlers/wechat-rss.ts`
- Modify: `src/test/mocks/handlers/index.ts`
- Modify: `src/test/mocks/server.ts`

- [ ] **Step 1: Rename the file**

```bash
git mv src/test/mocks/handlers/we-mp-rss.ts src/test/mocks/handlers/wechat-rss.ts
```

- [ ] **Step 2: Update comment and export name in `src/test/mocks/handlers/wechat-rss.ts`**

Change:
```ts
/**
 * we-mp-rss (we-mp-rss) integration mock handlers.
```
to:
```ts
/**
 * we-mp-rss integration mock handlers.
```

Change:
```ts
export const we-mp-rssHandlers = [
```
to:
```ts
export const wechatRssHandlers = [
```

- [ ] **Step 3: Update `src/test/mocks/handlers/index.ts`**

Change line 6 from:
```ts
export { we-mp-rssHandlers } from "./we-mp-rss";
```
to:
```ts
export { wechatRssHandlers } from "./wechat-rss";
```

- [ ] **Step 4: Update `src/test/mocks/server.ts`**

Change line 7 from:
```ts
import { we-mp-rssHandlers } from "./handlers/we-mp-rss";
```
to:
```ts
import { wechatRssHandlers } from "./handlers/wechat-rss";
```

Change line 23 from:
```ts
  ...we-mp-rssHandlers,
```
to:
```ts
  ...wechatRssHandlers,
```

- [ ] **Step 5: Run tests to verify mock infrastructure works**

Run: `pnpm test`
Expected: All tests pass (MSW server correctly uses renamed handlers)

- [ ] **Step 6: Commit**

```bash
git add src/test/mocks/
git commit -m "refactor: rename we-mp-rss mock handler to wechat-rss"
```

---

### Task 5: Update E2E test names

**Files:**
- Modify: `e2e/error-states.spec.ts:469-475`

- [ ] **Step 1: Update test comments and names**

Change line 469 from:
```ts
  // ── ES-013: we-mp-rss 连接测试失败 ──
```
to:
```ts
  // ── ES-013: we-mp-rss 连接测试失败 ──
```

Change line 471 from:
```ts
  test('ES-013: we-mp-rss 连接失败 → 显示中文失败原因', async ({ page }, testInfo) => {
```
to:
```ts
  test('ES-013: we-mp-rss 连接失败 → 显示中文失败原因', async ({ page }, testInfo) => {
```

Change line 475 from:
```ts
    // Mock we-mp-rss status API to return failure
```
to:
```ts
    // Mock we-mp-rss status API to return failure
```

- [ ] **Step 2: Commit**

```bash
git add e2e/error-states.spec.ts
git commit -m "refactor: update E2E test names from we-mp-rss to we-mp-rss"
```

---

### Task 6: Update project root docs

**Files:**
- Modify: `README.md:57-58,131`
- Modify: `DEPLOY.md:66-72`
- Modify: `AGENTS.md:14,32`
- Modify: `AGENT_HANDOFF.md` (multiple lines)
- Modify: `scripts/deploy/server-pull-and-restart.sh:126`

- [ ] **Step 1: Update `README.md`**

Change line 57 from:
```
# we-mp-rss（可选）
```
to:
```
# we-mp-rss（可选）
```

Change line 58 from:
```
# WE_MP_RSS_BASE_URL="http://localhost:8001"
```
to:
```
# WE_MP_RSS_BASE_URL="http://localhost:8001"
```

Change line 131 from:
```
| we-mp-rss 集成 | `/admin/integrations/we-mp-rss` |
```
to:
```
| we-mp-rss 集成 | `/admin/integrations/wechat-rss` |
```

- [ ] **Step 2: Update `DEPLOY.md`**

Change lines 66-72 from:
```markdown
## we-mp-rss Sidecar

we-mp-rss 是可选的本地 sidecar 服务，本项目**只读消费**其数据。

```bash
# 启动 we-mp-rss（可选）
docker compose --profile we-mp-rss up -d
```
```
to:
```markdown
## we-mp-rss Sidecar

we-mp-rss 是可选的本地 sidecar 服务，本项目**只读消费**其数据。

```bash
# 启动 we-mp-rss（可选）
docker compose --profile we-mp-rss up -d
```
```

- [ ] **Step 3: Update `AGENTS.md`**

Change line 14 from:
```
1. we-mp-rss 是 sidecar，不嵌入本项目，不写其数据库。
```
to:
```
1. we-mp-rss 是 sidecar，不嵌入本项目，不写其数据库。
```

Change line 32 from:
```
- `/integrations/we-mp-rss`
```
to:
```
- `/integrations/wechat-rss`
```

- [ ] **Step 4: Update `AGENT_HANDOFF.md`**

Replace all occurrences of the following patterns throughout the file:
- `we-mp-rss sidecar` → `we-mp-rss sidecar`
- `we-mp-rss` → `we-mp-rss`
- `we-mp-rss` → `we-mp-rss`
- `localhost:8001` → appropriate `WE_MP_RSS_BASE_URL` reference (or `localhost:8001`)
- `shenlun-staging-wewe` → `shenlun-staging-we-mp-rss`
- `wewe_data_staging` → `we_mp_rss_data_staging`
- `100.117.96.1:4000` → `100.117.96.1:8001`
- `we-mp-rss 配置` → `we-mp-rss 配置`
- `we-mp-rss 后台` → `we-mp-rss 后台`
- `we-mp-rss 配代理` → `we-mp-rss 配代理`
- `we-mp-rss 风控` → `we-mp-rss 风控`
- `we-mp-rss running` → `we-mp-rss running`

- [ ] **Step 5: Update `scripts/deploy/server-pull-and-restart.sh`**

Change line 126 from:
```bash
# Ensure caddy is running (it depends on app healthy + we-mp-rss, but force-check)
```
to:
```bash
# Ensure caddy is running (it depends on app healthy + we-mp-rss, but force-check)
```

- [ ] **Step 6: Commit**

```bash
git add README.md DEPLOY.md AGENTS.md AGENT_HANDOFF.md scripts/deploy/server-pull-and-restart.sh
git commit -m "docs: replace we-mp-rss references with we-mp-rss in project docs"
```

---

### Task 7: Delete old infrastructure directory

- [ ] **Step 1: Remove `infra/wechat-rss/we-mp-rss/` directory**

```bash
rm -rf infra/wechat-rss/we-mp-rss/
```

- [ ] **Step 2: Verify deletion**

Run: `ls infra/wechat-rss/we-mp-rss/ 2>/dev/null || echo "Deleted successfully"`
Expected: "Deleted successfully"

- [ ] **Step 3: Commit**

```bash
git add -A infra/wechat-rss/we-mp-rss/
git commit -m "chore: remove old we-mp-rss data directory"
```

---

### Task 8: Update active docs files

**Files:**
- Modify: `docs/local-wechat-rss.md`
- Modify: `docs/mcp.md`
- Modify: `docs/DEPLOY.md`
- Modify: `docs/codebase-overview.md`
- Modify: `docs/testing.md`
- Modify: `docs/acceptance/local-wechat-rss-acceptance.md`
- Modify: ~20 other active doc files (batch replace)

- [ ] **Step 1: Batch replace in all active docs**

Run the following sed commands to replace old references across active docs:

```bash
# Replace we-mp-rss → we-mp-rss (case-sensitive)
find docs/ -name "*.md" -not -path "docs/archive/*" -not -path "docs/handover/*" -not -path "docs/handoff/*" -not -path "docs/audit/screenshots/*" -not -name "*2026-06-12*" -not -name "*2026-06-15*" -exec sed -i '' 's/we-mp-rss/we-mp-rss/g' {} +

# Replace we-mp-rss → we-mp-rss
find docs/ -name "*.md" -not -path "docs/archive/*" -not -path "docs/handover/*" -not -path "docs/handoff/*" -not -path "docs/audit/screenshots/*" -not -name "*2026-06-12*" -not -name "*2026-06-15*" -exec sed -i '' 's/we-mp-rss/we-mp-rss/g' {} +

# Replace WE_MP_RSS → WE_MP_RSS
find docs/ -name "*.md" -not -path "docs/archive/*" -not -path "docs/handover/*" -not -path "docs/handoff/*" -not -path "docs/audit/screenshots/*" -not -name "*2026-06-12*" -not -name "*2026-06-15*" -exec sed -i '' 's/WE_MP_RSS/WE_MP_RSS/g' {} +

# Replace localhost:8001 → localhost:8001 (only in docs, not in the migration script)
find docs/ -name "*.md" -not -path "docs/archive/*" -not -path "docs/handover/*" -not -path "docs/handoff/*" -not -path "docs/audit/screenshots/*" -not -name "*2026-06-12*" -not -name "*2026-06-15*" -exec sed -i '' 's/localhost:8001/localhost:8001/g' {} +

# Replace we-mp-rss → we-mp-rss (in case any camelCase references exist)
find docs/ -name "*.md" -not -path "docs/archive/*" -not -path "docs/handover/*" -not -path "docs/handoff/*" -not -path "docs/audit/screenshots/*" -not -name "*2026-06-12*" -not -name "*2026-06-15*" -exec sed -i '' 's/we-mp-rss/we-mp-rss/g' {} +
```

- [ ] **Step 2: Verify no remaining references in active docs**

Run: `grep -rn "wewe\|we-mp-rss\|WE_MP_RSS\|localhost:8001" docs/ --include="*.md" | grep -v "archive\|handover\|handoff\|audit/screenshots\|2026-06-12\|2026-06-15\|we-mp-rss_admin\|fix-sync-skip" | head -20`
Expected: 0 results, or only references in the migration design doc and migration plan doc (which intentionally reference the old name)

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: replace we-mp-rss references with we-mp-rss in active docs"
```

---

### Task 9: Verify no old references remain in source code

- [ ] **Step 1: Search for any remaining old references in src/ and e2e/**

Run: `grep -rn "wewe\|we-mp-rss\|WE_MP_RSS\|localhost:8001" src/ e2e/ --include="*.ts" --include="*.tsx" | grep -v "generated/prisma\|node_modules\|\.next" | grep -v "page.tsx.*RedirectPage\|page.goto.*we-mp-rss\|→ 301.*we-mp-rss"`
Expected: 0 results (redirect page function names already renamed in Task 2, old route test kept intentionally)

- [ ] **Step 2: Run full validation**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: All pass

- [ ] **Step 3: Commit (only if any stragglers were fixed)**

If any stragglers were found and fixed:
```bash
git add -A
git commit -m "chore: final cleanup of we-mp-rss references"
```

---

## Verification Summary

After all tasks are complete:

1. **Sync bug fix**: `src/app/api/collectors/wechat/sync/route.ts` now has `getArticle()` enrichment — articles will have content and won't all be skipped
2. **Source code clean**: `grep -rn "wewe\|WeWe\|WE_MP_RSS\|localhost:8001" src/ e2e/ --include="*.ts" --include="*.tsx"` returns 0 results (excluding intentional redirect test)
3. **Docs clean**: Active docs reference only `we-mp-rss` and `localhost:8001`
4. **Build passes**: `pnpm lint && pnpm test && pnpm build` all green
5. **Old infra deleted**: `infra/wechat-rss/we-mp-rss/` no longer exists
