# Staging 测试环境部署 — 验证报告

> ✅ 状态：**核心部署完成**。E2E 全量因 global-setup 密码硬编码（admin123）需单独改造，留作后续。
> 执行时间：2026-06-11
> 执行人：Claude Code

---

## 一、修改文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `.gitignore` | 修改 | 追加 `.env.staging` 显式规则 + `!.env.staging.example` 放行 |
| `.env.staging.example` | 新增 | staging 环境变量模板（真实变量名 `WERSS_*`，敏感项占位） |
| `docker-compose.staging.yml` | 新增 | staging 编排（app 3001 / postgres 5433 / wewe-rss 4000，独立 volumes） |
| `docker-compose.staging.yml` | 修改 | healthcheck 改用 node（standalone 镜像无 wget） |
| `scripts/deploy-staging.sh` | 新增 | 部署脚本（LOCAL+REMOTE 双模式，含 5 个坑修复） |
| `scripts/check-staging.sh` | 新增 | 健康检查脚本 |
| `playwright.config.ts` | 修改 | webServer 条件化（打远程 staging 时跳过自带 dev server） |
| `package.json` | 修改 | 加 `test:e2e` / `test:e2e:staging` |
| `docs/deployment/staging-deployment.md` | 新增 | 完整部署文档 |
| `tasks/2026-06-11-staging-deployment/*` | 新增 | todolist/handoff/validation-report/grill-qa |

## 二、Linux 测试机部署路径

- 主机：`carry-pc` = Tailscale `100.117.96.1`，Ubuntu 25.10 x86_64
- ssh：`carry@100.117.96.1`（公钥免密已配）
- 部署目录：`/home/carry/shenlun-material-hub-staging`
- compose project name：`shenlun-staging`
- Docker：Docker Desktop for Linux 4.73（context `desktop-linux`，非标准 docker-ce）

## 三、访问地址（已验证）

- Linux 本机：`http://127.0.0.1:3001` ✅
- **Mac Tailscale：`http://100.117.96.1:3001` ✅**
- wewe-rss 配置：`http://100.117.96.1:4000` ✅（200，待扫码）
- health：`http://100.117.96.1:3001/api/health` → `{"status":"ok"}` ✅

## 四、环境变量说明

`.env.staging`（Linux 机本地，权限 600，不进 git）已填：
- `POSTGRES_PASSWORD`：openssl rand 生成（32 hex）
- `ADMIN_PASSWORD`：用户指定值（⚠️ 见 handoff 密码同源风险）
- `AI_CONFIG_ENCRYPTION_KEY`：openssl rand base64（44 字符 = 32 字节）
- `JWT_SECRET`：openssl rand base64
- `POSTGRES_DB`：`shenlun_material_hub`（与生产同名，物理隔离靠独立容器）
- `WERSS_BASE_URL`：`http://wewe-rss:4000`（compose 网络）

## 五、Docker 服务状态

```
NAME                       STATUS                    PORTS
shenlun-staging-app        Up (healthy)              0.0.0.0:3001->3000/tcp
shenlun-staging-postgres   Up (healthy)              0.0.0.0:5433->5432/tcp
shenlun-staging-wewe       Up                        0.0.0.0:4000->4000/tcp
```

## 六、数据库迁移状态

- 迁移：`0_init` 已应用 ✅
- 管理员：`admin` / `ADMIN` / `ACTIVE` 已创建（id `a5a0cd2c-...`）✅
- 登录验证：POST `/api/auth/login` → `{"success":true,"user":{"username":"admin","role":"ADMIN"}}` ✅

## 七、测试结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| `pnpm lint` | ✅ | 0 errors / 16 warnings（基线一致） |
| `pnpm test` | ✅ | 36 文件 / 270 passed |
| `pnpm build` | ✅ | 通过（需先 `prisma generate`，已固化进 deploy 脚本） |
| docker compose up | ✅ | 3 容器 healthy/running |
| `/api/health`（Linux 本机） | ✅ | `{"status":"ok"}` |
| `/api/health`（Mac Tailscale） | ✅ | `{"status":"ok"}` |
| Mac 浏览器访问后台 | ✅ | 首页 307→登录；登录 API 200 success |
| 管理员登录 | ✅ | admin / 用户密码 登录成功 |
| Playwright E2E（打 staging） | ⚠️ 未跑全量 | 见「八、未完成事项」 |
| wewe-rss 扫码配置 | ⏳ 待用户 | 页面 200 可达，待微信扫码登录 |

