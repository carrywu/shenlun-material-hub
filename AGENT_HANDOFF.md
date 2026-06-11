# Agent 统一交接入口

> 以后 Claude Code、Codex、Gemini 或新的人工维护者接管本项目时，只需要先读取本文件。

## 接管原则

- 不依赖历史聊天记录。
- 以真实代码、当前 Git 状态、当前任务文档为准。
- 不默认重读全仓库；先读本文件和当前任务，再按证据扩展阅读范围。
- 不覆盖无关的本地未提交改动。
- 不修改 `.env`、PostgreSQL 数据库、生产配置或 WeWe RSS sidecar 状态，除非任务明确授权。

## 接管后先执行

```bash
git status --short --branch
git diff --stat
```

需要判断历史背景时再执行：

```bash
git log --oneline -20
```

## 当前活跃任务

**2026-06-11 Staging 测试环境部署（家里 Linux 测试机，已部署并验证）**。

为 `carry-pc`（Tailscale `100.117.96.1`，Ubuntu 25.10 x86_64）搭建独立 staging 环境，与生产（ECS `47.119.182.210`）完全隔离。详细文档：`docs/deployment/staging-deployment.md`、`tasks/2026-06-11-staging-deployment/`。

staging 当前状态：
- 3 容器全部 healthy/running：`shenlun-staging-app`（3001）、`shenlun-staging-postgres`（5433，库 `shenlun_material_hub`）、`shenlun-staging-wewe`（4000）
- 迁移 `0_init` 已应用；管理员 `admin`（ADMIN/ACTIVE）已创建
- Mac Tailscale 访问验证通过：`http://100.117.96.1:3001/api/health` → `{"status":"ok"}`；登录 API 200 success
- 部署目录：`/home/carry/shenlun-material-hub-staging`；ssh `carry@100.117.96.1`（公钥免密）

本次新增（commit `a13c3ee` + `133ccab` + `5024ebb`）：
1. `.env.staging.example` + `docker-compose.staging.yml`（独立 volumes `pgdata_staging` / `wewe_data_staging` / `data-staging/`）
2. `scripts/deploy-staging.sh`（LOCAL+REMOTE 双模式）+ `scripts/check-staging.sh`
3. `playwright.config.ts` webServer 条件化 + `package.json` 加 `test:e2e:staging`
4. `docs/deployment/staging-deployment.md`

部署过程修复的 5 个真实 bug（已固化进 deploy-staging.sh，详见 validation-report 第九节）：
- A. compose 文件 `${VAR}` 插值需要 shell env（`source .env.staging`，不只靠 `--env-file`）
- B. fresh clone 缺 `src/generated/prisma`（build 前 `prisma generate`）
- C. standalone 镜像无 wget（compose healthcheck 改用 `node fetch`）
- D. standalone 镜像无 tsx（seed-admin 改用容器内 `node+pg+bcryptjs` INSERT）
- E. Docker Desktop 环境（`docker context use desktop-linux`）

待人工执行 / 确认：
- **wewe-rss 扫码配置**：Mac 浏览器开 `http://100.117.96.1:4000` 微信扫码登录，否则微信采集采不到数据（应用本身正常）。
- **密码同源风险**：staging 管理员密码 = Linux 机密码 = 生产管理员密码同源，建议 staging 改独立值。
- **E2E 全量未跑**：`e2e/global-setup.ts` 硬编码密码 `admin123`，staging 生产模式禁止，需改造 global-setup 读 `E2E_ADMIN_PASSWORD` 环境变量。连通性已由 curl 验证。

常用命令：
```bash
# 从 Mac 远程部署
LINUX_HOST=100.117.96.1 bash scripts/deploy-staging.sh
# 远程健康检查
LINUX_HOST=100.117.96.1 bash scripts/check-staging.sh
# Mac 浏览器访问
open http://100.117.96.1:3001   # staging 后台
open http://100.117.96.1:4000   # wewe-rss 配置
```

⚠️ Docker Desktop 注意：Linux 机用的是 Docker Desktop（非 docker-ce），需手动启动 GUI，无 systemd 自启。若要开机自启/ssh 友好，建议改装 docker-ce。

---

**2026-06-11 采集可观测性 + 微信验证页误判修复 + admin/logs 进 git（已部署，待一次真实采集确认 + 清理脚本待人工执行）**。

当前生产状态：
- 当前镜像：`ccr.ccs.tencentyun.com/carrywu/shenlun:20260611-2042`
- 当前提交：`7ccc6a7`
- 服务器 `REVISION`：`IMAGE_TAG=20260611-2042`
- 公网健康：`http://47.119.182.210/api/health` 返回 `{"status":"ok"}`

本次改动（commit `7ccc6a7`，12 文件）：

