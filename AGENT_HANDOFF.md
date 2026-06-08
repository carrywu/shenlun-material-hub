# Agent 统一交接入口

> 以后 Claude Code、Codex、Gemini 或新的人工维护者接管本项目时，只需要先读取本文件。

## 接管原则

- 不依赖历史聊天记录。
- 以真实代码、当前 Git 状态、当前任务文档为准。
- 不默认重读全仓库；先读本文件和当前任务，再按证据扩展阅读范围。
- 不覆盖无关的本地未提交改动。
- 不修改 `.env`、PostgreSQL 数据库、生产配置或 WeWe RSS sidecar 状态，除非任务明确授权。

## 接管后先执行

```bash
git status --short --branch
git diff --stat
```

需要判断历史背景时再执行：

```bash
git log --oneline -20
```

## 当前活跃任务

**2026-06-08 边界审计与修复进行中**（分支 `audit/boundary-hardening-2026-06-08`）。

目标：按 P0 → P1 → P2 → P3 自主审查并修复边界问题，覆盖权限、数据隔离、接口输入、采集/AI/同步流程、UI 错误态、测试与文档闭环。

当前执行顺序：
1. `SETUP-001`：创建审计追踪文档、开发 todolist、测试报告和交接记录。
2. `P0-001`：修复素材卡生成权限、owner-scoped duplicate、异步任务归属。
3. `P0-002`：修复同步状态/历史查询 owner scope。
4. `P1-001` ~ `P1-004`：内容导入 source、discover visibility、注册输入、分页解析。
5. `P2/P3`：CollectorRun 终态、异步任务扫尾、UI 错误态、全量验证与最终交接。

关键追踪文档：
- `docs/audit/development-todolist-2026-06-08.md`
- `docs/audit/project-audit-report.md` 第 13 节
- `docs/testing/full-project-validation-report.md` 的 2026-06-08 章节

**上一轮全量代码审查修复已完成**（分支 `fix/code-review-2026-06-07`）。

修复概要：
- **T0 测试可信度**：5 项永真断言/cookie 继承修复
- **P0 安全**：5 项（暴力破解保护、JWT 硬编码移除、Dashboard 鉴权+数据隔离、health 端点信息分离）
- **P1 核心**：17 项（AI token 优化、parseAiJson 统一、标注归属、explore 认证、采集器 channelId/质量/超时、标注定位、数据完整性、所有权检查、PostgreSQL 查询、Session 清理）
- **P2 稳定性**：22 项（加密密钥校验、Docker 默认密码、env 验证、originalUrl 空字符串、审计日志脱敏、401/403 区分、用户名校验、temperature 范围、HTTP→HTTPS、日期提取、微信重试、parseInt NaN、visibility 兼容、标签搜索、fullText 派生字段、API Key 掩码、卡片按钮权限、书签持久化、Dockerfile pg 模块、selectedText 限制）
- **P3 代码质量**：13 项（CSS 拼写、display-labels、变量名、alert→toast、gunzip 去重、timing-safe、密码改后保会话、VERIFIED_USER 权限、Input 组件）
- **未修复（低风险重构）**：P3-2 CARD_TYPE_CONFIG 提取、P3-3 renderContent/COLOR_THEMES 提取

详细修复记录见：`docs/audit/project-audit-todolist.md`

## 必读支撑文档

- `docs/audit/project-audit-todolist.md`：代码审查修复清单（含 commit hash）
- `docs/audit/full-code-review-2026-06-07.md`：全量代码审查报告
- `tasks/README.md`：个人开发任务工作流。
- `docs/testing.md`：验证命令和 Playwright 当前基线。
- `docs/handover/RBAC_RESUME_PROMPT.md`：RBAC 接管上下文。
- `docs/mcp.md`：MCP 工具、权限边界和使用规则。

## 当前已知基线

- `pnpm lint`：✅ 通过，0 errors / 16 warnings。
- `pnpm test`：✅ 通过，36 个测试文件 / 259 个测试。
- `pnpm build`：✅ 通过。
- `pnpm exec playwright test`：✅ 174 passed / 1 flaky / 16 did-not-run（9.8m）。

## 质量审计文档

- `docs/audit/full-code-review-2026-06-07.md` — 全量代码审查报告（2026-06-07）
- `docs/audit/project-audit-todolist.md` — 修复清单与进度
- `docs/testing/project-quality-assessment.md` — 项目质量评估（综合评分 4.6/5.0）
- `docs/testing/full-project-test-todolist.md` — 168 项验收检查清单
- `docs/testing/full-project-validation-report.md` — 最终验收报告

## MCP 使用规则

- 浏览器：使用 `shenlun-playwright` MCP 做交互式页面检查；正式 E2E 仍以 `pnpm exec playwright test` 为准。
- 数据库/日志：使用 `shenlun-sqlite-logs` MCP，只读查询 PostgreSQL 和 `SystemLog`。
- 数据库 MCP 默认禁止写入。任何写入、迁移、修复数据必须走任务文档授权、dry-run、备份或临时库验证。

## 每轮结束前必须更新

当前任务目录下：

- `journal.md`：记录本轮做了什么、改了哪些文件、关键决策。
- `validation.md`：记录命令、结果、失败证据或未运行原因。
- `handoff.md`：更新当前状态和下一步唯一行动。

## 当前长期决策

- ✅ **已完成 SQLite → PostgreSQL 迁移**（2026-06-06，分支 `feat/postgresql-migration`）。
  - 数据库：PostgreSQL 16，通过 `@prisma/adapter-pg` + `pg.Pool` 连接。
  - 备份系统：v2 Prisma 序列化格式（不再是文件复制）。
  - MCP 工具：已重写为 PostgreSQL 版本。
  - `better-sqlite3` 保留仅供 WeWe RSS sidecar 只读访问。
  - 迁移详情：`scripts/migrate-sqlite-to-postgres.ts`，662 行数据已验证迁移。

- ✅ **已完成全量代码审查修复**（2026-06-08，分支 `fix/code-review-2026-06-07`）。
  - 修复 57 项问题（5 P0 + 17 P1 + 22 P2 + 13 P3），2 项低风险重构延后。
  - 关键安全加固：暴力破解保护、JWT 硬编码移除、加密密钥校验、Docker 密码强制。
  - 数据隔离：Dashboard/文章/搜索/同步 全链路 ownerUserId 过滤。
