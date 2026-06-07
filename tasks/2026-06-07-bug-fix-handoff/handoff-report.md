# 反馈修复交接文档

> 日期：2026-06-07
> 来源：用户反馈文档（文字文稿1.docx，含 7 张截图 + 13 条反馈）
> 状态：全部完成 ✅

---

## 修复概览

| 编号 | 问题 | 状态 | 修改文件数 | 风险等级 |
|------|------|------|-----------|---------|
| BUG-01 | 登录页去掉导航栏 | ✅ | 2 | 低 |
| BUG-02 | 退出登录跳转首页 | ✅ | 1 | 低 |
| BUG-03 | 修改密码 UX 完善 | ✅ | 1 | 低 |
| BUG-04 | AI 默认配置改 DeepSeek | ✅ | 6 | 低 |
| BUG-05 | 隐藏 B站/小红书未实现功能 | ✅ | 1 | 低 |
| BUG-06 | VERIFIED_USER 权限开放 | ✅ | 3 | 中 |
| BUG-07A | 移除 AI fallback，强制用户自配 | ✅ | 6 | 高 |
| BUG-07B | 用户级 WeWe RSS 配置 | ✅ | 4 | 高 |

---

## 详细变更记录

### BUG-01: 登录页去掉导航栏

**问题**: 登录页被根布局包裹，顶部导航栏仍然显示
**方案**: 提取 `RootNav` 客户端组件，`usePathname()` 检测 `/admin/login` 时返回 `null`

**修改文件**:
- `src/app/layout.tsx` — 导入 `<RootNav />` 替换内联 header
- `src/components/RootNav.tsx` — **新建**，客户端导航组件

### BUG-02: 退出登录跳转首页

**问题**: 退出是 form POST，浏览器停留在 JSON 响应页面
**方案**: 改为客户端 `fetch` + `router.push('/')` 跳转到首页

**修改文件**:
- `src/components/RootNav.tsx` — `onClick` handler 替换 `<form>` POST

### BUG-03: 修改密码 UX 完善

**问题**: 修改密码后会话失效但无明确提示
**方案**: 成功后 toast 提示 + 主动跳转 `/admin/login`

**修改文件**:
- `src/app/settings/account/page.tsx` — 成功后 `router.push("/admin/login")` + error toast

### BUG-04: AI 默认配置改 DeepSeek

**问题**: 默认值是 gpt-4o / openai
**方案**: 全局替换默认值为 DeepSeek

**修改文件**:
- `src/components/ai/AiConfigPage.tsx` — baseUrl/model 默认值
- `src/app/settings/ai/page.tsx` — 默认值
- `src/app/api/settings/ai-config/route.ts` — fallback 默认值
- `src/app/api/ai-config/route.ts` — fallback 默认值
- `src/services/ai.ts` — model fallback 默认值
- `prisma/schema.prisma` — AiConfig model 默认值

### BUG-05: 隐藏 B站/小红书未实现功能

**问题**: 来源创建表单中 B站/小红书以 disabled 展示
**方案**: 移除 disabled `<SelectItem>` 元素

**修改文件**:
- `src/components/subscriptions/SubscriptionsPage.tsx` — 删除 bilibili/xiaohongshu SelectItem

### BUG-06: VERIFIED_USER 权限开放

**问题**: VERIFIED_USER 无法进入后台仪表板
**方案**: metrics API 改用 `requireVerifiedUser`，侧边栏按角色过滤

**修改文件**:
- `src/app/api/admin/metrics/route.ts` — `requireAdmin` → `requireVerifiedUser`
- `src/components/admin/AdminShell.tsx` — 角色过滤侧边栏 + 退出跳转 `/`
- `src/components/RootNav.tsx` — VERIFIED_USER 显示"管理后台"入口

### BUG-07A: 移除 AI fallback，强制用户自配

**问题**: 新用户未配 AI 源也能评估（fallback 到全局/环境变量）
**方案**: 当有 userId 时，无个人配置则抛 `AI_CONFIG_MISSING`；系统级保留 fallback

**修改文件**:
- `src/services/ai.ts` — `resolveAiRuntimeConfig` 分离用户级/系统级逻辑
- `src/app/api/content-items/[id]/generate-card/route.ts` — AiServiceError 错误处理
- `src/app/api/content-items/assess/route.ts` — AiServiceError 错误处理
- `src/app/api/content-items/reassess/route.ts` — AiServiceError 错误处理
- `src/app/api/content-items/[id]/score/route.ts` — AiServiceError 错误处理
- `src/components/ArticleDetail.tsx` — AI 配置错误链接改为 `/settings/ai`

### BUG-07B: 用户级 WeWe RSS 配置

**问题**: WeWe RSS 是全局配置，每个用户应有自己的配置
**方案**: 使用 UserIntegration 模型存储用户级配置

**新建文件**:
- `src/app/api/settings/integrations/wewe-rss/route.ts` — CRUD API（GET/POST/PUT/DELETE）
- `src/app/api/settings/integrations/wewe-rss/test/route.ts` — 测试连接 API
- `src/app/settings/integrations/page.tsx` — 用户级 WeWe RSS 配置页面

**修改文件**:
- `src/app/settings/page.tsx` — 集成入口对所有认证用户可见

---

## 验证结果

### 构建验证
```
✅ pnpm build — 编译成功，无类型错误
```

### 单元测试
```
✅ 36 test files passed, 249 tests passed
```

### Lint
```
⚠️ 1 error (pre-existing, e2e/error-states.spec.ts)
⚠️ 13 warnings (pre-existing + 2 new minor warnings)
```

---

## 权限模型

| 角色 | 文章可见性 | AI 配置 | WeWe RSS | 后台访问 |
|------|-----------|---------|----------|---------|
| USER | 管理员文章（只读） | ❌ | ❌ | ❌ |
| VERIFIED_USER | 仅自己的文章 | ✅ 必须自配 | ✅ 个人配置 | 仅仪表板概览 |
| ADMIN | 所有文章 | ✅ 全局/个人 | ✅ 全局/个人 | 全部管理页面 |

---

## 待办事项

### 必须手动执行
1. **Prisma 迁移** — BUG-04 修改了 schema 默认值，需执行：
   ```bash
   npx prisma migrate dev --name update-ai-config-defaults-to-deepseek
   ```

2. **浏览器手动验收** — 建议检查以下页面：
   - [ ] `/admin/login` — 无导航栏
   - [ ] 退出登录 — 跳转到首页
   - [ ] `/settings/account` — 修改密码后跳转登录页
   - [ ] `/settings/ai` — 默认值显示 DeepSeek
   - [ ] `/subscriptions` — 无 B站/小红书选项
   - [ ] VERIFIED_USER 登录 → 可访问 `/admin` 仪表板
   - [ ] VERIFIED_USER 后台侧边栏只有"系统概览"
   - [ ] 未配置 AI 的用户触发 AI 操作 → 提示去配置
   - [ ] `/settings/integrations` — WeWe RSS 配置页面可用

### 建议后续优化
1. **E2E 测试补充** — 为本次修复的关键场景添加 Playwright E2E 测试
2. **数据隔离完善** — 确认文章列表页、素材卡页按 ownerUserId 过滤
3. **采集流程** — 当用户通过自己的 WeWe RSS 触发采集时，文章标记 ownerUserId
4. **AI 配置测试** — 补充 `resolveAiRuntimeConfig` 的单元测试验证 fallback 行为
