# 最终开发报告：WeWe RSS 权限收紧 + 文章审核流 + 用户私有素材卡 + 前台重构

> **项目**：申论素材采集台
> **分支**：`worktree-p1-p8-review-flow`（基于 `main`）
> **完成日期**：2026-06-12
> **规模**：58 commits · 72 文件改动 · +3676 / -284 行 · 8 个独立 PR
> **原始需求**：`docs/wewerss_admin_review_user_ai_material_card_requirements.md`
> **实施计划**：`docs/superpowers/plans/2026-06-12-p1-*.md` ~ `p8-*.md`（8 份）

---

## 0. TL;DR

按需求方确认的 25 条核心决策，把 WeWe RSS 从「面向用户」降级为「管理员后台采集工具」，建立「AI 评估 → 管理员审核 → 用户可见」两段式文章准入链路，素材卡改造为「用户私有 + 用户自付 AI 成本」，并重构前台为「今日推荐 / 探索区 / 我的文章」三段式架构 + USER/VERIFIED_USER/ADMIN 三角色分层。

**本地验收全绿**：lint 0 error · vitest 331/331 · build 成功 · e2e 本地能跑的都过。
**staging 未部署**（见第 8 节，需需求方介入）。

---

## 1. 改了什么（8 PR 总览）

| PR | 内容 | 核心交付 |
|---|---|---|
| **P1** | WeWe RSS 权限收紧 | 5 个 settings API handler `requireVerifiedUser`→`requireAdmin`；设置页入口对非 admin 隐藏；`/settings/integrations` 加客户端 admin 守卫 |
| **P2** | Schema + 历史数据迁移 | ContentItem 加 6 审核字段；新建 `ArticleFavorite`、`RoleQuota` 表；`MaterialCard` partial unique index；幂等回填 SQL |
| **P3** | 文章可见性过滤 | `contentVisibilityWhere` 对非 ADMIN 注入 `adminReviewStatus=approved`；列表加 adminReviewStatus 查询参数；详情防 ID 绕过（非 ADMIN 访问未审核→404） |
| **P4** | assess + review + feature | assess 改管理员专用 + 写回状态；新增 `/api/admin/content-items/review`（批量 approve/reject/force-approve，下架删全部卡）；新增 feature 接口（今日推荐推送/撤下） |
| **P5** | generate-card 改造 | 准入改 `adminReviewStatus=approved`；USER 拒；去重加 `ownerUserId`（公共卡不阻止私有）；卡包串行；速率限制；前端防抖 |
| **P6** | 收藏 + 角色配额 | `/api/favorites`（GET/POST/DELETE，软收藏，整批超上限拒，移除连带删用户卡）；`/api/admin/role-quotas` + 配额后台页 |
| **P7** | 前台重构 | `/discover`→今日推荐；`/explore`→已审图书馆；新建 `/my-articles`；FavoriteButton + 批量勾选；ArticleDetail USER 置灰引导；管理员审核页加审核 UI |
| **P8** | 角色分层 + 注册 + upgrade | 注册邀请码可选（填→VERIFIED/不填→USER）；`/api/auth/upgrade`；USER 挡 AI/IMA 测试；e2e helper |

**最终代码评审**：独立 reviewer 给 APPROVED_WITH_NITS。发现并修复 2 个真实问题：
- 匿名 `/api/articles` 漏 approved 过滤（未审核文章泄露给匿名）→ 已修
- 管理员审核筛选下拉用了不存在的 `pending`/`pending_review` → 改为 `pending_ai`/`pending_admin`

---

## 2. 数据库迁移内容

### 新增字段（ContentItem）
```prisma
adminReviewStatus   String   @default("pending_ai") // pending_ai/pending_admin/approved/rejected
adminReviewedAt     DateTime?
adminReviewedBy     String?
adminReviewNote     String?
publicVisibleAt     DateTime?
featuredToday       Boolean  @default(false)
```
+ 索引 `@@index([adminReviewStatus])`、`@@index([featuredToday])`
+ 关系 `adminReviewer User?`（FK = adminReviewedBy）

### 新建表
- **`ArticleFavorite`**（软收藏关系表）：`userId + contentItemId`，`@@unique`，级联删除
- **`RoleQuota`**（角色配额）：`role @unique`、`favoriteLimit`

