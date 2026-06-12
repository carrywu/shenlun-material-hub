# 任务：申论项目多人使用安全加固与可信测试修复

你现在接手 `shenlun-material-hub` 项目。项目已经进入多人使用场景，请不要把现有“已知问题与限制”当作低风险处理。

本轮目标不是新增功能，不是美化页面，而是把项目从“单人可用”加固到“多人使用下数据隔离、安全、稳定、可测试”。

请严格按以下流程执行：

1. 先阅读代码和文档，不要直接改。
2. 先输出完整风险评估和 Todo。
3. 按 P0 → P1 → P2 顺序修复。
4. 每完成一个小任务，更新 Todo，记录验证命令，提交一次 git commit。
5. 所有修改必须有测试。
6. 不允许测试失败却声称完成。
7. 不允许只靠前端隐藏按钮代替后端权限校验。
8. 不允许 reset 生产数据库。
9. 如果实际代码与本文描述不一致，以实际代码为准，并在报告中说明差异。

---

## 一、本轮必须产出的文档

请新增或更新以下文档：

```txt
docs/audit/multi-user-hardening-todolist.md
docs/audit/multi-user-hardening-report.md
docs/testing/multi-user-security-e2e-report.md
docs/deploy/database-migration-and-seed-report.md
tasks/YYYY-MM-DD-multi-user-hardening/README.md
```

文档必须包含：

- 已发现问题
- 风险等级
- 修改文件
- 修复方案
- 验证命令
- 测试结果
- 未解决问题
- 是否建议继续多人使用
- 上线前人工确认事项

---

# P0：必须优先修复

## P0-001：修复文章详情接口泄露其他用户素材卡/批注的问题

重点检查：

```txt
src/app/api/content-items/[id]/route.ts
src/app/api/material-cards/route.ts
src/app/api/content-items/[id]/annotations/route.ts
src/lib/data-isolation.ts
```

当前风险：

`GET /api/content-items/[id]` 文章详情接口可能直接 include：

```ts
materialCards
annotations
```

但只校验了用户能否访问文章本身，没有继续按当前用户过滤素材卡和批注。

多人场景下，如果 A 和 B 都能访问同一篇 public 文章，A 可能在文章详情响应里看到 B 的素材卡或批注。

修复要求：

1. 普通用户只能看到自己的 `MaterialCard.ownerUserId = currentUser.id`。
2. 普通用户只能看到自己的 `ArticleAnnotation.userId = currentUser.id`。
3. 管理员可以看到全部。
4. legacy 数据 `ownerUserId = null` / `userId = null` 是否可见必须重新评估，默认不要暴露给普通用户。
5. 如果文章详情不需要返回素材卡/批注，建议移除 include，让前端分别调用已隔离的接口。
6. 新增单元测试和 E2E/API 测试。

验收标准：

- 用户 A 访问公共文章详情，看不到用户 B 的素材卡。
- 用户 A 访问公共文章详情，看不到用户 B 的批注。
- 管理员可以看到全部。
- 未登录访问受保护接口返回 401。
- 普通用户访问未审核文章返回 404 或 403，不能泄露存在性。

---

## P0-002：修复收藏配额 TOCTOU 并发漏洞

重点检查：

```txt
src/lib/favorite-quota.ts
src/app/api/favorites/route.ts
src/app/api/favorites/[id]/route.ts
prisma/schema.prisma
```

当前风险：

收藏逻辑类似：

```txt
先 getFavoriteLimits
再 getCurrentFavoriteCount
再判断是否超额
再 transaction insert
```

这会产生 TOCTOU 竞态。多人使用时，两个并发请求可能都通过 count 检查，然后都 insert，导致突破收藏上限。

修复要求：

1. 配额检查和写入必须放在同一个并发安全流程中。
2. 不允许事务外 count 后事务内 insert。
3. 同一 userId 的收藏配额检查必须串行化。
4. 可以使用 PostgreSQL advisory lock、SELECT FOR UPDATE、原子 usage 表或等价方案。
5. `@@unique([userId, contentItemId])` 只能防重复收藏，不能当作配额并发控制。
6. 重复收藏同一文章应幂等处理。
7. 并发收藏不同文章时不能突破配额。

推荐方案之一：

```sql
SELECT pg_advisory_xact_lock(hashtext($userId));
```

在事务内：

1. 锁定当前 userId。
2. 查询 roleQuota。
3. 查询当前收藏数量。
4. 查询本批 eligible 且未收藏文章。
5. 判断新增数量是否超过 limit。
6. 批量 createMany skipDuplicates。
7. 返回 added / skipped / alreadyFavorited。

验收标准：

