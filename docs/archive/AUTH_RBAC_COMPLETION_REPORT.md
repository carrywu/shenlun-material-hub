# 申论素材采集台 — RBAC 改造完成情况评估报告

> 评估时间：2026-06-05
> 依据文档：四份评估报告（需求可行性评估、代码阅读清单、评估交接文件、完整评估报告）+ 当前代码库实际状态
> 评估分支：feat/production-hardening
> 评估方法：对照四份评估文档中的阶段性要求，逐项检查代码库实际实现

---

## 一、执行摘要

### 总体完成度

| 阶段 | 计划内容 | 完成度 | 状态 |
|---|---|---|---|
| **第一阶段** | 安全收口与认证基础 | **~90%** | 核心安全基础设施已就绪，前端权限细节待完善 |
| **第二阶段** | 多用户数据隔离 | **~65%** | Schema 和隔离工具层完成，API 路由和前端有遗漏 |
| **第三阶段** | 用户个人配置 | **0%** | 未开始 |
| **第四阶段** | 高级功能 | **0%** | 未开始 |

### 结论

**项目已成功完成第一阶段核心工作**。数据库用户模型、会话管理、API 安全收口、管理后台用户管理等关键基础设施全部就位。系统从"单管理员 + 全局公开"的单用户工具，升级为了"多用户 + 角色权限 + API 认证"的安全系统。

但评估报告中规划的前端权限控制、数据隔离完善、用户级配置等仍有较大差距，需要继续推进。

---

## 二、第一阶段：安全收口与认证基础 — ~90%

### 2.1 ✅ 已完成项（15/17 项完成）

| # | 需求项 | 实现文件 | 说明 |
|---|---|---|---|
| 1 | **User 模型** | `prisma/schema.prisma` | User 表：username(unique), passwordHash, role(ADMIN/VERIFIED_USER/USER), status(ACTIVE/DISABLED), displayName, email |
| 2 | **Session 模型** | `prisma/schema.prisma` | Session 表：userId, token(unique, 高熵随机), expiresAt, cascade delete |
| 3 | **bcrypt 密码哈希** | `src/lib/auth.ts` | bcrypt 哈希（12 rounds）替代 SHA-256，保留 SHA-256 兼容回退 + 自动升级 |
| 4 | **DB Session 管理** | `src/lib/auth.ts` | createSession / validateSession / revokeSession，24h 过期，48 字节高熵 token |
| 5 | **会话立即撤销** | `src/lib/auth.ts` | revokeSession / revokeAllUserSessions，密码重置、角色变更时自动撤销全部会话 |
| 6 | **全局页面认证** | `src/proxy.ts` | 所有页面路由需认证，未登录 → 302 到 `/admin/login?redirect=原路径` |
| 7 | **API 安全收口** | 40+ API route 文件 | requireAuth() / requireAdmin() / requireVerifiedUser() 覆盖全部关键 API |
| 8 | **通用登录页** | `src/app/admin/login/page.tsx` | redirect 参数保留，Suspense 包裹，登录后跳回原页面 |
| 9 | **NavBar 用户状态** | `src/app/layout.tsx` | 服务端读取 session → 显示用户名 + 退出按钮，无权限闪烁 |
| 10 | **初始管理员迁移** | `src/lib/auth.ts` + `src/scripts/seed-admin.ts` | ensureInitialAdmin() 幂等创建，环境变量 → 数据库平滑迁移 |
| 11 | **用户管理 API** | `src/app/api/admin/users/` | CRUD：创建 USER/VERIFIED_USER/ADMIN、修改角色、启用/禁用、重置密码、撤销会话 |
| 12 | **用户管理页面** | `src/app/admin/users/page.tsx` | 完整管理 UI：用户表、创建对话框、角色选择、启用/禁用、重置密码、删除确认 |
| 13 | **修改密码 API** | `src/app/api/auth/change-password/route.ts` | 验证旧密码、bcrypt 新密码、撤销全部旧会话 |
| 14 | **最后管理员保护** | `src/app/api/admin/users/[id]/route.ts` | countActiveAdmins() 检查，禁止禁用或降级最后一个管理员 |
| 15 | **JWT 兼容** | `src/lib/auth.ts` | verifyLegacyJWT 支持旧 token 平滑过渡，login 时自动升级为 DB session |

