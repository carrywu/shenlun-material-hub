# 2026-06-08 边界审计开发 Todolist

> 目标：自主审查、修复项目边界问题，循环验证直到达到可交付状态。  
> 分支：`audit/boundary-hardening-2026-06-08`  
> 状态说明：`[ ]` 未开始，`[~]` 进行中/待复测，`[x]` 已完成，`[!]` 阻塞/需决策。

## 总进度

- [x] SETUP-001：创建边界审计追踪文档（报告 / todolist / handoff / validation）
- [x] P0-001：素材卡生成权限、重复判断、异步任务归属边界
- [x] P0-002：同步状态与同步历史 owner scope 边界
- [x] P1-001：手动内容导入 `sourceId` 外键与输入边界
- [ ] P1-002：`/api/discover` 可见性过滤边界
- [ ] P1-003：注册接口输入类型、邀请码审计脱敏和并发消耗边界
- [ ] P1-004：分页参数 NaN / 极值统一解析
- [ ] P2-001：微信手动导入 CollectorRun 异常终态
- [ ] P2-002：异步任务归属与任务可见性扫尾
- [ ] P2-003：相关 UI 错误态、重复点击和失败恢复
- [ ] P3-001：交叉审计扫尾
- [ ] P3-002：全量验证与最终交接

## SETUP：追踪与流程

### SETUP-001：创建边界审计追踪文档

- 严重级别：P0 前置
- 影响范围：`docs/audit/*`、`docs/testing/*`、`AGENT_HANDOFF.md`
- 复现/确认：用户要求每个问题闭环记录、维护文档、todolist、测试报告和 git 提交。
- 根因：既有审计文档为历史基线，不包含本轮 2026-06-08 边界审计的问题编号、状态、测试与提交映射。
- 修复计划：创建本文件并在审计报告、测试报告、交接文档追加本轮章节。
- 测试计划：文档变更不运行代码测试；提交前检查 git diff，确认未包含敏感/生成文件。
- 状态：`[x]` 已完成。
- Commit：本次文档初始化提交。

## P0：权限 / 数据隔离阻塞项

### P0-001：素材卡生成权限、重复判断、异步任务归属边界

- 严重级别：P0
- 影响范围：`src/app/api/content-items/[id]/generate-card/route.ts`、对应 route test、`src/lib/async-task.ts` 调用方式。
- 复现/确认步骤：
  1. 阅读 POST route，确认 `findUnique({ id })` 后未调用 `canAccessResource`。
  2. 阅读 `runGenerateCardTask`，确认异步执行时再次无权限校验。
  3. 确认 duplicate check 只按 `{ contentItemId, cardType }`，未按 `ownerUserId` 隔离。
  4. 确认 `createAsyncTask` 未传 `user.id`，`checkTaskRateLimit` 未使用。
- 根因：异步任务引入后只校验登录/verified 身份，未复用项目已有 data isolation helper。
- 修复计划：入队前和任务执行时校验访问权；owner-scoped duplicate；任务限流；任务记录 userId。
- 已完成修复：
  - 入队前使用 `canAccessResource(user, item.ownerUserId, item.visibility)` 拦截他人私有内容。
  - 异步执行函数接收 `AuthUser` 并再次校验访问权。
  - 重复卡查询改为 `{ contentItemId, cardType, ownerUserId: user.id }`，避免跨用户互相阻塞。
  - 调用 `checkTaskRateLimit(user.id)`，超限返回 429 且不入队。
  - `createAsyncTask(..., user.id)` 记录任务归属。
- 测试结果：
  - `pnpm exec vitest run 'src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts'`：PASS，1 file / 7 tests。
  - `pnpm lint`：PASS，0 errors / 16 warnings（warnings 为既有 unused 变量）。
  - `pnpm exec tsc --noEmit`：FAIL，失败来自既有测试类型问题（`NODE_ENV` readonly、旧测试 `Request` vs `NextRequest`、backup test 重复属性等），未指向本次修改文件；已记录到测试报告。