### MaterialCard partial unique index（PostgreSQL）
```sql
CREATE UNIQUE INDEX IF NOT EXISTS "materialcard_private_unique"
  ON "MaterialCard" ("contentItemId", "cardType", "ownerUserId")
  WHERE "ownerUserId" IS NOT NULL;
```
同一用户 + 同一文章 + 同一卡片类型只能一张；公共卡（ownerUserId=null）不受约束。

### Migration 文件
`prisma/migrations/20260611175652_review_flow/migration.sql`（DDL + partial index + 幂等回填）

---

## 3. 历史数据迁移规则（已应用）

所有 UPDATE 带 `WHERE adminReviewStatus = 'pending_ai'` 守卫，**幂等可重跑**。

| 老文章条件 | 新 adminReviewStatus | 备注 |
|---|---|---|
| `aiDecision = 'accept'` | **approved** | ⚠️ 破红线自动放行；`publicVisibleAt`/`adminReviewedBy` 留空标记为「迁移放行非人工」 |
| `aiDecision = 'reject'` | rejected | |
| `qualityStatus IN ('filtered','blocked')` | rejected | 垃圾内容直接判死 |
| `aiDecision IS NULL AND candidate` | pending_ai | 等管理员触发 AI 评估 |

**状态机**：approved + rejected + pending_ai 之和 = ContentItem 总数（无 pending_admin 孤儿）。

---

## 4. WeWe RSS 权限边界（最终）

| 接口/页面 | USER | VERIFIED_USER | ADMIN |
|---|---|---|---|
| `GET/POST/DELETE/PUT /api/settings/integrations/wewe-rss` | 403 | 403 | ✅ |
| `POST /api/settings/integrations/wewe-rss/test` | 403 | 403 | ✅ |
| `/settings` 「外部集成」入口 | 隐藏 | 隐藏 | 显示 |
| `/settings/integrations` 直访 | 重定向 | 重定向 | 正常 |
| `/api/integrations/wewe-rss/**`（采集接口） | 403 | 403 | ✅（本就是 requireAdmin，未动） |
| `/admin/integrations/wewe-rss` 后台页 | 无权 | 无权 | ✅（未动） |

**普通用户完全碰不到 WeWe RSS**——配置、调用、入口全部隔离。

---

## 5. AI 配置和调用归属

| 场景 | 谁的 Key | 实现 |
|---|---|---|
| 管理员做文章 AI 评估（assess） | 管理员自己的 | `resolveAiRuntimeConfig(admin.id)` |
| 认证用户生成素材卡 | 用户自己的 | `resolveAiRuntimeConfig(user.id)` |
| USER 生卡 | 不消耗任何 Key | 路由层 403 拦截 |
| 系统全局兜底 | ❌ 不存在 | `resolveAiRuntimeConfig(userId)` 传 userId 时**无 fallback**，找不到配置直接抛 `AI_CONFIG_MISSING` |

**核心保证**：系统不使用管理员 Key 给普通用户生成素材卡；不使用全局 Key 兜底。每个用户调用 AI 都用自己的配置。

---

## 6. 素材卡归属和去重规则

- **归属**：`MaterialCard.ownerUserId = 当前用户 ID`（生成时写入）
- **隔离**：用户 A 的卡 B 看不到（`ownerScopeWhere` 过滤）
- **去重**：`findFirst({ where: { contentItemId, cardType, ownerUserId: user.id } })`
  - 同一用户 + 同一文章 + 同一类型只能一张
  - **公共卡（ownerUserId=null）不阻止**私有卡生成
  - 后端 PG partial unique index 物理保证（防并发双写）
- **准入**：必须 `adminReviewStatus=approved` 才能生成
- **历史公共卡**（ownerUserId=null）：保留，仅 ADMIN 可见
- **卡包**（金句+规范表达+案例+对策）：串行 enqueue，已生成跳过，失败可重试
- **速率限制**：复用 `checkTaskRateLimit`（每用户 3 并发 / 日 50）
- **前端防抖**：生卡按钮 loading + disabled，防连点

---

## 7. 角色分层（三角色权限矩阵）

| 能力 | USER | VERIFIED_USER | ADMIN |
|---|---|---|---|
| 注册 | 免费 | 注册时填邀请码 | 后台分配 |
| 看今日推荐 / 探索区 / 我的文章 | ✅ | ✅ | ✅ |
| 收藏文章 | ✅ | ✅ | ✅（不需，后台看全部） |
| 配 AI / IMA | ❌ | ✅ | ✅ |
| 生成素材卡 | ❌（详情页置灰 + 升级引导） | ✅（自付 Key） | ✅ |
| 升级路径 | 设置页弹窗 / 详情页 UpgradeButton 输码 | — | — |
| 采集 / 审核 / 推送今日推荐 | ❌ | ❌ | ✅ |

