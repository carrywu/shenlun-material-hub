# 腾讯云 TCR 个人版首次部署报告

> 日期：2026-06-10
> 分支：`audit/boundary-hardening-2026-06-08`
> 提交：`cba81ad` (feat(deploy): add TCR personal edition deployment pipeline)
> 服务器：阿里云 ECS 47.119.182.210 (2C2G, 1Mbps)

---

## 1. 部署架构

```
┌─────────────┐    docker push     ┌──────────────────────┐    docker pull    ┌──────────────┐
│  本地 Mac    │ ─────────────────→ │ 腾讯云 TCR 个人版     │ ─────────────────→ │ 阿里云 ECS   │
│  构建+推送   │    三个 tag        │ ccr.ccs.tencentyun.com│    按需拉取        │ 运行容器      │
└─────────────┘                    │ /carrywu/shenlun      │                   └──────────────┘
                                   └──────────────────────┘
                                           私有仓库
```

```
Internet → :80 Caddy (reverse proxy) → :3000 Next.js App → :5432 PostgreSQL
                   ↑                        ↑                     ↑
              caddy:2-alpine          TCR 镜像 (TCR 个人版)    postgres:16
              (caddy_data 卷)         (standalone 镜像)        (pgdata 卷)
```

- **镜像来源**：从本地 `docker build` → 推送到 TCR → ECS 从 TCR 拉取
- **服务器不执行任何构建任务**
- **网络**：Docker bridge `internal`，PostgreSQL 不暴露到宿主机
- **数据持久化**：`pgdata` 卷（数据库）、`./data/uploads`（文件上传）
- **反向代理**：Caddy 2 监听 80/443，gzip/zstd 压缩

## 2. 镜像信息

| 属性 | 值 |
|------|-----|
| 仓库地址 | `ccr.ccs.tencentyun.com/carrywu/shenlun` |
| 当前 tag | `20260610-1732` |
| Git SHA tag | `cba81ad` |
| 默认 tag | `latest` |
| 镜像 digest | `sha256:1052c5358b27cd81a39d42c016370df1fe2c5a316942a61ae9c6bfd25581cbba` |
| 平台 | `linux/amd64` |
| 构建方式 | Docker 多阶段构建（standalone） |

## 3. 部署流程执行记录

### 3.1 本地 TCR 登录 ✅

```bash
docker login ccr.ccs.tencentyun.com --username=100011725549 --password-stdin
# Login Succeeded
```

### 3.2 Docker 镜像构建 ✅

```bash
docker build --platform linux/amd64 -f Dockerfile \
  -t ccr.ccs.tencentyun.com/carrywu/shenlun:latest .
# 构建耗时约 10 分钟（大部分层命中缓存）
# 输出：81 routes，Next.js 16.2.6 (Turbopack)
```

### 3.3 镜像打 Tag + 推送 TCR ✅

```bash
# 三个 tag 指向同一个 image digest
docker tag ... 20260610-1732   # 时间戳 tag
docker tag ... cba81ad         # git sha tag
docker push ... 20260610-1732  # ✅
docker push ... cba81ad        # ✅ (层已存在，秒传)
docker push ... latest         # ✅ (层已存在，秒传)
```

### 3.4 ECS TCR 登录 ✅

```bash
ssh root@47.119.182.210
echo "***" | docker login ccr.ccs.tencentyun.com --username=100011725549 --password-stdin
# Login Succeeded
# 凭据保存在 ~/.docker/config.json，后续无需重复登录
```

### 3.5 同步配置到 ECS ✅

```bash
scp docker-compose.prod.yml root@47.119.182.210:/opt/shenlun-material-hub/
scp scripts/deploy/*.sh root@47.119.182.210:/opt/shenlun-material-hub/scripts/deploy/
```

### 3.6 ECS 拉取镜像 ✅

```bash
IMAGE_TAG=20260610-1732 docker compose -f docker-compose.prod.yml \
  --env-file .env.production pull app
# 从 TCR 拉取成功（约 200MB 下载，1Mbps 带宽耗时约 30 分钟）
```

### 3.7 重启服务 ✅

```bash
IMAGE_TAG=20260610-1732 docker compose -f docker-compose.prod.yml \
  --env-file .env.production up -d --no-build app
# app 容器创建并启动
# postgres: healthy, caddy: running
```

