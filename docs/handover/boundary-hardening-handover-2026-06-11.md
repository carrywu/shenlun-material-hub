# 交接报告：订阅级数据隔离 + WeWe RSS 生产集成

> 日期：2026-06-11
> 分支：`audit/boundary-hardening-2026-06-08`
> 提交：`57c1409` (feat + fix, 3 commits)
> 部署镜像：`ccr.ccs.tencentyun.com/carrywu/shenlun:20260611-0944`

---

## 变更概述

根据 `docs/audit/wewe-rss-integration-assessment.md` 评估结果，完成了两个未完成项：

1. **订阅级数据隔离** — 用户只能看到自己订阅来源的文章 + 自己创建的内容
2. **WeWe RSS 生产集成** — 通过 Caddy 反代打通 WeWe RSS 服务

用户确认的隔离策略：
- 订阅级隔离（订阅同一来源的用户看到同一批文章）
- 遗留数据（ownerUserId=null）归给 admin
- WeWe RSS 一起打通

---

## 变更清单

### 代码变更

| 文件 | 变更 |
|------|------|
| `src/lib/data-isolation.ts` | 移除 `contentVisibilityWhere()` 和 `subscriptionVisibilityWhere()` 中的 `{ ownerUserId: null }` fallback |
| `src/app/api/articles/route.ts` | 匿名用户仅看 `visibility: "public"`；认证用户统一用 `subscriptionVisibilityWhere()` |
| `src/app/api/discover/route.ts` | 同上，统一用 `subscriptionVisibilityWhere()` |
| `src/lib/__tests__/data-isolation-subscription.test.ts` | 新增 8 个测试用例覆盖新隔离策略 |
| `src/lib/__tests__/data-isolation-legacy.test.ts` | 更新 legacy 测试匹配新行为 |
| `src/app/api/articles/__tests__/route.test.ts` | 更新匿名用户过滤测试 |
| `src/app/api/discover/__tests__/route.test.ts` | 更新为 subscription 过滤测试 |

### 基础设施变更

| 文件 | 变更 |
|------|------|
| `docker-compose.prod.yml` | 新增 `wewe-rss` 服务（TCR 镜像 `carrywu/wewe-rss:v2.6.1`） |
| `deploy/Caddyfile` | 新增 `/wewerss*` → `wewe-rss:4000` 反代规则 |
| `.env.production.example` | 新增 `WEWERSS_BASE_URL`、`NEXT_PUBLIC_WEWERSS_PUBLIC_URL`、`WEWERSS_AUTH_CODE` |
| `scripts/deploy/server-pull-and-restart.sh` | 新增 wewe-rss 容器启动步骤 |

---

## 测试结果

### 本地验证

```
pnpm lint   → 0 errors in modified files (pre-existing 7 errors unchanged)
pnpm test   → 334 passed / 0 failed (54 test files)
pnpm build  → Build successful
```

### 线上验证

| 检查项 | 结果 |
|--------|------|
| 主应用健康检查 `GET /api/health` | ✅ `{"ok":true,"database":"ok"}` |
| WeWe RSS 连通 `GET /wewersss/` | ✅ HTTP 200 |
| WeWe RSS feeds API `GET /wewerss/feeds/` | ✅ 返回 `[]`（新实例，未配置公众号） |
| 容器状态 | ✅ 4/4 运行中（app healthy, caddy, postgres healthy, wewe-rss） |
| ownerUserId=null 残留 | ✅ 0 条 |
| ContentItem 归属 | ✅ 480 条全部归属 admin |

---

## 数据库迁移

**线上执行：**

```sql
-- 将 41 条 ownerUserId=null 的 ContentItem 归给 admin
UPDATE "ContentItem" SET "ownerUserId" = 'cmq0gc25e0000cjvywsktsycz' WHERE "ownerUserId" IS NULL;
-- 结果：UPDATE 41
```

同时修复了一个之前失败的 Prisma 迁移：

```sql
-- 标记 202606099999_create_invitation_tables 为已完成（表已存在但记录未标记）
UPDATE _prisma_migrations SET finished_at = NOW()
WHERE migration_name = '202606099999_create_invitation_tables' AND finished_at IS NULL;
```

---

## WeWe RSS 配置

**线上环境变量（`.env.production`）：**

```env
WEWERSS_BASE_URL=http://wewe-rss:4000
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210/wewerss
WEWERSS_AUTH_CODE=9171227871
```

**WeWe RSS 镜像**：通过 TCR 中转（`ccr.ccs.tencentyun.com/carrywu/wewe-rss:v2.6.1`），因 Docker Hub 中国区 mirror 403。

**下一步**：
1. 访问 `http://47.119.182.210/wewerss/` 配置 WeWe RSS（输入 AUTH_CODE: 9171227871）
2. 在 WeWe RSS 中添加微信公众号
3. 回到主项目 `/settings/integrations` 测试连接
4. 在 `/settings/subscriptions` 同步并订阅公众号

---

## 部署步骤（可复现）

```bash
# 1. 本地构建 + 推送
bash scripts/deploy/deploy-tcr.sh --no-confirm

# 2. 同步配置到服务器
scp docker-compose.prod.yml deploy/Caddyfile scripts/deploy/server-pull-and-restart.sh \
  root@47.119.182.210:/opt/shenlun-material-hub/

# 3. 更新 .env.production（如需要）
# 添加 WEWERSS_BASE_URL / NEXT_PUBLIC_WEWERSS_PUBLIC_URL / WEWERSS_AUTH_CODE

# 4. 服务器重启
ssh root@47.119.182.210
cd /opt/shenlun-material-hub
bash scripts/deploy/server-pull-and-restart.sh --tag <TAG>

# 5. 数据库迁移（如需要）
docker compose -f docker-compose.prod.yml exec postgres psql -U shenlun -d shenlun_material_hub \
  -c "UPDATE \"ContentItem\" SET \"ownerUserId\" = '<admin-id>' WHERE \"ownerUserId\" IS NULL;"
```

---

## 风险 & 回滚

| 风险 | 缓解措施 |
|------|---------|
| 无订阅用户看不到文章 | 期望行为。Admin 始终可见。用户需先订阅来源。 |
| Caddy 配置错误 | 已验证通过。如需回滚，恢复原 Caddyfile（仅 `reverse_proxy app:3000`） |
| WeWe RSS 服务异常 | 不影响主应用，Caddy handle_path 隔离，主应用路由不受影响 |

**快速回滚**：
```bash
# 恢复数据隔离 null fallback
git revert HEAD~3  # 恢复 data-isolation.ts 原始代码
# 或直接在 data-isolation.ts 中恢复 { ownerUserId: null } 子句
```

---

## 遗留事项

1. **WeWe RSS 首次配置**：需要在浏览器访问 `http://47.119.182.210/wewerss/` 输入 AUTH_CODE 并添加公众号
2. **管理员密码**：线上 admin 密码 hash 与服务器登录密码不同，需确认或重置
3. **E2E 测试**：本次未运行 Playwright（依赖本地 dev server），生产验证通过 API 完成
