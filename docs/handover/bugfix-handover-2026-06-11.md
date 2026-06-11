# 交接报告：线上 Bug 修复（WeWe RSS + 权限 + 连接测试）

> 日期：2026-06-11
> 分支：`audit/boundary-hardening-2026-06-08`
> 提交：`6c7d21a`
> 部署镜像：`ccr.ccs.tencentyun.com/carrywu/shenlun:20260611-1043`

---

## 问题概述

部署后发现 3 个线上 bug：

1. **WeWe RSS `/wewerss/` 跳转 404** — Caddy 子路径反代与 WeWe RSS 前端路由冲突
2. **VERIFIED_USER "carry" 能看到/修改系统配置** — GET 端点读取用户自己的 UserIntegration 而非 admin 的
3. **连接测试失败** — 测试端点使用前端传入的 URL 而非服务端环境变量配置

---

## 修复清单

### Bug 1: WeWe RSS 404 → 改为端口映射

**根因**：`handle_path /wewerss*` 剥离前缀后，WeWe RSS 返回的 HTML 中链接不带 `/wewerss` 前缀，浏览器直接访问 `/` 导致主应用 404。

**修复**：改为端口映射方式，WeWe RSS 直接暴露 4000 端口。

| 文件 | 变更 |
|------|------|
| `docker-compose.prod.yml` | wewe-rss: `expose: "4000"` → `ports: "4000:4000"`，`SERVER_ORIGIN_URL` 改为 `:4000` |
| `deploy/Caddyfile` | 移除 `/wewerss` 反代规则，恢复为仅代理主应用 |
| `.env.production` | `NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210:4000` |

**注意**：阿里云安全组需开放 4000 端口才能从外部访问 WeWe RSS 管理界面。

### Bug 2: VERIFIED_USER 权限泄漏

**根因**：GET 端点用 `user.id` 查询 UserIntegration，每个用户有自己的记录。carry 查到自己的空记录返回 `{configured: false}`，导致前端显示不正确的状态。

**修复**：非 admin 用户读取第一个 ADMIN 的 UserIntegration 配置状态。

| 文件 | 变更 |
|------|------|
| `src/app/api/settings/integrations/wewe-rss/route.ts` | GET: 非 admin 查询 `findFirst(where: {user: {role: "ADMIN"}})` 而非 `user.id` |

**验证结果**：
- Admin 登录 → 看到完整配置（baseUrl, dbPath）✅
- Carry 登录 → 只看到 `{configured: false}`，无 baseUrl/dbPath ✅
- Carry POST 配置 → `{"error": "权限不足"}` ✅

### Bug 3: 连接测试

**根因**：测试端点从请求 body 取 URL 测试，不用服务端 `WEWERSS_BASE_URL` 环境变量。

**修复**：
1. 优先使用 `getWeweRssServerConfig()` 的内部 URL（`http://wewe-rss:4000`）
2. 兜底使用前端传入的 URL
3. 权限从 `requireVerifiedUser` 改为 `requireAdmin`

| 文件 | 变更 |
|------|------|
| `src/app/api/settings/integrations/wewe-rss/test/route.ts` | 使用 `getWeweRssServerConfig()` + `requireAdmin()` |

**验证结果**：
- Admin 连接测试 → `{"success": true, "message": "WeWe RSS 服务可访问，已订阅 0 个公众号", "feedCount": 0}` ✅

### 附加修复: Admin 密码

线上 admin 密码 hash 与实际密码不一致，已重新生成：
- 密码：`9171227871`
- Hash：`$2b$12$PI1.J8kXMn9xHPOUokShRuJEuSrHl2riLIsFi34DKHJPObzTkcrdG`

---

## 测试结果

### 本地验证
```
pnpm lint  → 0 errors in modified files
pnpm test  → 334 passed / 0 failed
pnpm build → Build successful
```

### 线上验证

| 检查项 | 结果 |
|--------|------|
| 主应用 Health | ✅ `{"ok":true}` |
| Admin 登录 (admin/9171227871) | ✅ `admin ADMIN` |
| Carry 登录 (carry/9171227871) | ✅ `carry VERIFIED_USER` |
| Carry GET 配置 | ✅ 仅返回 `{configured: false}` |
| Carry POST 配置 | ✅ `{"error":"权限不足"}` |
| Admin 连接测试 | ✅ `{"success":true, "feedCount":0}` |
| WeWe RSS 内部通信 | ✅ app → wewe-rss:4000 正常 |
| WeWe RSS 外部访问 :4000 | ⚠️ 需开放阿里云安全组 4000 端口 |

---

## 遗留事项

1. **阿里云安全组**：需在 ECS 控制台开放 TCP 4000 端口，才能从浏览器访问 WeWe RSS 管理界面 (`http://47.119.182.210:4000`)
2. **WeWe RSS 首次配置**：开放端口后访问 `http://47.119.182.210:4000`，输入 AUTH_CODE `9171227871`，添加公众号
3. **Docker Compose 警告**：`PI1` variable not set — bcrypt hash 中的 `$` 被 docker compose 解析，不影响运行（hash 在 .env.production 中已正确存储）

---

## 回滚方案

```bash
# 如果需要回滚到上一版本
ssh root@47.119.182.210
cd /opt/shenlun-material-hub
bash scripts/deploy/rollback-tcr.sh 20260611-0944
```