1. **采集全链路日志**（核心）：`weRssNormalizer.ts` / `base.ts` 的每个决策分支（URL 已存在 / 封禁 / 全文过短 / 过滤器命中 / 导入成功）都写 `SystemLog`（category=CRAWLER）；`wechat/sync/route.ts` 和 `base.ts run()` 写任务级开始/完成/失败汇总（含 discovered/imported/skipped/blocked/durationMs）。`/admin/logs` 选 CRAWLER 分类即可看到每条跳过/封禁的原因 + 标题 + URL。
2. **`CollectorResult` 新增 `skippedCount`**，`web/collect/route.ts` 透传，website 源也能在采集弹窗显示"跳过 N"（之前只有 wechat 能显示）。
3. **`/admin/logs` 页面增强**：新增关键词搜索（`q` 参数，对 message/detail ILIKE）、detail 单元格可点击展开看完整 JSON、顶部新增"采集日志 (CRAWLER)"计数卡片。
4. **去重漏洞修复**：`content-filter.ts` 的 `checkDuplicateFilter` 把 `blocked` 纳入查重（`notIn: ["filtered"]`），堵住"不同 URL 同 contentHash 验证页"重复写入；`weRssNormalizer.ts` / `base.ts` 在 create 前追加 contentHash `findFirst` 兜底防同批竞态。
5. **`detectWechatBlockPage` 关键词补全**：加 `"完成验证后即可继续访问"`。
6. **`.gitignore` 修复**：原 `logs` 规则误伤 `src/app/admin/logs/` 和 `src/app/api/admin/logs/`，导致 `/admin/logs` 页面和接口**从未进 git、从未进生产镜像**。改为 `/logs/` + `*.log`，本次随提交一起上线。生产 `/admin/logs`（307 登录）和 `/api/admin/logs`（401）现在可达。

待人工执行 / 确认：

- **触发一次真实采集确认写入链路**：部署后已验证读取链路通（种子 CRAWLER 日志可见、路由可达），写入链路由 33 个 weRssNormalizer 单测证明；但生产 SystemLog 里目前 CRAWLER=1（仅种子记录），需你在后台"开始采集"点一次，之后 `/admin/logs` 选 CRAWLER 就能看到真实明细。
- **清理脚本待人工执行**（本次未跑）：`scripts/ops/cleanup-collector-noise.sql` + `.md`。把历史"全文过短（26 字）+ 环境异常"的 10 条验证页从 filtered 改为 blocked，并删同 contentHash 的重复验证页。**先按 .md 跑 dry-run SELECT + pg_dump 备份再执行。** 历史记录不会自动重判，因 `originalUrl @unique` 让 `findUnique` 命中后直接返回，走不到 `detectWechatBlockPage`。

排查"采集跳过/封禁"的标准动作：
1. 后台 `/admin/logs`，分类选 CRAWLER，按时间倒序看"采集任务完成"汇总。
2. 顶部"采集日志 (CRAWLER)"卡片看总数；搜索框输入来源名/标题/URL 可定位具体记录，点击 detail 列展开看完整 JSON。
3. 含义：`采集封禁：微信验证页` → 上游 wewe-rss 被微信风控；`采集跳过：URL 已存在` → 正常去重；`采集跳过：全文过短` → 文章本身太短；`采集跳过：与已有内容重复` → contentHash 命中。

wewe-rss 风控（非本系统 bug，根因答疑）：
- 现象：采集弹窗显示"封禁 10"，库里 wechat 源正文是"环境异常/完成验证后即可继续访问"。
- 确认是否风控：`curl -s 'http://<server>:4000/feeds/<feedId>.rss' | grep -c 'verify.html'`（>0 即被风控）；或从服务器直抓微信文章 `curl -s -A '<iPhone UA>' 'https://mp.weixin.qq.com/s/<id>' | grep -c 'js_content'`（0 即微信给错误页）。
- 处置：等几小时～1 天让微信解风控，在 wewe-rss 后台对该公众号触发刷新；或给 wewe-rss 配代理。本系统无能为力。

**2026-06-11 本地 Docker → TCR → ECS 部署已完成**。

当前生产状态：
- 服务器：`root@47.119.182.210:/opt/shenlun-material-hub`
- 当前镜像：`ccr.ccs.tencentyun.com/carrywu/shenlun:20260611-1921`
- 当前提交：`0548514`
- 线上健康检查：`http://47.119.182.210/api/health` 返回 `{"status":"ok"}`
- 服务器 `REVISION`：`IMAGE_TAG=20260611-1921`
- 容器状态：`app` healthy，`postgres` healthy，`caddy` running，`wewe-rss` running

本次部署修复：
- GitHub Actions 改为仅手动触发，避免 push 后慢 CI 与本地部署抢状态。
- Docker 镜像 runner 阶段复制 `prisma.config.ts`、完整 `node_modules`，Prisma migrate 改为部署脚本执行，容器启动只跑 `node server.js`。
- Dockerfile 设置 `HOSTNAME=0.0.0.0`，避免 Next standalone 绑定容器 hostname 导致 `127.0.0.1:3000` 不通。
- `server-pull-and-restart.sh` 回滚判定改为 Docker app container health，Caddy/public health 作为补充验证。
- `deploy-tcr.sh` 和服务器脚本兼容两种 health body：`{"ok":true}` 与 `{"status":"ok"}`。

常用命令：

```bash
# 本地优先部署
bash scripts/deploy/deploy-tcr.sh --no-confirm

# 生产状态
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && cat REVISION && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"'

# 公网健康检查
curl -i http://47.119.182.210/api/health

# 回滚到指定旧 tag
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh --yes <tag>'
```

