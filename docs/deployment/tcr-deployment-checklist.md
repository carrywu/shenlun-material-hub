# TCR 部署检查清单

> 每次部署前、中、后的操作检查项

---

## 部署前

- [ ] 本地代码已提交并推送到 Git
- [ ] 本地 Docker Desktop 正在运行
- [ ] `.env.deploy.local` 配置正确（TCR 密码已填写）
- [ ] 本地 TCR 登录有效：`docker login ccr.ccs.tencentyun.com --username=100011725549`
- [ ] ECS 服务器可 SSH 连接：`ssh root@47.119.182.210`
- [ ] ECS TCR 登录有效（`~/.docker/config.json` 存在）

## 构建与推送

- [ ] 执行 `bash scripts/deploy/deploy-tcr.sh --dry-run` 预览
- [ ] 确认 tag 正确（时间戳 + git sha）
- [ ] 执行 `bash scripts/deploy/deploy-tcr.sh`
- [ ] 构建成功（无错误）
- [ ] 三个 tag 推送成功（时间戳、git sha、latest）

## 服务器部署

- [ ] SSH 连接成功
- [ ] `docker compose pull app` 成功
- [ ] 数据库自动备份成功
- [ ] `docker compose up -d` 成功
- [ ] 旧镜像清理完成

## 部署后验证

- [ ] `docker compose ps` — 所有容器 healthy
- [ ] `curl http://47.119.182.210/api/health` — 返回 `{"ok":true}`
- [ ] 浏览器访问 `http://47.119.182.210/` — 页面正常
- [ ] 浏览器访问 `http://47.119.182.210/admin/login` — 登录正常
- [ ] 文章列表页正常
- [ ] `REVISION` 文件已更新

## 出问题时

- [ ] 查看日志：`ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/aliyun-logs.sh app'`
- [ ] 回滚：`ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh <tag>'`
- [ ] 恢复数据库：`bash scripts/deploy/aliyun-restore-db.sh <backup-file>`
