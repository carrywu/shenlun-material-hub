# RBAC P0 Foundation 验证日志

## 2026-06-05 20:15

- Command: `pnpm lint`
- Result: passed, exit code 0.
- Evidence: ESLint 完成且未报告错误。
- Notes: pnpm 输出既有配置警告：当前 pnpm 不再读取 `package.json` 内的 `pnpm.onlyBuiltDependencies`。

- Command: `pnpm test`
- Result: passed, exit code 0.
- Evidence: 30 个测试文件通过；177 个测试通过。
- Notes: 仅单元/集成测试。

- Command: `pnpm build`
- Result: passed, exit code 0.
- Evidence: Next.js 16.2.6 production build 编译完成、TypeScript 完成、生成 70 个静态页面，并输出 app route table。
- Notes: build 将 `next-env.d.ts` 从 `.next/dev/types/routes.d.ts` 更新为 `.next/types/routes.d.ts`。

## 2026-06-05 22:30

- Command: `node scripts/mcp/sqlite-readonly-server.mjs --self-test`
- Result: passed, exit code 0.
- Evidence: schemaTables=14；sampleQueryRows=5；systemLogRows=5；rejectedDangerousSql=true；rejectedMultiStatement=true。
- Notes: 验证只读 SQLite/SystemLog MCP 能查询 schema、查询日志，并拒绝 `DELETE` 和多语句 SQL。

- Command: `codex mcp list`
- Result: passed, exit code 0.
- Evidence: 列表包含 `shenlun-playwright` 和 `shenlun-sqlite-logs`，状态为 enabled。
- Notes: Codex MCP 写入全局配置。

- Command: `claude mcp list`
- Result: passed, exit code 0.
- Evidence: 列表包含 `shenlun-playwright` 和 `shenlun-sqlite-logs`。
- Notes: Claude Code 项目级 MCP 处于 Pending approval；首次运行 `claude` 时需要批准 `.mcp.json`。

- Command: Markdown 英文标题残留扫描
- Result: passed, exit code 1 from `rg` because no matches were found.
- Evidence: 未匹配 `Handover`、`Audit date`、`Current Goal`、`Known Baseline Failures` 等旧英文交接标题。
- Notes: 退出码 1 在该扫描中表示没有匹配项。

- Command: `pnpm lint`
- Result: passed, exit code 0.
- Evidence: ESLint 完成且未报告错误。
- Notes: pnpm 仍输出既有 `pnpm.onlyBuiltDependencies` 配置警告。

- Command: `pnpm test`
- Result: passed, exit code 0.
- Evidence: 30 个测试文件通过；177 个测试通过。
- Notes: Vitest 4.1.7。

- Command: `pnpm build`
- Result: passed, exit code 0.
- Evidence: Next.js 16.2.6 production build 编译成功、TypeScript 完成、生成 70 个静态页面，并输出 route table。
- Notes: 未运行 Playwright 全量；当前仍按已知失败基线记录。

## 已知基线失败

来自 `docs/testing.md`，当前 Playwright 基线不干净：

- `pnpm exec playwright test`：交接验证中观察到 11 failed / 2 skipped / 1 passed。
- 不要在重新运行且退出码为 0 前声称 Playwright 通过。
