# Staging 测试环境部署说明

> 本文档：如何在「家里 Linux 测试机」上部署 shenlun-material-hub 的 staging 测试环境。
> 与生产环境（ECS `47.119.182.210`）完全隔离，只通过 Tailscale 访问。

---

## 1. 环境定位

| 维度 | 生产 (production) | 测试 (staging) |
|---|---|---|
| 机器 | 阿里云 ECS `47.119.182.210` | 家里 Linux 机（Tailscale `carry-pc` = `100.117.96.1`） |
| 镜像分发 | Mac buildx → 腾讯云 TCR → ECS 拉取 | Linux 机本地 `git pull` + `docker build` |
| 数据库 | 生产 PG（库名 `shenlun_material_hub`） | 独立 PG 容器（库名 `shenlun_material_hub`，独立 volume `pgdata_staging`） |
| 上传目录 | ECS `./data/uploads` | Linux 机 `./data-staging/uploads` |
| 访问 | 公网 `http://47.119.182.210`（Caddy 反代 + HTTPS） | 仅 Tailscale `http://100.117.96.1:3001`（无 Caddy） |
| 密钥 | `.env.production`（ECS 本地） | `.env.staging`（Linux 机本地） |
| we-mp-rss | ECS 生产实例（端口 4000） | 独立实例（端口 4000，需重新扫码登录） |

**核心隔离原则**：staging 不连生产数据库、不用生产上传目录、不暴露公网、密钥独立。

---

## 2. Linux 测试机准备（一次性）

### 2.1 确认 Tailscale

```bash
# 在 Linux 机上
tailscale status
# 应看到自己（carry-pc = 100.117.96.1）和 Mac（applemacbook-pro = 100.90.22.96）都在线
```

### 2.2 安装基础环境

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 重新登录让 docker 组生效

# Node 20 + pnpm（用于宿主机跑 lint/test/seed）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm

# git
sudo apt-get install -y git

# 验证
docker --version          # Docker version 2x.x
docker compose version    # Docker Compose version v2.x
node --version            # v20.x
pnpm --version            # x.x
git --version             # git version 2.x
```

### 2.3 配置 ssh 公钥（从 Mac 远程部署用，可选）

如果想让 Mac 一键远程部署，需配 ssh 公钥：

```bash
# 在 Mac 上
ssh-copy-id carry.117.96.1
# 输入 Linux 机密码（当前 <LINUX_HOST_PASSWORD>）

# 验证免密
ssh carry.117.96.1 'echo OK'
```

如果不在意自动化，跳过这步，全程 ssh 进 Linux 机手动跑脚本即可。

### 2.4 检查 4000 端口空闲（we-mp-rss 用）

```bash
# 在 Linux 机上
ss -lntp | grep :4000 || echo "4000 空闲，OK"
# 如果有占用，需先停掉占用进程，或改 docker-compose.staging.yml 的 we-mp-rss 端口
```

---

## 3. Tailscale 访问方式

部署完成后，**在 Mac 浏览器**访问：

| 用途 | 地址 |
|---|---|
| staging 后台 | `http://100.117.96.1:3001` |
| 健康检查 | `http://100.117.96.1:3001/api/health` |
| we-mp-rss 扫码配置 | `http://100.117.96.1:4000` |

如果访问失败，按顺序排查：

```bash
# 1. Tailscale 两端在线？
tailscale status

# 2. Linux 机端口在监听？
ssh carry.117.96.1 'ss -lntp | grep -E ":3001|:4000"'

# 3. 容器在跑？
ssh carry.117.96.1 'cd /home/carry/shenlun-material-hub-staging && docker compose -f docker-compose.staging.yml ps'

# 4. 防火墙（如果启用了 UFW，放行 tailscale0 网卡的 3001/4000）
ssh carry.117.96.1 'sudo ufw status'
# 如果 UFW 启用且拦截了：
#   sudo ufw allow in on tailscale0 to any port 3001
#   sudo ufw allow in on tailscale0 to any port 4000
# 注意：如果 UFW 没启用，不要为了 staging 强行开 UFW。
```

---

## 4. 项目目录结构

