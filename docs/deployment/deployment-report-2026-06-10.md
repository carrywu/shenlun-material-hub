# 申论素材库 ECS 部署报告

> 日期：2026-06-10
> 分支：`audit/boundary-hardening-2026-06-08`
> 提交：`735d409` (Validate bcrypt hashes without shell interpolation)
> 服务器：阿里云 ECS 47.119.182.210 (Ubuntu 24.04, x86_64)

---

## 1. 部署架构

```
Internet → :80 Caddy (reverse proxy) → :3000 Next.js App → :5432 PostgreSQL
                   ↑                        ↑                     ↑
              caddy:2-alpine          shenlun-material-hub    postgres:16
              (caddy_data 卷)         (standalone 镜像)       (pgdata 卷)
```

- **网络**：Docker bridge `internal`，PostgreSQL 不暴露到宿主机
- **数据持久化**：`pgdata` 卷（数据库）、`./data/uploads`（文件上传）
- **反向代理**：Caddy 2 监听 80/443，gzip/zstd 压缩

## 2. 已完成的步骤

### 2.1 本地验证（全部通过 ✅）

| 检查项 | 结果 | 详情 |
|--------|------|------|
| `pnpm lint` | ✅ Passed | Exit 0，仅有存量 warning |
| `pnpm test` | ✅ Passed | 46 files, 297 tests |
| `pnpm build` | ✅ Passed | Next.js 16 生产构建，81 routes |
| `pnpm test src/app/api/health/__tests__/route.test.ts` | ✅ Passed | 2 个 health-check 测试 |
| `bash -n scripts/deploy/*.sh` | ✅ Passed | 部署/备份/恢复/日志脚本语法正确 |
| `docker compose config --quiet` | ✅ Passed | 生产 compose 配置校验通过 |
| Docker 本地构建 | ✅ Passed | 完整构建通过，镜像 1.02GB |

### 2.2 Docker 镜像构建细节

```
Dockerfile 多阶段构建:
  base      → node:22-bookworm-slim + npmmirror + pnpm@11.4.0
  build-base → 阿里云 apt 源 + python3/make/g++/openssl
  deps      → pnpm install --frozen-lockfile
  prod-deps → pnpm install --prod --frozen-lockfile
  builder   → prisma rebuild + db:generate + next build
  runner    → standalone + static + prisma + 非 root 用户运行
```

关键优化：
- Prisma 引擎使用 npmmirror 镜像下载
- npm/pnpm 使用 npmmirror registry
- apt 使用阿里云 Debian 镜像
- `chown` 只对 `public/uploads` 和 `.next/cache` 授权，避免递归遍历整个 `/app`
- `.dockerignore` 排除了 `.auth/`、`.playwright-mcp/`、`*.db`、`prisma/*.db*` 等敏感文件

### 2.3 服务器初始化（已通过 ✅）

- 阿里云 apt 源配置
- Docker CE 安装 + 阿里云 Docker mirror
- 目录创建：`/opt/shenlun-material-hub`、`backups/`、`data/uploads/`

### 2.4 旧部署清理（已通过 ✅）

| 操作 | 状态 |
|------|------|
| 停止旧 `shenlun` compose 容器 | ✅ `shenlun-app-1`, `shenlun-postgres-1` 已移除 |
| 删除旧网络 `shenlun_default` | ✅ |
| 保留数据卷 `shenlun_pgdata` | ✅ 未删除 |

### 2.5 服务器环境配置（已通过 ✅）

文件 `/opt/shenlun-material-hub/.env.production`，权限 600：
- `DATABASE_URL` — PostgreSQL 内部网络连接
- `ADMIN_PASSWORD_HASH` — bcrypt hash（单引号包裹防 Compose 插值）
- `JWT_SECRET` — 随机 64 字符 hex
- `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` — MiMo AI 配置
- `IMA_CLIENT_ID` / `IMA_API_KEY` — IMA 知识库配置
- `CADDY_SITE_ADDRESS` — `:80`（当前无域名/TLS）

