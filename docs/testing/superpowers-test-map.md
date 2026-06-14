# Superpowers Test Map

生成日期：2026-06-14
项目：shenlun-material-hub (Next.js 16 + Prisma 7 + PostgreSQL)

## 前端页面路由 (30 pages)

### 公开/认证页面
- `/login` — 前台登录 (蓝色主题)
- `/register` — 注册 (邀请码可选)
- `/admin/login` — 后台登录 (紫色主题)

### 用户页面 (需登录)
- `/` — 角色化首页 (欢迎+快捷操作)
- `/articles` — 文章列表 (Tab: 全部/推荐/收藏)
- `/articles/[id]` — 文章详情 (学习状态徽章+素材卡生成)
- `/cards` — 素材卡列表 (Tab: 全部/已归档)
- `/cards/[id]` — 素材卡详情
- `/search` — 全文搜索
- `/review` — 复习页
- `/subscriptions` — 订阅页
- `/sync-records` — 同步记录
- `/integrations/wewe-rss` — WeWe RSS 集成

### 设置页面
- `/settings` — 设置中心
- `/settings/account` — 账号设置 (改密码)
- `/settings/ai` — AI 配置
- `/settings/ima` — IMA 知识库
- `/settings/integrations` — 集成设置

### 管理后台 (需 ADMIN)
- `/admin` — 仪表板
- `/admin/articles` — 文章管理 (候选/审核/AI评估)
- `/admin/sources` — 采集源管理
- `/admin/users` — 用户管理 (CRUD+禁用/启用)
- `/admin/tasks` — 异步任务监控
- `/admin/logs` — 系统日志
- `/admin/sync-records` — 同步记录
- `/admin/backup` — 备份/恢复
- `/admin/clean` — 数据清理
- `/admin/integrations/wewe-rss` — WeWe RSS 管理
- `/admin/settings/ai` — AI 设置
- `/admin/settings/quotas` — 配额管理

## API 路由 (~68 route files, ~113 HTTP methods)

### 核心链路
1. 采集 → `POST /api/collectors/*` → ContentItem (candidate)
2. AI 评估 → `POST /api/content-items/assess` → accept/reject
3. 管理员审核 → `POST /api/admin/content-items/review` → approved/rejected
4. 素材卡生成 → `POST /api/content-items/[id]/generate-card` → MaterialCard
5. IMA 同步 → `POST /api/sync` → SyncRecord

### 权限模型
- 未登录: `/login`, `/admin/login`, `/register`, `/api/health`, `/api/auth/*`
- USER: 基础学习 (articles, review, settings)
- VERIFIED_USER: + cards, search, generate-card
- ADMIN: 全部 + 后台

## 现有 Playwright 覆盖 (e2e/ — 26 spec, 272 tests)

### 覆盖良好
- 认证流程 (auth.spec.ts: 17 tests)
- 管理后台 (admin.spec.ts: 16 tests)
- 文章列表/详情 (articles + article-detail: 20 tests)
- 素材卡 (cards: 11 tests)
- 搜索 (search: 9 tests)
- 权限边界 (api-security + data-isolation + middleware: 44 tests)
- 无障碍 (accessibility: 24 tests)
- 错误状态 (error-states: 8 tests)
- 移动端响应 (mobile-responsive: 20 tests)
- 死链检测 (dead-link: 22 tests)
- 视觉回归 (visual-regression: 12 tests)

### 覆盖缺口
- `/admin/settings/quotas` — 无测试
- `/login` 前台登录 — 无独立表单测试
- `/subscriptions`, `/settings/integrations` — 无测试
- `POST /api/content-items/assess` — 无 AI 评估流程测试
- `POST /api/content-items/[id]/generate-card` — 无完整生成流程测试
- `POST /api/auth/change-password` — 无实际改密码测试
- `POST /api/admin/invitations` — 无邀请码管理测试
- `/api/admin/users/[id]` CRUD — 无单用户操作测试
- 双提交防护 — 仅 articles 测试了快速点击
- Loading 卡死专项 — 无系统性覆盖
- Token 过期/Session 超时 — 无测试

## 新建测试目录 (tests/e2e/)

### 基础设施
- `helpers/auth.ts` — 登录/登出/storageState
- `helpers/assertions.ts` — Loading/错误/Toast 断言
- `helpers/api.ts` — API 请求监听/拦截
- `helpers/test-data.ts` — 测试数据准备
- `helpers/navigation.ts` — 页面导航辅助
- `helpers/selectors.ts` — 选择器规范

### 测试文件
- `auth.spec.ts` — 登录/注册/登出
- `frontend-navigation.spec.ts` — 导航/路由
- `articles.spec.ts` — 文章列表
- `article-detail.spec.ts` — 文章详情
- `material-cards.spec.ts` — 素材卡
- `ai-assessment.spec.ts` — AI 评估流程
- `admin-auth.spec.ts` — 后台认证
- `admin-content.spec.ts` — 内容管理
- `admin-review.spec.ts` — 管理员审核
- `admin-ai-config.spec.ts` — AI 配置
- `sources.spec.ts` — 采集源
- `wewe-rss.spec.ts` — WeWe RSS
- `permissions.spec.ts` — 权限边界
- `loading-states.spec.ts` — Loading 卡死专项
- `api-errors.spec.ts` — API 异常处理
- `regression.spec.ts` — 回归测试
