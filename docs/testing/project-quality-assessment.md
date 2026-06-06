# 项目质量评估报告

> 生成日期：2026-06-06
> 审计范围：shenlun-material-hub 全项目
> 审计基线：commit `52fa783`，分支 `main`

---

## 1. 项目概览

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js + React | 16.2.6 / 19.2.4 |
| 样式 | Tailwind CSS + shadcn | 4.x / 4.8.2 |
| 数据库 | PostgreSQL | 16 |
| ORM | Prisma | 7.8.0 |
| 语言 | TypeScript | 6.0.3 |
| 单元测试 | Vitest | 4.1.7 |
| E2E 测试 | Playwright | 1.60.0 |
| 包管理器 | pnpm | — |

### 规模指标

| 指标 | 数值 |
|------|------|
| 总代码行数 | 71,657 |
| 页面文件 (page.tsx) | 29 |
| API 路由 (route.ts) | 62 |
| Prisma 数据模型 | 18 |
| React 组件 | 34 |
| 工具库文件 (lib/) | 23 |
| 采集器服务 | 8+ |

### 18 个 Prisma 模型

User, Session, Source, CollectionChannel, ContentItem, MaterialCard, SyncRecord, CollectorRun, AiConfig, AiPromptTemplate, ArticleAnnotation, SystemLog, AsyncTask, UserIntegration, ImaTarget, Invitation, InvitationUse, AuditLog

---

## 2. 测试基础设施评估

### Vitest 单元测试

| 指标 | 数值 |
|------|------|
| 测试文件数 | 36 |
| 测试用例数 | ~249 |
| 上次运行结果 | **249 passed / 0 failed** |
| 上次运行日期 | 2026-06-06 |

**覆盖范围：**
- ✅ API 路由单元测试：15/62 路由（24%）
- ✅ 数据隔离工具函数测试：`mergeWhere`, `contentVisibilityWhere`, `ownerScopeWhere`
- ✅ 认证逻辑测试：session 验证、JWT fallback
- ✅ 图片代理 SSRF 防护测试：20+ 测试用例
- ✅ 备份恢复 RBAC 测试
- ✅ AI 服务测试

### Playwright E2E 测试

| 指标 | 数值 |
|------|------|
| Spec 文件数 | 18 |
| 测试用例数 | 190+ |
| 上次运行结果 | **99 passed / 0 failed / 12 did-not-run / exit code 0** |
| 运行耗时 | ~16.3 分钟 |
| Workers | 4 |
| 浏览器 | Chromium (Desktop Chrome) |

**覆盖范围：**
- ✅ 页面路由覆盖：29/29（100%）
- ✅ 可点击元素覆盖：85/108（79%）
- ✅ 认证流程：login, register, session check
- ✅ 管理员功能：users, sources, logs, tasks, backup, clean, AI config
- ✅ 中间件保护：public/protected 路由重定向
- ✅ 数据隔离：跨用户访问拒绝
- ✅ 无障碍扫描：24 个 WCAG 2.1 AA 检查
- ✅ 视觉回归：14 个基线截图对比
- ✅ 死链检查：22 个路由非空页面验证
- ✅ 控制台守卫：161 处使用 `consoleGuard` 检测控制台错误

### 测试配置

| 配置项 | 值 |
|--------|-----|
| Playwright 超时 | 60s (test), 10s (expect) |
| 截图差异阈值 | `maxDiffPixelRatio: 0.02` |
| 重试 | CI: 2, local: 1 |
| 全局 Setup | `e2e/global-setup.ts` (admin auth) |
| Storage State | `.auth/admin-storage.json` |
| Dev Server | port 3001, 自动启动 |

---

## 3. 覆盖率分析

### API 路由单元测试覆盖率

| 分类 | 有测试 | 无测试 | 覆盖率 |
|------|--------|--------|--------|
| Admin API | 3 | 13 | 19% |
| Auth API | 1 | 3 | 25% |
| Collectors API | 2 | 4 | 33% |
| Content API | 3 | 5 | 38% |
| AI Config API | 2 | 1 | 67% |
| Annotation API | 2 | 0 | 100% |
| Material Cards API | 0 | 2 | 0% |
| Sources API | 0 | 6 | 0% |
| Integration API | 0 | 7 | 0% |
| 其他 | 2 | 8 | 20% |
| **总计** | **15** | **47** | **24%** |

### 有测试的 15 个路由