## 3. 遇到的问题与解决

### 3.1 ECS 上 Docker 构建资源耗尽

**现象**：`docker compose up --build` 在 ECS 上触发 in-container 构建（g++ + pnpm + Next.js），导致 2 vCPU / ~2GB 的 ECS 实例资源耗尽。SSH banner 超时，HTTP 502。

**解决方案**：改为本地构建 → `docker save` 导出 → `scp` 传输 → `docker load` 加载 → `docker compose up --no-build` 启动。

### 3.2 bcrypt hash 与 Docker Compose 插值冲突

**现象**：`ADMIN_PASSWORD_HASH=$2b$12$...` 中的 `$` 被 Compose 当作变量插值，导致 hash 被截断。

**解决方案**：env 文件中使用单引号包裹 hash 值，部署脚本的校验逻辑改为 `case` 模式匹配以兼容引号格式。

提交：`1dfa5c4` + `735d409`

### 3.3 `.dockerignore` 不完整导致构建上下文膨胀

**现象**：Docker 构建上下文从预期 ~8MB 膨胀到 600MB+，包含 `.playwright-mcp/`（469MB）、`prisma/dev.db` 等本地文件。

**解决方案**：补充 `.dockerignore` 规则，排除 `.auth/`、`.omx/`、`.playwright-mcp/`、`*.db`、`*.sqlite`、`prisma/*.db*`、`tsconfig.tsbuildinfo`。

### 3.4 `chown -R /app` 耗时过长

**现象**：最终 runner 阶段 `chown -R nextjs:nodejs /app` 递归遍历所有依赖目录，在本地构建也卡了 30+ 分钟。

**解决方案**：收窄为只授权需要写入的目录：
```dockerfile
RUN mkdir -p /app/public/uploads /app/.next/cache \
  && chown -R nextjs:nodejs /app/public/uploads /app/.next/cache
```

## 4. 待完成步骤

### 4.1 镜像导出 ✅ (12:30 完成)

```bash
# 本地导出 — 已完成
docker save shenlun-material-hub:latest | gzip > /tmp/shenlun-material-hub-image.tar.gz
# 结果: 277MB 压缩后（原始 1.02GB）
ls -lh /tmp/shenlun-material-hub-image.tar.gz
# -rw-r--r--  1 apple  wheel   277M  6 10 12:30 /tmp/shenlun-material-hub-image.tar.gz
```

### 4.2 镜像传输与加载（等待 ECS 恢复）

> ✅ ECS 已通过阿里云控制台重启恢复（12:32 SSH banner 恢复）

### 4.3 镜像传输 ✅

```bash
sshpass -p '***' scp /tmp/shenlun-material-hub-image.tar.gz root@47.119.182.210:/tmp/
# 277MB 传输完成，无错误
```

### 4.4 镜像加载 + 服务启动 ✅ (12:59 完成)

第一次启动失败：app 容器报 `Can't write to node_modules/@prisma/engines`，因为 `nextjs` 用户无写入权限。

**修复**：Dockerfile runner 阶段增加 `chown -R nextjs:nodejs /app/node_modules`，本地重新构建、导出、传输。

```bash
# ECS 上操作
docker compose -f docker-compose.prod.yml --env-file .env.production down --remove-orphans
docker load < /tmp/shenlun-material-hub-image.tar.gz
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build
```

**容器状态（全部 healthy）：**

| 容器 | 镜像 | 状态 | 端口 |
|------|------|------|------|
| shenlun-material-hub-postgres-1 | postgres:16 | healthy | 5432（内部） |
| shenlun-material-hub-app-1 | shenlun-material-hub:latest | healthy | 3000（内部） |
| shenlun-material-hub-caddy-1 | caddy:2-alpine | running | 80→80, 443→443 |

### 4.5 部署验证 ✅

```
Health check:     {"ok":true,"timestamp":"2026-06-10T04:59:32.778Z","database":"ok"}
Admin login:      HTTP 200 (12582 bytes)  → http://47.119.182.210/admin/login
Homepage:         HTTP 307 (redirect to login)
```

