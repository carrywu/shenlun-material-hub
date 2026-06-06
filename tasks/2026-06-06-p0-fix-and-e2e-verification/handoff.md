# P0 修复 & E2E 验证 — Handoff

> 任务日期：2026-06-06
> 状态：✅ 完成

---

## 任务摘要

修复 Codex 复验发现的 4 个 P0 问题，恢复 Playwright E2E 测试全绿。

## 完成内容

| P0 | 修复 | 文件数 |
|----|------|--------|
| P0-001 | Playwright admin 认证 storageState | 4 |
| P0-002 | `/cards` 请求失败友好提示 | 1 |
| P0-003 | Admin 页面 heading 语义 (h1→h2) | 2 |
| P0-004 | AI/IMA 设置接口 500 → 503 | 5 |

附带修复 E2E 测试稳定性问题 6 项（admin strict mode、Checkbox 选择器、ai-config flaky 等待）。

## 验证结果

- `pnpm lint` ✅
- `pnpm test` ✅ (36 files / 249 tests)
- `pnpm build` ✅
- `pnpm exec playwright test` ✅ (160 passed / 0 failed / 12 did not run)

## 关键文件

- 详细验证报告：`docs/testing/p0-e2e-validation-report.md`
- 实施清单：`tasks/2026-06-06-p0-fix-and-e2e-verification/p0-implementation-todolist.md`
- 开发 TodoList：`docs/audit/development-todolist.md`

## 唯一下一步

进入 P1 阶段：按 `docs/audit/development-todolist.md` 执行 P1-001 ~ P1-005。