```
/home/carry/shenlun-material-hub-staging/        # Linux 机部署根目录
├── .git/                                  # git 仓库
├── .env.staging                           # ⚠️ 不进 git，Linux 机本地填
├── .env.staging.example                   # 模板（进 git）
├── docker-compose.staging.yml             # staging 编排
├── Dockerfile                             # 复用生产 Dockerfile
├── prisma/                                # schema + migrations
├── scripts/
│   ├── deploy-staging.sh                  # 部署脚本
│   └── check-staging.sh                   # 健康检查
├── src/                                   # 应用代码
├── data-staging/                          # staging 独立数据（不进 git）
│   └── uploads/                           # 上传文件
└── node_modules/                          # 宿主机 pnpm install 产物（跑 seed 用）

Docker volumes（由 docker compose 管理）:
- pgdata_staging                           # staging 独立 PG 数据
- wewe_data_staging                        # staging 独立 we-mp-rss 数据
```

---

## 5. 首次部署步骤

```bash
# === 在 Linux 机上 ===
cd /opt
sudo mkdir -p shenlun-material-hub-staging
sudo chown $USER:$USER shenlun-material-hub-staging
cd shenlun-material-hub-staging

# 1. clone 代码
git clone https://github.com/carrywu/shenlun-material-hub .

# 2. 创建 .env.staging
cp .env.staging.example .env.staging

# 3. 填写 .env.staging（用编辑器或 sed）
#    - POSTGRES_PASSWORD: openssl rand -hex 16
#    - ADMIN_PASSWORD:    （staging 管理员密码）
#    - AI_CONFIG_ENCRYPTION_KEY: openssl rand -base64 32
#    - JWT_SECRET:        openssl rand -base64 32
nano .env.staging

# 4. 一键部署
bash scripts/deploy-staging.sh
#    流程：build → up postgres → migrate → seed:admin → up app+we-mp-rss → health check

# 5. 健康检查
bash scripts/check-staging.sh
```

或者从 Mac 远程触发（配好 ssh 公钥后）：

```bash
# === 在 Mac 上 ===
LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh
LINUX_HOST=100.117.96.1 bash scripts/check-staging.sh
```

---

## 6. 日常更新步骤

代码 push 到 GitHub 后，更新 staging：

```bash
# 本机模式（Linux 机上）
bash scripts/deploy-staging.sh
# 脚本会自动 git pull → rebuild → migrate → 重启

# 远程模式（Mac 上）
LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh
```

只重启不 rebuild（代码没变，只是容器配置变了）：

```bash
ssh carry.117.96.1 'cd /home/carry/shenlun-material-hub-staging && \
  docker compose -f docker-compose.staging.yml --env-file .env.staging up -d'
```

---

## 7. 数据库迁移

```bash
# 在容器里跑 prisma migrate deploy（部署脚本自动执行）
ssh carry.117.96.1 'cd /home/carry/shenlun-material-hub-staging && \
  docker compose -f docker-compose.staging.yml exec -T app npx prisma migrate deploy'

# 查看迁移状态
ssh carry.117.96.1 'cd /home/carry/shenlun-material-hub-staging && \
  docker compose -f docker-compose.staging.yml exec -T postgres \
  psql -U shenlun -d shenlun_material_hub -c \
  "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at DESC;"'
```

**重置 staging 数据库（破坏性，慎用）**：

```bash
ssh carry.117.96.1 'cd /home/carry/shenlun-material-hub-staging && \
  docker compose -f docker-compose.staging.yml down -v && \
  docker volume rm shenlun-staging_pgdata_staging'
# 之后重跑 deploy-staging.sh 会重建空库 + 重新 migrate + seed
```

---

## 8. Playwright E2E 测试

### 8.1 在 Mac 上打 staging 跑 E2E

```bash
# 前提：staging 已部署且 http://100.117.96.1:3001 可访问
pnpm test:e2e:staging
# 等价于：PLAYWRIGHT_BASE_URL=http://100.117.96.1:3001 playwright test
```

`playwright.config.ts` 会检测到 `PLAYWRIGHT_BASE_URL` 非 localhost，**自动跳过自带 dev server**，直接打 staging。

### 8.2 本地开发跑 E2E（默认）

```bash
pnpm test:e2e
# 等价于：playwright test
# 会自动起 pnpm dev 在 3001，打本地
```

### 8.3 测试报告

