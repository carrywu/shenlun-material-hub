# 任务 PRD

## 目标

修复需求文档核对出的前台/后台权限、首页口径、复习页空状态、文章列表跳转、个人 AI 测试连接等问题，确保采集能力只在管理员后台使用，普通用户学习链路清晰可走。

## 背景

来源：`/Users/apple/Downloads/需求文档.docx` 与用户后续口径确认。

已确认：

- 所有平台采集只允许 ADMIN 使用。
- 管理员统一在 `/admin/articles` 打开全平台采集弹窗。
- 首页内容类数据展示全站已审核公开内容，个人素材卡统计仍按当前用户。
- `/review` 对所有登录用户开放，空状态按角色给不同引导。
- 顶部导航顺序为首页、文章、素材卡、检索、复习、设置；素材卡仍只给 VERIFIED_USER 和 ADMIN。
- 前台和后台文章列表点击文章均跳转 `/articles/[id]`。
- `/settings/ai` 测试连接只测试当前用户个人 AI 配置。
- 用户侧 WeWe RSS 入口仅管理员可用，非管理员直达回 `/settings`。

## 需求

- [ ] 非 ADMIN 不能看到或调用任何采集能力。
- [ ] `/admin/articles` 的采集按钮打开来源选择弹窗，覆盖全部启用来源。
- [ ] 首页内容统计与最近内容仅统计 `adminReviewStatus=approved` 且 `visibility=public` 的文章。
- [ ] 首页素材卡、待确认、已确认统计仍按当前用户素材卡。
- [ ] `/review` 所有登录用户可访问。
- [ ] `/review` 无卡时，USER 引导到账号设置升级，VERIFIED_USER/ADMIN 引导到文章页生成素材卡。
- [ ] 顶部导航包含复习，且顺序符合最终口径。
- [ ] 文章列表点击行或标题进入 `/articles/[id]`。
- [ ] VERIFIED_USER 在 `/settings/ai` 可测试个人 AI 配置；未配置时禁用测试并说明。
- [ ] 非管理员直达 `/settings/integrations/wewe-rss` 返回 `/settings` 并提示仅管理员可用。

## 验收标准

- [ ] 非 ADMIN 调采集 API 得到 403。
- [ ] 管理员可在 `/admin/articles` 打开采集弹窗。
- [ ] 首页无采集入口，最近内容空态不提示采集。
- [ ] USER/VERIFIED_USER/ADMIN 的复习空状态符合角色口径。
- [ ] 前台和后台文章列表点击跳详情页。
- [ ] 个人 AI 未配置时测试按钮禁用并显示说明。
- [ ] 定向测试、lint、unit test、build 结果记录在 `validation.md`。

## 不在本任务范围

- 不新增数据库字段或迁移。
- 不引入新依赖。
- 不实现 `/admin/articles/[id]` 管理详情页。
- 不改变普通 USER 不能生成素材卡的权限边界。
- 不改变 WeWe RSS sidecar 边界。

## 约束

- 遵守 `AGENTS.md`、`CLAUDE.md` 和项目敏感文件规则。
- 不修改 `.env`、本地数据库、测试报告目录。
- UI/auth 行为变化必须补或更新 Playwright 覆盖。

## 风险

- 风险：现有 E2E 对旧文章列表侧边详情有断言。
  - 影响：测试需要随新跳转行为更新。
  - 缓解：把断言改为 URL 与详情页内容验证。
- 风险：现有 user-facing WeWe RSS 页面仍存在。
  - 影响：非管理员短暂看到页面再重定向。
  - 缓解：保留客户端重定向与明确 toast。

## 验证计划

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm exec playwright test e2e/articles.spec.ts e2e/review.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --workers=1`
