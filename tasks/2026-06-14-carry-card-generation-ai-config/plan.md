# Plan: carry 生卡入口与 AI Key 保存反馈

## 实施顺序

1. 建立任务文档和细颗粒 TodoList。
2. 修改 `/articles/[id]` 文章详情页：
   - 增加角色判断。
   - 隐藏非管理员 AI 评估入口。
   - 为 VERIFIED_USER 增加素材卡类型选择和生成按钮。
   - 处理生成 API 的成功、已存在、缺配置、未审核、无全文等反馈。
3. 修改 `/settings/ai`：
   - 保存成功后显示成功提示。
   - 保持 API Key 输入框清空和 masked key 展示。
4. 更新测试：
   - API 权限回归。
   - 文章详情角色入口。
   - AI 配置保存反馈。
5. 运行验证并记录结果。
6. 更新 handoff，按 Lore 格式提交。

## 风险控制

- 不改变 `POST /api/content-items/assess` ADMIN-only 权限。
- 不改变 `POST /api/content-items/[id]/generate-card` 权限模型。
- 不输出或保存明文 API Key 到文档。
- 只提交本次相关文件。

## 验证命令

- `pnpm build`
- `pnpm exec playwright test e2e/article-detail.spec.ts e2e/ai-config.spec.ts e2e/api-security.spec.ts --project=admin --workers=1`
- `pnpm lint`
- `pnpm test`
