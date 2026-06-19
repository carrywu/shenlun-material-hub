# Batch C: Review Loop

## Goal

为 USER 和 VERIFIED_USER 补全复习闭环。

## Scope

```text
src/app/review/page.tsx
src/app/api/review/route.ts
src/app/api/material-cards/route.ts
src/app/api/articles/route.ts
src/app/api/favorites/*
src/app/api/user-content-state/route.ts
prisma/schema.prisma
e2e/review.spec.ts
tests related to review state
```

## Requirements

### C1. USER 复习

USER 可复习自己收藏的文章。

### C2. VERIFIED_USER 复习

VERIFIED_USER 可复习：

```text
自己收藏的文章
自己的 material 卡
```

### C3. ADMIN 复习

ADMIN 可使用前台学习功能，但不得绕过个人 IMA target 要求。

### C4. 复习页 Tab

`/review` 应支持：

```text
收藏文章复习
素材卡复习
```

按角色显示 Tab：

```text
USER: 收藏文章复习
VERIFIED_USER: 收藏文章复习 + 素材卡复习
ADMIN: 收藏文章复习 + 素材卡复习 + 管理入口
```

### C5. 下架文章行为

如果文章已下架但用户曾收藏：

```text
在历史收藏/复习路径显示
只读
显示下架徽章
不允许新生成 material 卡
```

## Required Tests

- USER 收藏文章并复习。
- VERIFIED_USER 复习自己的 material 卡。
- User A 不能复习 User B 的卡。
- 归档 material 卡排除出复习。
- 下架的已收藏文章以只读显示。
- USER 看不到 material 卡复习 Tab。

## Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test e2e/review.spec.ts
```

如果复习入口、底部 Tab 或角色导航变化，额外运行：

```bash
pnpm exec playwright test e2e/auth.spec.ts e2e/mobile-responsive.spec.ts
```

## Done When

- USER 有可用的复习路径。
- VERIFIED_USER 有文章 + 卡片复习路径。
- 私有数据保持隔离。
- 下架历史行为有覆盖。
- `docs/audit/development-todolist.md` 已更新。
- `docs/audit/development-handoff.md` 已更新。
