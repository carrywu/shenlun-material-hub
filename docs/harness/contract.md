# Harness Contract

> 本文件定义 `shenlun-material-hub` 项目 harness 的定位、目录结构、批次约束、分级规则、数据归属红线、IMA/AI 红线。
> 详细规则见仓库根 `CLAUDE.md` 与全局规则 `~/.claude/CLAUDE.md`。

## 1. Harness 定位

本项目的 harness **不是新 agent 框架**，而是在现有项目内建立的执行外壳：

```text
CLAUDE.md / AGENTS.md
+ docs/audit 需求与开发文档
+ docs/testing.md 验证契约
+ docs/harness/ 契约 / 验证矩阵 / 二审清单
+ tasks/harness/*.md 批次任务
+ scripts/harness/*.mjs 预检与验证脚本
+ .claude/commands/*.md Claude Code 命令
+ 二审提示词
```

Agent 不允许"自由发挥"。每次任务必须固定在一个明确 batch 中。

## 2. 项目核心闭环

```text
采集文章
-> AI 评估
-> 管理员审核
-> 用户学习文章
-> VERIFIED_USER 生成私有素材卡
-> 复习
-> 同步个人 IMA
```

### 角色权限

| 角色 | 能力 |
|---|---|
| USER | 注册登录、查看 approved 公共文章、阅读、收藏、复习收藏文章 |
| VERIFIED_USER | USER 能力 + 配置个人 AI key + 生成自己的私有素材卡 + 同步自己的 IMA |
| ADMIN | 后台管理、审核、下架、用户管理、任务日志、全局数据管理、审计 |

### 禁止项

```text
USER 不可 AI 生成素材卡
USER 不可配置 AI
USER 不可配置或同步 IMA
USER 不可访问后台
VERIFIED_USER 不可访问后台
ADMIN 自己使用 IMA 时也必须配置自己的 IMA target
不允许 fallback 到 env IMA 配置
```

## 3. Agent 工作流

```text
先理解结构
再列 TodoList
再做最小修改
再补测试
再验证
再报告
```

禁止：

```text
不读文档直接改代码
大范围重构
顺手改 UI / 无关 API
删除旧功能
跳过测试却声称通过
把失败测试改成 skip
用 mock 掩盖真实权限问题
把 P0 风险降级成建议
```

## 4. 批次约束

每个任务必须绑定一个 batch 文件：

```text
tasks/harness/batch-a-sync-security.md
tasks/harness/batch-b-user-state.md
tasks/harness/batch-c-review-loop.md
tasks/harness/batch-d-validation-cleanup.md
```

不属于当前 batch 的问题：记录到 Findings / Next Batch，不要顺手修。

冲突仲裁：如果代码、旧文档、聊天记录和 `docs/audit/requirements-confirmation.md` 冲突，**以 requirements-confirmation.md 为准**。

## 5. P0 / P1 / P2 / P3 分级

### P0：必须立即处理

```text
越权访问
ownerUserId 隔离失败
非 owner 可读取私有素材卡
A 用户可同步 B 用户素材卡
IMA / AI fallback 到 env
USER 可生成素材卡
USER 可访问后台能力
下架 / reject 删除用户私有资产
密码、API key、IMA key、cookie、Authorization 泄露
破坏性操作没有 dry-run / 预览 / 二次确认
```

### P1：当前 batch 内优先修

```text
用户私有状态写到 ContentItem 全局字段
缺少关键 route test
缺少 A/B 用户隔离测试
下架文章未显示只读 / 下架标记
恢复归档卡片时丢失复习状态、同步状态、标签
```

### P2：可排期

```text
UI 文案不统一
组件复用不足
错误提示不够清晰
日志字段不完整但不泄露敏感信息
```

### P3：建议

```text
代码风格优化
轻量重构
命名优化
文档补充
```

## 6. 数据归属红线

### 6.1 公共文章

普通用户只能看到：

```text
adminReviewStatus = approved
并且文章可见
```

### 6.2 用户私有状态

以下状态必须属于用户个人：

```text
阅读状态
收藏状态
忽略状态
文章复习状态
```

`ContentItem.read / ContentItem.bookmarked / ContentItem.ignored` **不能**作为长期方案。

推荐长期模型：

```text
ArticleFavorite(userId, contentItemId)
UserContentState(userId, contentItemId, read, ignored)
ArticleReviewState(userId, contentItemId, mastery, reviewCount, lastReviewedAt, nextReviewedAt)
```

### 6.3 素材卡（用户私有资产）

必须满足：

```text
owner 可查看、编辑、归档自己的素材卡
ADMIN 可管理任意素材卡
其他用户访问别人的素材卡返回 404
默认列表、搜索、复习、IMA 同步排除 archivedAt != null 的素材卡
恢复归档卡片必须保留标签、复习状态、掌握状态、同步记录
```

## 7. IMA / AI 同步红线

### 7.1 AI key

```text
VERIFIED_USER / ADMIN 生成素材卡必须使用自己的 AI key
不允许 fallback 到 env AI key
缺配置时禁止生成，并提示去配置
USER 不显示 AI 配置入口
```

### 7.2 IMA

```text
VERIFIED_USER / ADMIN 可使用 IMA
USER 没有 IMA 配置和同步入口
每个用户必须配置自己的 IMA target
不允许 fallback 到 env IMA 配置
同步范围 = 自己可见的文章 + 自己的素材卡
```

### 7.3 Service 层也必须校验 owner

不要只在 route 层做权限检查。例如同步素材卡时：

```text
route 层检查 card.ownerUserId
service 层再次检查 card.ownerUserId
query 层过滤 ownerUserId = currentUser.id
archivedAt = null
confirmed = true
```
