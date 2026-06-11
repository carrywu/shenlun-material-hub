# Staging 测试环境部署 — 验证报告

> ⏳ 状态：**待执行**。以下表格先建模板，部署完成后填入**真实结果**（不伪造）。
> 执行时间：2026-06-11（待填）
> 执行人：Claude Code

---

## 一、修改文件清单

> 待部署完成后填写实际改动。

| 文件 | 类型 | 说明 |
|---|---|---|
| `.gitignore` | 修改 | 追加 `.env.staging` 显式规则 |
| `.env.staging.example` | 新增 | staging 环境变量模板 |
| `docker-compose.staging.yml` | 新增 | staging 编排 |
| `scripts/deploy-staging.sh` | 新增 | 部署脚本 |
| `scripts/check-staging.sh` | 新增 | 健康检查脚本 |
| `playwright.config.ts` | 修改 | webServer 条件化 |
| `package.json` | 修改 | 加 test:e2e:staging |
| `docs/deployment/staging-deployment.md` | 新增 | 部署文档 |
| `tasks/2026-06-11-staging-deployment/*` | 新增 | 本任务目录 |

## 二、Linux 测试机部署路径

- 主机：`carry-pc` = Tailscale `100.117.96.1`
- 部署目录：`/home/carry/shenlun-material-hub-staging`
- compose project name：`shenlun-staging`

## 三、访问地址

- Linux 本机：`http://127.0.0.1:3001`
- Mac Tailscale：`http://100.117.96.1:3001`
- wewe-rss 配置：`http://100.117.96.1:4000`

## 四、环境变量说明

> 详见 `.env.staging.example`。敏感项（密码、密钥）只在 Linux 机本地 `.env.staging` 填写，不进 git。

## 五、Docker 服务状态

> 待 `docker compose -f docker-compose.staging.yml ps` 真实输出。

| 服务 | 状态 | 端口 |
|---|---|---|
| postgres | 待填 | 5433:5432 |
| app | 待填 | 3001:3000 |
| wewe-rss | 待填 | 4000:4000 |

## 六、数据库迁移状态

> 待 `SELECT migration_name, finished_at FROM _prisma_migrations` 真实输出。

- 迁移数量：待填
- 最新迁移：待填
- 管理员账号：待填（应有 1 个 ADMIN）

## 七、测试结果（核心）

| 检查项 | 结果 | 说明 |
|---|---|---|
| `pnpm lint` | 待填 | 待填 |
| `pnpm test` | 待填 | 待填 |
| `pnpm build` | 待填 | 待填 |
| docker compose up | 待填 | 待填 |
| `/api/health`（Linux 本机） | 待填 | 待填 |
| `/api/health`（Mac Tailscale） | 待填 | 待填 |
| Mac 浏览器访问后台 | 待填 | 待填 |
| Playwright E2E（打 staging） | 待填 | 待填 |
| wewe-rss 扫码配置 | 待填（可选） | 待填 |

## 八、未完成事项

> 待填。如有阻塞项，记录真实原因。

## 九、风险提醒

1. ⚠️ **密码同源**：staging 管理员密码 `<LINUX_HOST_PASSWORD>` 与 Linux root 密码、生产管理员密码同源。建议改。
2. ⚠️ **wewe-rss 4000 端口**：用户坚持用 4000，部署前已确认空闲（待填检查结果）。
3. ⚠️ **wewe-rss 需重新扫码**：staging 是新实例，首次需 Mac 浏览器开 `http://100.117.96.1:4000` 微信扫码登录。

## 十、下一步建议

- [ ] wewe-rss 扫码配置公众号（解锁微信采集测试）
- [ ] staging 管理员密码改成独立随机值
- [ ] 跑一次完整采集验证 staging 链路
- [ ] **提醒**：上一个任务的生产库清理脚本 `scripts/ops/cleanup-collector-noise.sql` 待人工执行

---

## 真实命令输出记录区（部署时粘贴）

### `pnpm lint`
```
✖ 16 problems (0 errors, 16 warnings)
```
（16 warnings 全是既有的未使用变量，非本次改动引入；基线一致）

### `pnpm test`
```
Test Files  36 passed (36)
     Tests  270 passed (270)
  Duration  17.74s
```

### `pnpm build`
```
✓ 构建成功，所有路由编译完成（standalone 模式）
```

### `docker compose ps`（Linux 机）
```
待填
```

### `curl /api/health`（Linux 本机）
```
待填
```

### `curl /api/health`（Mac Tailscale）
```
待填
```

### `pnpm test:e2e:staging`
```
待填
```
