# 修复网站文章采集后无换行、正文格式丢失 — TodoList

## Problem Summary
网站采集的文章在详情页正文全部挤成一大段，段落/标题/列表/引用/图片位置全丢。

## Current Behavior
5 个网站采集器 + 基类 extractArticleDetail() 全用 `.text()` 抠正文，且从不生成/存储 rawHtml。
本地库 476 篇 web_collector 文章，0 篇有 rawHtml。

## Expected Behavior
新采集文章同时存 rawHtml（清洗 HTML）+ 结构化 fullText（\n\n 分段）；详情页还原原文格式；
旧文章降级显示 + 可控回填；全链路测试覆盖。

## Suspected Root Cause（已确认）
采集端 `.text()` 抹平段落 + 从不写 rawHtml。DB 列/API/渲染器都已就绪，只差采集端产出。

## Files To Inspect（已审计）
- src/services/collectors/base.ts（RawArticle 无 rawHtml；两处 create 不写 rawHtml）
- src/services/collectors/web/*.ts（5 个采集器全 .text()）
- src/services/collectors/wechat/weRssNormalizer.ts（正确，不破坏）
- src/services/content-filter.ts（导航过滤器按 \n 分行，需防误判）
- src/components/articles/ArticleContentRenderer.tsx（已优先 rawHtml；splitParagraphs 只支持双换行）

## Planned Changes（用户选：rawHtml + fullText 都改）

- [x] 1. 审计现状（核对完成）
- [x] 2. 建立绿色测试基线（735 passed）
- [x] 3. 新建统一 content-extractor.ts + 18 个 fixture 单测（754 passed）
- [x] 4. 扩展 RawArticle 加 rawHtml + extractArticleDetail 签名
- [x] 5. 改 base.ts（RSS 分支 / collectFromChannel / 两处 create 写 rawHtml）
- [x] 6. 改 5 个 web 采集器 + 3 个 collect() 传播 rawHtml
- [x] 7. content-filter 导航过滤器回归保护（\n → \n\n + fixture）
- [x] 8. 渲染器 splitParagraphs 单换行降级 + 渲染器测试
- [x] 9. 更新 6 个 collector 测试断言（rawHtml 非空、fullText 含 \n\n）
- [x] 10. 回填脚本 backfill-article-format.ts + 真实 dry-run（9/9 OK）
- [x] 11. Playwright article-format E2E（4 passed）
- [x] 12. pnpm lint / test / build / playwright 全量回归（761 passed, build OK）
- [x] 13. 分阶段 git 提交（7 commits）
- [x] 14. 更新 handoff 文档

## Risks / Rollback
- contentHash 变化导致旧文章 AI 评估标记「过期」（用户已确认接受，不自动重评）
- content-filter 误判短段真实文章为导航页（用 \n\n 分块 + 回归测试防）
- 无 Prisma migration（rawHtml 列已存在）
- 回滚：每个阶段独立提交，可逐个 revert
