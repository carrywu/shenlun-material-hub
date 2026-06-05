# 测试与验证指南

本项目使用 Next.js 16、Prisma 7、SQLite、Vitest、ESLint 和 Playwright。

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

截至 2026-06-05，`pnpm exec playwright test` 不是干净基线。

交接验证中最近观察到：

```text
总计 14 个测试
11 failed
2 skipped
1 passed
```

已知失败区域：

- `e2e/admin-auth.spec.ts`
  - redirect 断言未兼容 `/admin/login?redirect=%2Fadmin`。
  - 部分 spec 的登录表单 label selector 超时。
- `e2e/articles-filter-remove-column.spec.ts`
  - 找不到文章表头。
  - 找不到 `source-type-select` test id。
- `e2e/subscriptions-wewe-rss.spec.ts`
  - 管理员登录 selector 超时。
- `e2e/ui-chinese-integrity.spec.ts`
  - 预期公共页面/筛选中文文案不存在。
  - 管理员登录 selector 超时。

不要声称 Playwright 通过，除非重新运行命令且退出码为 0。若任务不改 UI/auth 行为，应把 Playwright 记录为“已知失败基线”，不要算作本任务引入的回归。

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
