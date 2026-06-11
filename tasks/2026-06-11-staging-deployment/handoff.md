# Staging 测试环境部署 — 交接文档

> 接手者请先读 `AGENT_HANDOFF.md`（项目统一交接入口），再读本文件。
> 本任务：2026-06-11，为 shenlun-material-hub 搭建独立 staging 测试环境。

---

## 一、任务一句话概述

在用户家里的 Linux 测试机（Tailscale 节点 `carry-pc` = `100.117.96.1`）上，用 docker compose 跑一套与生产完全隔离的 staging 环境，供 Docker 部署验证 / 数据库迁移验证 / Playwright E2E 验收 / 采集功能测试。Mac（`applemacbook-pro` = `100.90.22.96`）通过 Tailscale 访问 `http://100.117.96.1:3001`。

## 二、环境拓扑

```
┌─────────────────────────────────────────────────────────────┐
│  Mac (开发机, applemacbook-pro)                              │
│  Tailscale: 100.90.22.96                                    │
│  - 代码开发、pnpm lint/test/build                            │
│  - 跑 Playwright E2E → 打 staging                            │
│  - 浏览器访问 http://100.117.96.1:3001 (staging 后台)        │
│  - 浏览器访问 http://100.117.96.1:4000 (wewe-rss 扫码配置)   │
└─────────────────────────────────────────────────────────────┘
                        │ Tailscale 加密隧道
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Linux 测试机 (carry-pc)                                     │
│  Tailscale: 100.117.96.1                                    │
│  ssh: carry.117.96.1 (公钥免密)                          │
│  部署目录: /home/carry/shenlun-material-hub-staging                │
│                                                             │
│  docker compose: shenlun-staging                            │
│  ├─ postgres (pgdata_staging volume, 库 shenlun_material_hub)│
│  │   宿主端口 5433:5432                                      │
│  ├─ app (Next.js standalone, 3001:3000)                     │
│  └─ wewe-rss (sqlite, wewe_data_staging volume, 4000:4000) │
│                                                             │
│  宿主机还装了: Node 20 + pnpm + git (跑 lint/test/seed)     │
└─────────────────────────────────────────────────────────────┘
                        │ 完全隔离
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  生产 ECS (47.119.182.210) — 不受本任务影响                  │
│  TCR 镜像、生产 PG、生产上传目录 — staging 一律不碰          │
└─────────────────────────────────────────────────────────────┘
```

## 三、关键决策记录（为什么这么做）

| 决策 | 选择 | 理由 |
|---|---|---|
| 构建分发 | Linux 机本地 `git pull` + `docker build` | x86_64 原生构建最快，不走 TCR，Mac 不参与 |
| app 端口 | `3001:3000` | 用户任务要求；避 Playwright dev 默认端口冲突 |
| wewe-rss 端口 | `4000:4000` | 用户坚持和生产一致（⚠️前置：4000 必须空闲） |
| 数据库名 | `shenlun_material_hub` | 用户选 B，和生产一致；物理隔离靠独立容器+独立 volume |
| Linux 机装 Node | 是 | standalone 镜像无 devDeps，跑不了 lint/test/seed |
| E2E 跑哪 | Mac 打 staging | 用户任务要求 |
| caddy | **不要** | Tailscale 已端到端加密；staging 无域名，caddy 拿不到证书 |
| `.env.staging` 位置 | 只在 Linux 机 | 密钥不跨机传输 |
| ssh | 公钥免密 | 用户选 A，提供密码 `<LINUX_HOST_PASSWORD>` 走 ssh-copy-id |

## 四、新增/修改文件清单

**新增**：
- `.env.staging.example` — 环境变量模板（真实变量名，敏感项占位）
- `docker-compose.staging.yml` — staging 编排
- `scripts/deploy-staging.sh` — 部署脚本（LOCAL+REMOTE 双模式）
- `scripts/check-staging.sh` — 健康检查脚本
- `docs/deployment/staging-deployment.md` — 完整部署文档
- `tasks/2026-06-11-staging-deployment/` — 本任务目录（todolist/handoff/validation-report/grill-qa）

**修改**：
- `.gitignore` — 追加 `.env.staging` 显式规则
- `playwright.config.ts` — `webServer` 条件化（打远程 staging 时跳过自带 dev server）
- `package.json` — 加 `test:e2e:staging` 脚本

**不改（生产链路保护）**：
- `Dockerfile`、生产 `docker-compose.yml`、`.env.production`、`scripts/deploy/deploy-tcr.sh` 等生产部署链路一律不动。

