# P3 交接文档：文章可见性过滤

## 改了什么
- **`src/lib/data-isolation.ts`**：`contentVisibilityWhere` 对非 ADMIN 注入 `adminReviewStatus: "approved"`（ADMIN 仍返回 `{}`）
- **`src/app/api/articles/route.ts`**：加 `adminReviewStatus` 查询参数，仅 ADMIN 生效；非 ADMIN 由 `contentVisibilityWhere` 强制 approved
- **`src/app/api/content-items/[id]/route.ts`**：GET 加审核检查，非 ADMIN 访问未审核文章返 **404**（防 ID 绕过，用 404 而非 403 避免泄露文章存在性）
- **`e2e/articles.spec.ts`**：追加 2 个审核可见性 e2e（依赖 fixture，本地 skip）

## 权限矩阵
| 场景 | USER/VERIFIED_USER | ADMIN |
|---|---|---|
| 文章列表默认 | 只看 approved | 全部 |
| 文章列表 `adminReviewStatus=all` | 强制 approved | 全部 |
| 文章列表 `adminReviewStatus=pending_admin` | 强制 approved | 仅 pending_admin |
| 文章详情 approved | 200 | 200 |
| 文章详情 pending_admin / rejected | 404 | 200 |

## 测试结果（本地 worktree）
- `pnpm lint`：**0 error，16 warning**（既有，与 P3 无关）
- `pnpm test`（vitest）：**289/289 passed**（40 文件）
  - 新增：data-isolation-review 4 + articles 2 + content-items/[id] 3 = 9 个新单测
  - 修复：data-isolation-legacy 1 处 `.toEqual` → `.toMatchObject`（因新增 adminReviewStatus 字段）
- `pnpm build`：成功
- e2e：2 个新用例（依赖 staging fixture，本地 test.skip）

## 已知 mock 漂移（不影响功能）
`src/app/api/articles/__tests__/route.test.ts` 里 mock 的 `contentVisibilityWhere` 仍返回**旧结构**（不含 `adminReviewStatus`），没有同步真实实现的注入行为。这不影响 T3 测试通过（路由对非 ADMIN 不直接写 where.adminReviewStatus，由 mocked 的 contentVisibilityWhere 返回值决定），但意味着 articles 路由级单测**没有真正验证非 ADMIN 的 approved 过滤**。该覆盖由 `data-isolation-review.test.ts`（直接测真实函数）兜底。如需路由级忠实覆盖，可后续更新该 mock。

## 给后续 PR
- **P4** 审核 approve 时务必设 `adminReviewStatus='approved'` + `publicVisibleAt`，否则文章对普通用户不可见
- **P7** 前台「今日推荐」/「探索区」都依赖 approved 过滤，复用 `contentVisibilityWhere`，无需重复实现
- 非 ADMIN 的 approved 过滤是**列表级 + 详情级双保险**，防 ID 绕过

## 相关 commit
- `bb86a60` test(data-isolation): lock adminReviewStatus filter behavior
- `045af1e` feat(data-isolation): filter non-admin to approved articles
- `82c1a72` feat(articles): add adminReviewStatus filter for admin users
- `7f93153` feat(content-items): block non-admin from unapproved articles
- `1ec0718` test(e2e): article review visibility (fixture-dependent, skip locally)
