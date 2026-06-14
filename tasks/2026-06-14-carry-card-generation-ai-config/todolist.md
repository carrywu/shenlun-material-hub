# TodoList

## 文档

- [x] 创建任务目录。
- [x] 创建 `prd.md`。
- [x] 创建 `plan.md`。
- [x] 创建 `todolist.md`。
- [x] 创建 `validation.md`。
- [x] 创建 `handoff.md`。

## 文章详情页

- [x] 检查 `/articles/[id]` 当前角色判断。
- [x] 增加认证用户生卡所需状态。
- [x] 增加素材卡类型选择。
- [x] 增加生成素材卡请求函数。
- [x] 处理生成成功提示。
- [x] 处理已存在素材卡提示。
- [x] 处理缺 AI 配置提示并链接设置页。
- [x] 处理未审核和无全文禁用原因。
- [x] 隐藏非管理员 AI 评估按钮。
- [x] USER 显示升级认证引导。
- [x] ADMIN 保持后台管理引导。

## AI 配置页

- [x] 增加保存成功状态。
- [x] 保存开始时清空旧成功提示。
- [x] 保存成功后显示明确提示。
- [x] 保持 API Key 输入框保存后清空。
- [x] 保持 masked key 展示。

## 测试

- [x] 更新 API 安全测试：VERIFIED_USER 不能 AI 评估。
- [x] 更新 API 安全测试：VERIFIED_USER 生卡不因角色返回 403。
- [x] 更新文章详情 E2E：VERIFIED_USER 不显示 AI 评估。
- [x] 更新文章详情 E2E：USER 显示升级引导。
- [x] 更新 AI 配置 E2E：保存成功反馈。

## 验证与交接

- [x] 运行定向 Playwright。
- [x] 运行 `pnpm build`。
- [x] 运行 `pnpm lint`。
- [x] 运行 `pnpm test`。
- [x] 更新 `validation.md`。
- [x] 更新最终 `handoff.md`。
- [x] 提交本次相关改动。