## 五、当前状态（待执行）

> ⏳ 文档已就绪，实际部署操作待用户确认后开始。

下一步唯一行动：
1. 退出 plan mode
2. 按 `todolist.md` 顺序执行（配置文件 → 代码改动 → 文档 → 本地验证 → Linux 准备 → 首次部署 → 端到端验证 → 收尾）

## 六、待人工执行 / 确认

### 6.1 本任务内
- **首次部署后**：wewe-rss 需微信扫码登录（Mac 浏览器开 `http://100.117.96.1:4000`），否则微信采集功能采不到数据。应用本身能正常启动，不阻塞。
- **密码同源风险**（见下方「安全提醒」）：建议 staging 管理员密码改成和生产不同的值。

### 6.2 来自上一个任务（采集可观测性，commit `7ccc6a7`，tag `20260611-2042`，已上线）
- **生产库历史验证页清理**：`scripts/ops/cleanup-collector-noise.sql` 待人工执行。生产库「浙江宣传」源 10 条记录（`filterReason='全文过短（26 字）'` + `fullText` 含"环境异常"）卡在 `filtered`，因 `originalUrl @unique` 永不被自动重判。清理前后台一直显示「跳过 10」，清理后才显示「封禁 10」。**先 `pg_dump` 备份 + dry-run SELECT 确认 10 行，再事务执行。**

## 七、安全提醒（⚠️ 必读）

1. **密码同源风险**：staging 管理员密码 `<LINUX_HOST_PASSWORD>` = Linux 机 root 密码 = 生产管理员密码（`.env.production` 的 `<PRODUCTION_ADMIN_PASSWORD>`）同源。**如果 staging 被入侵，攻击者能猜到生产密码。** 强烈建议：
   - staging 管理员密码改成独立随机值
   - Linux 机 root 密码也建议改
2. **staging 不开公网**：3001/4000 只监听 `0.0.0.0`，靠 Tailscale 可达；**绝不在路由器/安全组开放公网端口**。
3. **不连生产库**：`DATABASE_URL` 必须指向 staging postgres 容器（`postgres:5432` 容器内 / `127.0.0.1:5433` 宿主机），绝不指 ECS 生产库。
4. **wewe-rss 独立**：staging wewe-rss 用独立 volume，**不从生产拷微信扫码数据**（隔离原则；且生产扫码 token 复用可能触发微信风控）。
5. **`.env.staging` 不进 git**：`.gitignore` 已覆盖 `.env.*`，并显式追加 `.env.staging`。

## 八、常用命令

```bash
# === Mac 端 ===
# 远程部署（配好公钥后）
LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh

# 远程健康检查
LINUX_HOST=100.117.96.1 bash scripts/check-staging.sh

# 从 Mac 直接 curl staging
curl http://100.117.96.1:3001/api/health

# 跑 E2E 打 staging
pnpm test:e2e:staging

# === Linux 机端（ssh 进去后）===
cd /home/carry/shenlun-material-hub-staging

# 本地模式部署
bash scripts/deploy-staging.sh

# 看容器状态
docker compose -f docker-compose.staging.yml ps

# 看日志
docker compose -f docker-compose.staging.yml logs -f app

# 重启
docker compose -f docker-compose.staging.yml restart app

# 完全销毁（保留 volume）
docker compose -f docker-compose.staging.yml down

# 销毁并删数据（⚠️ 会丢库）
docker compose -f docker-compose.staging.yml down -v
```

## 九、如果出问题

| 现象 | 排查 |
|---|---|
| Mac 访问 `100.117.96.1:3001` 不通 | `tailscale status` 确认两节点在线；Linux 机 `ss -lntp \| grep 3001` 确认监听；查防火墙 |
| app 容器 unhealthy | `docker compose logs app`；多半是 `DATABASE_URL` 不对或 migrate 没跑 |
| migrate 失败 | `docker compose exec app npx prisma migrate deploy` 手动跑看错误；确认 postgres 容器 healthy |
| seed-admin 失败 | 确认宿主机 Node/pnpm 装了；`DATABASE_URL` 指向 `127.0.0.1:5433`（宿主机映射端口） |
| wewe-rss 采不到 | 浏览器开 `http://100.117.96.1:4000` 检查是否已扫码登录；微信可能风控 wewe-rss 服务器 IP |
| 4000 端口被占 | `ss -lntp \| grep :4000` 找占用进程；和用户确认是否换端口 |
| ssh 连不上 | 确认公钥已 `ssh-copy-id`；`ssh -v carry.117.96.1` 看详细 |