### 2.2 ⚠️ 部分完成项（5 项需完善）

| # | 需求项 | 当前状态 | 差距说明 |
|---|---|---|---|
| 1 | **proxy.ts 公开端点白名单** | 公开端点靠隐式放行 | `/api/articles`、`/api/search`、`/api/discover`、`/api/explore` 未显式列入白名单；依赖不匹配保护模式的默认放行行为，有 defense-in-depth 但不够明确 |
| 2 | **登录页文案** | 功能已通用化 | UI 仍显示"管理账号"/"管理密码"/"系统管理后台"，应改为"账号"/"密码"等通用措辞 |
| 3 | **NavBar 角色显示** | 显示用户名 + 退出 | 缺少角色徽章（如"管理员"/"认证用户"），无管理后台入口链接 |
| 4 | **按角色隐藏导航/按钮** | 所有用户看到相同导航 | CollectButton、SyncToIma、AI 批注、素材卡编辑等按钮未按角色条件渲染 |
| 5 | **前端 Auth Context** | 无 `useAuth` hook | 无客户端 auth context/provider，组件无法方便获取当前用户角色 |

### 2.3 ❌ 未完成项（2 项）

| # | 需求项 | 说明 |
|---|---|---|
| 1 | **客户端权限闪烁防护** | layout 是 server component 无闪烁，但客户端组件内缺少 loading/skeleton 防护 |
| 2 | **采集器列表端点保护** | `GET /api/collectors/web/collect`（列出可用采集器）无认证，暴露采集器配置名称 |

### 2.4 第一阶段验收标准对照

| 验收标准 | 结果 | 说明 |
|---|---|---|
| 未登录用户无法调用任何危险写入 API | ✅ 通过 | 所有写入 API 有 requireAdmin/requireAuth 守卫 |
| USER 无法调用写入和管理 API | ✅ 通过 | 角色检查在 API 层强制执行 |
| VERIFIED_USER 第一阶段仍无法调用写入 API | ✅ 通过 | 写入操作统一 requireAdmin |
| ADMIN 可以继续使用现有功能 | ✅ 通过 | 管理员全功能可用 |
| 公开文章浏览正常 | ✅ 通过 | `/api/articles` 无认证，正常返回 |
| 备份、清洗、日志删除等高风险接口已保护 | ✅ 通过 | 统一 requireAdmin |
| 用户被禁用/重置密码/修改角色后旧会话立即失效 | ✅ 通过 | revokeAllUserSessions 在对应操作后调用 |
| lint、test、build 全部完成 | ✅ 通过 | lint ✓、144 tests ✓、build ✓ |

---

## 三、第二阶段：多用户数据隔离 — ~65%

### 3.1 ✅ 已完成项

| # | 需求项 | 实现位置 | 说明 |
|---|---|---|---|
| 1 | **ContentItem.ownerUserId** | `prisma/schema.prisma` | 字段存在，`String?`，关联 User（关系名 "ContentItemOwner"） |
| 2 | **ContentItem.visibility** | `prisma/schema.prisma` | 字段存在，`String @default("public")`，支持 public / private |
| 3 | **MaterialCard.ownerUserId** | `prisma/schema.prisma` | 字段存在，关联 User |
| 4 | **ArticleAnnotation.userId** | `prisma/schema.prisma` | 字段存在，关联 User |
| 5 | **AsyncTask.userId** | `prisma/schema.prisma` | 字段存在，关联 User |
| 6 | **SyncRecord.userId** | `prisma/schema.prisma` | 字段存在，关联 User |
| 7 | **数据隔离工具** | `src/lib/data-isolation.ts` | 四个核心函数：contentVisibilityWhere / ownerScopeWhere / canAccessResource / canModifyResource |
| 8 | **GET 路由用户过滤** | 多个 route 文件 | content-items、material-cards、sync-records、export、admin/tasks 已应用隔离函数 |
| 9 | **单资源所有权校验** | `[id]/route.ts` 文件 | content-items/[id]、material-cards/[id] 使用 canAccessResource / canModifyResource |