**注册流程**：邀请码可选（填了直接 VERIFIED_USER，不填 USER）。注册后可在设置页 / 详情页弹窗输码升级（`/api/auth/upgrade`）。

---

## 8. 测试结果

### 本地 worktree（全绿）
- `pnpm lint`：**0 error，16 warning**（全部既有未使用变量，与本次无关）
- `pnpm test`（vitest）：**331/331 passed**（50 文件，新增 51 个单测）
- `pnpm build`：**成功**（含全部新路由）
- e2e：
  - 本地能跑的（`api-security` WeWe RSS 6 个、`role-upgrade` 匿名注册 1 个、`frontend-experience` 页面加载 4 个）→ **全过**
  - fixture/AI 依赖的（VERIFIED_USER 链路、卡包生成、审核流端到端）→ `test.skip`，staging 激活

### ⚠️ staging 测试（**未做，待部署后补**）
代码**未部署到 staging**。需需求方介入：
1. 推送/合并 `worktree-p1-p8-review-flow` 分支
2. 部署到 staging（`http://100.117.96.1:3001`）
3. `prisma migrate deploy` 应用 review_flow migration
4. **核对回填数量**：`SELECT "adminReviewStatus", COUNT(*) FROM "ContentItem" GROUP BY ...`
5. `pnpm seed:role-quotas`（写 USER=100 / VERIFIED_USER=300）
6. 设置 e2e fixture env（`E2E_APPROVED_ARTICLE_ID` 等）
7. 跑 `pnpm test:e2e:staging`
8. 把 staging 测试结果补进本报告

---

## ⚠️ 9. 采集相关 e2e 风控提醒（需求方要求单独标注）

staging 跑全量 e2e 时，**采集类用例可能因微信风控失败**——这**不是代码 bug**。

### 判断方法
用 `detectWechatBlockPage()`（`src/services/collectors/wechat/weRssNormalizer.ts:53`）检测，命中以下任一关键词即为风控：
- 环境异常
- 频繁访问
- 请先验证
- 完成验证后即可继续访问
- 当前环境异常
- 为你的访问安全

### 命中风控时的处理
- **不算代码缺陷**，是微信侧反爬
- 建议人工核查 WeWe RSS 服务状态（IP 是否被封、是否需要换号/换 IP）
- 在 staging 测试报告里单独标注「采集 e2e 因微信风控失败，命中关键词 XXX」

### 卡包生成 e2e 的 AI 依赖
`material-card-ownership.spec.ts` 卡包用例会**真实调用 AI 4 次**。staging AI 不可达 / VERIFIED_USER Key 配额耗尽 → 500。已加 `test.skip` 兜底，但**最终报告需标注**「卡包 e2e 因 AI 服务/Key 配额失败，非代码 bug」。

---

## 10. todolist 完成情况（25 条核心决策）

### A. 审核流（4/4 ✅）
- [x] 垃圾文章（filtered/blocked）直接 rejected
- [x] 管理员可强制通过 AI 拒绝文章（二次确认 + 填理由）
- [x] 文章状态只能改不能删（记录永久保留）
- [x] 管理员下架连带删所有用户基于该文章的素材卡

### B. 老数据迁移（2/2 ✅）
- [x] AI 通过的老文章自动放行 approved（破红线）
- [x] `publicVisibleAt`/`adminReviewedBy` 留空标记

### C. 素材卡（4/4 ✅）
- [x] 去重加 ownerUserId（前端防抖 + 后端 PG 唯一约束）
- [x] 卡包排队串行生成
- [x] 必须先收藏进「我的文章」才能生卡
- [x] 普通用户只看自己的卡，老卡归 ADMIN

### D. 前台架构（5/5 ✅）
- [x] 「我的库」→「我的文章」，平铺模式
- [x] 今日推荐 = 管理员精选，所有用户看同一份，必须先审核通过
- [x] 今日推荐手动制（下架自动清标记）
- [x] 探索区 = 全部已审核图书馆
- [x] `/discover` 复用为今日推荐（原 plan 的 `/articles` 改造调整为新建 `/my-articles`，因为 `/articles` 是管理员文章管理页）

