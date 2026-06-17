# 部署指南

## 环境要求

- Node.js 18+
- pnpm 8+
- PostgreSQL 16
- （可选）we-mp-rss sidecar 用于微信公众号采集

## 部署步骤

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入生产配置
```

必需环境变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `AI_CONFIG_ENCRYPTION_KEY` | AI 配置加密密钥（32 字符） |
| `ADMIN_USERNAME` | 初始管理员用户名 |
| `ADMIN_PASSWORD` | 初始管理员密码（生产环境必须设置） |

### 2. 安装依赖 & 构建

```bash
pnpm install --frozen-lockfile
pnpm build
```

### 3. 数据库迁移

```bash
pnpm db:migrate
```

迁移失败回滚：

```bash
# 查看迁移状态
npx prisma migrate status

# 回滚到上一个迁移
npx prisma migrate resolve --rolled-back <migration_name>
```

### 4. 创建管理员

```bash
pnpm seed:admin
```

### 5. 启动服务

```bash
pnpm start
# 或使用自定义端口
PORT=3200 pnpm start
```

## CI 验证命令

部署前必须全部通过：

```bash
# 1. 代码检查
pnpm lint

# 2. 单元测试（Vitest，36 文件 / 245+ 用例）
pnpm test

# 3. 构建检查
pnpm build

# 4. E2E 测试（Playwright，需要 dev server 运行）
pnpm exec playwright test
```

E2E 测试基线：32 passed / 2 conditional skip / 0 failed。

### 最小 CI 配置

```bash
pnpm lint && pnpm test && pnpm build
```

### 完整 CI 配置（含 E2E）

```bash
pnpm lint
pnpm test
pnpm build
pnpm start &              # 后台启动服务
sleep 5                    # 等待服务就绪
pnpm exec playwright test  # E2E 测试
kill %1                    # 停止服务
```

## Docker 部署

```bash
docker compose up -d
```

### Docker 健康检查

```bash
curl http://localhost:3000/api/health
```

## 数据库备份

```bash
# 通过管理后台导出（/admin/backup）
# 或使用 pg_dump
pg_dump -U shenlun shenlun_material_hub > backup.sql
```

## 故障排查

| 问题 | 排查方法 |
|------|----------|
| 服务启动失败 | 检查 `.env` 配置和 PostgreSQL 连接 |
| 数据库迁移失败 | `npx prisma migrate status` |
| AI 功能不可用 | 检查 AI 配置页或 `AI_API_KEY` 环境变量 |
| 登录失败 | 检查 `ADMIN_PASSWORD` 是否正确设置 |
