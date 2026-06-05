# 任务目录

本目录是项目的长期任务记忆，用于跨 prompt、跨 Agent、跨工作日延续工作。

使用它的目的：让 Claude Code 和 Codex 可以交替开发，而不依赖聊天历史。

## 什么时候创建任务目录

满足任一条件时，创建：

```text
tasks/YYYY-MM-DD-short-name/
```

- 预计超过 2 小时。
- 修改 5 个以上文件。
- 涉及 3 个以上模块。
- 涉及 auth、RBAC、数据隔离、Prisma、部署、备份或破坏性数据路径。
- 需要 Playwright 或人工浏览器 QA。
- 任务可能被中断，或需要交给另一个 Agent。

小型文档或单文件修改可以不创建任务目录，但最终报告仍必须包含验证结果。

## 目录结构

```text
tasks/YYYY-MM-DD-short-name/
  prd.md
  plan.md
  journal.md
  validation.md
  handoff.md
```

新任务从 `tasks/templates/` 复制模板。

## Agent 交接入口

以后切换 Claude Code、Codex、Gemini 或新会话时，只说：

```text
请先读取 AGENT_HANDOFF.md，并严格按里面的当前任务、下一步行动和验证要求继续。
```

下一位 Agent 不应默认重读全仓库。它应先读统一入口、当前任务 handoff、plan、validation，再只检查任务相关文件。只有证据不足时才扩展范围。

## 必备任务文件

- `prd.md`：目标、需求、非目标、验收标准、风险。
- `plan.md`：实施顺序、文件范围、测试计划。
- `journal.md`：每轮工作的时间线记录。
- `validation.md`：命令、结果、失败、证据。
- `handoff.md`：当前状态和下一步唯一行动。

## Claude Code 和 Codex 交替开发规则

推荐个人工作流：

1. 一个 Agent 做只读分析并写/更新 `plan.md`。
2. 你确认方向。
3. 一个 Agent 只实现一个小步骤。
4. 同一个 Agent 运行目标验证。
5. Agent 更新 `journal.md`、`validation.md`、`handoff.md`。
6. 下一个 Agent 从 `AGENT_HANDOFF.md` 开始。

不要让两个 Agent 同时编辑同一批文件。需要并行时，必须在 `plan.md` 明确文件所有权。

## 检查点规则

长任务每完成一步，都必须更新：

- 修改文件。
- 已满足的验收标准。
- 已运行的验证。
- 当前风险。
- 下一步唯一行动。

## 完成清单

- [ ] 验收标准已满足。
- [ ] 相关测试/检查已记录到 `validation.md`。
- [ ] 已检查 `git status --short`。
- [ ] 已检查 `git diff --stat`。
- [ ] `handoff.md` 写明任务完成，或写明唯一下一步行动。
- [ ] 只有当规则会长期复用时，才把它加入 docs 或 AGENTS.md。