- 用户剩余 1 个收藏名额时，并发 10 个请求收藏 10 篇不同文章，最终只能新增 1 篇。
- 同一文章重复收藏不产生重复记录。
- 超额时返回明确中文错误。
- 前端显示友好提示。
- 单元测试覆盖普通收藏、重复收藏、超额、并发。

---

## P0-003：修复素材卡生成任务限流并发问题

重点检查：

```txt
src/app/api/content-items/[id]/generate-card/route.ts
src/lib/async-task.ts
src/services/ai.ts
prisma/schema.prisma
```

当前风险：

`checkTaskRateLimit()` 通过 count 检查：

```txt
PENDING / RUNNING 数量
今日任务数量
```

但多个请求并发进入时，都可能通过检查，然后一起 createAsyncTask。

另外当前 async task queue 存在 `globalThis` 内存里。多人部署时有风险：

- 服务重启任务丢失；
- 多进程 / 多 Docker 副本之间不共享队列；
- DB 中 PENDING 任务可能没有 worker 执行；
- 全局并发只在单进程生效。

修复要求：

1. 用户任务限流必须并发安全。
2. 任务创建和限流检查必须原子化。
3. 同一用户不能突破并发任务限制。
4. 同一用户不能突破每日任务限制。
5. 同一用户同一文章同一卡片类型不能并发生成重复任务或重复卡片。
6. `MaterialCard` 的 partial unique index 必须真实存在并有验证。
7. 评估是否将内存队列升级为 DB worker。
8. 如果暂不重构 DB worker，必须在报告里明确风险和上线限制。

推荐方向：

- 给 `AsyncTask` 增加唯一约束或业务幂等 key，例如：

```txt
userId + type + contentItemId + cardType + status in PENDING/RUNNING
```

- 或新增 `dedupeKey` 字段：

```txt
CARD_GENERATE:${userId}:${contentItemId}:${cardType}
```

- 创建任务时使用事务 + 锁。
- worker 领取任务时使用 DB 原子 update，而不是只依赖内存队列。

验收标准：

- 用户并发点击生成同一种素材卡，只产生一个任务或一个素材卡。
- 用户超过并发任务数返回 429。
- 用户超过每日任务数返回 429。
- 服务重启后的 PENDING 任务处理策略明确。
- 有测试覆盖重复点击、并发请求、任务失败、重试。

---

## P0-004：修复 E2E storageState 污染，重建权限测试可信度

重点检查：

```txt
playwright.config.ts
e2e/global-setup.ts
e2e/api-security.spec.ts
e2e/data-isolation.spec.ts
e2e/helpers/auth.ts
```

当前风险：

Playwright 全局使用 admin storageState，导致很多“未登录 401”测试实际可能带 admin cookie，测试不可信。

修复要求：

1. 不要让所有测试默认 admin 登录。
2. 拆分四类认证状态：
   - anonymous
   - user
   - verifiedUser
   - admin
3. 未登录测试必须显式清空 storageState。
4. 普通用户、认证用户、管理员必须有独立 storageState。
5. 用户 A / 用户 B 必须有独立账号和隔离测试。
6. 修复原有 16 个未认证 401 用例。
7. 所有权限测试必须真实断言 401 / 403 / 404 / 200。

推荐 Playwright project：

```ts
projects: [
  { name: "anonymous", use: { storageState: { cookies: [], origins: [] } } },
  { name: "user", use: { storageState: ".auth/user-storage.json" } },
  { name: "verified", use: { storageState: ".auth/verified-storage.json" } },
  { name: "admin", use: { storageState: ".auth/admin-storage.json" } }
]
```

必须覆盖：

- 未登录访问保护接口 → 401
- USER 访问 admin API → 403
- VERIFIED_USER 访问 admin API → 403
- ADMIN 访问 admin API → 200
- 用户 A 看不到用户 B 的素材卡
- 用户 A 看不到用户 B 的批注
- 用户 A 不能删除用户 B 的数据
- 普通用户不能访问 AI 管理配置
- 普通用户不能访问 WeWe RSS 管理配置

---

# P1：多人使用前建议修复

## P1-001：修正 ownerScopeWhere 的 legacy null 数据暴露风险

重点检查：

```txt
src/lib/data-isolation.ts
src/app/api/material-cards/route.ts
src/app/api/sync-records/route.ts
src/app/api/content-items/[id]/annotations/route.ts
```

当前风险：

`ownerScopeWhere()` 对普通用户返回：

```ts
OR: [
  { ownerUserId: user.id },
  { ownerUserId: null }
]
```

这可能导致普通用户看到历史公共素材卡或历史同步记录。

修复要求：

