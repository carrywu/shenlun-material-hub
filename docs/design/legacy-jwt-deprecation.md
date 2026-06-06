# Legacy JWT 弃用计划

> P3-3: 移除遗留 JWT 认证代码
> 状态：规划中（当前为 DB Session + JWT 双轨运行）

## 背景

项目在迁移到数据库 Session 认证之前，使用了基于 HMAC-SHA256 的 JWT 令牌。当前代码同时支持两种认证方式：

- **新方式**：DB Session Token（`auth_token` cookie → `Session` 表）
- **遗留方式**：JWT Token（同一 cookie → 本地 HMAC 验证）

## 遗留代码位置

**文件**：`src/lib/auth.ts`

| 行号 | 内容 | 说明 |
|------|------|------|
| 145-153 | `DEFAULT_JWT_SECRET`, `getLegacyJwtSecret()` | JWT 密钥（含硬编码 fallback） |
| 155-163 | `getCryptoKey()` | HMAC 密钥派生 |
| 165-169 | `base64UrlDecode()` | JWT Base64Url 解码 |
| 171-198 | `verifyLegacyJWT()` | 完整 JWT 验证（签名 + 过期） |
| 224-245 | `getUserFromRequest()` 中 JWT 分支 | 先尝试 DB Session，失败后尝试 JWT |

## 安全风险

1. **硬编码默认密钥**：`DEFAULT_JWT_SECRET = "shenlun-material-hub-super-secret-jwt-key"` — 未设置 `JWT_SECRET` 环境变量时使用
2. **双认证路径**：攻击面增大
3. **无 JWT 使用审计**：无法知道还有多少请求走 JWT 路径

## 弃用计划

### Step 1：添加使用监控（1 天）

在 `verifyLegacyJWT` 被成功调用时记录日志：

```ts
// src/lib/auth.ts — getUserFromRequest() JWT 分支
if (legacyUsername) {
  logger.warn(
    `Legacy JWT auth used by user: ${legacyUsername}`,
    "AUTH"
  );
  // ... existing user lookup
}
```

同时在 `admin/logs` 页面添加 `category=AUTH` 筛选，监控 JWT 使用频率。

### Step 2：观察期（90 天）

- 部署 Step 1 后观察 90 天
- 如果 `AUTH` 日志中无 JWT 使用记录 → 可安全移除
- 如果有 JWT 使用 → 排查来源（旧浏览器缓存、API 客户端等）

### Step 3：移除代码（0.5 天）

删除以下代码：

```diff
  // src/lib/auth.ts

- // ─── Legacy JWT support (for migration period) ─────────────
- const DEFAULT_JWT_SECRET = "shenlun-material-hub-super-secret-jwt-key";
- function getLegacyJwtSecret() { ... }
- const encoder = new TextEncoder();
- async function getCryptoKey(secret: string) { ... }
- function base64UrlDecode(str: string) { ... }
- async function verifyLegacyJWT(token: string) { ... }

  export async function getUserFromRequest(request: Request) {
    // 1. Try DB session token
    const cookieHeader = request.headers.get("cookie") || "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (tokenMatch) {
      const token = tokenMatch[1];
      const user = await validateSession(token);
      if (user) return user;
    }

-   // 2. Try legacy JWT token
-   if (tokenMatch) {
-     const legacyUsername = await verifyLegacyJWT(token);
-     ...
-   }

    return null;
  }
```

同时移除 `JWT_SECRET` 环境变量引用：
- `.env.example` 中删除 `JWT_SECRET`
- `playwright.config.ts` 中删除 `JWT_SECRET=playwright-test-secret`
- `DEPLOY.md` 中删除相关说明

### Step 4：验证

- 运行全量测试：`pnpm lint && pnpm test && pnpm build`
- 运行 E2E：`pnpm exec playwright test`
- 确认所有认证流程走 DB Session

## 回滚方案

如果 Step 3 部署后发现问题（部分用户仍在使用 JWT），可通过 git revert 恢复代码。JWT 验证本身是无状态的，不依赖数据库，恢复后立即可用。

## 参考文件

- `src/lib/auth.ts` — 认证核心代码
- `prisma/schema.prisma` — Session 表定义
- `docs/handover/RBAC_ARCHITECTURE.md` — RBAC 架构文档
