# shenlun-material-hub

申论官方文章采集、AI 素材卡生成与 IMA 知识库同步工作台。支持全国通用及广东/湖南省考素材积累。

## 技术栈

- **前端**: Next.js 16 + React 19 + Tailwind CSS 4
- **后端**: Next.js API Routes + Prisma 7
- **数据库**: PostgreSQL 16
- **AI**: OpenAI SDK（兼容 OpenAI API 的任意模型）
- **测试**: Vitest + Playwright

## 快速开始

### 1. 环境准备

```bash
# Node.js 18+ 和 pnpm
node -v   # 需要 >= 18
pnpm -v   # 需要 >= 8

# PostgreSQL 16
psql --version
```

### 2. 安装依赖

```bash
git clone <repo-url> && cd shenlun-material-hub
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入以下必需配置：

```env
# 数据库
DATABASE_URL="postgresql://shenlun:shenlun_dev@localhost:5432/shenlun_material_hub"

# AI 配置（二选一：数据库配置或环境变量）
AI_CONFIG_ENCRYPTION_KEY="your-32-char-encryption-key"
# AI_API_KEY="sk-xxx"            # 可选：环境变量方式的 AI Key
# AI_BASE_URL="https://api.openai.com/v1"
# AI_MODEL="gpt-4o"

# IMA 同步（可选）
# IMA_API_BASE="https://api.ima.qq.com"
# IMA_CLIENT_ID="xxx"
# IMA_API_KEY="xxx"
# IMA_KNOWLEDGE_BASE_ID="xxx"

# we-mp-rss（可选）
# WE_MP_RSS_BASE_URL="http://localhost:8001"
```

### 4. 初始化数据库

```bash
# 运行 Prisma 迁移
pnpm db:migrate

# 生成 Prisma Client
pnpm db:generate

# 创建初始管理员账户
pnpm seed:admin
# 默认: admin / admin123（生产环境请务必修改密码）
```

### 5. 启动开发服务器

```bash
pnpm dev
```

打开 http://localhost:3000，使用 `admin / admin123` 登录。

### 6. （可选）初始化采集种子数据

```bash
# 添加示例来源和采集栏目
pnpm seed:channels

# 添加测试用户
pnpm seed:accounts
```

## 验证命令

```bash
# 代码检查
pnpm lint

# 单元测试（Vitest）
pnpm test

# 构建
pnpm build

# E2E 测试（Playwright，需先启动 dev server）
pnpm exec playwright test
```

## 核心页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 仪表板 | `/` | 统计概览 |
| 今日推荐 | `/discover` | 已验证来源的精选内容 |
| 探索区 | `/explore` | 未验证来源内容 |
| 文章列表 | `/articles` | 全部采集文章 |
| 文章详情 | `/articles/[id]` | 正文、AI 评估、批注 |
| 素材卡 | `/cards` | 9 种 AI 素材卡管理 |
| 检索 | `/search` | 全文搜索素材卡 |
| 复习 | `/review` | 间隔重复复习 |
| 个人设置 | `/settings` | AI 配置、IMA 同步、集成 |
| 管理后台 | `/admin` | 用户/来源/任务/日志管理 |

## 管理后台

| 页面 | 路径 |
|------|------|
| 控制台 | `/admin` |
| 文章管理 | `/admin/articles` |
| 来源管理 | `/admin/sources` |
| we-mp-rss 集成 | `/admin/integrations/wechat-rss` |
| AI 配置 | `/admin/settings/ai` |
| 异步任务 | `/admin/tasks` |
| 系统日志 | `/admin/logs` |
| 用户管理 | `/admin/users` |
| 数据备份 | `/admin/backup` |
| 数据清理 | `/admin/clean` |
| 同步记录 | `/admin/sync-records` |

## Web 采集器

| 采集器 | 来源 |
|--------|------|
| 先锋文汇 | 人民论坛网 |
| 人民日报 | 人民日报数字报 |
| 人民网观点 | 人民网观点频道 |
| 广东省政府网 | 广东省人民政府 |
| 湖南省政府网 | 湖南省人民政府 |

## 项目结构

```
src/
├── app/                  # Next.js App Router 页面和 API
│   ├── admin/            # 管理后台页面
│   ├── api/              # API 路由
│   └── *.tsx             # 公开页面
├── components/           # React 组件
├── lib/                  # 工具库（auth, db, logger, crypto）
├── services/             # 业务服务（AI, 采集器, IMA 同步）
├── scripts/              # 数据库迁移和种子脚本
└── generated/prisma/     # Prisma 生成的客户端
```

## 部署

详见 [DEPLOY.md](./docs/DEPLOY.md)。
