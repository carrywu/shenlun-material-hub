# RBAC 接管提示词

给下一位 Codex / Claude Code / Gemini 接管时使用：

```text
你正在接管 shenlun-material-hub，当前分支为 main。

先读取根目录：
- AGENT_HANDOFF.md

需要 RBAC 细节时再读取：
- docs/handover/README.md
- docs/handover/PROJECT_MASTER_TODO.md
- docs/handover/RBAC_HANDOVER.md
- docs/handover/RBAC_API_AUDIT.md
- docs/handover/RBAC_RISK_REGISTER.md
- docs/testing.md
- docs/mcp.md

不要相信历史聊天记录。先用真实代码状态重新确认：
- git status --short --branch
- git branch --show-current
- git log --oneline -20
- git diff --stat

首要任务：
在新增功能前，修复并验证 P0 RBAC / 部署 / 安全阻断项。

已完成的 P0 RBAC 项：
1. ✅ 补齐 User、Session、owner 字段和 RBAC 关系的 Prisma migration chain。
2. ✅ 添加 A/B 用户隔离测试。
3. ✅ 修复 annotation PATCH/DELETE ownership checks。
4. ✅ 修复 content item annotation GET auth 和 isolation。
5. ✅ 决策并执行 /api/articles public/private policy。
6. ✅ 修复 /api/content-items 和 /api/search 中 unsafe Prisma where OR merges。
7. ✅ 运行 pnpm lint、pnpm test、pnpm build；UI/auth 行为变化时运行 Playwright。

剩余 P0：无（全部已完成）。

已完成的额外 P0 项：
- ✅ P0｜部署｜建立空库迁移与首启验收脚本（`scripts/setup-fresh-db.ts`）
- ✅ P0｜安全｜生产禁用默认管理员密码路径（`src/lib/auth.ts`）

项目约束：
- we-mp-rss 是 sidecar，不嵌入本项目。
- 不写 we-mp-rss 数据库。
- 不做微信逆向，不绕登录/验证码/风控。
- 破坏性数据库操作必须 dry-run。
- 保留手动来源和外部 WeRSS fallback。
- MCP 数据库工具默认只读；写入必须由任务文档临时授权。
- ✅ 已完成 SQLite → PostgreSQL 迁移（2026-06-06）。数据库使用 PostgreSQL 16 + @prisma/adapter-pg。

最终报告必须包含：修改文件、测试命令和结果、剩余风险、人工验收清单。
```
