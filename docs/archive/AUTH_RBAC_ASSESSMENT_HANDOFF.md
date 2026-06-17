# 评估交接文件 (AUTH_RBAC_ASSESSMENT_HANDOFF)

> 生成时间：2026-06-05
> 项目：shenlun-material-hub
> 评估结论：**建议调整部分需求后进入开发**

---

## 1. 当前项目是否适合实施

**适合**，但需要分阶段实施，不能一次完成全部需求。

当前项目是一个 Next.js 16 + Prisma 7 + PostgreSQL 的内容管理工具，技术栈支持多用户扩展。主要挑战在于当前架构是"单管理员 + 全局公开"模式，增加多用户系统需要较大范围的改造。

---

## 2. 当前认证、配置和数据归属现状

### 认证现状
- **单一管理员**：凭据来自环境变量（`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`JWT_SECRET`）
- **JWT 实现**：自定义 HS256，Cookie 存储，24 小时过期
- **密码哈希**：SHA-256（建议升级为 bcrypt）
- **前端保护**：仅 AdminShell 组件检查认证
- **API 保护**：仅 login/check/logout 三个端点有认证，**其余 31 个端点完全公开**

### 配置现状
| 配置项 | 存储位置 | 范围 |
|---|---|---|
| AI API Key/URL/Model | DB `AiConfig` 表 + 环境变量 fallback | 全局唯一 |
| IMA 知识库 | 环境变量 | 全局唯一 |
| we-mp-rss | 环境变量 + 参数传入 | 全局唯一 |

### 数据归属现状
- **所有数据无用户归属**：ContentItem、MaterialCard、AsyncTask、SyncRecord 等均无 userId 字段
- **所有查询无范围限制**：API 返回全部数据，无用户过滤
- **无 User 表**：数据库中无任何用户相关表

---

## 3. 已确认需求中最难的五项

| 排名 | 需求 | 难度 | 原因 |
|---|---|---|---|
| 1 | AI/IMA/we-mp-rss 用户级配置 | XL | 需要重构三个服务层的配置读取方式，影响所有 AI 和同步功能 |
| 2 | 多用户数据隔离 | L | 需要改造全部 30+ API 路由的查询逻辑，添加所有权验证 |
| 3 | 历史数据迁移 | L | 需要为现有数据添加用户归属和可见性，保证不丢失、不泄露 |
| 4 | 后台任务用户上下文 | M | AsyncTask 无 userId，任务执行时需要传递用户配置 |
| 5 | 前端权限控制 | M | 需要添加权限上下文、条件渲染、导航改造 |

---

## 4. 推荐调整的需求

| 需求 | 推荐调整 | 理由 |
|---|---|---|
| 邀请码注册 | 延后到第二阶段 | 第一阶段先做管理员手动创建账号，降低复杂度 |
| 多 IMA 知识库 | 延后到第三阶段 | IMA 配置纯环境变量，改造深度大 |
| 管理员查看明文密钥 | **建议放弃** | 安全风险过高，替代方案为管理员只能重置密钥 |
| USER/VERIFIED_USER 区分 | 保留但简化 | 防止未验证用户消耗付费 AI 额度 |

---

## 5. 推荐实施阶段

### 阶段 1：认证基础与 API 保护（1-2 周）
- 新建 User、Session 表
- 重构 auth.ts 为多用户认证
- 新建 API 认证中间件，保护所有端点
- JWT 添加角色信息

### 阶段 2：用户管理与数据隔离（2-3 周）
- 管理员创建用户、邀请码注册
- ContentItem/MaterialCard 添加 userId 和 visibility
- 所有查询添加用户过滤
- 前端权限控制

### 阶段 3：用户级配置与集成（2-3 周）
- AI 配置用户化（重构 ai.ts）
- IMA 配置用户化（重构 ima-sync.ts）
- we-mp-rss 配置用户化
- 用户配置页面

### 阶段 4：高级功能（1-2 周）
- 任务限额、审计日志、多 IMA 目标

---

## 6. 需要用户确认的问题

1. **历史文章可见性**：默认 public 还是 private？（推荐 public）
2. **素材卡可见性**：默认 private 还是 public？（推荐 private）
3. **同一篇文章多用户采集**：共享模式还是独立副本？（推荐共享）
4. **管理员查看用户 AI 使用情况**：是否需要？（推荐汇总统计）
5. **用户禁用后数据处理**：保留、归档还是转移？（推荐保留）
6. **密码重置方式**：管理员重置还是邮箱自助？（推荐管理员重置）

---

## 7. 关键文件索引

### 认证相关
| 文件 | 职责 |
|---|---|
| `src/lib/auth.ts` | JWT 和密码工具（需要重构） |
| `src/lib/crypto.ts` | AES-256-CBC 加密（可复用） |
| `src/app/api/auth/login/route.ts` | 登录端点 |
| `src/app/api/auth/check/route.ts` | 认证检查端点 |
| `src/components/admin/AdminShell.tsx` | 管理后台认证外壳 |

### 数据模型
| 文件 | 职责 |
|---|---|
| `prisma/schema.prisma` | 数据库 Schema（需要新建 User/Session/Invitation 表） |
| `prisma/migrations/*.sql` | 迁移历史 |

### 配置系统
| 文件 | 职责 |
|---|---|
| `src/services/ai.ts` | AI 服务核心（需要重构为用户级配置） |
| `src/services/ima-sync.ts` | IMA 同步（需要重构为参数化配置） |
| `src/services/integrations/we-mp-rss*.ts` | we-mp-rss（已是参数化设计） |
| `src/app/api/ai-config/route.ts` | AI 配置 API |

### 任务系统
| 文件 | 职责 |
|---|---|
| `src/lib/async-task.ts` | 异步任务队列（需要添加用户关联） |
| `src/app/api/admin/tasks/route.ts` | 任务管理 API |

### 前端
| 文件 | 职责 |
|---|---|
| `src/app/layout.tsx` | 根布局（需要权限导航） |
| `src/app/page.tsx` | 仪表板（需要权限控制） |
| `src/components/CollectButton.tsx` | 采集按钮（需要权限控制） |
| `src/components/SyncToIma.tsx` | IMA 同步（需要权限控制） |

---

## 8. 审计限制

- 项目不在 Git 版本控制下（外层目录无 `.git`），无法获取提交历史
- 部分文件仅确认用途未深入阅读（42 个），不影响核心评估结论
- 未运行任何测试命令（避免修改数据）
- 未阅读 Prisma 生成代码和 UI 基础组件（不影响评估）
- 数据库实际数据量未确认（需要运行时检查）