### 3.8 健康检查 ✅

```bash
# ECS 内部
curl http://127.0.0.1/api/health
# {"ok":true,"timestamp":"2026-06-10T09:40:45.953Z","database":"ok"}

# 外部访问
curl http://47.119.182.210/api/health
# {"ok":true,"timestamp":"2026-06-10T09:40:50.312Z","database":"ok"}
```

## 4. 容器状态

| 容器 | 镜像 | 状态 | 端口 |
|------|------|------|------|
| shenlun-material-hub-postgres-1 | postgres:16 | Up 2h (healthy) | 5432（内部） |
| shenlun-material-hub-app-1 | ccr.ccs.tencentyun.com/carrywu/shenlun:20260610-1732 | Up (healthy) | 3000（内部） |
| shenlun-material-hub-caddy-1 | caddy:2-alpine | Up 2h | 80→80, 443→443 |

## 5. REVISION 记录

```
IMAGE_TAG=20260610-1732
DEPLOYED_AT=2026-06-10T09:41:18Z
DEPLOYED_BY=root
```

## 6. 变更文件清单

### 新建文件（9 个）

| 文件 | 用途 |
|------|------|
| `scripts/deploy/deploy-tcr.sh` | 本地一键构建+推送+部署脚本 |
| `scripts/deploy/server-pull-and-restart.sh` | ECS 端拉取+备份+重启+清理脚本 |
| `scripts/deploy/rollback-tcr.sh` | ECS 端回滚脚本 |
| `.env.deploy.example` | 本地部署配置模板（提交 Git） |
| `.env.deploy.local` | 本地部署配置（含密码，gitignored） |
| `docs/deployment/tcr-deployment-plan.md` | TCR 部署方案文档 |
| `docs/deployment/tcr-deployment-checklist.md` | 部署检查清单 |
| `docs/deployment/tcr-rollback-guide.md` | 回滚指南 |
| `docs/deployment/tcr-troubleshooting.md` | 故障排查手册（10 个场景） |

### 修改文件（3 个）

| 文件 | 变更 |
|------|------|
| `docker-compose.prod.yml` | 移除 `build:` 块，`image:` 改为 TCR 地址 + `${IMAGE_TAG:-latest}` |
| `.gitignore` | 追加 `.env.deploy.local`、`!.env.deploy.example`、`*.pem`、`*.key`、`*.crt` |
| `.env.production.example` | 追加 IMAGE_TAG 使用说明 |

## 7. 与之前部署方式的对比

| 对比项 | 旧方式（docker save） | 新方式（TCR） |
|--------|----------------------|---------------|
| 构建位置 | 本地 Mac | 本地 Mac（不变） |
| 传输方式 | `docker save \| gzip` → SCP → `docker load` | `docker push` → TCR → `docker pull` |
| 版本管理 | 无（只有一个 `latest`） | 三个 tag（时间戳 + git sha + latest） |
| 回滚能力 | 无（需重新构建） | 秒级回滚到任意 tag |
| 首次传输 | ~277MB SCP 直传 | ~200MB TCR 中转 |
| 增量更新 | 全量传输 | Docker 层缓存复用 |
| 操作复杂度 | 手动多步操作 | 一条命令 `bash scripts/deploy/deploy-tcr.sh` |
| 凭据管理 | SSH 密码 | TCR 凭据持久化 + SSH |

## 8. 后续一键部署命令

```bash
# 日常部署（构建 + 推送 + 远程重启 + 健康检查）
bash scripts/deploy/deploy-tcr.sh

# 预览（不执行）
bash scripts/deploy/deploy-tcr.sh --dry-run

# 回滚（在 ECS 上执行）
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh cba81ad'
```

## 9. 后续优化建议

1. **域名 + HTTPS**：配置域名后 Caddy 自动签发 Let's Encrypt 证书
2. **GitHub Actions CI/CD**：自动构建 + 推送 TCR + SSH 部署
3. **自动备份**：crontab 每日执行 `aliyun-backup-db.sh`
4. **监控告警**：接入阿里云云监控
5. **镜像层缓存优化**：调整 Dockerfile 层顺序减少增量体积
