# 测试与验证指南

本项目使用 Next.js 16、Prisma 7、PostgreSQL、Vitest、ESLint 和 Playwright。

本文件是 Codex、Claude Code、Gemini 和人工维护者共享的验证契约。不要依赖聊天历史判断该跑哪些检查。

## 标准命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

## 什么时候跑什么

- 仅文档改动：
  - 条件允许时运行 `pnpm lint`、`pnpm test`、`pnpm build`。
  - 除非文档改了任务或 QA 流程，否则 Playwright 可选。
- 单元/helper/service 改动：
  - 先运行相关 Vitest 文件。
  - 再运行 `pnpm test`。
- API route 行为改动：
  - 先运行相关 route test。
  - 再运行 `pnpm lint`、`pnpm test`、`pnpm build`。
- Auth、RBAC、owner 隔离、Prisma、备份、破坏性数据路径：
  - 运行 `pnpm lint`、`pnpm test`、`pnpm build`。
  - 改行为前先添加或更新回归测试。
  - 如果影响用户可见 auth 流程，再运行 Playwright。
- UI/page 交互改动：
  - 运行 `pnpm lint`、`pnpm test`、`pnpm build`。
  - 运行相关 Playwright spec 或 `pnpm exec playwright test`。

## 当前 Playwright 基线

截至 2026-06-06，`pnpm exec playwright test` 是干净基线。

```text
最新运行结果（2026-06-06，21 个 spec 文件）：
  原有 18 spec：97 passed / 1 flaky (visual-regression discover) / 12 did not run
  新增 3 spec：53 passed / 0 failed
  合计：150 passed / 1 flaky / 12 did not run
  Workers：4
```

### Spec 文件清单（21 个）

| 文件 | 测试数 | 覆盖 |
|------|--------|------|
| auth.spec.ts | 19 | 登录/登出/注册 |
| middleware.spec.ts | 14 | 路由重定向 |
| data-isolation.spec.ts | 11 | API 权限隔离 |
| articles.spec.ts | 12 | 文章列表/筛选 |
| article-detail.spec.ts | 8 | 文章详情 |
| cards.spec.ts | 11 | 素材卡 |
| sources.spec.ts | 6 | 来源管理 |
| sync-records.spec.ts | 4 | 同步记录 |
| explore-discover.spec.ts | 9 | 探索/发现 |
| search.spec.ts | 8 | 搜索 |
| review.spec.ts | 8 | 复习 |
| admin.spec.ts | 20 | 管理后台 |
| ai-config.spec.ts | 7 | AI 配置 |
| wewe-rss.spec.ts | 6 | WeWe RSS |
| settings.spec.ts | 7 | 设置 |
| dead-link.spec.ts | 22 | 死链检查 |
| accessibility.spec.ts | 24 | a11y 扫描 |
| visual-regression.spec.ts | 14 | 视觉回归 |
| mobile-responsive.spec.ts | 18 | 移动端响应式 |
| api-security.spec.ts | 18 | API 安全认证 |
| error-states.spec.ts | 11 | 错误状态处理 |

### 已知 a11y 违规（不阻塞测试）

- `button-name`：Select combobox 缺少 aria-label
- `color-contrast`：text-muted-foreground 对比度不足 4.5:1

不要声称 Playwright 通过，除非重新运行命令且退出码为 0。

## 验证记录格式

每条命令都记录到当前任务的 `validation.md`：

```markdown
## YYYY-MM-DD HH:mm

- Command: `pnpm test`
- Result: passed
- Evidence: 27 files / 144 tests
- Notes: none
```

失败时：

```markdown
## YYYY-MM-DD HH:mm

- Command: `pnpm exec playwright test`
- Result: failed
- Evidence: 11 failed / 2 skipped / 1 passed
- Failing specs:
  - `e2e/admin-auth.spec.ts`
  - `e2e/articles-filter-remove-column.spec.ts`
- Next action: 修复，或明确作为已知基线继续携带
```

## 完成定义

一个任务只有满足以下条件才算完成：

- 验收标准已逐项核对。
- 相关测试/检查已运行，或明确记录未运行原因。
- 失败项包含文件名/spec 名和下一步。
- 已检查 `git status --short` 和 `git diff --stat`。
- 当前任务的 `handoff.md` 写明任务完成，或写明唯一下一步行动。