1. 文章 public 可见逻辑和用户资产 owner 可见逻辑必须分离。
2. `ContentItem` 可以 public。
3. `MaterialCard`、`ArticleAnnotation`、`SyncRecord`、`UserIntegration`、`ImaTarget` 这类用户资产默认只能 owner 或 admin 可见。
4. legacy null 数据默认只给 ADMIN 看，除非业务明确允许普通用户看。
5. 更新文档说明 legacy 数据处理策略。

建议新增 helper：

```ts
contentVisibilityWhere(user)
ownedResourceWhere(user, fieldName)
legacyAdminOnlyWhere(user, fieldName)
canAccessOwnedResource(user, ownerId)
```

---

## P1-002：收紧 POST /api/content-items 权限

重点检查：

```txt
src/app/api/content-items/route.ts
```

当前风险：

任何登录用户都可能创建文章内容，并且可能设置为 public。

修复要求：

根据产品定位二选一：

### 方案 A：普通用户不能导入文章

直接将 `POST /api/content-items` 改为 `requireAdmin`。

### 方案 B：允许用户投稿

则必须实现投稿隔离：

1. 普通用户创建的内容默认 `visibility = private`。
2. 普通用户创建的内容默认 `adminReviewStatus = pending_admin`。
3. sourceId 必须合法，不允许空字符串。
4. 用户投稿不能污染管理员采集源。
5. originalUrl 全局唯一冲突要有合理提示。
6. 管理员审核通过后才 public。

请先评估现有产品逻辑，再选择方案。不要擅自扩大普通用户权限。

---

## P1-003：修复用户素材卡编辑/删除权限

重点检查：

```txt
src/app/api/material-cards/[id]/route.ts
```

当前风险：

`GET` 允许用户访问自己的素材卡，但 `PUT` 和 `DELETE` 只有 ADMIN 能操作。若产品目标是“用户私有素材卡”，则用户应该能编辑/删除自己的卡。

修复要求：

1. 登录用户可以编辑自己的素材卡。
2. 登录用户可以删除自己的素材卡。
3. 管理员可以管理全部。
4. 用户 A 不能编辑/删除用户 B 的素材卡。
5. USER 是否允许编辑素材卡要根据产品角色规则确认；如果 USER 不能生成素材卡，但历史上有卡，需要明确策略。
6. 新增 API 测试和 E2E 测试。

---

## P1-004：修复 Prisma 7 + tsx seed 脚本问题

重点检查：

```txt
prisma/schema.prisma
prisma.config.ts
src/scripts/seed-role-quotas.ts
package.json
src/generated/prisma
docs/handoff/FINAL-development-report.md
```

当前问题：

`pnpm seed:role-quotas` 依赖 `../generated/prisma`，但文档记录存在 `src/generated/prisma/index.json` 找不到的问题。

修复要求：

1. 找出真实原因。
2. 修复 Prisma 7 client 生成和 tsx 动态 import 的兼容问题。
3. `pnpm exec prisma generate` 后，`pnpm seed:role-quotas` 必须稳定运行。
4. 不允许 staging 部署依赖手动 psql。
5. 更新部署文档。
6. 验证 RoleQuota 表默认值：
   - USER = 100
   - VERIFIED_USER = 300
   - ADMIN 不入库，不限额。

---

## P1-005：整理数据库 migration drift

当前文档记录：

```txt
本地 dev 库有 7 张表不在 migration 历史
```

修复要求：

1. 对比 `prisma/schema.prisma` 和 `prisma/migrations`。
2. 检查本地 dev、staging、production 的 migration 状态。
3. 不得 reset 生产库。
4. 不得破坏线上数据。
5. 补齐必要 migration。
6. 对已存在生产表，使用安全的幂等 migration。
7. 输出数据库迁移说明。
8. 验证：

```bash
pnpm exec prisma migrate status
pnpm db:migrate
pnpm exec prisma generate
pnpm seed:role-quotas
```

---

# P2：修完 P0/P1 后处理

## P2-001：修复 TypeScript 类型检查问题

文档记录多个测试文件存在 TypeScript 小错误，`vitest` 能跑但 `tsc --noEmit` 会报错。

要求：

1. 跑：

```bash
pnpm tsc --noEmit
```

或项目实际 typecheck 命令。

2. 修复 annotations、login、review 等测试文件的类型错误。
3. 不允许大面积使用 any 糊弄。
4. 不允许关闭 typecheck 掩盖问题。

---

## P2-002：评估 ArticleChecklist 是否接入 explore/discover

当前不是安全问题，低优先级。

要求：

1. 评估组件现状。
2. 如果改动小，可以接入。
3. 如果改动大，形成独立 issue。
4. 不得影响收藏、详情页、素材卡主流程。

---

