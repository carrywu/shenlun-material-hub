# 部署指南

## 快速开始（本地开发）

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置管理员密码等

# 3. 初始化数据库（首次部署）
pnpm db:setup

# 4. 启动开发服务器
pnpm dev
```

## 生产部署

### 环境变量检查清单

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 连接字符串 |
| `ADMIN_PASSWORD_HASH` | 生产必须 | bcrypt 哈希（生成见下方） |
| `AI_CONFIG_ENCRYPTION_KEY` | 使用 AI 功能时 | `openssl rand -base64 32` |
| `JWT_SECRET` | 可选 | 旧版 JWT 兼容 |

生成 bcrypt 密码哈希：
```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD',12).then(h=>console.log(h))"
```

### Docker 部署

```bash
# 构建并启动
docker compose up -d

# 查看健康状态
docker compose ps
```

### 迁移与回滚

```bash
# 执行迁移（部署新版本时）
pnpm db:migrate

# 回滚：从 PostgreSQL 备份恢复（通过 API）
# 使用管理后台的备份导入功能，或 pg_dump/pg_restore
```

### 备份

```bash
# 通过 API 备份（需要 admin 认证）
curl -b "auth_token=YOUR_TOKEN" http://localhost:3000/api/admin/backup/export -o backup.json.gz

# PostgreSQL 原生备份（可选）
docker compose exec postgres pg_dump -U shenlun shenlun_material_hub > backup.sql
```

## WeWe RSS Sidecar

WeWe RSS 是可选的本地 sidecar 服务，本项目**只读消费**其数据。

```bash
# 启动 WeWe RSS（可选）
docker compose --profile wewe-rss up -d
```

## 验证

```bash
# 代码检查
pnpm lint

# 单元测试
pnpm test

# 构建
pnpm build

# E2E 测试
pnpm exec playwright test
```
