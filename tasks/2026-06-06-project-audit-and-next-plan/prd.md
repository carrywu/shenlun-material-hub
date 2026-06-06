# 项目审计与下一步开发计划 PRD

## 目标

接管 `shenlun-material-hub` 后，基于当前代码、真实运行环境、真实页面交互和测试结果，输出项目审计报告、下一步开发计划和可执行开发 TodoList。

## 成功标准

- 已生成 `docs/audit/project-audit-todolist.md`，并按进度即时勾选。
- 已真实启动或复用本地开发服务。
- 已真实查看桌面端和移动端页面。
- 已真实点击关键交互，并记录体验问题。
- 已从普通考公用户、管理员、新用户三个视角评估。
- 已运行基础验证命令和 Playwright 专项检查，或记录阻塞原因。
- 已生成 `project-audit-report.md`、`next-development-plan.md`、`development-todolist.md`。
- 已更新本任务的 `journal.md`、`validation.md`、`handoff.md`。

## 约束

- 不读取 `docs/archive/**`。
- 不修改 `.env`、生产配置、生产数据库或 WeWe RSS sidecar 状态。
- 数据库默认按本地开发库处理；破坏性动作只做取消、preview、dry-run 或 mock。
- 不直接开发新功能；发现问题先分级并进入下一步计划。