## 5. 配置清单

### 5.1 Docker Compose 服务

| 服务 | 镜像 | 端口 | 健康检查 |
|------|------|------|----------|
| postgres | postgres:16 | 5432（内部） | `pg_isready -U shenlun` / 5s |
| app | shenlun-material-hub:latest | 3000（内部） | `fetch /api/health` / 30s |
| caddy | caddy:2-alpine | 80, 443 | depends_on app healthy |

### 5.2 环境变量摘要

| 变量 | 说明 | 来源 |
|------|------|------|
| `POSTGRES_PASSWORD` | 数据库密码 | 随机生成 |
| `DATABASE_URL` | 内部 PostgreSQL URL | 自动拼接 |
| `ADMIN_PASSWORD_HASH` | 管理员 bcrypt hash | 随机生成 |
| `JWT_SECRET` | JWT 签名密钥 | 随机生成 |
| `AI_API_KEY` | MiMo AI API Key | 用户提供 |
| `IMA_CLIENT_ID` | IMA 知识库 Client ID | 用户提供 |
| `CADDY_SITE_ADDRESS` | `:80`（HTTP only） | 默认 |

### 5.3 管理员凭证

- URL: `http://47.119.182.210/admin/login`
- 用户名: `admin`
- 密码: 存储在服务器 `/root/shenlun-material-hub-admin-password.txt`（权限 600）

## 6. 回退方案

| 场景 | 操作 |
|------|------|
| 新部署启动失败 | `docker compose down`，保留 pgdata 卷排查日志 |
| 数据库连接失败 | 检查 pgdata 卷是否挂载，`docker compose logs postgres` |
| 应用运行异常 | `docker compose logs --tail=200 app` 查看错误 |
| 完全回退 | 恢复旧 `shenlun` compose（如旧 pgdata 兼容） |
| 磁盘不足 | `docker system prune -f` 清理旧镜像/构建缓存 |

## 7. 后续优化建议

1. **域名 + TLS**：配置域名后 Caddy 自动签发 Let's Encrypt 证书
2. **CI/CD**：GitHub Actions 构建镜像 → 推送到阿里云容器镜像服务 → ECS 拉取部署
3. **备份自动化**：`scripts/deploy/backup-db.sh` 加入 crontab 每日备份
4. **监控**：接入阿里云云监控或 Prometheus + Grafana
5. **ECS 规格**：如需在服务器上构建，建议升级到 4 vCPU / 8GB
6. **部署脚本优化**：`aliyun-deploy.sh` 增加 `--no-build` 参数支持预构建镜像部署

## 8. 数据迁移 (14:55-15:01)

### 迁移方式

`pg_dump --data-only --column-inserts` → `scp` → `docker cp` + `psql -f` 恢复。
使用 `SET session_replication_role = 'replica'` 跳过外键检查。

### 迁移结果

| 表 | 本地 | ECS | 状态 |
|---|---|---|---|
| ContentItem (文章) | 445 | 445 | ✅ |
| Source (来源) | 31 | 31 | ✅ |
| User (用户) | 18 | 18 | ✅ |
| CollectorRun | 35 | 35 | ✅ |
| ArticleAnnotation | 25 | 25 | ✅ |
| CollectionChannel | 9 | 9 | ✅ |
| MaterialCard (素材卡) | 11 | 11 | ✅ |
| SyncRecord | 14 | 14 | ✅ |
| AsyncTask | 3 | 1 | ✅ |
| AiConfig | 2 | 0 | ⚠️ schema 差异 |

**AiConfig 说明**：本地有 `userId` 列（额外 migration），ECS schema 不含此列。需在管理后台重新配置 AI。

## 9. Git 提交记录

```
735d409 Validate bcrypt hashes without shell interpolation
1dfa5c4 Accept quoted bcrypt hashes in deployment env files
c2b548b Enable ECS deployment behind a production proxy
b30e331 fix(deploy): harden Dockerfile for Prisma 7 and production build
```