1. `api/admin/logs` — 管理日志 CRUD
2. `api/admin/metrics` — 管理指标
3. `api/admin/tasks` — 任务管理
4. `api/ai-config` — AI 配置
5. `api/ai-config/prompts` — 提示词管理
6. `api/annotations/[id]` — 注解修改
7. `api/articles` — 文章列表（含 visibility 隔离）
8. `api/auth/login` — 登录
9. `api/collectors/wechat/import` — 微信导入
10. `api/collectors/wechat/sync` — 微信同步
11. `api/content-items/[id]/annotations` — 内容注解
12. `api/content-items/[id]/generate-card` — 卡片生成
13. `api/proxy/image` — 图片代理（20+ SSRF 测试）
14. `api/review` — 复习
15. `api/sync-records` — 同步记录

### E2E 覆盖的页面（29/29 = 100%）

| 页面 | Spec 文件 | 测试数 |
|------|-----------|--------|
| `/admin/login` | auth.spec.ts | 7 |
| `/register` | auth.spec.ts | 5 |
| `/` (仪表板) | auth.spec.ts | 2 |
| `/articles` | articles.spec.ts | 7 |
| `/admin/articles` | articles.spec.ts | 5 |
| `/articles/[id]` | article-detail.spec.ts | 8 |
| `/cards` | cards.spec.ts | 6 |
| `/cards/[id]` | cards.spec.ts | 5 |
| `/discover` | explore-discover.spec.ts | 4 |
| `/explore` | explore-discover.spec.ts | 5 |
| `/search` | search.spec.ts | 8 |
| `/review` | review.spec.ts | 8 |
| `/settings` | settings.spec.ts | 2 |
| `/settings/account` | settings.spec.ts | 2 |
| `/settings/ai` | ai-config.spec.ts | 1 |
| `/settings/ima` | settings.spec.ts | 2 |
| `/admin` | admin.spec.ts | 2 |
| `/admin/tasks` | admin.spec.ts | 4 |
| `/admin/logs` | admin.spec.ts | 3 |
| `/admin/users` | admin.spec.ts | 5 |
| `/admin/backup` | admin.spec.ts | 2 |
| `/admin/clean` | admin.spec.ts | 4 |
| `/admin/settings/ai` | ai-config.spec.ts | 6 |
| `/admin/integrations/wewe-rss` | wewe-rss.spec.ts | 6 |
| `/admin/sources` | sources.spec.ts | 6 |
| `/admin/sync-records` | sync-records.spec.ts | 4 |
| 全公开/受保护路由 | middleware.spec.ts | 14 |
| 全受保护 API | data-isolation.spec.ts | 11 |

---

## 4. RBAC 成熟度评估

### 架构完整性

| 维度 | 状态 | 评级 |
|------|------|------|
| 角色定义 | ADMIN / VERIFIED_USER / USER / anonymous | ✅ 完善 |
| Middleware 保护 | `src/proxy.ts` — 公开/受保护路由白名单 | ✅ 完善 |
| Route Guard | `requireAdmin` / `requireAuth` / `requireVerifiedUser` | ✅ 完善 |
| 数据隔离 | `contentVisibilityWhere` / `ownerScopeWhere` / `canAccessResource` / `canModifyResource` / `mergeWhere` | ✅ 完善 |
| API 审计 | 58 API 路由逐一审计（RBAC_API_AUDIT.md） | ✅ 完善 |
| 能力矩阵 | RBAC_CAPABILITY_MATRIX.md — 4 角色 × 全功能 | ✅ 完善 |
| 公开 API 清单 | PUBLIC_API_INVENTORY.md | ✅ 完善 |

### Guard 分布

| Guard 类型 | 路由数 | 说明 |
|-----------|--------|------|
| `requireAdmin` | 42 | 管理员专属操作 |
| `requireAuth` | 14 | 需要登录 |
| `requireVerifiedUser` | 0 | 预留，当前未使用 |
| 无 Guard | 6 | 公开 API (health, discover, explore, articles, search, proxy) |

### 数据隔离助手使用情况

| 助手函数 | 用途 | 使用位置 |
|----------|------|---------|
| `contentVisibilityWhere` | 内容可见性过滤 | articles, content-items |
| `ownerScopeWhere` | 用户数据范围限制 | review, sync-records, material-cards, export, admin/tasks |
| `canAccessResource` | 单资源访问检查 | content-items/[id], material-cards/[id], annotations |
| `canModifyResource` | 单资源修改检查 | content-items/[id], material-cards/[id], annotations/[id] |
| `mergeWhere` | 安全合并 Prisma OR 查询 | articles, content-items, material-cards, search |

---

## 5. 已知问题清单

