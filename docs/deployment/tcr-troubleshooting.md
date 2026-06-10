# TCR 部署故障排查

---

## 目录

1. [TCR 登录失败](#1-tcr-登录失败)
2. [镜像推送失败](#2-镜像推送失败)
3. [镜像拉取失败](#3-镜像拉取失败)
4. [容器启动失败](#4-容器启动失败)
5. [健康检查失败](#5-健康检查失败)
6. [磁盘空间不足](#6-磁盘空间不足)
7. [网络传输慢](#7-网络传输慢)
8. [数据库连接失败](#8-数据库连接失败)
9. [Prisma Migration 错误](#9-prisma-migration-错误)
10. [Cookie / 登录问题](#10-cookie--登录问题)

---

## 1. TCR 登录失败

### 症状
```
Error: login attempt to https://ccr.ccs.tencentyun.com/v2/ failed with status: 401 Unauthorized
```

### 排查

```bash
# 检查 Docker 凭据
cat ~/.docker/config.json | grep ccr.ccs.tencentyun.com

# 重新登录
docker login ccr.ccs.tencentyun.com --username=100011725549
```

### 常见原因
- 密码错误（检查腾讯云控制台 → 容器镜像服务 → 访问凭证）
- 凭据过期（TCR 个人版 token 有效期较长，但可能被手动撤销）
- 本地 `~/.docker/config.json` 损坏

---

## 2. 镜像推送失败

### 症状
```
denied: requested access to the resource is denied
```

### 排查

```bash
# 确认已登录
docker login ccr.ccs.tencentyun.com --username=100011725549

# 确认仓库名正确
docker images | grep ccr.ccs.tencentyun.com

# 手动推送测试
docker push ccr.ccs.tencentyun.com/carrywu/shenlun:latest
```

### 常见原因
- 未登录或登录过期
- 仓库名/namespace 拼写错误
- 仓库不存在（需要在腾讯云控制台先创建）

---

## 3. 镜像拉取失败

### 症状（ECS 上）
```
Error response from daemon: pull access denied for ccr.ccs.tencentyun.com/carrywu/shenlun
```

### 排查

```bash
# SSH 到 ECS
ssh root@47.119.182.210

# 检查 TCR 登录状态
cat ~/.docker/config.json | grep ccr.ccs.tencentyun.com

# 重新登录
docker login ccr.ccs.tencentyun.com --username=100011725549

# 手动拉取测试
docker pull ccr.ccs.tencentyun.com/carrywu/shenlun:latest
```

### 常见原因
- ECS 上未登录 TCR（首次使用需要 `docker login`）
- 登录凭据过期
- tag 不存在（检查 `docker images` 或 TCR 控制台）
- 网络不通（ECS 到 TCR 的网络被防火墙阻断）

---

## 4. 容器启动失败

### 症状
```
docker compose ps  →  Restarting 或 Exit 1
```

### 排查

```bash
# 查看容器日志
bash scripts/deploy/aliyun-logs.sh app

# 或直接
docker compose logs --tail=200 app

# 查看退出码
docker inspect --format='{{.State.ExitCode}}' <container_id>
```

### 常见退出码
| 码 | 含义 | 排查方向 |
|----|------|----------|
| 1 | 应用错误 | 查看日志中的 Error/Exception |
| 137 | OOM Killed | 内存不足，检查 `docker stats` |
| 139 | Segfault | Node.js 崩溃，检查日志 |

### 常见原因
- `.env.production` 缺少必要变量（特别是 `DATABASE_URL`、`JWT_SECRET`）
- Prisma migration 失败
- 端口冲突
- 内存不足（2G 服务器可能在构建期 OOM）

---

## 5. 健康检查失败

### 症状
```
Health check FAILED after 120s
```

### 排查

```bash
# 在 ECS 上手动测试
curl -v http://127.0.0.1/api/health

# 查看容器状态
docker compose ps

# 查看应用日志
bash scripts/deploy/aliyun-logs.sh app

# 从外部测试
curl http://47.119.182.210/api/health
```

### 常见原因
- 应用还在启动中（Next.js standalone 首次启动较慢）
- 数据库连接失败（检查 postgres 容器状态）
- 端口未暴露或 Caddy 未正确代理

---

## 6. 磁盘空间不足

### 症状
```
no space left on device
```

### 排查

```bash
# 查看磁盘使用
df -h

# 查看 Docker 占用
docker system df

# 查看镜像列表
docker images ccr.ccs.tencentyun.com/carrywu/shenlun

# 查看备份文件
ls -lh backups/
```

### 清理方式

```bash
# 清理旧镜像（server-pull-and-restart.sh 自动执行）
# 手动清理特定 tag：
docker rmi ccr.ccs.tencentyun.com/carrywu/shenlun:<old-tag>

# 清理 dangling images（无 tag 的中间层）
docker image prune -f

# 清理旧备份（保留最近 7 天）
find backups/ -name "*.dump" -mtime +7 -delete

# ⚠️ 不要执行以下命令，除非明确确认：
# docker system prune -a     # 会删除所有未使用的镜像！
# docker volume rm           # 会删除数据库数据！
```

---

## 7. 网络传输慢

### 症状
镜像拉取耗时超过 40 分钟

### 排查

```bash
# 测试 ECS 到 TCR 网络延迟
curl -o /dev/null -w "Speed: %{speed_download} bytes/s\n" \
  https://ccr.ccs.tencentyun.com/v2/

# 查看 Docker pull 进度
docker pull ccr.ccs.tencentyun.com/carrywu/shenlun:latest
```

### 缓解方法
- 确保只更新有变化的层（Docker 层缓存机制）
- 在 `server-pull-and-restart.sh` 中使用 `docker compose pull app` 只拉 app 镜像
- 如果网络持续很慢，可考虑在 ECS 上配置 Docker mirror

---

## 8. 数据库连接失败

### 症状
```
Error: P1001: Can't reach database server at `postgres:5432`
```

### 排查

```bash
# 检查 postgres 容器状态
docker compose ps postgres

# 查看 postgres 日志
bash scripts/deploy/aliyun-logs.sh postgres

# 在 app 容器中测试连接
docker compose exec app node -e "
  const { Client } = require('pg');
  const c = new Client(process.env.DATABASE_URL);
  c.connect().then(() => { console.log('OK'); c.end(); }).catch(e => console.error(e));
"
```

### 常见原因
- postgres 容器未启动或未 healthy
- `DATABASE_URL` 格式错误
- `POSTGRES_PASSWORD` 不匹配
- Docker 内部网络异常

---

## 9. Prisma Migration 错误

### 症状
```
Error: P3005: The database schema is not empty.
```

### 排查

```bash
# 查看 migration 状态
docker compose exec app npx prisma migrate status

# 查看 migration 历史
docker compose exec postgres psql -U shenlun -d shenlun_material_hub \
  -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

### 常见原因
- migration 文件与数据库状态不一致
- 多个实例同时运行 `migrate deploy`
- 手动修改了数据库 schema

---

## 10. Cookie / 登录问题

### 症状
登录后仍显示 401，或登录后立即退出

### 排查

```bash
# 检查当前部署的 cookie 策略
# 查看 src/lib/auth.ts 中 isHttps() 函数
# 当前逻辑：根据 NEXT_PUBLIC_APP_URL 判断是否 HTTPS

# 检查 .env.production 中的 NEXT_PUBLIC_APP_URL
ssh root@47.119.182.210 'grep NEXT_PUBLIC_APP_URL /opt/shenlun-material-hub/.env.production'
```

### 常见原因
- HTTP 部署但 cookie 设置了 `Secure` 标志 → 浏览器拒绝
- `NEXT_PUBLIC_APP_URL` 设置为 `https://` 但实际是 HTTP
- `JWT_SECRET` 未设置或与之前不同 → 旧 session 失效

### 修复
确保 `.env.production` 中 `NEXT_PUBLIC_APP_URL=http://47.119.182.210`（HTTP 部署不加 https）