# 必须新增或修复的测试

## 单元测试 / 集成测试

必须覆盖：

1. 文章详情不会返回其他用户素材卡。
2. 文章详情不会返回其他用户批注。
3. 管理员文章详情可以看到全部。
4. 收藏配额并发不能突破。
5. 重复收藏同一文章幂等。
6. 超过收藏上限返回 400 或业务约定状态。
7. 生成素材卡并发不能重复创建。
8. 用户任务限流不能被并发绕过。
9. USER 不能生成素材卡。
10. VERIFIED_USER 可以生成自己的素材卡。
11. 用户 A 不能编辑/删除用户 B 的素材卡。
12. 用户可以编辑/删除自己的素材卡。
13. 普通用户不能访问 admin API。
14. 普通用户不能访问 WeWe RSS 管理配置。
15. 普通用户不能访问系统 AI 配置。

## Playwright E2E

必须覆盖四类身份：

```txt
anonymous
userA
userB
verifiedUser
admin
```

测试场景：

1. anonymous 访问保护 API → 401。
2. userA 访问 admin API → 403。
3. verifiedUser 访问 admin API → 403。
4. admin 访问 admin API → 200。
5. userA 收藏文章后，userB 的“我的文章”看不到。
6. userA 生成素材卡后，userB 看不到。
7. userA 创建批注后，userB 看不到。
8. userA 删除自己的收藏，只删除自己的卡，不影响 userB。
9. 管理员审核文章后，普通用户才能看到。
10. 未审核文章不能通过 ID 访问泄露。

---

# 必须运行的命令

请根据项目实际 package scripts 调整，但至少运行：

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm exec prisma generate
pnpm exec prisma migrate status
pnpm seed:role-quotas
pnpm tsc --noEmit
```

如果 `pnpm tsc --noEmit` 不是项目脚本，也必须说明实际类型检查命令。

如果某个命令失败：

1. 不允许跳过。
2. 必须记录失败原因。
3. 必须修复后重跑。
4. 如果确实是环境限制，必须给出证据和人工复现步骤。

---

# Git 提交要求

每完成一个小阶段提交一次：

```bash
git status
git add .
git commit -m "fix(security): isolate article detail child resources"
git commit -m "fix(favorites): make quota checks concurrency-safe"
git commit -m "fix(tasks): harden async task rate limiting"
git commit -m "test(e2e): split auth storage states"
git commit -m "fix(db): stabilize prisma seed scripts"
```

提交信息必须清晰，不要把大量无关修改塞进一个 commit。

---

# 最终交付报告必须回答

完成后请明确输出：

1. P0 修复了哪些？
2. P1 修复了哪些？
3. P2 修复了哪些？
4. 哪些问题暂缓，为什么？
5. 是否可以继续多人使用？
6. 是否建议扩大用户量？
7. 数据库是否需要人工执行 migration？
8. staging / production 部署前需要我确认什么？
9. 所有测试命令结果是什么？
10. 有没有仍然不可信的测试？
11. 有没有可能影响现有用户数据的变更？

---

# 禁止事项

严禁：

1. 只改前端，不改后端权限。
2. 只隐藏按钮，不加 API 权限校验。
3. 只靠 unique index 解决配额并发。
4. 事务外 count 后事务内 insert。
5. reset 生产数据库。
6. 删除历史数据来掩盖 migration drift。
7. 测试失败却写通过。
8. storageState 污染未登录测试。
9. 使用管理员 cookie 假装普通用户测试。
10. 大面积 any 掩盖类型错误。
11. 把用户 A/B 数据隔离只写单测，不做 E2E。
12. 继续新增 UI 功能而不处理 P0 安全问题。

---

# 开始方式

请先执行以下工作：

1. 阅读以下重点文件：

```txt
src/app/api/content-items/[id]/route.ts
src/app/api/favorites/route.ts
src/lib/favorite-quota.ts
src/app/api/content-items/[id]/generate-card/route.ts
src/lib/async-task.ts
src/lib/data-isolation.ts
src/app/api/material-cards/[id]/route.ts
src/app/api/content-items/route.ts
playwright.config.ts
e2e/global-setup.ts
e2e/api-security.spec.ts
e2e/data-isolation.spec.ts
prisma/schema.prisma
src/scripts/seed-role-quotas.ts
package.json
docs/handoff/FINAL-development-report.md
```

2. 生成：

```txt
docs/audit/multi-user-hardening-todolist.md
```

3. 按 P0/P1/P2 拆成小任务。
4. 每个小任务写清：
   - 问题
   - 影响
   - 修法
   - 涉及文件
   - 测试方式
   - 完成状态
5. 等 Todo 写完后，再开始改代码。