### 🔴 高优先级

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | API 路由单元测试覆盖率仅 24% (15/62) | 回归风险 | 已知 — E2E 覆盖部分弥补 |
| 2 | 47 个 API 路由无单元测试 | 安全回归风险 | 已知 — admin-only 路由风险较低 |

### 🟡 中优先级

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 3 | 无移动端响应式 E2E 测试 | 移动端布局问题不可见 | 待补充 |
| 4 | 无 API 安全 E2E 测试（未认证 401、跨用户 403） | 安全回归不可见 | 待补充 |
| 5 | 无错误状态 E2E 测试（500、网络错误、空数据） | 用户体验回归不可见 | 待补充 |
| 6 | 2 个 a11y 违规：button-name (Select combobox) + color-contrast | 无障碍访问不达标 | 已知 |

### 🟢 低优先级

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 7 | 单浏览器测试（仅 Chromium） | 跨浏览器兼容性不可见 | 接受 |
| 8 | 12 个测试 "did not run"（serial 条件测试） | 条件路径未覆盖 | 正常行为 |
| 9 | `docs/testing.md` Playwright 基线描述过时 | 交接信息不准确 | 待更新 |
| 10 | `AGENT_HANDOFF.md` 测试数字过时 | 交接信息不准确 | 待更新 |

---

## 6. 风险评估

### 按领域分级

| 领域 | 风险等级 | 说明 |
|------|---------|------|
| **Lint** | 🟢 低 | 零错误通过 |
| **单元测试** | 🟢 低 | 249 测试全通过，核心逻辑覆盖好 |
| **构建** | 🟢 低 | Next.js 构建成功 |
| **E2E 覆盖** | 🟢 低 | 29/29 页面覆盖，18 个 spec |
| **RBAC** | 🟢 低 | 全路由审计，guard + 数据隔离完整 |
| **数据隔离** | 🟢 低 | 5 个隔离助手函数，E2E 覆盖 |
| **API 安全** | 🟡 中 | 单测覆盖率低，但 middleware + route guard 双重保护 |
| **无障碍** | 🟡 中 | 2 个 WCAG 违规待处理 |
| **移动端** | 🟡 中 | 无自动化测试，依赖手动检查 |
| **视觉回归** | 🟢 低 | 14 基线截图，maxDiffPixelRatio 0.02 |

### 总体风险矩阵

```
影响 ↑
高 │  API 安全覆盖    │                  │
   │                   │                  │
中 │  a11y 违规        │  移动端响应式    │
   │                   │                  │
低 │  文档过时         │  浏览器兼容      │  （极低风险）
   │                   │                  │
   └───────────────────┴──────────────────┘
        容易修复              需要更多工作
```

---

## 7. 整体质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **代码质量** | ⭐⭐⭐⭐⭐ 5/5 | TypeScript 严格模式，lint 零错误 |
| **测试覆盖率** | ⭐⭐⭐⭐ 4/5 | E2E 优秀（100% 页面），API 单测偏低（24%） |
| **RBAC 安全** | ⭐⭐⭐⭐⭐ 5/5 | 完整的 guard + 数据隔离 + 审计文档 |
| **无障碍** | ⭐⭐⭐⭐ 4/5 | 24 个 a11y 测试，2 个已知违规待修 |
| **文档完整性** | ⭐⭐⭐⭐⭐ 5/5 | 交接文档、API 审计、能力矩阵齐全 |
| **E2E 覆盖** | ⭐⭐⭐⭐ 4/5 | 页面 100%，缺移动端和错误状态 |
| **可维护性** | ⭐⭐⭐⭐⭐ 5/5 | 清晰架构，consoleGuard 一致使用 |

### **综合评分：4.6 / 5.0**

> 项目处于高质量状态。核心风险在 API 路由单元测试覆盖率和移动端测试空白，两者将通过本次审计补充。

---

## 8. 审计建议

### 本次审计将执行

1. ✅ 重新运行 lint/test/build 验证基线
2. ✅ 重新运行 Playwright 全量套件
3. ✅ RBAC/API 交叉验证
4. ✅ 新增 3 个 E2E spec：mobile-responsive, api-security, error-states
5. ✅ 修复已知 a11y 违规
6. ✅ 刷新所有文档基线

### 未来建议（超出本次审计范围）

- P4：将 API 单元测试覆盖率提升到 60%+
- P4：添加 Firefox / Safari 浏览器 E2E 项目
- P4：添加 API 集成测试（真实数据库）
- P4：添加性能基准测试（Lighthouse CI）
- P4：添加 IMA 同成 E2E 测试