已知非阻断警告：
- `docker compose` 会提示 `PI1` 变量未设置；当前未阻断部署。
- `npx prisma migrate deploy` 会提示无法检测 OpenSSL 版本并默认 `openssl-1.1.x`；本次迁移成功，后续可单独优化基础镜像或安装 OpenSSL，避免警告。
- 服务器部署目录不是 git checkout；脚本变更需要 `scp` 同步到 `/opt/shenlun-material-hub/scripts/deploy/`。

**2026-06-08 全量代码审查修复已完成**（分支 `fix/code-review-2026-06-07`）。

修复概要：
- **T0 测试可信度**：5 项永真断言/cookie 继承修复
- **P0 安全**：5 项（暴力破解保护、JWT 硬编码移除、Dashboard 鉴权+数据隔离、health 端点信息分离）
- **P1 核心**：17 项（AI token 优化、parseAiJson 统一、标注归属、explore 认证、采集器 channelId/质量/超时、标注定位、数据完整性、所有权检查、PostgreSQL 查询、Session 清理）
- **P2 稳定性**：22 项（加密密钥校验、Docker 默认密码、env 验证、originalUrl 空字符串、审计日志脱敏、401/403 区分、用户名校验、temperature 范围、HTTP→HTTPS、日期提取、微信重试、parseInt NaN、visibility 兼容、标签搜索、fullText 派生字段、API Key 掩码、卡片按钮权限、书签持久化、Dockerfile pg 模块、selectedText 限制）
- **P3 代码质量**：13 项（CSS 拼写、display-labels、变量名、alert→toast、gunzip 去重、timing-safe、密码改后保会话、VERIFIED_USER 权限、Input 组件）
- **未修复（低风险重构）**：P3-2 CARD_TYPE_CONFIG 提取、P3-3 renderContent/COLOR_THEMES 提取

详细修复记录见：`docs/audit/project-audit-todolist.md`

## 必读支撑文档

- `docs/audit/project-audit-todolist.md`：代码审查修复清单（含 commit hash）
- `docs/audit/full-code-review-2026-06-07.md`：全量代码审查报告
- `tasks/README.md`：个人开发任务工作流。
- `docs/testing.md`：验证命令和 Playwright 当前基线。
- `docs/handover/RBAC_RESUME_PROMPT.md`：RBAC 接管上下文。
- `docs/mcp.md`：MCP 工具、权限边界和使用规则。

## 当前已知基线

- `pnpm lint`：✅ 通过，0 errors / 16 warnings。
- `pnpm test`：✅ 通过，36 个测试文件 / 259 个测试。
- `pnpm build`：✅ 通过。
- `pnpm exec playwright test`：✅ 174 passed / 1 flaky / 16 did-not-run（9.8m）。

## 质量审计文档

- `docs/audit/full-code-review-2026-06-07.md` — 全量代码审查报告（2026-06-07）
- `docs/audit/project-audit-todolist.md` — 修复清单与进度
- `docs/testing/project-quality-assessment.md` — 项目质量评估（综合评分 4.6/5.0）
- `docs/testing/full-project-test-todolist.md` — 168 项验收检查清单
- `docs/testing/full-project-validation-report.md` — 最终验收报告

## MCP 使用规则

- 浏览器：使用 `shenlun-playwright` MCP 做交互式页面检查；正式 E2E 仍以 `pnpm exec playwright test` 为准。
- 数据库/日志：使用 `shenlun-sqlite-logs` MCP，只读查询 PostgreSQL 和 `SystemLog`。
- 数据库 MCP 默认禁止写入。任何写入、迁移、修复数据必须走任务文档授权、dry-run、备份或临时库验证。

## 每轮结束前必须更新

当前任务目录下：

- `journal.md`：记录本轮做了什么、改了哪些文件、关键决策。
- `validation.md`：记录命令、结果、失败证据或未运行原因。
- `handoff.md`：更新当前状态和下一步唯一行动。

## 当前长期决策

- ✅ **已完成 SQLite → PostgreSQL 迁移**（2026-06-06，分支 `feat/postgresql-migration`）。
  - 数据库：PostgreSQL 16，通过 `@prisma/adapter-pg` + `pg.Pool` 连接。
  - 备份系统：v2 Prisma 序列化格式（不再是文件复制）。
  - MCP 工具：已重写为 PostgreSQL 版本。
  - `better-sqlite3` 保留仅供 WeWe RSS sidecar 只读访问。
  - 迁移详情：`scripts/migrate-sqlite-to-postgres.ts`，662 行数据已验证迁移。

- ✅ **已完成全量代码审查修复**（2026-06-08，分支 `fix/code-review-2026-06-07`）。
  - 修复 57 项问题（5 P0 + 17 P1 + 22 P2 + 13 P3），2 项低风险重构延后。
  - 关键安全加固：暴力破解保护、JWT 硬编码移除、加密密钥校验、Docker 密码强制。
  - 数据隔离：Dashboard/文章/搜索/同步 全链路 ownerUserId 过滤。