- 状态：`[x]` 已完成。
- Commit：本次 P0-001 修复提交。

### P0-002：同步状态与同步历史 owner scope 边界

- 严重级别：P0
- 影响范围：`src/app/api/sync/route.ts`、`src/services/ima-sync.ts`、相关 tests。
- 复现/确认步骤：
  1. 阅读 GET `/api/sync`，确认 `syncRecordId` 分支调用 `getSyncStatus(syncRecordId)` 未传用户。
  2. 确认 `cardId` 分支调用 `getSyncHistory(cardId, limit)` 未校验 card owner。
  3. 对比 `/api/sync-records` 已使用 `ownerScopeWhere(user, "userId")`。
- 根因：列表接口已加 owner scope，但详情/历史快捷查询未同步加固。
- 修复计划：服务函数接收用户并 owner-scope 查询；他人记录返回 404/403；limit 安全解析。
- 已完成修复：
  - `getSyncStatus(syncRecordId, user)` 改为 `findFirst` 并合并 `ownerScopeWhere(user, "userId")`。
  - `getSyncHistory(cardId, user, limit)` 先按 `ownerScopeWhere(user, "ownerUserId")` 校验素材卡访问权，再按 sync record `userId` 过滤历史。
  - `/api/sync` GET 传入当前 user，malformed/超大 limit 使用安全解析回退或 cap。
  - 不存在或不可访问的 sync record/card history 返回 404，避免 500 和资源存在性泄漏。
- 测试结果：
  - `pnpm exec vitest run src/app/api/sync/__tests__/route.test.ts src/services/__tests__/ima-sync-ownership.test.ts`：PASS，2 files / 9 tests。
  - `pnpm lint`：PASS，0 errors / 16 warnings（warnings 为既有 unused 变量）。
- 状态：`[x]` 已完成。
- Commit：本次 P0-002 修复提交。

## P1：主要边界缺陷

### P1-001：手动内容导入 `sourceId` 外键与输入边界

- 严重级别：P1
- 影响范围：`src/app/api/content-items/route.ts`、对应 route test。
- 复现/确认步骤：阅读 POST route，确认缺失 sourceId 会写入 `sourceId: sourceId ?? ""`，无效 sourceId 未返回控制错误。
- 根因：API 注释与实现不一致；Prisma 外键必填但 route 未强制解析有效 source。
- 修复计划：sourceId 必填且存在；title/originalUrl 类型和 trim；duplicate check 使用 trimmed URL；数组字段类型保护。
- 已完成修复：
  - `title` / `originalUrl` 必须为字符串且 trim 后非空。
  - `sourceId` 必填、trim 后非空，且必须能查到 `Source`；缺失/空值返回 400，无效 ID 返回 404。
  - duplicate URL 检查与 create 均使用 trimmed URL。
  - create 写入真实 `source.id`，并从 source 派生 `platform/contentType/trustLevel`，避免客户端伪造或外键 500。
  - `topicTags` / `regionScopes` 仅接受数组，否则回退 `[]`；非字符串 `excerpt/fullText` 做 null 处理。
- 测试结果：
  - `pnpm exec vitest run src/app/api/content-items/__tests__/route.test.ts`：PASS，1 file / 5 tests。
  - `pnpm lint`：PASS，0 errors / 16 warnings（warnings 为既有 unused 变量）。
- 状态：`[x]` 已完成。
- Commit：本次 P1-001 修复提交。

### P1-002：`/api/discover` 可见性过滤边界

- 严重级别：P1
- 影响范围：`src/app/api/discover/route.ts`、discover/API security tests。
- 复现/确认步骤：阅读 route，确认只过滤 verified source，未合并 `visibility` / `ownerUserId` 条件。
- 根因：discover public feed 未复用 `/api/articles` 的匿名/登录可见性策略。
- 修复计划：保持 public feed；anonymous 仅 public+legacy；authenticated 使用 `contentVisibilityWhere`；admin all；safe pagination。
- 测试计划：anonymous/user/admin 可见性矩阵、malformed page/pageSize。
- 状态：`[ ]` 未开始。
- Commit：待提交。