## 八、未完成事项

### 8.1 Playwright E2E 全量未跑
**原因**：`e2e/global-setup.ts` 硬编码登录密码 `admin123`（第 30 行），staging 生产模式禁止该默认密码（应用会 exit），导致 global-setup 登录失败，所有需鉴权的 spec 都会挂。

**修复建议**（单独任务）：改 global-setup 读 `process.env.E2E_ADMIN_PASSWORD`，staging 跑时设 `E2E_ADMIN_PASSWORD=<staging密码>`。同时注意 E2E 会写数据（创建文章/卡片/源），跑全量会污染 staging 库，建议跑前 snapshot 或用独立测试库。

**当前连通性已验证**：`curl /api/health` 通过 = Playwright `request.get('/api/health')` 等价，证明 staging 可被自动化测试访问。

### 8.2 wewe-rss 待扫码配置
Mac 浏览器开 `http://100.117.96.1:4000`，微信扫码登录后才有公众号 feed。配置前微信采集功能采不到数据（应用本身正常）。

## 九、部署过程修复的 5 个真实 bug（已固化进 deploy-staging.sh）

| # | bug | 修复 |
|---|---|---|
| A | compose 文件 `${VAR}` 插值需要 shell env，`--env-file` 只给容器内用 | `set -a; source .env.staging; set +a` 加载到 shell |
| B | fresh clone 缺 `src/generated/prisma`（.gitignore 排除），build 失败 | build 前 `pnpm install && npx prisma generate` |
| C | standalone 镜像无 wget，healthcheck 永远失败 | compose override 用 `node fetch` 做 healthcheck |
| D | standalone 镜像无 tsx，host 跑 seed-admin 撞 Prisma 7 入口 | 容器内 `node + pg + bcryptjs` 直接 INSERT |
| E | Docker Desktop 环境，default context 指向不存在的 socket | `docker context use desktop-linux` |

## 十、风险提醒

1. ⚠️ **密码同源**：staging 管理员密码 = Linux 机密码 = 生产管理员密码同源。staging 被入侵可猜到生产。建议改独立值。
2. ⚠️ **Docker Desktop 非服务器最优**：Linux 机用 Docker Desktop（图形应用，需手动启动 GUI）。若追求开机自启/ssh 友好，建议改装标准 docker-ce（有 systemd unit）。当前需手动开 Docker Desktop。
3. ⚠️ **wewe-rss 需重新扫码**：staging 是新实例，首次需 Mac 浏览器开 `http://100.117.96.1:4000` 微信扫码登录。
4. ⚠️ **E2E global-setup 密码硬编码**：见八.1。

## 十一、下一步建议

- [ ] wewe-rss 扫码配置公众号（解锁微信采集测试）
- [ ] staging 管理员密码改成独立随机值
- [ ] 改造 `e2e/global-setup.ts` 支持 `E2E_ADMIN_PASSWORD` 环境变量，跑 E2E 全量
- [ ] （可选）Linux 机改装 docker-ce 实现 systemd 自启
- [ ] **提醒**：上一个任务的生产库清理脚本 `scripts/ops/cleanup-collector-noise.sql` 待人工执行

---

## 真实命令输出记录区

### `pnpm lint`
```
✖ 16 problems (0 errors, 16 warnings)
```

### `pnpm test`
```
Test Files  36 passed (36)
     Tests  270 passed (270)
  Duration  17.74s
```

### `pnpm build`
```
✓ 构建成功（Next.js standalone）
（注意：fresh clone 需先 npx prisma generate，否则 src/lib/db.ts 模块找不到）
```

### `docker compose ps`（Linux 机）
```
NAME                       STATUS                    PORTS
shenlun-staging-app        Up (healthy)              0.0.0.0:3001->3000/tcp
shenlun-staging-postgres   Up (healthy)              0.0.0.0:5433->5432/tcp
shenlun-staging-wewe       Up                        0.0.0.0:4000->4000/tcp
```

### `curl /api/health`（Linux 本机 + Mac Tailscale）
```
{"status":"ok"}
```

### `curl POST /api/auth/login`（Mac Tailscale）
```
{"success":true,"message":"登录成功","user":{"username":"admin","role":"ADMIN","displayName":"管理员"}}
```

### `pnpm test:e2e:staging`
```
⚠ 未跑全量（global-setup 密码硬编码 admin123，staging 生产模式禁止；见八.1）
连通性已由 curl /api/health 等价验证
```
