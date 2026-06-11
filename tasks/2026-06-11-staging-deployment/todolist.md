# Staging 测试环境部署 — Todolist

> 目标：在 Linux 测试机（`carry-pc` = Tailscale `100.117.96.1`）上搭一套独立的 staging 环境，与生产完全隔离，Mac 通过 Tailscale 访问 `http://100.117.96.1:3001`。
>
> 执行原则：每完成一项打勾；跑不通就记录真实错误，不伪造结果；最后 git commit。

---

## 一、配置文件创建（本地 Mac）

- [ ] 1. `.gitignore` 追加 `.env.staging` 显式规则（`.env.*` 已覆盖，显式更防误提交）
- [ ] 2. 创建 `.env.staging.example`（真实变量名 `WERSS_*`；删 `UPLOAD_DIR`/`PORT`/`HOST`/`WEWE_DB_PATH`/`WEWE_SYNC_ENABLED`/`NEXTAUTH_SECRET`；`POSTGRES_DB=shenlun_material_hub`；敏感项标 `__手动填写__`）
- [ ] 3. 创建 `docker-compose.staging.yml`
  - `name: shenlun-staging`
  - app: `3001:3000`，`env_file: .env.staging`，挂 `./data-staging/uploads:/app/public/uploads`
  - postgres: 独立 volume `pgdata_staging`，库 `shenlun_material_hub`，端口 `5433:5432`
  - wewe-rss: **inline 定义**（非 extends），端口 `4000:4000`，独立 volume `wewe_data_staging`
  - 不要 caddy
- [ ] 4. 创建 `scripts/deploy-staging.sh`（LOCAL + REMOTE 双模式；git pull → build → up postgres → migrate → 宿主机 `pnpm seed:admin` → up app+wewe-rss → health check）
- [ ] 5. 创建 `scripts/check-staging.sh`（compose ps + 端口 + curl health + 首页 + 迁移状态）

## 二、代码改动（本地 Mac）

- [ ] 6. 改 `playwright.config.ts`：`webServer` 条件化（`PLAYWRIGHT_BASE_URL` 非 localhost 时跳过自带 dev server）
- [ ] 7. `package.json` 加 `test:e2e:staging`（`PLAYWRIGHT_BASE_URL=http://100.117.96.1:3001 playwright test`）

## 三、文档（本地 Mac）

- [ ] 8. 写 `docs/deployment/staging-deployment.md`（10 节：环境定位 / Linux 准备 / Tailscale / 目录结构 / 首次部署 / 日常更新 / 迁移 / E2E / 排查 / 安全）
- [ ] 9. 写 `tasks/2026-06-11-staging-deployment/handoff.md`
- [ ] 10. 写 `tasks/2026-06-11-staging-deployment/validation-report.md`（先建模板，部署后填真实结果）

## 四、本地验证（Mac，确认代码改动不破坏基线）

- [ ] 11. `pnpm lint`
- [ ] 12. `pnpm test`
- [ ] 13. `pnpm build`

## 五、Linux 机准备 + 首次部署

- [ ] 14. 用密码 `<LINUX_HOST_PASSWORD>` 走 `ssh-copy-id carry.117.96.1` 配 ssh 公钥
- [ ] 15. ssh 过去检查环境：docker / Node 20 / pnpm / git 是否已装；装缺的
- [ ] 16. 检查 Linux 机 `4000` 端口是否空闲（Q7=4000 前置，被占则停下报告）
- [ ] 17. `git clone https://github.com/carrywu/shenlun-material-hub /home/carry/shenlun-material-hub-staging`
- [ ] 18. 在 Linux 机 `cp .env.staging.example .env.staging`，填值：
  - `POSTGRES_PASSWORD`：`openssl rand -hex 16`
  - `ADMIN_PASSWORD`：`<LINUX_HOST_PASSWORD>`
  - `AI_CONFIG_ENCRYPTION_KEY`：`openssl rand -base64 32`
  - `JWT_SECRET`：`openssl rand -base64 32`
- [ ] 19. 跑 `bash scripts/deploy-staging.sh`（首次部署）
- [ ] 20. 跑 `bash scripts/check-staging.sh`，记录真实输出

## 六、验证（端到端）

- [ ] 21. Linux 机本机：`curl -f http://127.0.0.1:3001/api/health`
- [ ] 22. Mac Tailscale：`curl -f http://100.117.96.1:3001/api/health`
- [ ] 23. Mac 浏览器：`http://100.117.96.1:3001` 能打开后台，用 `admin` / `<LINUX_HOST_PASSWORD>` 登录
- [ ] 24. Mac 跑 E2E：`pnpm test:e2e:staging`，记录通过/失败数
- [ ] 25. wewe-rss 扫码配置：Mac 浏览器 `http://100.117.96.1:4000`，微信扫码登录（可选，不阻塞）

## 七、收尾

- [ ] 26. 把 21–24 的真实结果填进 `validation-report.md`
- [ ] 27. `git commit -m "chore: add staging deployment setup"`
- [ ] 28. 更新 `AGENT_HANDOFF.md` 顶部加 staging 任务条目
- [ ] 29. **提醒用户**：上一个任务的生产库清理脚本（`scripts/ops/cleanup-collector-noise.sql`，10 条历史验证页）待人工执行

---

## 风险提醒（执行时牢记）

1. ⚠️ **密码同源风险**：staging 管理员密码 `<LINUX_HOST_PASSWORD>` = Linux 机 root 密码 = 生产管理员密码同源。staging 被入侵可猜到生产。handoff 醒目标注，建议后续改。
2. ⚠️ **4000 端口前置**：用户坚持 wewe-rss 用 4000，部署前必须 ssh 查 `ss -lntp | grep :4000`，被占就停下报告，不能硬上。
3. ⚠️ **wewe-rss 数据迁移**：staging 是全新 wewe-rss 实例，需重新微信扫码登录，**不要**从生产 ECS 拷 wewe-rss 数据（隔离原则）。
4. ⚠️ **不连生产库**：`DATABASE_URL` 必须指向 staging postgres 容器（`postgres:5432` 容器内 / `127.0.0.1:5433` 宿主机），绝不指 ECS 生产库。
