# RBAC 角色能力矩阵

> 审计日期：2026-06-05
> 此文档定义每个角色对每类 API 的权限，作为测试和代码审查的基准。

## 角色定义

| 角色 | 说明 | 鉴权函数 |
|---|---|---|
| `ADMIN` | 运营所有者，可访问全部数据和管理功能 | `requireAdmin()` |
| `VERIFIED_USER` | 已认证高级用户，部分管理侧读权限（待定义具体能力） | `requireVerifiedUser()` |
| `USER` | 普通认证用户，可使用用户侧功能 | `requireAuth()` |
| 匿名 | 未登录用户，仅可访问公开页面和公开 API | 无 |

## API 权限矩阵

### 公开 API（无需认证）

| API | 方法 | 说明 |
|---|---|---|
| `/api/health` | GET | 健康检查 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/check` | GET | 认证状态检查 |
| `/api/auth/logout` | POST | 登出 |
| `/api/articles` | GET | 文章列表（仅 public + null-owner） |
| `/api/discover` | GET | 发现页（公开内容） |
| `/api/explore` | GET | 探索页（公开内容） |

### 管理员专属 API（ADMIN only）

| API | 方法 | 说明 |
|---|---|---|
| `/api/admin/**` | ALL | 全部管理后台 API |
| `/api/ai-config/**` | ALL | AI 配置管理 |
| `/api/collectors/**` | ALL | 采集器操作 |
| `/api/content-items/assess` | POST | 批量 AI 评估 |
| `/api/content-items/reassess` | POST | 单条重新评估 |
| `/api/sources/**` | POST/PUT/DELETE | 来源增删改 |
| `/api/integrations/**` | ALL | 集成管理 |
| `/api/sync` | POST | IMA 同步 |
| `/api/settings/ai` | ALL | AI 设置 |

### 认证用户 API（任何已登录用户）

| API | 方法 | 数据范围 |
|---|---|---|
| `/api/articles` | GET | public + own + null-owner（只读） |
| `/api/content-items` | GET | public + own + null-owner（只读） |
| `/api/content-items/[id]` | GET | public + own + null-owner（只读） |
| `/api/search` | GET | public + own + null-owner（只读） |
| `/api/content-items/[id]/annotations` | GET | 需可访问父级 ContentItem |
| `/api/annotations/[id]` | PATCH/DELETE | 仅 own |
| `/api/material-cards` | GET | public + own + null-owner（只读） |
| `/api/review` | GET/POST | own only |
| `/api/sync-records` | GET | own only |
| `/api/proxy/image` | GET | 白名单域名 |

### VERIFIED_USER 预留能力（P2 定义）

当前 VERIFIED_USER 与 USER 行为一致。未来可能扩展：
- 查看更多来源的详细数据
- 使用高级 AI 功能
- 参与内容审核流程

**决策**：在 P1 阶段，VERIFIED_USER 视同 USER 处理，不增加额外能力。

## AsyncTask 访问策略

| 场景 | 策略 |
|---|---|
| Admin 查看任务列表 | 可见所有任务 |
| Admin 查看任务详情 | 可见所有任务 |
| 普通用户查看任务 | 当前不可访问（admin-only API） |
| 未来用户任务 | 需新增 `/api/tasks` 用户侧端点，仅返回 own 任务 |

## 数据隔离语义

| 数据类型 | Admin | Non-admin | null-owner |
|---|---|---|---|
| ContentItem (读) | 全部 | public + own + null-owner | 可读 |
| ContentItem (写) | 全部 | own only | 不可写 |
| MaterialCard (读) | 全部 | own + null-owner | 可读 |
| MaterialCard (写) | 全部 | own only | 不可写 |
| ArticleAnnotation (读) | 全部 | 需访问父级 ContentItem | — |
| ArticleAnnotation (写) | 全部 | own only | — |
| SyncRecord (读) | 全部 | own only | 可读 |
| AsyncTask | 全部 | 当前不可访问 | — |
| Source (读) | 全部 | public | — |
| Source (写) | 全部 | 不可访问 | — |

## 变更流程

新增或修改 API route 时：
1. 更新本矩阵
2. 添加对应的 401/403 route test
3. 更新 `docs/handover/RBAC_API_AUDIT.md`
