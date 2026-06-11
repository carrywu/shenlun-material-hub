# P6 交接文档：收藏功能 + 角色配额

## 改了什么

### 配额辅助
- `src/lib/favorite-quota.ts`：`getFavoriteLimits(user)`（ADMIN→Infinity，USER→100 默认，VERIFIED→查表 300）+ `getCurrentFavoriteCount(userId)`

### 收藏接口
- `GET /api/favorites`：当前用户收藏列表（倒序，含 contentItem 摘要）
- `POST /api/favorites`：批量收藏
  - **整批超上限 → 400**（不部分收藏）
  - **未审核文章被过滤**（仅 `adminReviewStatus=approved` 可收藏），记入 `skipped`
  - 已收藏的（unique 冲突）跳过，记入 `alreadyFavorited`
- `DELETE /api/favorites/[id]`（[id]=contentItemId）：移除收藏 + **事务内删除该用户基于该文章的 MaterialCard**（公共卡和别人的卡不动）

### 配额管理接口
- `GET /api/admin/role-quotas`：管理员查配额列表
- `PUT /api/admin/role-quotas`：upsert 配额（仅 USER/VERIFIED_USER 可配，ADMIN 不入库；非负整数校验）

### 前端
- `src/app/admin/settings/quotas/page.tsx`：配额设置页（每角色一行 input + 保存按钮）

## 收藏规则
| 规则 | 实现 |
|---|---|
| 软收藏（文章本体只存一份） | ArticleFavorite 关系表，文章不复制 |
| 仅收藏 approved 文章 | POST 内 `contentItem.findMany` 过滤 |
| 整批超上限拒绝 | `currentCount + N > limit` → 400 |
| 移除连带删用户卡 | DELETE 事务内 `materialCard.deleteMany({ ownerUserId: user.id, contentItemId })` |
| USER/VERIFIED_USER 都能收藏 | `requireAuth`（不限角色） |
| ADMIN 不限 | `getFavoriteLimits` 返 Infinity |

## 配额默认（需 staging apply migration + seed 后生效）
- USER: 100，VERIFIED_USER: 300（P2 seed 脚本 `pnpm seed:role-quotas`）
- 管理员可在 `/admin/settings/quotas` 改

## 测试结果（本地 worktree）
- `pnpm lint`：**0 error，16 warning**（既有）
- `pnpm test`：**321/321 passed**（47 文件）
  - 新增：favorite-quota 4 + favorites route 5 + favorites/[id] 2 + role-quotas 5 = 16 个新单测
- `pnpm build`：成功（含 `/admin/settings/quotas`、`/api/admin/role-quotas` 路由）
- e2e：my-articles.spec.ts 4 个用例（fixture 依赖，本地 skip）

## 实现过程的关键修正
- **`vi.hoisted` 修复**：favorites 测试里 `dbMock` 必须用 `vi.hoisted()` 包裹（vitest 把 vi.mock 提升到声明之前），否则 ReferenceError。所有 mock 引用的变量都遵循此模式。
- **mock fidelity 修正**：「未审核文章被过滤」用例改用 `mockImplementation` 按 route 传的 `where.adminReviewStatus` 过滤 canned rows，真正验证 approval guard（之前 canned 数据无论 route 过滤什么都返回全部，测试是假的）。

## 给 P7
- 「我的文章」页：GET `/api/favorites` 渲染列表
- 详情页「移除」按钮：DELETE `/api/favorites/[id]`
- 批量勾选：POST `/api/favorites` `{ contentItemIds: [...] }`
- 配额超上限的错误提示文案已在后端（`error` 字段），前端直接 toast 展示

## 相关 commit
- `0eab466` test(favorite-quota): lock limit resolver behavior
- `e56971d` feat(quota): favorite limit resolver with role defaults
- `614ea07` test(favorites): lock batch favorite + delete-with-cards
- `ac3e513` feat(favorites): batch favorite with quota + approval guard; delete with card cleanup
- `0025414` test(role-quotas): lock admin get/put behavior
- `103616d` feat(role-quotas): admin get/put per-role favorite limit
- `96b5240` feat(admin): role quota settings page
- `21876ab` test(e2e): favorites batch and removal (fixture-dependent)
