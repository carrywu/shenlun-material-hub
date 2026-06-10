# TCR 部署回滚指南

---

## 快速回滚

```bash
# 1. 查看当前版本
ssh root@47.119.182.210 'cat /opt/shenlun-material-hub/REVISION'

# 2. 列出可用 tag
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh'

# 3. 回滚到指定 tag
ssh root@47.119.182.210 'cd /opt/shenlun-material-hub && bash scripts/deploy/rollback-tcr.sh <tag>'
```

## 手动回滚命令

如果脚本不可用：

```bash
ssh root@47.119.182.210
cd /opt/shenlun-material-hub

# 查看当前版本
cat REVISION

# 查看可用镜像
docker images ccr.ccs.tencentyun.com/carrywu/shenlun

# 备份数据库
bash scripts/deploy/aliyun-backup-db.sh

# 拉取目标版本
IMAGE_TAG=<tag> docker compose -f docker-compose.prod.yml --env-file .env.production pull app

# 重启
IMAGE_TAG=<tag> docker compose -f docker-compose.prod.yml --env-file .env.production up -d --no-build app

# 验证
curl http://127.0.0.1/api/health
docker compose -f docker-compose.prod.yml ps
```

## 回滚场景

### 场景 1：新版本启动失败

**现象**：app 容器不断重启或 health check 失败

**处理**：
1. 查看日志确认原因：`bash scripts/deploy/aliyun-logs.sh app`
2. 回滚到上一个版本：`bash scripts/deploy/rollback-tcr.sh <上一个 tag>`
3. 如果上一个 tag 不在本地，脚本会自动从 TCR 拉取

### 场景 2：新版本功能异常

**现象**：服务正常启动，但功能不正常

**处理**：
1. 记录问题现象
2. 回滚到上一个版本
3. 如果涉及数据库 schema 变更：
   - Prisma `migrate deploy` 只做向前迁移
   - 回滚镜像不会回滚数据库 schema
   - 如需恢复数据库：`bash scripts/deploy/aliyun-restore-db.sh <backup-file>`

### 场景 3：数据库损坏

**现象**：应用报数据库连接错误或数据不一致

**处理**：
1. 停止应用：`docker compose stop app`
2. 恢复最近的备份：`bash scripts/deploy/aliyun-restore-db.sh backups/shenlun-material-hub-<timestamp>.dump`
3. 重启应用：`docker compose start app`
4. 健康检查：`curl http://127.0.0.1/api/health`

### 场景 4：完全不可用

**现象**：ECS 无法 SSH 或 Docker 异常

**处理**：
1. 阿里云控制台重启 ECS 实例
2. SSH 恢复后检查 Docker：`systemctl status docker`
3. 检查容器：`docker compose ps`
4. 查看日志排查原因
5. 必要时重新拉取镜像和重启

## Tag 查找方法

```bash
# 本地已有 tag
docker images --format '{{.Tag}}\t{{.CreatedAt}}' ccr.ccs.tencentyun.com/carrywu/shenlun

# 查看 REVISION 文件确认当前版本
cat /opt/shenlun-material-hub/REVISION

# 从 TCR 拉取特定 tag
docker pull ccr.ccs.tencentyun.com/carrywu/shenlun:<tag>
```

## 注意事项

- 每次回滚前会自动备份数据库
- 回滚只切换应用镜像，不回滚数据库
- 如果新版本有数据库 migration，回滚后可能需要恢复数据库备份
- `latest` tag 总是指向最后一次部署的版本，不一定是稳定版本
