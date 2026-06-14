# 2026-06-14 Bug 修复 TodoList

## P0

- [x] 修复重新 AI 评估后详情页显示旧结果（Bug 1）
- [x] 修复批量 AI 评估重新评估确认弹窗（Bug 6）
- [x] 修复文章管理页 ID 搜索（Bug 5）

## P1

- [x] 修复文章详情页批注提示被遮盖（Bug 2）
- [x] 精简 IMA 配置页字段（Bug 3）
- [x] 排查文章详情页格式与原文不一致问题（Bug 4）

## P2

- [x] 增加 Playwright 回归测试（`tests/e2e/bugfix-regression.spec.ts`）
- [x] lint / test / typecheck 全部通过
- [x] 更新交接文档（`docs/bugfix/2026-06-14-bugfix-handoff.md`）

## 附带改动

- [x] 新增本地开发一键启动脚本 `scripts/dev.sh`（含端口冲突交互处理）
- [x] `package.json` 新增 `pnpm dev:up` 脚本
