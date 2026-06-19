# Batch B: User Private Article State

## Goal

把文章阅读 / 收藏 / 忽略 / 复习状态完全迁移到用户私有表。

## Scope

```text
src/app/articles/[id]/page.tsx
src/app/api/content-items/[id]/route.ts
src/app/api/user-content-state/route.ts
src/app/api/favorites/*
src/app/api/articles/route.ts
prisma/schema.prisma
tests related to article state / favorites / data isolation
e2e/article-detail.spec.ts
e2e/articles.spec.ts
e2e/review.spec.ts
```

## Requirements

### B1. 不得用用户行为写全局 ContentItem 状态

用户行为不得更新：

```text
ContentItem.read
ContentItem.bookmarked
ContentItem.ignored
```

### B2. 阅读 / 忽略状态

使用：

```text
UserContentState(userId, contentItemId, read, ignored)
```

### B3. 收藏状态

使用：

```text
ArticleFavorite(userId, contentItemId)
```

### B4. 文章复习状态

如果复习状态未实现，设计或新增：

```text
ArticleReviewState(
  userId,
  contentItemId,
  mastery,
  reviewCount,
  lastReviewedAt,
  nextReviewAt
)
```

### B5. A/B 隔离

User A 的状态绝不能出现在 User B。

## Required Tests

- User A 标记已读；User B 仍看到未读。
- User A 忽略文章；User B 仍看到未忽略。
- User A 收藏文章；User B 看不到已收藏。
- 匿名用户收不到私有状态。
- USER 可复习已收藏文章。
- VERIFIED_USER 可复习已收藏文章和自己的卡。

## Validation

```bash
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test e2e/article-detail.spec.ts e2e/articles.spec.ts e2e/review.spec.ts
```

如果收藏 / 搜索 / 导航行为变化，额外运行：

```bash
pnpm exec playwright test e2e/search.spec.ts e2e/mobile-responsive.spec.ts
```

## Done When

- 无用户可见行为写全局 ContentItem read/bookmarked/ignored。
- A/B 隔离测试通过。
- UI 徽章使用 userRead / userIgnored / userBookmarked 或等价私有状态。
- `docs/audit/development-todolist.md` 已更新。
- `docs/audit/development-handoff.md` 已更新。
