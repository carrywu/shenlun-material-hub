# 腾讯云 TCR 个人版部署方案

> 适用项目：shenlun-material-hub
> 日期：2026-06-10
> 镜像仓库：腾讯云 TCR 个人版 `ccr.ccs.tencentyun.com/carrywu/shenlun`

---

## 1. 架构概览

```
┌─────────────┐      docker push       ┌──────────────────┐      docker pull      ┌──────────────┐
│  本地 Mac    │ ──────────────────────→ │ 腾讯云 TCR 个人版 │ ──────────────────────→ │ 阿里云 ECS   │
│  (构建镜像)  │      三个 tag           │ (镜像仓库，私有)   │      按需拉取           │ (运行容器)    │
└─────────────┘                         └──────────────────┘                        └──────────────┘
     ↑                                                                                  ↑
     │ deploy-tcr.sh                                                         server-pull-and-restart.sh
     │ (一键脚本)                                                                      │ (服务器脚本)
                                                                                       │
                                                                              rollback-tcr.sh
                                                                              (回滚脚本)
```

**数据流**：本地构建 → 推送 TCR → ECS 拉取 → docker compose 重启 → 健康检查验证

## 2. 前提条件

### 本地 Mac

- Docker Desktop 已安装并运行
- 已登录 TCR：`docker login ccr.ccs.tencentyun.com --username=100011725549`
- SSH 可连接 ECS：`ssh root@47.119.182.210`
- 已配置 `.env.deploy.local`（从 `.env.deploy.example` 复制）

### ECS 服务器

- Docker CE + Docker Compose 已安装
- 已登录 TCR：`docker login ccr.ccs.tencentyun.com --username=100011725549`（凭据持久化在 `~/.docker/config.json`）
- `/opt/shenlun-material-hub/.env.production` 已配置
- `docker-compose.prod.yml` 使用 TCR 镜像地址

## 3. 一次性设置

### 3.1 本地 TCR 登录

```bash
docker login ccr.ccs.tencentyun.com --username=100011725549
# 输入密码（腾讯云控制台 → 容器镜像服务 → 访问凭证）
```

### 3.2 ECS TCR 登录

```bash
ssh root@47.119.182.210
docker login ccr.ccs.tencentyun.com --username=100011725549
# 输入密码
# 凭据保存在 ~/.docker/config.json，后续 pull 无需重复登录
```

### 3.3 本地部署配置

```bash
cp .env.deploy.example .env.deploy.local
# 编辑 .env.deploy.local，填写 TCR_PASSWORD
```

## 4. 日常部署

```bash
# 一键部署（构建 + 推送 + 远程重启 + 健康检查）
bash scripts/deploy/deploy-tcr.sh

# Dry run（只打印计划，不执行）
bash scripts/deploy/deploy-tcr.sh --dry-run

# 跳过构建（使用已构建的镜像）
bash scripts/deploy/deploy-tcr.sh --skip-build

# 使用自定义 tag
bash scripts/deploy/deploy-tcr.sh --tag hotfix-1

# 无需确认（CI 用）
bash scripts/deploy/deploy-tcr.sh --no-confirm
```

## 5. Tag 策略

每次部署给同一镜像打三个 tag：

| Tag | 格式 | 用途 | 示例 |
|-----|------|------|------|
| 时间戳 | `YYYYMMDD-HHMM` | 人工识别部署版本 | `20260610-1530` |
| Git SHA | 7 字符短 hash | 精确回滚到某个 commit | `a1b2c3d` |
| `latest` | 固定 | 默认部署目标 | `latest` |

三个 tag 指向同一个 image digest。

**保留策略**：ECS 服务器保留最近 3 个版本 tag + `latest`，自动清理更旧的镜像。

## 6. 回滚

```bash
# 在 ECS 上列出可用 tag
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh'

# 回滚到指定 tag
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh a1b2c3d'
```

详见 [tcr-rollback-guide.md](./tcr-rollback-guide.md)。

## 7. 手动操作命令

如果脚本不可用，可手动执行：

```bash
# 本地构建 + 推送
docker build --platform linux/amd64 -t ccr.ccs.tencentyun.com/carrywu/shenlun:latest .
docker push ccr.ccs.tencentyun.com/carrywu/shenlun:latest

# 服务器拉取 + 重启
ssh root@47.119.182.210
cd /opt/shenlun-material-hub
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml --env-file .env.production pull app
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build app

# 健康检查
curl http://127.0.0.1/api/health
```

## 8. 服务器资源预估

| 资源 | 用量 | 说明 |
|------|------|------|
| 镜像存储 | ~1GB × 4 = 4GB | 3 个版本 + latest |
| PostgreSQL | ~100MB | 数据库数据 |
| 上传文件 | 可变 | `data/uploads/` |
| 备份 | ~50MB × 7 = 350MB | 保留 7 天 |
| **合计** | ~5-6GB | 40GB 磁盘足够 |

## 9. 网络传输预估

| 操作 | 大小 | 1Mbps 耗时 |
|------|------|-----------|
| 镜像推送（本地上传） | ~277MB 压缩 | 取决于本地上行 |
| 镜像拉取（ECS 下载） | ~277MB 压缩 | ~36 分钟 |
| 增量更新（层复用） | ~10-50MB | ~5-10 分钟 |

## 10. 后续升级方向

1. **GitHub Actions CI/CD** — 自动构建 + 推送 + SSH 部署
2. **域名 + HTTPS** — Caddy 自动签发 Let's Encrypt
3. **自动备份** — crontab 每日备份 PostgreSQL
4. **监控告警** — 阿里云云监控或 Prometheus
