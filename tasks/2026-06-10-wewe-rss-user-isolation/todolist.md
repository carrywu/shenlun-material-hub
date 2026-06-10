# WeWe RSS 用户级隔离 + 安全修复 + 体验增强 Todolist

> 开始日期：2026-06-10
> 范围：Phase 1 + Phase 2 + Phase 5（Phase 3/4 推迟）

---

## Phase 1: P0 安全修复

- [x] 1.1 修复 `wewe-rss-api.ts` HTML 响应处理（checkHealth + listFeeds 加 content-type 检查）
- [x] 1.2 确认公共测试端点认证状态（已有 requireAdmin，无需修改）
- [x] 1.3 `settings/integrations/wewe-rss` API 权限修正（GET 按角色返回，POST/PUT/DELETE 改 requireAdmin）
- [x] 1.4 用户设置页改造（VERIFIED_USER 移除系统配置字段，展示模式说明）

## Phase 2: 数据模型 — 用户级隔离基础设施

- [x] 2.1 新增 WeweAccount + WeweSubscription Prisma 模型
- [x] 2.2 修改 User + Source 模型（添加 relations）
- [x] 2.3 生成 Prisma 迁移（prisma db push + prisma generate）
- [x] 2.4 新增订阅同步 API（`/api/user/subscriptions/sync`）
- [x] 2.5 新增订阅管理 API（`/api/user/subscriptions`）
- [x] 2.6 新增用户订阅页面（`/settings/subscriptions`）
- [x] 2.7 修改文章入库逻辑（weRssNormalizer.ts — 保持 ownerUserId=null，由订阅过滤处理）
- [x] 2.8 新增 `subscriptionVisibilityWhere()` 过滤函数
- [x] 2.9 替换文章查询过滤（articles + content-items API）

## Phase 5: 体验增强 — MissingConfigDialog

- [x] 5.1 创建 `MissingConfigDialog` 组件
- [x] 5.2 创建 `useMissingConfigDialog` hook
- [x] 5.3 集成到 AI 批注页面
- [x] 5.4 集成到 AI 评估按钮
- [x] 5.5 集成到采集按钮
- [x] 5.6 集成到 WeWeRSS 同步页面
- [x] 5.7 集成到 AI 配置页

## Phase 6: 测试

- [x] 6.1 单元测试：HTML 响应处理
- [x] 6.2 单元测试：最后管理员降级防护
- [x] 6.3 单元测试：AI 配置缺失错误格式化
- [x] 6.4 单元测试：订阅过滤隔离
- [x] 6.5 单元测试：VERIFIED_USER 不能改系统配置
- [x] 6.6 E2E 测试：USER 不能进后台
- [x] 6.7 E2E 测试：管理员邀请码页面可访问
- [x] 6.8 E2E 测试：管理员用户管理页面可访问
- [x] 6.9 E2E 测试：用户页展示管理员配置表单
- [x] 6.10 E2E 测试：用户页显示模式说明文案
- [x] 6.11 E2E 测试：HTML 连接测试返回友好错误
- [x] 6.12 E2E 测试：采集按钮存在且可点击
- [x] 6.13 E2E 测试：订阅页面可访问且展示基本元素

## Phase 7: 本地回归测试

- [x] 7.1 `pnpm lint` 通过（仅预存 error-states.spec.ts 有预存错误）
- [x] 7.2 `pnpm test` 通过（326 tests passed）
- [x] 7.3 `pnpm build` 通过
- [ ] 7.4 `pnpm exec playwright test` 全量通过

## Phase 8: 部署

- [ ] 8.1 Docker 构建 + TCR 推送
- [ ] 8.2 服务器拉取 + Prisma 迁移
- [ ] 8.3 健康检查通过

## Phase 9: 生产浏览器测试

- [ ] 9.1 回归测试（R1-R11）
- [ ] 9.2 功能测试（F1-F13）
- [ ] 9.3 截图记录

---

## 推迟到后续

- Phase 3: 扫码绑定微信读书（需调研 WeWe RSS 账号 API）
- Phase 4: 管理员 WeWe RSS 配置页（`/admin/settings/integrations/wewe-rss`）
