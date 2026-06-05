# 公开 API 清单

> 审计日期：2026-06-05
> 此文档列出所有无需认证即可访问的 API 端点。

## 完全公开 API（无认证）

| API | 方法 | 返回内容 | 数据范围 |
|---|---|---|---|
| `/api/health` | GET | 健康状态 | 系统状态信息 |
| `/api/auth/login` | POST | 登录结果 | 创建/验证 session |
| `/api/auth/check` | GET | 认证状态 | 当前用户信息或 null |
| `/api/auth/logout` | POST | 登出结果 | 清除 session |

## 可选认证 API（公开内容 + 增强数据）

| API | 方法 | 匿名 | 已登录用户 | 说明 |
|---|---|---|---|---|
| `/api/articles` | GET | public + null-owner | public + own + null-owner | 文章列表 |
| `/api/discover` | GET | public 内容 | public + own | 发现页 |
| `/api/explore` | GET | public 内容 | public + own | 探索页 |
| `/api/content-items` | GET | public + null-owner | public + own + null-owner | 内容列表 |
| `/api/search` | GET | public + null-owner | public + own + null-owner | 搜索 |

## 公开代理 API

| API | 方法 | 安全措施 | 说明 |
|---|---|---|---|
| `/api/proxy/image` | GET | 白名单域名 + SSRF 防护 + HTTPS | 微信图片代理 |

## 认证用户 API

| API | 方法 | 数据范围 |
|---|---|---|
| `/api/material-cards` | GET | own + null-owner |
| `/api/review` | GET/POST | own only |
| `/api/sync-records` | GET | own only |
| `/api/annotations/[id]` | PATCH/DELETE | own only |
| `/api/content-items/[id]/annotations` | GET | 需访问父级 ContentItem |

## 管理员专属 API

| API | 方法 | 说明 |
|---|---|---|
| `/api/admin/**` | ALL | 用户管理、备份、日志、指标、清理 |
| `/api/ai-config/**` | ALL | AI 配置管理 |
| `/api/collectors/**` | ALL | 采集器操作 |
| `/api/sources/**` | POST/PUT/DELETE | 来源增删改 |
| `/api/integrations/**` | ALL | 集成管理 |
| `/api/sync` | POST/GET | IMA 同步 |
| `/api/content-items/reassess` | POST | AI 重新评估 |
| `/api/content-items/assess` | POST | 批量 AI 评估 |
| `/api/content-items/[id]/generate-card` | POST | AI 素材卡生成 |

## 变更流程

新增或修改 API 端点时：
1. 确定公开/认证/管理员级别
2. 更新此清单
3. 添加对应的 401/403 测试
4. 如为公开 API，确认返回数据不包含私有内容