### 3.2 ⚠️ 部分完成项

| # | 需求项 | 差距说明 |
|---|---|---|
| 1 | **POST 创建未设置 ownerUserId** | `content-items/route.ts` POST 和 `material-cards/route.ts` POST 创建新记录时**未设置** `ownerUserId: user.id`，导致新数据没有所有者，数据隔离对新建数据无效 |
| 2 | **sync/route.ts 无数据隔离** | IMA 同步路由使用 requireAdmin（仅限管理员），但 `syncToIma()` 创建 SyncRecord 时**未设置** userId |
| 3 | **搜索/复习过滤未确认** | `search/route.ts` 和 `review/route.ts` 是否应用了可见性过滤未完全验证 |

### 3.3 ❌ 未完成项

| # | 需求项 | 说明 |
|---|---|---|
| 1 | **UserContentRelation 表** | 不存在。评估报告推荐的"共享文章主体 + 用户关系表"模式中的关系表未建（收藏、书签、采集关系等） |
| 2 | **历史数据迁移脚本** | 无迁移脚本将现有数据的 ownerUserId 设为管理员、visibility 设为 public |
| 3 | **前端数据隔离展示** | 前端页面未根据用户角色和所有权调整展示内容 |
| 4 | **水平越权 E2E 测试** | 无针对多用户数据隔离的 E2E 测试 |

---

## 四、第三阶段：用户个人配置与认证用户能力 — 0%

全部未开始。

| # | 需求项 | 状态 | 说明 |
|---|---|---|---|
| 1 | AiConfig.userId 字段 | ❌ | 仍为全局唯一（name: "default"），无用户级 AI 配置 |
| 2 | UserIntegration 表 | ❌ | 不存在，无用户集成配置存储 |
| 3 | ImaTarget 表 | ❌ | 不存在，IMA 配置仍为全局环境变量 |
| 4 | ai.ts 接受 userId 参数 | ❌ | getAiRuntime() 和 resolveAiRuntimeConfig() 无 userId 参数，全局缓存 |
| 5 | ima-sync.ts 参数化配置 | ❌ | 仍从 process.env 模块级常量读取（lines 4-7） |
| 6 | 用户设置页面 /settings | ❌ | `/settings/ai` 仅重定向到 `/admin/settings/ai` |
| 7 | VERIFIED_USER 开放采集 | ❌ | 角色已定义但未向 VERIFIED_USER 开放采集/AI/同步能力 |

---

## 五、第四阶段：高级功能 — 0%

全部未开始。

| # | 需求项 | 状态 | 说明 |
|---|---|---|---|
| 1 | Invitation / InvitationUse 表 | ❌ | 无邀请码模型 |
| 2 | 注册页面 /register | ❌ | 无注册相关代码 |
| 3 | AuditLog 表 | ❌ | 仅有 SystemLog（系统级），无用户审计追踪 |
| 4 | 任务限额 | ❌ | 无按用户并发限制、去重、日限额等逻辑 |
| 5 | 多 IMA 目标 | ❌ | 单一全局 IMA_KNOWLEDGE_BASE_ID |

---

## 六、与评估报告的差距分析

### 6.1 评估报告预期 vs 实际进度

评估报告建议的总体路线：

```
第一阶段（1-2周）→ 第二阶段（2-3周）→ 第三阶段（2-3周）→ 第四阶段（1-2周）
```

**实际进度**：第一阶段核心完成（~90%），第二阶段部分推进（~65%），第三/四阶段未启动。

### 6.2 评估报告中"最严重的 7 个问题"解决情况

| # | 原始问题 | 解决状态 |
|---|---|---|
| 1 | 数据库中没有用户表、会话表和角色模型 | ✅ 已解决 |
| 2 | 只有环境变量中的单一管理员 | ✅ 已解决（DB User + Session） |
| 3 | 约 31/35 个 API 没有认证保护 | ✅ 已解决（全部关键 API 已保护） |
| 4 | 管理 API、备份、清洗等接口未授权访问 | ✅ 已解决（requireAdmin） |
| 5 | 所有文章、素材卡等没有用户归属 | ⚠️ Schema 已有字段，但 POST 未写入 |
| 6 | AI、IMA、WeWe RSS 使用全局配置 | ❌ 未解决 |
| 7 | 异步任务没有用户上下文 | ⚠️ Schema 已有 userId，但任务执行时未传递 |