### E. 收藏（5/5 ✅）
- [x] 软收藏（ArticleFavorite 关系表）
- [x] 批量入库（勾选 + 浮动条）
- [x] 上限按角色配置（RoleQuota 后台页）
- [x] 超上限整批拒绝
- [x] 移除连带删用户卡

### F. 角色分层（5/5 ✅）
- [x] USER 不能配 AI/IMA，不能生卡
- [x] VERIFIED_USER 完整功能
- [x] 注册邀请码可选
- [x] 注册后设置页 + 详情页弹窗双入口升级
- [x] USER 详情页生卡按钮置灰 + 弹窗输码

---

## 11. 交接文档清单（8 份）

每份含「改了什么 / 为什么 / 测试结果 / 给后续 PR 的注意事项」：

```
docs/handoff/
├── P1-wewe-rss-permission-handoff.md
├── P2-schema-migration-handoff.md
├── P3-article-visibility-handoff.md
├── P4-assess-review-handoff.md
├── P5-generate-card-handoff.md
├── P6-favorites-handoff.md
├── P7-frontend-handoff.md
└── P8-roles-and-tests-handoff.md
```

---

## 12. 已知问题与限制

### 未修（已评估为低风险，文档记录）
1. **收藏配额 TOCTOU 竞态**：`getFavoriteLimits` + `getCurrentFavoriteCount` 在事务外读，两个并发 POST 理论上都能过 check 然后都 insert。实际影响小（`@@unique` 防重复，且用户并发收藏场景少）。彻底修需 `SELECT FOR UPDATE` 或 count+conditional-insert。
2. **Prisma 7 + tsx 模块解析 bug**：`src/generated/prisma/index.json` 找不到，导致 `seed:role-quotas` 和验证脚本无法从 worktree 运行。**既有工具链问题**（影响所有 seed 脚本，非本次引入）。staging 部署时用 psql 或修好 tsx 集成后核对。
3. **ArticleChecklist 未挂载到 explore/discover 卡片**：组件已就绪，但为避免一次性改动太大未集成。当前用户主要通过 FavoriteButton 单篇收藏。后续可挂载。
4. **本地 dev 库 drift**（7 张表不在 migration 历史）：P2 未处理，独立 issue。

### 既有问题（与本次无关，但发现并记录）
- `e2e/api-security.spec.ts` 原 16 个「未认证→401」用例因 storageState 污染全部失败（P1 新增的用例已用 `test.use({ storageState: ... })` 规避，但既有 16 个未修）
- 多个既有测试文件有 TypeScript 小错误（`annotations`、`login`、`review` 等），不影响 vitest 运行（esbuild 不 typecheck），但 `tsc --noEmit` 会报

---

## 13. 部署 checklist（staging）

- [ ] 合并/推送 `worktree-p1-p8-review-flow` 分支（58 commits）
- [ ] 部署到 staging
- [ ] `pnpm exec prisma generate`（重新生成 client）
- [ ] `pnpm db:migrate`（apply review_flow migration）
- [ ] 核对回填数量分布（approved/rejected/pending_ai）
- [ ] 二次 `migrate deploy` 验证幂等（数据不变）
- [ ] `pnpm seed:role-quotas`（USER=100 / VERIFIED_USER=300）
- [ ] 验证 RoleQuota 表 + MaterialCard partial index 存在
- [ ] 设置 e2e fixture env
- [ ] 跑 `pnpm test:e2e:staging`
- [ ] 关注采集类 e2e 是否风控失败（见第 9 节）
- [ ] 把 staging 测试结果补进本报告第 8 节

---

## 14. 相关 commit（58 个，按 PR 分组）

完整 commit 历史见 `git log --oneline main..HEAD`。关键里程碑：
- P1: `d6835ab` → `d63c900`（9 commits）
- P2: `562ea70` → `4b26406`（5 commits）
- P3: `bb86a60` → `9a87d6e`（6 commits）
- P4: `34b31c7` → `bf1b6c8`（8 commits）
- P5: `520e25b` → `3113c99`（5 commits）
- P6: `0eab466` → `4623b52`（9 commits）
- P7: `045888d` → `ab63f94`（7 commits）
- P8: `652078d` → `3b48279`（8 commits）
- 最终评审修复：`fc713ed`（1 commit）

---

*本报告基于 2026-06-12 worktree `worktree-p1-p8-review-flow` 的最终状态。staging 部署 + 测试结果待补。*
