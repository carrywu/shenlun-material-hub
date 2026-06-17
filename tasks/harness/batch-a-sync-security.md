# Batch A: Sync and API Security

## Goal

修复权限、owner 隔离、IMA 同步安全问题。

## Scope

只检查和修改以下相关文件：

```text
src/app/api/articles/route.ts
src/app/api/articles/[id]/sync-to-ima/route.ts
src/app/api/sync/route.ts
src/app/api/material-cards/route.ts
src/services/ima-sync.ts
src/lib/data-isolation.ts
tests related to auth / sync / data isolation
e2e/api-security.spec.ts
e2e/sync-records.spec.ts
```

## Requirements

### A1. API auth policy

明确并强制 `/api/articles` 是公开还是需要登录。

期望策略：

- 公开文档页可以是 public。
- 核心学习页需要登录。
- 如果 `/api/articles` 保持 public 以提供 approved 文章，只能暴露 approved 的公共文章数据。
- 不得向匿名用户返回任何私有用户状态。

### A2. SyncRecord owner 隔离

`GET /api/sync?syncRecordId=...` 必须强制：

```text
user.id 拥有该 SyncRecord
或 user.role = ADMIN
否则返回 404
```

### A3. 卡片同步历史 owner 隔离

`GET /api/sync?cardId=...` 必须强制：

```text
card.ownerUserId = user.id
或 user.role = ADMIN
否则返回 404
```

### A4. syncArticle 不得同步他人卡片

同步文章时：

```text
只包含满足以下条件的 materialCards：
ownerUserId = currentUser.id
confirmed = true
archivedAt = null
```

不得同步他人 confirmed 卡片。

### A5. syncMaterialCard service 层 owner 校验

不要只依赖 route 层检查。

`syncMaterialCard` 必须校验：

```text
card 存在
card.ownerUserId = userId
card.archivedAt = null
card.confirmed = true
```

ADMIN 例外（如需要）必须显式声明。

### A6. 素材卡创建权限

明确 `POST /api/material-cards` 是否允许 USER。

期望需求：

```text
USER 不能创建 AI / material 卡
VERIFIED_USER 和 ADMIN 可创建自己的卡
```

如果手动建卡本意是给 USER，必须显式文档化；否则要求 VERIFIED_USER。

## Required Tests

补充或更新测试：

- 匿名用户不能从 `/api/articles` 收到私有用户状态。
- User A 不能通过 syncRecordId 访问 User B 的 syncRecord。
- User A 不能通过 cardId 访问 User B 的卡片同步历史。
- User A 文章同步不同步 User B 的 material cards。
- 归档卡片被排除出同步。
- 如需求禁止，USER 不能创建 material card。
- VERIFIED_USER 可创建/同步自己的卡。
- 如设计允许，ADMIN 可查全局记录。

## Validation

```bash
pnpm test
pnpm lint
pnpm build
```

因本批次触及权限、owner 隔离、IMA 同步，必须运行 Playwright：

```bash
pnpm exec playwright test e2e/api-security.spec.ts e2e/sync-records.spec.ts
```

如果改动了 `/login`、角色跳转或用户可见 auth 流程，额外运行：

```bash
pnpm exec playwright test e2e/auth.spec.ts e2e/middleware.spec.ts
```

## Done When

- route 层和 service 层都存在 owner 校验。
- 必需测试通过。
- 未新增 env fallback。
- `docs/audit/development-todolist.md` 已更新。
- `docs/audit/development-handoff.md` 已更新。
