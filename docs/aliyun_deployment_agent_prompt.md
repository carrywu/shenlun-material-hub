# 给 Agent/Codex 的阿里云部署提示词：shenlun-material-hub

> 用途：把本文件完整发送给 Codex / Claude Code / Gemini / OpenCode，让 Agent 自动评估项目并完成“可在阿里云 ECS 生产部署”的全部准备工作。  
> 项目：`shenlun-material-hub`，申论官方文章采集、AI 素材卡生成与 IMA 知识库同步工作台。  
> 目标：部署到我的阿里云服务器，并形成可重复执行、可回滚、可验收的部署方案。

---

## 你的角色

你是资深全栈 DevOps + Next.js + Prisma + PostgreSQL 工程师。请你直接读取当前仓库代码，评估部署方式，并完成所有必要的部署配置、文档、脚本和测试。

不要只给建议。你需要实际修改仓库，生成部署资产，运行测试，更新交接文档，并提交 git commit。

---

## 已知项目信息

请以仓库真实代码为准，但我已知项目大致如下：

- 技术栈：Next.js 16、React 19、Tailwind CSS 4、Next.js API Routes、Prisma 7、PostgreSQL 16。
- 包管理：pnpm。
- 数据库：PostgreSQL。
- 主要脚本：
  - `pnpm dev`
  - `pnpm build`
  - `pnpm start`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm db:migrate`
  - `pnpm db:generate`
  - `pnpm seed:admin`
  - `pnpm seed:channels`
  - `pnpm seed:accounts`
  - `pnpm exec playwright test`
- 环境变量大致包括：
  - `DATABASE_URL`
  - `AI_CONFIG_ENCRYPTION_KEY`
  - `AI_API_KEY`
  - `AI_BASE_URL`
  - `AI_MODEL`
  - `IMA_API_BASE`
  - `IMA_CLIENT_ID`
  - `IMA_API_KEY`
  - `IMA_KNOWLEDGE_BASE_ID`
  - `WEWERSS_BASE_URL`

---

## 最终目标

请把项目整理成可以部署到阿里云 ECS 的生产方案。

我希望优先采用：

```txt
阿里云 ECS + Docker Compose + PostgreSQL 16 + Next.js standalone/server + Nginx/Caddy 反向代理 + HTTPS
```

如果项目暂时不适合 Docker 部署，你需要说明原因，并给出 PM2 原生部署备选方案。但默认请优先做 Docker Compose 方案。

---

## 工作原则

1. 先评估，再修改。
2. 不确定的地方必须查代码，不要猜。
3. 所有部署相关配置都要可复用、可回滚。
4. 不要把真实密钥写入仓库。
5. `.env.production.example` 只能放占位符。
6. 生产环境默认不能使用 `admin / admin123`。
7. 部署前后都要跑测试。
8. 每完成一个阶段，在 todo 文档里打勾。
9. 每完成一个稳定阶段，提交一次 git commit。
10. 最后必须给我一份交接文档，告诉我在阿里云服务器上怎么执行。

---

## 第一阶段：项目部署审计

请先读取并确认以下内容：

- `package.json`
- `next.config.*`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `.env.example`
- `src/lib/db*`
- `src/generated/prisma` 或 Prisma Client 输出目录
- 认证/session 相关代码
- 文件上传、导出、备份、日志、缓存相关目录
- Playwright 配置
- 现有 README / docs / tasks 文档
- 是否已有 Dockerfile / docker-compose / Nginx / deploy 脚本

输出一份审计结果，写入：

```txt
docs/deployment/aliyun-deployment-audit.md
```

审计至少包括：

- 当前项目启动方式
- 端口
- Node 版本要求
- pnpm 版本要求
- Prisma Client 生成方式
- 数据库连接方式
- 运行时是否依赖本地文件系统
- 是否需要持久化目录
- 是否需要定时任务/后台任务
- 是否有 WebSocket/SSE/长任务
- 是否有跨域/CORS 问题
- 是否有生产安全风险
- 是否缺少部署配置
- 推荐部署拓扑

---

## 第二阶段：生成部署资产

请新增或修复以下文件。

### 1. `.env.production.example`

生成生产环境变量模板，至少包含：

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://shenlun:CHANGE_ME@postgres:5432/shenlun_material_hub?schema=public
AI_CONFIG_ENCRYPTION_KEY=CHANGE_ME_32_BYTES_MINIMUM
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
IMA_API_BASE=
IMA_CLIENT_ID=
IMA_API_KEY=
IMA_KNOWLEDGE_BASE_ID=
WEWERSS_BASE_URL=
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

如果代码中还有其他必需环境变量，请补齐。

要求：

- 注释清楚每个变量用途。
- 标明哪些是必填，哪些是可选。
- 不允许出现真实 token、真实 API Key、真实密码。

---

### 2. `Dockerfile`

要求：

- 使用 Node LTS，建议 Node 20 或 Node 22，按项目兼容性选择。
- 使用 pnpm。
- 多阶段构建。
- 正确处理 Prisma：
  - 安装依赖
  - `pnpm db:generate` 或等价命令
  - `pnpm build`
- 生产镜像尽量小。
- 不在镜像里写入密钥。
- 非 root 用户运行。
- 暴露 `3000`。
- 启动命令可运行生产服务。

如果 Next.js standalone 需要配置，请同步修改 `next.config.*`。

---

### 3. `docker-compose.prod.yml`

要求包含：

- `app`
- `postgres`
- 可选 `nginx` 或 `caddy`
- 持久化 volume：
  - PostgreSQL 数据
  - 如项目有上传/导出/备份目录，也要挂载
- 健康检查：
  - PostgreSQL healthcheck
  - app healthcheck，如果项目没有健康检查接口，请新增 `/api/health`
- 网络隔离：
  - app 与 postgres 在内部网络
  - 只有反向代理暴露 80/443
- restart 策略
- env_file 指向 `.env.production`

PostgreSQL 要使用 16 版本。

---

### 4. 反向代理配置

优先给出 Caddy 方案，因为 HTTPS 自动化更简单。

新增：

```txt
deploy/Caddyfile
```

要求：

```caddyfile
your-domain.com {
  reverse_proxy app:3000
}
```

同时给出 Nginx 备选：

```txt
deploy/nginx.conf.example
```

要求支持：

- 反向代理到 app:3000
- WebSocket Upgrade
- gzip
- 合理的上传体积限制
- 代理超时配置
- HTTPS 说明

---

### 5. 部署脚本

新增：

```txt
scripts/deploy/aliyun-init.sh
scripts/deploy/aliyun-deploy.sh
scripts/deploy/aliyun-backup-db.sh
scripts/deploy/aliyun-restore-db.sh
scripts/deploy/aliyun-logs.sh
```

要求：

#### `aliyun-init.sh`

用于全新阿里云 ECS 初始化：

- 检查系统版本
- 安装 Docker
- 安装 Docker Compose plugin
- 安装 Git
- 创建部署目录
- 配置基础防火墙提示
- 输出下一步操作

兼容 Ubuntu/Debian 优先；如果检测到 CentOS/Alibaba Cloud Linux，也给出提示或兼容安装分支。

#### `aliyun-deploy.sh`

用于每次部署：

- `git pull`
- 检查 `.env.production` 是否存在
- 构建镜像
- 启动容器
- 执行 Prisma migrate
- 执行 Prisma generate，如运行时需要
- 可选初始化管理员，但生产必须要求用户显式确认
- 输出访问地址
- 输出健康检查结果

#### `aliyun-backup-db.sh`

- 用 `pg_dump` 备份数据库。
- 备份到 `backups/`。
- 文件名带日期时间。
- 不把备份提交 git。

#### `aliyun-restore-db.sh`

- 从指定备份恢复。
- 必须二次确认。
- 恢复前自动再备份当前库。

#### `aliyun-logs.sh`

- 快速查看 app / postgres / caddy 或 nginx 日志。

所有脚本必须：

- `set -euo pipefail`
- 有清晰错误提示
- 有执行权限说明
- 不泄露密码

---

## 第三阶段：新增健康检查接口

如果项目没有健康检查接口，请新增：

```txt
src/app/api/health/route.ts
```

要求返回：

```json
{
  "ok": true,
  "timestamp": "...",
  "database": "ok"
}
```

必须实际检查数据库连接。

如果数据库不可用，返回 503。

注意：

- 不泄露环境变量。
- 不暴露敏感内部信息。
- 可被 Docker healthcheck / 反向代理探活使用。

---

## 第四阶段：生产安全加固

请检查并修复：

- 生产环境默认账号密码问题。
- Cookie/session 是否设置：
  - `httpOnly`
  - `secure`
  - `sameSite`
  - 合理过期时间
- 登录接口是否有基础限流或失败保护。
- `/admin` 是否强制鉴权。
- API 是否存在未鉴权的危险操作。
- 环境变量缺失时是否 fail fast。
- 数据库迁移失败时是否阻断启动。
- 日志是否会输出 API Key、密码、cookie、token。
- 备份文件是否被 gitignore。
- `.env.production` 是否被 gitignore。
- Prisma generated client 输出路径是否适合 Docker 构建。

如果发现安全问题，优先修复 P0/P1。修复后更新：

```txt
docs/deployment/production-security-checklist.md
```

---

## 第五阶段：阿里云部署文档

新增完整文档：

```txt
docs/deployment/aliyun-ecs-deployment-guide.md
```

文档必须按小白可执行方式写，包含：

### 1. 阿里云准备

- ECS 推荐配置：
  - 最低：2C2G，仅自用
  - 推荐：2C4G 或 4C8G
  - 系统盘建议 40G+
  - 地域按我实际访问位置选择
- 系统推荐：
  - Ubuntu 22.04/24.04 LTS 优先
- 安全组：
  - 22：仅自己 IP
  - 80：开放
  - 443：开放
  - 3000：不建议公网开放
  - 5432：不建议公网开放

### 2. 域名与备案说明

说明：

- 国内阿里云服务器绑定域名对公网正式访问通常涉及备案。
- 如果暂时没有备案，可以先用公网 IP + 端口测试。
- HTTPS 用域名最方便。
- 如果不用域名，Caddy 自动 HTTPS 不适用，需要换 Nginx 或自签证书。

### 3. 首次部署命令

写清楚从 SSH 登录开始的每一步：

```bash
ssh root@你的服务器IP
git clone <repo-url> /opt/shenlun-material-hub
cd /opt/shenlun-material-hub
cp .env.production.example .env.production
nano .env.production
chmod +x scripts/deploy/*.sh
bash scripts/deploy/aliyun-init.sh
bash scripts/deploy/aliyun-deploy.sh
```

### 4. 数据库初始化

写清楚：

```bash
docker compose -f docker-compose.prod.yml exec app pnpm db:migrate
docker compose -f docker-compose.prod.yml exec app pnpm seed:admin
```

但生产默认管理员密码必须修改。

### 5. 更新部署

写清楚：

```bash
cd /opt/shenlun-material-hub
bash scripts/deploy/aliyun-backup-db.sh
git pull
bash scripts/deploy/aliyun-deploy.sh
```

### 6. 回滚方案

至少包含：

- git 回滚到上一版本
- 数据库备份恢复
- 查看日志定位问题

### 7. 日志查看

包括：

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml logs -f caddy
```

### 8. 常见问题

至少包含：

- 端口访问不了
- 数据库连接失败
- Prisma migrate 失败
- pnpm build 失败
- Caddy/HTTPS 失败
- 登录不了后台
- 采集任务失败
- AI API 配置失败
- IMA 同步失败
- WeWe RSS 连不上

---

## 第六阶段：测试与验收

修改完成后必须执行：

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

如果有 Playwright：

```bash
pnpm exec playwright install --with-deps
pnpm exec playwright test
```

再执行 Docker 验收：

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml ps
curl -f http://localhost:3000/api/health
docker compose -f docker-compose.prod.yml logs --tail=200 app
```

如果本地无法跑 Docker，必须说明原因，并至少保证：

- Dockerfile 语法检查
- compose 配置检查
- 文档完整
- 非 Docker 的 `lint/test/build` 已通过

---

## 第七阶段：交付文档与 Todo

新增：

```txt
tasks/YYYY-MM-DD-aliyun-deployment-handoff/README.md
tasks/YYYY-MM-DD-aliyun-deployment-handoff/todolist.md
tasks/YYYY-MM-DD-aliyun-deployment-handoff/validation-report.md
```

`todolist.md` 必须细到小颗粒度，例如：

```md
# 阿里云部署 Todo

## 审计
- [ ] 读取 package.json
- [ ] 读取 Prisma schema
- [ ] 检查 env 变量
- [ ] 检查 Next.js 构建配置
- [ ] 检查数据库迁移
- [ ] 检查认证/session
- [ ] 检查文件持久化目录

## 部署资产
- [ ] 新增 .env.production.example
- [ ] 新增 Dockerfile
- [ ] 新增 docker-compose.prod.yml
- [ ] 新增 deploy/Caddyfile
- [ ] 新增 deploy/nginx.conf.example
- [ ] 新增部署脚本
- [ ] 新增备份脚本
- [ ] 新增恢复脚本
- [ ] 新增日志脚本

## 安全
- [ ] 检查默认管理员
- [ ] 检查 cookie/session
- [ ] 检查 admin 鉴权
- [ ] 检查敏感日志
- [ ] 检查 .gitignore

## 验证
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm build
- [ ] Docker build
- [ ] Docker compose up
- [ ] /api/health
- [ ] 登录后台
- [ ] 文章列表
- [ ] 文章详情
- [ ] 管理后台
- [ ] AI 配置页
- [ ] 数据备份
- [ ] 数据恢复演练
```

所有实际完成项必须打勾。

`validation-report.md` 必须包含：

- 命令
- 结果
- 失败原因
- 修复动作
- 最终状态
- 仍需我手动配置的内容

---

## Git 提交要求

按阶段提交，不要所有东西堆一个 commit。

推荐 commit：

```bash
git add docs/deployment/aliyun-deployment-audit.md
git commit -m "docs: audit aliyun deployment requirements"

git add Dockerfile docker-compose.prod.yml deploy .env.production.example scripts/deploy
git commit -m "chore: add aliyun docker deployment assets"

git add src/app/api/health/route.ts
git commit -m "feat: add production health check endpoint"

git add docs/deployment tasks
git commit -m "docs: add aliyun ecs deployment guide and handoff"
```

如果修复了安全问题，单独提交：

```bash
git commit -m "fix: harden production auth and deployment safety"
```

---

## 最终回复格式

完成后请按以下格式回复我：

```md
# 阿里云部署改造完成报告

## 1. 本次完成
- ...

## 2. 新增/修改文件
- ...

## 3. 测试结果
| 命令 | 结果 | 说明 |
|---|---|---|
| pnpm lint | ✅/❌ | ... |
| pnpm test | ✅/❌ | ... |
| pnpm build | ✅/❌ | ... |
| Playwright | ✅/❌/未运行 | ... |
| Docker Compose | ✅/❌/未运行 | ... |

## 4. 我需要在阿里云手动配置的内容
- 服务器 IP
- 域名
- 安全组
- .env.production
- AI Key
- IMA Key
- WeWe RSS 地址

## 5. 部署命令
```bash
...
```

## 6. 风险与未完成项
- ...

## 7. Git 提交
- commit hash / commit message
```

---

## 额外要求

- 你必须优先保证“能部署、能启动、能回滚、能备份”。
- 不要引入复杂 K8s。
- 不要把 PostgreSQL 直接暴露到公网。
- 不要把 3000 端口直接作为正式入口，正式入口用 80/443。
- 如果使用公网 IP 临时访问，可以在文档中说明这是临时方案。
- 所有文档用中文。
- 所有新增脚本写注释。
- 所有报错不要吞掉，要明确输出。
- 如果发现项目代码本身阻碍部署，请先修复 P0，再继续部署资产。
