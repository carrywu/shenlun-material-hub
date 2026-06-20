# Article Export Annotation Fix TodoList

## Problem Summary

文章详情页正文批注少显示；PDF / Word 带批注导出定位不全；PDF 保存标题没有区分无批注版与带批注版。

## Current Behavior

- 问题文章 `cmqhjuyf500adpavy617ca578` 的详情 API 返回 10 条批注，正文 DOM 只渲染 5 个唯一批注标记。
- PDF 带批注打印快照只定位 7 个正文编号，3 条进入“未定位到正文位置”。
- PDF `documentTitle` 固定为文章标题，不带 `_无批注` / `_带批注`。

## Expected Behavior

- 详情页正文中，所有能合理定位到原文的批注都显示高亮/标记。
- PDF / Word 带批注版共用同一套定位结果，正文显示 `[n]`，文末保留完整批注列表。
- 真正无法定位的批注保留在文末，并标记“未定位到正文位置”。
- PDF 保存标题区分无批注版与带批注版。

## Suspected Root Cause

- `ArticleContentRenderer.insertAnnotationsIntoHtml` 在循环中替换文本节点，后续批注仍引用旧节点，导致同一文本节点里的后续批注静默丢失。
- `buildAnnotatedContent` 只折叠空白，不处理中文引号差异，且不允许包含式重叠批注。
- `ArticleExportMenu` 的 `useReactToPrint({ documentTitle })` 固定传 `article.title`。

## Files to Inspect

- `src/components/articles/ArticleContentRenderer.tsx`
- `src/lib/article-export/build-annotated-content.ts`
- `src/components/articles/ArticleExportMenu.tsx`
- `src/components/articles/__tests__/ArticleContentRenderer.test.tsx`
- `src/lib/article-export/__tests__/build-annotated-content.test.ts`
- `src/components/articles/__tests__/ArticleExportMenu.test.tsx`
- `e2e/article-export.spec.ts`

## Planned Changes

- [x] Add failing Vitest regressions for detail-page annotation rendering.
- [x] Add failing Vitest regressions for export annotation positioning.
- [x] Add failing Vitest regression for PDF document title suffix.
- [x] Implement shared tolerant annotation matching behavior.
- [x] Update detail-page DOM insertion to precompute ranges before mutation.
- [x] Update export builder to reuse the improved matching behavior.
- [x] Update PDF document title to include export variant.
- [x] Run focused tests and fix failures.
- [x] Run standard validation commands.
- [x] Manually verify the reported article with browser automation.

## Tests to Add

- Multiple annotations in one original text node all render.
- Contained/overlapping annotations do not disappear.
- Chinese quote variants like `‘限时拍摄’` match source text with `“限时拍摄”`.
- Duplicate same-text annotations still render `[1][2]`.
- Clean export remains free of marks, numbers, and annotation section.
- PDF document title includes `_无批注` / `_带批注`.

## Validation Commands

```bash
pnpm test src/components/articles/__tests__/ArticleContentRenderer.test.tsx
pnpm test src/lib/article-export/__tests__/build-annotated-content.test.ts
pnpm test src/components/articles/__tests__/ArticleExportMenu.test.tsx
pnpm exec playwright test e2e/article-export.spec.ts --project=admin --workers=1
pnpm lint
pnpm test
pnpm build
```

## Risks / Rollback Plan

- Contained overlap handling may change highlight boundaries. Keep crossing overlaps conservative and mark unsafe cases unlocated.
- Multi-id mark support may affect hover behavior. Preserve `data-annotation-id` and add tests.
- Rollback can revert matcher/rendering changes independently from the PDF title suffix fix.
