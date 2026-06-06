# Journal

## 2026-06-06

- 创建项目审计任务目录。
- 创建审计 TodoList 初始文件。
- 完成项目状态初查：当前分支 main，当前 commit fb33bfa，API route 62 个，Playwright spec 21 个。
- 确认项目存在 visual regression、a11y、dead-link 和 mobile responsive E2E specs。
- 运行 `pnpm install`，依赖已是最新。
- 运行 `pnpm lint`，退出码 0，但存在 8 个 warning。
- 运行 `pnpm test`，36 个测试文件 / 249 个测试通过。
- 运行 `pnpm build`，构建通过。
- 复用本地 `http://localhost:3001` Next dev 服务；未启动 Docker，避免自动触碰数据库服务。
- 使用 Playwright 定向审计 26 个页面并保存 31 张截图到 `docs/audit/screenshots/`。
- 使用 API 登录 cookie 方式验证受保护页面，后台页面均可进入，结构化结果保存到 `docs/audit/screenshots/admin-authenticated-results.json`。
- 发现 `/cards` 显示“请求失败”，素材卡列表为 0，素材卡生成/编辑/删除路径缺少安全可操作数据。
- 发现 `/admin/settings/ai`、`/settings/ai`、`/settings/ima` 有 500 资源错误。
- 发现 `/admin/tasks` 有 React unique key warning。
- 发现 `/admin/sync-records` 和 `/sync-records` 显示 IMA 404 失败详情，错误表达偏技术化。
- 运行 Playwright 全量并在 20 个失败后停止，结果为 26 passed / 20 failed / 3 interrupted / 216 did not run。
- 运行 a11y 专项，24 passed。
- 运行 visual regression 专项，12 passed / 2 failed；`/explore`、`/discover` 基线高度不匹配。
- 运行 dead-link 专项，10 failed 后停止；主要是测试命中 Next dev 内联 404 字符串的误报。
- 生成 `docs/audit/project-audit-report.md`、`docs/audit/next-development-plan.md`、`docs/audit/development-todolist.md`。
- 更新 `docs/testing/full-project-validation-report.md`。
