# RBAC 架构说明

审计日期：2026-06-05

## 数据模型

当前 `prisma/schema.prisma` 定义了 RBAC 和 ownership 模型：

- `User`
  - `username`：唯一登录身份。
  - `passwordHash`：保存 bcrypt-compatible hash。
  - `role`：`ADMIN`、`VERIFIED_USER`、`USER`。
  - `status`：`ACTIVE`、`DISABLED`。
  - 关联 sessions、owned content、owned cards、async tasks、sync records、annotations。
- `Session`
  - 数据库支持的 `auth_token` session token。
  - `expiresAt` 控制 session 过期。
  - 用户删除时 cascade delete。
- ownership 字段：
  - `ContentItem.ownerUserId`、`ContentItem.visibility`。
  - `MaterialCard.ownerUserId`。
  - `ArticleAnnotation.userId`。
  - `AsyncTask.userId`。
  - `SyncRecord.userId`。
- 全局/admin-only 配置：
  - `AiConfig` 没有 owner 字段，按 admin-controlled global state 处理。
  - `AiPromptTemplate` 没有 owner 字段，按 admin-controlled global state 处理。

## 服务端认证流程

核心文件：`src/lib/auth.ts`。

- 密码校验支持 bcrypt 和 legacy SHA-256 fallback。
- `createSession(userId)` 创建数据库 session，并生成高熵 token。
- `validateSession(token)` 解析有效 session，拒绝过期或 disabled 用户。
- `getUserFromRequest(request)` 读取 `auth_token`，并支持 legacy JWT 兼容。
- `requireAuth(request)` 返回任意已认证活跃用户。
- `requireAdmin(request)` 仅返回 `ADMIN`。
- `requireVerifiedUser(request)` 返回 `ADMIN` 或 `VERIFIED_USER`。
- `unauthorizedResponse()` 返回 401。
- `forbiddenResponse()` 返回 403。

## 客户端认证流程

核心文件：

- `src/app/layout.tsx`
- `src/lib/auth-context.tsx`
- `src/components/admin/AdminShell.tsx`

`RootLayout` 在服务端读取 `auth_token` cookie，并把用户状态提供给客户端 `AuthProvider`。`useAuth()` 暴露：

- `user`
- `isAdmin`
- `isVerifiedUser`
- `isAuthenticated`

`AdminShell` 在客户端检查 `/api/auth/check`，session 检查失败时跳转 `/admin/login`。服务端 route guard 仍然是安全边界。

## Proxy / Middleware 策略

核心文件：`src/proxy.ts`。

公开路径：

- `/admin/login`
- `/api/auth/login`
- `/api/auth/check`
- `/api/auth/logout`

proxy 保护的 API 前缀：

- `/api/admin`
- `/api/collectors`
- `/api/ai-config`
- `/api/integrations`
- `/api/content-items` 下选定 AI task API
- 非 GET 的 `/api/sources`

所有页面 route 在未认证时跳转 `/admin/login`。

重要结论：proxy 保护不能替代完整授权模型。每个 API route 仍需要明确 route-level auth 和 owner check。

## 数据隔离 Helper

核心文件：`src/lib/data-isolation.ts`。

- `contentVisibilityWhere(user)`
  - Admin 可见全部。
  - 非 admin 可见 public 内容、自己的内容、`ownerUserId=null` legacy 内容。
- `ownerScopeWhere(user, fieldName = "ownerUserId")`
  - Admin 可见全部。
  - 非 admin 可见自己的行和 null-owner legacy 行。
- `canAccessResource(user, ownerId, visibility?)`
  - Admin 可见全部。
  - owner 可见自己的。
  - null-owner 行可访问。
  - `visibility="public"` 可访问。
- `canModifyResource(user, ownerId)`
  - Admin 可修改全部。
  - owner 只能修改自己的。
  - 非 admin 不能修改 null-owner 行。

## 架构缺口

- 仍需要空库迁移验收脚本证明 migration chain 与 schema 一致。
- legacy null-owner 数据在多用户生产中的访问策略未最终确定。
- 部分 route 虽已修复 where 组合，但仍需要回归测试固定。
- 批注 route 需要更多真实 A/B 用户隔离测试。
- route-local tests 中仍有 mock guard 场景，不能完全证明真实 auth extraction 和 owner isolation。
