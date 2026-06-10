# WeWe RSS 用户级隔离 — 交接文档

> 创建日期：2026-06-10
> 状态：进行中

## 1. 任务目标

将 WeWe RSS 集成从当前的"共享模式"改造为"用户级隔离"：
- 用户各自订阅不同的公众号
- 用户只能看到自己订阅的公众号文章
- 系统共享文章保留可见
- 管理员统一管理 WeWe RSS 系统配置

## 2. 设计决策

| 决策 | 选择 |
|---|---|
| 隔离方式 | 用户级隔离（每个用户绑定微信读书账号） |
| 已有文章 | 保留可见（系统共享） |
| 订阅流程 | WeWe RSS 订阅后同步到申论 |
| WeweAccount 时机 | Phase 2 建表，Phase 3 实现绑定 |

## 3. 已完成内容

### Phase 1: P0 安全修复
- 修复 `wewe-rss-api.ts` HTML 响应处理（checkHealth + listFeeds 加 content-type 检查）
- `settings/integrations/wewe-rss` API 权限修正（GET 按角色返回，POST/PUT/DELETE 改 requireAdmin）
- 用户设置页改造（VERIFIED_USER 只看到只读状态和模式说明，管理员看到完整配置）

### Phase 2: 数据模型
- 新增 WeweAccount + WeweSubscription Prisma 模型
- User/Source 模型添加 relations
- 新增订阅同步 API (`/api/user/subscriptions/sync`)
- 新增订阅管理 API (`/api/user/subscriptions`)
- 新增用户订阅页面 (`/settings/subscriptions`)
- 新增 `subscriptionVisibilityWhere()` 过滤函数
- 替换 articles + content-items API 的过滤逻辑

### Phase 5: 体验增强
- 创建 MissingConfigDialog 组件
- 创建 useMissingConfigDialog hook
- 集成到：CollectButton、ArticleDetailPage、WeweRssIntegrationPage、UserAiSettingsPage

### Phase 6: 测试
- 5 个新单元测试（16 个测试用例）
- 326 tests all passed
- E2E 测试新增 permissions-and-dialogs.spec.ts

## 4. 修改文件清单

### Phase 1 安全修复
- `src/services/integrations/wewe-rss-api.ts` — HTML 响应 content-type 检查
- `src/app/api/settings/integrations/wewe-rss/route.ts` — 权限修正
- `src/app/settings/integrations/page.tsx` — 用户设置页改造

### Phase 2 数据模型
- `prisma/schema.prisma` — WeweAccount + WeweSubscription 模型
- `src/app/api/user/subscriptions/route.ts` — 订阅管理 API（新建）
- `src/app/api/user/subscriptions/sync/route.ts` — 订阅同步 API（新建）
- `src/app/settings/subscriptions/page.tsx` — 用户订阅页面（新建）
- `src/lib/data-isolation.ts` — subscriptionVisibilityWhere 函数
- `src/app/api/articles/route.ts` — 使用 subscriptionVisibilityWhere
- `src/app/api/content-items/route.ts` — 使用 subscriptionVisibilityWhere

### Phase 5 体验增强
- `src/components/ui/missing-config-dialog.tsx` — Dialog 组件（新建）
- `src/hooks/use-missing-config-dialog.tsx` — Hook（新建）
- `src/components/CollectButton.tsx` — 集成权限 Dialog
- `src/app/articles/[id]/page.tsx` — 集成 AI/权限 Dialog
- `src/components/integrations/WeweRssIntegrationPage.tsx` — 集成 WeWeRSS Dialog
- `src/app/settings/ai/page.tsx` — 集成权限 Dialog

### 测试
- 5 个新单元测试文件
- `e2e/permissions-and-dialogs.spec.ts` — E2E 测试（新建）
- `src/app/api/articles/__tests__/route.test.ts` — 更新 mock

### 文档
- `docs/audit/wewe-rss-integration-assessment.md` — 评估报告（新建）
- `tasks/2026-06-10-wewe-rss-user-isolation/todolist.md` — Todolist（新建）
- `tasks/2026-06-10-wewe-rss-user-isolation/handoff.md` — 交接文档（新建）

## 5. 数据库变更

- 新增 `WeweAccount` 表
- 新增 `WeweSubscription` 表
- User 模型新增 `weweAccount` / `weweSubscriptions` 关系
- Source 模型新增 `weweSubscriptions` 关系

## 6. 环境变量变更

```env
WEWERSS_BASE_URL=http://wewerss:4000
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210/wewerss
```

## 7. 部署注意事项

- Prisma 迁移：`npx prisma migrate deploy`
- 现有文章不受影响（ownerUserId=null 保持可见）
- VERIFIED_USER 设置页将不再展示系统配置字段

## 8. 遗留风险

- WeWe RSS 可能没有账号管理 API（Phase 3 需调研）
- 微信读书风控风险（每个用户独立账号分散风险）

## 9. 后续计划

- Phase 3: 扫码绑定微信读书
- Phase 4: 管理员 WeWe RSS 配置页

## 10. 测试结果

（部署后更新）