### P1-003：注册接口输入类型、邀请码审计脱敏和并发消耗边界

- 严重级别：P1
- 影响范围：`src/app/api/auth/register/route.ts`、register route tests。
- 复现/确认步骤：阅读 route，确认 JSON body 字段未校验类型即 `.length`/regex/`.slice`；expired/exhausted 审计记录明文 code。
- 根因：注册接口沿用 happy-path string 假设，未覆盖恶意/异常 JSON 类型。
- 修复计划：字段必须为 string；normalize username/code；所有审计路径脱敏；稳定处理 exhausted invitation。
- 测试计划：number/object/null body 400；trim duplicate；audit mask；exhausted 400。
- 状态：`[ ]` 未开始。
- Commit：待提交。

### P1-004：分页参数 NaN / 极值统一解析

- 严重级别：P1
- 影响范围：`src/lib/api-params.ts`（新增）与多个 `src/app/api/**/route.ts`。
- 复现/确认步骤：搜索 `Math.max(1, parseInt(...))`，确认 malformed input 会产生 NaN。
- 根因：多路由复制本地 parseInt 模式，缺少共享边界 helper。
- 修复计划：新增 helper；替换暴露 API 的 page/pageSize/limit 解析。
- 测试计划：helper 单测 + 代表 route malformed 参数回归。
- 状态：`[ ]` 未开始。
- Commit：待提交。

## P2：可靠性与 UI 边界

### P2-001：微信手动导入 CollectorRun 异常终态

- 严重级别：P2
- 影响范围：`src/app/api/collectors/wechat/import/route.ts`、对应 route test。
- 复现/确认步骤：阅读 route，确认创建 running run 后若后续异常进入 outer catch，可能不更新 failed。
- 根因：CollectorRun 生命周期无 finally/catch 兜底。
- 修复计划：outer scope 保存 runRecordId；catch 中更新 failed/finishedAt/errorSummary。
- 测试计划：模拟 run 创建后失败，断言 update failed。
- 状态：`[ ]` 未开始。
- Commit：待提交。

### P2-002：异步任务归属与任务可见性扫尾

- 严重级别：P2
- 影响范围：所有 `createAsyncTask(` 调用点、admin task API。
- 复现/确认步骤：搜索 async task 创建调用，分类 user-triggered vs admin/system。
- 修复计划：user-triggered task 传 userId；确认 task result 不泄漏 secrets。
- 测试计划：依改动补 targeted tests。
- 状态：`[ ]` 未开始。
- Commit：待提交。

### P2-003：相关 UI 错误态、重复点击和失败恢复

- 严重级别：P2
- 影响范围：`SyncToIma.tsx`、`ArticleDetail.tsx`、discover 页面、`WechatImportDialog.tsx` 等实际受 API 改动影响的组件。
- 修复计划：仅针对本轮新增/改变的 400/403/404/409/429 错误补可读文案和 loading/disabled 恢复，不做无关 UI 重写。
- 测试计划：组件测试或 Playwright 真实点击。
- 状态：`[ ]` 未开始。
- Commit：待提交。

## P3：收口

### P3-001：交叉审计扫尾

- 搜索范围：unscoped `findUnique/findFirst`、auth route 缺少 data isolation、unsafe parseInt、async task ownership、raw HTML sink、running collector run。
- 状态：`[ ]` 未开始。

### P3-002：全量验证与最终交接

- 命令：`pnpm lint`、`pnpm exec tsc --noEmit`、`pnpm test`、`pnpm build`、`pnpm exec playwright test`。
- 浏览器/E2E 关键页：`/integrations/wewe-rss`、`/subscriptions`、`/articles/[id]`、`/materials` 或实际 `/cards`、`/sources`。
- 状态：`[ ]` 未开始。
