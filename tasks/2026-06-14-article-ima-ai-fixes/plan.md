# Development Plan

## Current Behavior

- 文章详情页 AI 决策展示存在局部硬编码，缺少统一映射。
- AI 评估字段直接来自 `ContentItem`，但 schema 缺少来源、模型、prompt 版本、评估正文 hash。
- 正文渲染逻辑内联在详情页，微信 `rawHtml` 和普通 `fullText` 处理不统一。
- IMA 同步已有 `src/services/ima-sync.ts` 和 `/api/sync`，但结果结构、重复同步、文章正文同步和健康检查不完整。
- 素材卡批量同步入口只在选中后出现，未选择时没有直接反馈。

## Implementation Sequence

1. Add shared Chinese display mappings and unit tests.
2. Add AI provenance schema, migration, write path, admin-only reassess behavior, and tests.
3. Extract safe article content renderer and tests.
4. Refactor IMA sync service for material cards, articles, batch sync, duplicate skip, and health check.
5. Update material-card batch sync UI feedback.
6. Add article-detail IMA sync selector and article-body fallback flow.
7. Add IMA health status to settings page.
8. Add Playwright E2E for the critical user paths.
9. Run validation and update handoff after each phase.

## Risk Controls

- Use additive nullable Prisma fields where possible.
- Do not run destructive database scripts.
- Keep `/api/sync` compatibility while adding the article-specific sync route.
- Enforce permission and ownership checks in backend routes, not only UI.
- Record every validation command in `validation.md`.

## Validation Commands

```bash
pnpm test src/lib/__tests__/display-labels.test.ts
pnpm test
pnpm lint
pnpm build
pnpm exec playwright test --project=admin
```

If a command fails because the local database, IMA target, or dev server is unavailable, record the exact error and the nearest targeted validation that did run.