- HTML 报告：`playwright-report/`
- 失败截图/trace/video：`test-results/`
- E2E 截图基线：`e2e/__screenshots__/`

---

## 9. 常见问题排查

| 现象 | 排查 |
|---|---|
| Mac 访问 `100.117.96.1:3001` 超时 | `tailscale status` 两端在线？Linux 机 `ss -lntp \| grep 3001` 监听？UFW 拦了？ |
| app 容器 unhealthy / 反复重启 | `docker compose logs app`；多半 `DATABASE_URL` 不对或 migrate 没跑 |
| migrate 报 `relation already exists` | PG volume 有脏数据；`docker volume rm shenlun-staging_pgdata_staging` 后重部署 |
| seed-admin 失败 | 宿主机 Node/pnpm 装了吗？`DATABASE_URL` 指向 `127.0.0.1:5433`？`.env.staging` 密码填了吗？ |
| seed-role-quotas 失败 | 先 `source .env.staging` 再跑 `npx tsx src/scripts/seed-role-quotas.ts`；确保 `prisma generate` 已执行 |
| we-mp-rss 采不到文章 | Mac 浏览器开 `http://100.117.96.1:4000` 检查是否已微信扫码登录；we-mp-rss 服务器 IP 可能被微信风控 |
| 4000 端口被占 | `ss -lntp \| grep :4000` 找占用进程；停掉或改 compose 端口 |
| ssh 免密失败 | Mac `ssh-copy-id carry.117.96.1` 跑过？`ssh -v carry.117.96.1` 看详细 |
| compose 报 `POSTGRES_PASSWORD not set` | `.env.staging` 里 `POSTGRES_PASSWORD=__手动填写__` 没改成真值 |
| 容器名冲突 | 确认没跑同名容器：`docker ps -a \| grep shenlun-staging` |

---

## 10. 安全注意事项

1. **不开公网端口**：staging 的 3001/4000 只监听 `0.0.0.0`，靠 Tailscale 可达。**绝不在路由器/安全组开放公网映射。**
2. **不连生产库**：`.env.staging` 的 `DATABASE_URL` 必须指向 staging postgres 容器（`127.0.0.1:5433` 或容器内 `postgres:5432`），**绝不指 ECS 生产库**。
3. **`.env.staging` 不进 git**：`.gitignore` 已覆盖（`.env.*` + 显式 `.env.staging`）。
4. **密钥独立**：`AI_CONFIG_ENCRYPTION_KEY` / `JWT_SECRET` 在 Linux 机上用 `openssl rand` 现场生成，**不复用生产密钥**。
5. **we-mp-rss 独立**：staging we-mp-rss 用独立 volume `wewe_data_staging`，**不从生产拷微信扫码数据**（隔离 + 防风控连锁）。
6. **管理员密码**：staging 默认密码（见 `.env.staging`）只走 Tailscale，但**上线前建议改成强密码**。⚠️ 当前 staging 管理员密码与 Linux root 密码、生产管理员密码同源，存在横向爆破风险，强烈建议改成独立值。
7. **种子账号仅限 staging**：`seed-admin` / `seed-accounts` / `seed-channels` 产生的测试数据只在 staging 库，不污染生产。
8. **UFW**：如果 Linux 机启用了 UFW，需放行 `tailscale0` 网卡的 3001/4000；**如果没启用 UFW，不要为了 staging 强行开**。

---

## 附录：与生产部署的关键差异（为什么 staging 这么搭）

| 维度 | 生产 | staging | 理由 |
|---|---|---|---|
| 镜像分发 | TCR | 本地 build | staging 在 x86_64 原生构建最快，无需 TCR 中转 |
| 反向代理 | Caddy + HTTPS | 无（Tailscale 直连） | staging 无域名，Caddy 拿不到证书；Tailscale 已端到端加密 |
| 端口 | 3000 | 3001 | 避 Playwright dev 默认端口；避生产冲突 |
| 数据库端口暴露 | 不暴露 | 5433:5432 | 方便宿主机跑 seed/调试；不暴露公网 |
| we-mp-rss 端口 | 4000 | 4000 | 与生产一致（用户决策） |
| compose project name | 默认 | `shenlun-staging` | 隔离容器/volume 命名空间 |