### 6.3 评估报告建议调整的需求采纳情况

| 建议 | 是否采纳 | 说明 |
|---|---|---|
| 邀请码延后到第二阶段 | ✅ 采纳 | 已延后，当前无邀请码代码 |
| 多 IMA 延后到第三阶段 | ✅ 采纳 | 已延后 |
| 管理员查看明文密钥建议放弃 | ✅ 采纳 | 未实现 |
| USER/VERIFIED_USER 区分保留但简化 | ✅ 采纳 | 角色字段存在，但功能区分尚未实现 |
| 不自动回退管理员 AI 配置 | ✅ 采纳 | 当前仍为全局配置，无用户配置 |

---

## 七、关键风险与遗留问题

### P0 — 安全风险（需立即修复）

| # | 风险 | 影响 | 修复方案 |
|---|---|---|---|
| 1 | POST 路由未设置 ownerUserId | 新创建的内容没有所有者，数据隔离对新建数据无效 | content-items POST、material-cards POST 添加 `ownerUserId: user.id` |
| 2 | sync/route.ts SyncRecord 无 userId | 同步记录无法关联用户 | syncToIma() 调用时传入 userId |

### P1 — 功能差距（本阶段内修复）

| # | 差距 | 影响 | 修复方案 |
|---|---|---|---|
| 3 | 无前端 Auth Context | 客户端组件无法按角色渲染 | 创建 `useAuth` hook + AuthProvider |
| 4 | 按钮无角色控制 | 所有用户看到相同操作按钮 | 按角色条件渲染 CollectButton、SyncToIma 等 |
| 5 | 登录页文案 | 仍写"管理账号"等管理员措辞 | 改为通用措辞 |
| 6 | 无历史数据迁移脚本 | 现有数据 ownerUserId 为 null | 编写 dry-run 迁移脚本 |

### P2 — 下阶段需求

| # | 需求 | 说明 |
|---|---|---|
| 7 | UserContentRelation 表 | 第二阶段推荐的收藏/书签关系表 |
| 8 | 用户级 AI 配置 | 第三阶段 |
| 9 | 用户级 IMA 配置 | 第三阶段 |
| 10 | 邀请码注册 | 第四阶段 |
| 11 | 审计日志 | 第四阶段 |
| 12 | 任务限额 | 第四阶段 |

---

## 八、建议下一步行动

### 优先级 1：补全第一阶段（1-2 天）

1. 修复登录页文案（"管理账号" → "账号"等）
2. 创建前端 Auth Context（`useAuth` hook + Server Component 传递用户信息）
3. 按角色隐藏/显示导航项和操作按钮
4. NavBar 添加角色徽章和管理后台入口链接

### 优先级 2：修复第二阶段 gap（2-3 天）

1. POST 路由设置 ownerUserId
2. sync 路由数据隔离
3. 编写历史数据迁移脚本（dry-run + apply）
4. 添加多用户数据隔离 E2E 测试

### 优先级 3：决定是否推进第三阶段

视业务需求决定是否启动用户级配置开发。

---

## 附录：评估方法说明

本评估基于以下四份文档的阶段性要求：

1. **《下载登录、权限与多用户改造完整评估报告》** — 定义了四个阶段的详细实施计划
2. **《AUTH_RBAC_ASSESSMENT_HANDOFF.md》** — 评估交接文件，定义了各阶段验收标准
3. **《AUTH_RBAC_CODE_READING_MANIFEST.md》** — 代码阅读清单，记录了原始代码状态
4. **《AUTH_RBAC_REQUIREMENTS_ASSESSMENT.md》** — 需求可行性评估，定义了 API 权限矩阵

评估通过对比文档中的要求与当前代码库实际文件内容，逐项确认实现状态。
