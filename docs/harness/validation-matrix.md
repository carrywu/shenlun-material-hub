# Validation Matrix

> 验证命令按改动类型分级。原则：按影响范围强制运行相关 spec，只有影响多个主流程时才跑全量 Playwright，纯文档/纯内部 helper 改动可不跑但必须说明原因。

## 1. 标准验证命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

Harness 封装（见 `scripts/harness/`）：

```bash
pnpm harness:preflight          # 只读预检：必读文件 + 必需脚本 + git status
pnpm harness:validate           # standard: lint + test + build
pnpm harness:validate:e2e       # e2e: standard + playwright 全量
pnpm harness:validate:db        # db: db:generate + db:setup:dry + standard
```

## 2. 按改动类型选择命令

### 文档改动

```bash
pnpm lint
pnpm test
pnpm build
```

Playwright 可选，除非文档改了任务或 QA 流程。

### helper / service 改动

```bash
pnpm test
pnpm lint
pnpm build
```

先跑相关 Vitest 文件，再跑全量 `pnpm test`。

### API route 改动

```bash
pnpm test
pnpm lint
pnpm build
```

必须添加或更新 route test。

### Auth / RBAC / owner 隔离 / Prisma / 破坏性数据路径

```bash
pnpm lint
pnpm test
pnpm build
```

如果影响用户可见 auth 流程，再跑：

```bash
pnpm exec playwright test
```

### UI / page 交互改动

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

可以先跑相关 spec，再跑全量。

## 3. Playwright 分级验收

### 3.1 必须运行 Playwright 的场景

涉及以下任一范围时，必须运行相关 Playwright spec：

```text
登录 / 注册 / 登出
USER / VERIFIED_USER / ADMIN 权限分流
/login
/admin/login
前台导航
底部 Tab
角色化首页
/articles
/cards
/review
/settings
素材卡生成
素材卡归档 / 恢复
文章收藏
文章阅读
文章复习
IMA 同步入口
AI 配置入口
后台审核
文章下架
危险操作二次确认
移动端响应式
可访问性
错误态
空状态
```

### 3.2 推荐 spec 映射

| 改动范围 | 必跑 Playwright spec |
|---|---|
| 登录 / 注册 / 登出 | `e2e/auth.spec.ts` |
| 路由中间件 / 权限跳转 | `e2e/middleware.spec.ts` |
| API 权限 / owner 隔离 | `e2e/api-security.spec.ts` |
| 文章列表 / 筛选 / Tab | `e2e/articles.spec.ts` |
| 文章详情 / 阅读 / 收藏 / 忽略 | `e2e/article-detail.spec.ts` |
| 素材卡列表 / 生成 / 归档 | `e2e/cards.spec.ts` |
| 复习闭环 | `e2e/review.spec.ts` |
| IMA 同步 / 同步记录 | `e2e/sync-records.spec.ts` |
| AI 配置 | `e2e/ai-config.spec.ts` |
| 设置页 / 个人配置 | `e2e/settings.spec.ts` |
| 后台管理 | `e2e/admin.spec.ts` |
| 搜索 | `e2e/search.spec.ts` |
| 移动端响应式 | `e2e/mobile-responsive.spec.ts` |
| 可访问性 | `e2e/accessibility.spec.ts` |
| 视觉回归 | `e2e/visual-regression.spec.ts` |
| 错误态 / 空状态 | `e2e/error-states.spec.ts` |
| 死链 / 旧路由清理 | `e2e/dead-link.spec.ts` |

### 3.3 推荐运行方式

优先运行相关 spec：

```bash
pnpm exec playwright test e2e/auth.spec.ts
pnpm exec playwright test e2e/articles.spec.ts
pnpm exec playwright test e2e/article-detail.spec.ts
pnpm exec playwright test e2e/cards.spec.ts
pnpm exec playwright test e2e/review.spec.ts
pnpm exec playwright test e2e/api-security.spec.ts
pnpm exec playwright test e2e/sync-records.spec.ts
```

改动影响多个主流程时运行全量：

```bash
pnpm exec playwright test
```

### 3.4 可以不跑 Playwright 的场景

```text
纯文档改动
纯 service/helper 内部逻辑，且已有 Vitest 覆盖
纯类型修复
不影响页面、权限、登录态、用户路径的内部重构
```

但最终报告必须写：

```text
Playwright not run: 本次改动不涉及用户可见流程，已由 Vitest 覆盖。
```

### 3.5 禁止事项

```text
不允许把失败的 Playwright 测试直接 skip
不允许只跑 Vitest 却声称 E2E 通过
不允许改测试断言来迎合错误实现
不允许只跑了单个 spec 却声称全量 Playwright 通过
Playwright 只有实际运行且退出码为 0，才能写 passed
```

## 4. 禁止伪通过

Agent 不得说：`应该通过` / `理论上通过` / `我认为通过`。

只能说：

```text
已运行 pnpm test，退出码 0
未运行，原因：...
运行失败，失败 spec：...
```
