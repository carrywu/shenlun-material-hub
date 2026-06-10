# 阿里云部署 Todo

## 审计
- [x] 读取 package.json
- [x] 读取 Prisma schema
- [x] 检查 env 变量
- [x] 检查 Next.js 构建配置
- [x] 检查数据库迁移
- [x] 检查认证/session
- [x] 检查文件持久化目录

## 部署资产
- [x] 新增 .env.production.example
- [x] 修正 Dockerfile
- [x] 修正 docker-compose.prod.yml
- [x] 新增 deploy/Caddyfile
- [x] 新增 deploy/nginx.conf.example
- [x] 新增部署脚本
- [x] 新增备份脚本
- [x] 新增恢复脚本
- [x] 新增日志脚本

## 安全
- [x] 检查默认管理员
- [x] 检查 cookie/session
- [x] 检查 admin 鉴权
- [x] 检查敏感日志
- [x] 检查 .gitignore

## 验证
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm build
- [x] Docker compose config
- [x] Docker image build
- [x] ECS old container cleanup
- [ ] Docker compose up
- [ ] /api/health
- [ ] 登录后台
- [ ] 关键页面
- [ ] AI 配置页
- [ ] 数据备份
