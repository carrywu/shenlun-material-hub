# TodoList

## 文档准备

- [x] 创建任务目录。
- [x] 写入 `prd.md`。
- [x] 写入 `plan.md`。
- [x] 初始化 `todolist.md`。
- [x] 初始化 `handoff.md`。
- [x] 初始化 `validation.md`。

## 权限与采集

- [x] 检查所有采集 POST API 权限。
- [x] 将网页采集 POST 改为 ADMIN-only。
- [x] 确认微信与 MediaCrawler 采集 POST 已 ADMIN-only。
- [x] 移除首页采集按钮导入。
- [x] 移除首页采集按钮渲染。
- [x] 在 `/admin/articles` 引入采集弹窗状态。
- [x] 将后台“开始采集”按钮改为打开弹窗。
- [x] 弹窗完成后刷新文章列表。

## 首页口径

- [x] 定义首页公开内容过滤条件。
- [x] 将内容条目统计改为全站已审核公开。
- [x] 将最近采集内容改为全站已审核公开。
- [x] 保持素材卡统计为当前用户。
- [x] 修改最近内容空态文案。

## 复习页与导航

- [x] 恢复并调整顶部导航“复习”入口。
- [x] 保持“素材卡”仅 VERIFIED_USER/ADMIN 可见。
- [x] 在复习页读取当前用户角色。
- [x] USER 无卡空态显示升级说明。
- [x] USER 无卡空态按钮跳账号设置。
- [x] VERIFIED_USER/ADMIN 无卡空态显示生成卡说明。
- [x] VERIFIED_USER/ADMIN 无卡空态按钮跳文章列表。

## 文章列表跳转

- [x] 移除文章列表侧边详情状态。
- [x] 移除文章列表侧边详情渲染。
- [x] 行点击跳 `/articles/[id]`。
- [x] 标题点击跳 `/articles/[id]`。
- [x] 保持 checkbox 和管理操作不触发行跳转。

## AI 测试连接与 WeWe RSS

- [x] `/api/ai-config/test` 确认使用 VERIFIED_USER 权限。
- [x] `/api/ai-config/test` 缺个人配置时返回明确错误。
- [x] `/settings/ai` 未配置时显示测试说明。
- [x] `/settings/ai` 未配置时禁用测试按钮。
- [x] `/settings/ai` 测试失败展示接口错误。
- [x] `/settings/integrations/wewe-rss` 非管理员重定向回设置页。
- [x] `/settings/integrations/wewe-rss` 非管理员显示仅管理员提示。

## 测试更新

- [x] 更新文章列表点击跳转 E2E。
- [x] 更新复习页空状态 E2E。
- [x] 更新 AI 配置 E2E。
- [x] 更新采集权限相关 E2E 或 API 测试。

## 验证与交接

- [x] 运行定向测试。
- [x] 运行 `pnpm lint`。
- [x] 运行 `pnpm test`。
- [x] 运行 `pnpm build`。
- [x] 记录验证结果到 `validation.md`。
- [x] 更新最终 `handoff.md`。
