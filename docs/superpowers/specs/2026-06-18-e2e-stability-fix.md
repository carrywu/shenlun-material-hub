# E2E 测试稳定性回归 — 诊断与修复开发文件

> 生成日期：2026-06-18（开发跨日到 06-19）
> 状态：进行中（Phase 0 诊断）
> 来源：全量 5-project 回归暴露 682 确定性失败
> 分支：`fix/full-audit-p0-p1`

## 1. Problem Summary

全量 5-project Playwright（`pnpm exec playwright test --retries=1`，2.5h）：
```
1131 passed / 785 failed / 3 flaky / 127 skipped / 69 did not run
```
- 785 failed 中 **682 = 确定性失败**（failed + retry#1 也 failed），仅 4 个被 retry 救回（真 flaky）。
- ✅ **P0 关键 bug 指标全 0**：`Expected: not 401`=0、`location is not defined`=0、`uncaughtException`=0。本分支真正修的 P0/P1 业务 bug（owner 隔离 / 强制登录 / 禁 env fallback 等 9 项）确认全修好。
- ❌ 剩余失败几乎全是**测试稳定性**问题，不是业务 bug。

**结论**：不可直接 push/merge（CLAUDE.md：禁止 skip/fixme 掩盖失败测试）。必须先诊断根因 + 修复，admin isolated 达 **0 failed** 才合并。

## 2. Current Behavior（已确证事实）

> 以下均为本人亲自跑的实验，不是猜测。

| 编号 | 事实 | 证据 |
|------|------|------|
| **F1** | admin 单 worker isolated（`--project=admin --workers=1 --retries=0`，37min）= **267 passed / 127 failed / 24 skipped / 5 did not run** | `admin-isolated.log` |
| **F2** | `e2e/cards.spec.ts` 单独跑 = **11/11 全过** | `pnpm exec playwright test e2e/cards.spec.ts --project=admin --workers=1 --retries=0` |
| **F3** | 同份 cards 在 admin 全量序列里 = **11/11 全失败**（找不到 `cards-page-header`） | `admin-isolated.log` |
| **F4** | 探针访问 /cards（admin storageState）= STATUS 200，`cards-page-header` 正常渲染，body 完整 | 临时探针 spec |
| **F5** | `page.route` mock **不跨 test 残留**（已证伪污染假说）：两 spec 串联，A 注册 `**/api/material-cards**` mock 不清理，B 访问 /cards = POLLUTED=false，cards 正常 | 决定性实验 |
| **F6** | 失败断言分布：65 次 `toBeVisible`，其中 **51 次是 `xxx-page-header`**（article-detail 12 / wechat-rss 10 / review 8 / sources 6 / settings-ai 6 / cards 6 / sync-records 2…） | `admin-isolated.log` grep |
| **F7** | `cards-page-header`（`src/app/cards/page.tsx:209`）是 client component **同步首次渲染**就出现、**不依赖任何 fetch**、在 loading 分支（line 336）之前 | 源码核查 |
| **F8** | cards 页有 loading / error / 空态三态可作数据契约（`page.tsx:79,336`） | 源码核查 |
| **F9** | ART-016/018 = Class D 把 `waitForLoadState('networkidle')` 换成 `domcontentloaded` + `expect(getByTestId('article-detail-page-header')).toBeVisible({timeout:15000})`。article-detail 是 client component，header 在 fetch 后渲染。baseline（Class D 前）用 networkidle + 不断言 header = 能过。**真·Class D 回归** | `git show 434c2fc:e2e/articles-enhanced.spec.ts` 对比 |
| **F10** | ES-007 断言 `getByText('文章不存在')`，但页面 404 实际渲染「请求失败」（fetch throw `"请求失败"`）。baseline 也这么写。**历史坏断言**，与 Class D 无关 | `git show 434c2fc` 对比 + 探针 |
| **F11** | 配置 `reuseExistingServer: !process.env.CI`（本地复用 dev server，CI 全新）；retries CI=2 / 本地=1 | `playwright.config.ts` |

### 关键推论（由 F2/F3/F4/F7 直接推出）

`cards-page-header` 同步渲染、不需 fetch，序列里 100% 不可见 ⇒ 该测试执行时 `/cards` **根本没到达 client 渲染**（导航挂起 / hydration 卡死 / 被重定向 / 401）。**这不是断言写错，是执行环境在序列后期退化。** 修复必须先定位「为什么序列后期页面打不开」，而不是改断言。

## 3. Root Cause（已诊断确证，2026-06-19）

### 诊断结论

- **H1（dev server 复用退化）❌ 证伪**：Exp-1 CI 模式全新 dev server，admin isolated 仍 **127 failed**（与复用基线完全一致）。非 dev server 问题。
- **H3（cookie 失效-过期）❌ 排除**：storageState cookie expires 在未来（新鲜）。
- **PG 连接池 ❌ 排除**：跑中查 pg_stat_activity，1 active + 1 idle，远未达 max 20。
- **F5（page.route 跨 test 污染）❌ 证伪**：两 spec 串联实验，B 未被污染。
- **H4（ART-016/018 真·Class D 回归）✅ 确证**：Exp-5 单跑就跪，独立于序列（~17 个）。
- **H5（ES-007 历史坏断言）✅ 确证**：单跑就跪（1 个）。
- **H2（真·测试间串扰）✅ 确证，主因**：见下方根因。

### ★ 主因根因：auth.spec.ts 登出测试 revoke 了共享 admin session（H2）

**二分定位**（CI 模式单 worker）：
- 前置 13 spec + cards → cards **11 失败**（污染存在）。
- 前 7 spec + cards → cards 0 失败（前 7 无辜）。
- api-security + article-detail + articles-enhanced + cards → 0 失败（无辜）。
- articles / auth / bugfix-regression 逐个 + cards → **仅 `auth.spec.ts + cards` = cards 11 失败**。其余 0。

**确证因果**：
1. `globalSetup`（`e2e/global-setup.ts:134`）为 admin 登录生成 token **T1**，写 `.auth/admin-storage.json`。全量序列开头只跑一次。
2. `auth.spec.ts:266-290` 登出测试用 `.auth/admin-storage.json`（token **T1**）→ 点「退出」→ `POST /api/auth/logout` → `revokeSession(T1)`（`src/app/api/auth/logout/route.ts:26`）**从 DB 删除 T1**。
3. `.auth/admin-storage.json` 文件不变，仍存 T1。
4. 序列后续所有用 `.auth/admin-storage.json` 的 spec（cards / wechat-rss / review / settings / sources / ai-config / sync-records 等 admin-gated）拿 **T1** → 服务端 `validateSession(T1)` 查不到 → **401 / 重定向 /login** → client 页面不渲染 → page-header testid 永不出现 → 全跪。
5. cards 单跑过：因为单跑时 global-setup 重新登录生成**新 token** 覆盖文件（T1 失效但文件已刷新）。

**DB 佐证**：登出后查 `.auth/admin-storage.json` 的 token 在 `Session` 表 → **0 行**（已被 revoke）。

**失败画像**：127 = 大部分（~109）admin-gated spec 因 T1 失效 + 17（ART-016/018 H4）+ 1（ES-007 H5）。

### Root Cause Hypotheses（历史，诊断过程记录）

| 编号 | 假设 | 结论 |
|------|------|------|
| **H1** | dev server 长跑累积变慢 | ❌ Exp-1 证伪 |
| **H2** | 真·测试间状态串扰 | ✅ **主因**：auth.spec.ts 登出 revoke 共享 token |
| **H3** | storageState cookie 过期失效 | ❌ 排除（cookie 新鲜）|
| **H4** | ART-016/018 真·Class D 回归 | ✅ 确证（~17 个，独立）|
| **H5** | ES-007 历史坏断言 | ✅ 确证（1 个，独立）|

## 4. Diagnostic Experiments（只读 / 可回退，独立 worktree）

### Exp-1（决定性）— CI 模式隔离 dev server 复用

```bash
CI=1 pnpm exec playwright test --project=admin --workers=1 --retries=0 --reporter=line 2>&1 | tee ci-admin-isolated.log
```
`CI=1` ⇒ `reuseExistingServer:false`（全新 server）。

**解读**：
- failed 大降（→ ≤ ~20）→ H1 主因（复用既有长跑 dev server）→ 落 **S1**。
- failed ≈ 127 不变 → 复用非主因 → Exp-2/3/4 区分 H1 的「长跑退化」vs H2/H3。

### Exp-5 — ART-016/018 与 ES-007 单跑（独立确认 H4/H5）

```bash
CI=1 pnpm exec playwright test e2e/articles-enhanced.spec.ts --project=admin --workers=1 --retries=0 -g "ART-016|ART-018"
CI=1 pnpm exec playwright test e2e/error-states.spec.ts --project=admin --workers=1 --retries=0 -g "ES-007"
```
单跑就跪 → 走 S2/S3，不计入 H1。

### Exp-2 — 全新 server 下失败 spec 单跑 + 预热后单跑（隔离 H1「长跑退化」）

```bash
for s in cards wechat-rss review settings sources sync-records; do
  CI=1 pnpm exec playwright test e2e/$s.spec.ts --project=admin --workers=1 --retries=0
done
# 预热对照：先跑前半 admin spec，再单独跑 cards
CI=1 pnpm exec playwright test e2e/admin.spec.ts e2e/cards.spec.ts --project=admin --workers=1 --retries=0
```
单跑全过 + 预热后 cards 复跪 → H1 确证。

### Exp-3 — 二分定位串扰源（仅 Exp-1/2 排除 H1 后，针对 H2）

取稳定复现失败的 spec（cards）为靶子，二分前置 spec 集合，收敛最小污染集，检查未清理全局态。

### Exp-4 — storageState 有效性探针（针对 H3）

实验分支插只读探针：`page.request.get('/api/material-cards?page=1&pageSize=1')` 打 status。401 ⇒ H3；200 ⇒ 排除。

## 4b. 第二轮诊断发现（S-auth 修复后，剩余 50 失败深挖）

S-auth 修复后 admin isolated：**127 → 50 failed**（357 passed）。主因已根除，剩余 50 个单跑也跪（真·测试 bug，非污染），分三类新根因：

### H6 — 测试 mock 数据类型错误（articles-enhanced ART-016/DETAIL 类）

- `MOCK_DETAIL.aiCategories/aiScenarios/aiGoldenSentences` 给的是 **array**，但 API/schema（`prisma/schema.prisma:162` `String?`）和页面类型（`page.tsx:81` `string | null`）期望 **JSON string**。
- 页面 `parseStringList`（`page.tsx:197`）catch 分支对 value 调 `.split` → **`value.split is not a function`** → ErrorBoundary 显示「页面出错了」→ header 永不渲染。
- 探针确证：完整 MOCK_DETAIL mock → 页面 body 含「页面出错了 value.split is not a function」。
- baseline「碰巧过」：旧测试只 `expect(bodyText).toBeTruthy()`，「页面出错了」也 truthy。Class D 加强断言 page-header 后暴露。
- **修复（已做）**：MOCK_DETAIL 三字段改 `JSON.stringify([...])`（`articles-enhanced.spec.ts:506-511`）。17 → 10。
- **次生**：页面 `parseStringList` 对 array 输入无防御（真实 API 给 string 不触发，但防御差），后续可加固。

### H7 — testid 加错文件 / 断言文案脱节（ai-config）

- ai-config 测试访问 `/admin/settings/ai`（渲染 `AiConfigPage` 组件），但断言 `settings-ai-page-header`（testid 在 `/settings/ai/page.tsx` 前台页，line 164，不在 AiConfigPage）。
- AiConfigPage 实际有 `data-testid="ai-config-page"`（`AiConfigPage.tsx:205`）。
- 且测试断言「提示词配置」，但 AiConfigPage 标题是「AI 默认提示词模板」（`AiConfigPage.tsx:350`）。
- Class D Phase 0 给 /settings/ai/page.tsx 加 testid，但测试访问 /admin/settings/ai（不同路由）。testid 加错文件。
- **修复方向**：测试断言改用 AiConfigPage 实际元素（`ai-config-page` + 「AI 默认提示词模板」/「服务配置」）。⚠️ 注意 `ai-config-page` 在 loading 后渲染，需等真实数据。

### H5（扩展）— error-states 多个断言文案脱节

- ES-007（404 显示「请求失败」非「文章不存在」）+ ES-004（搜索「未找到匹配」）+ 卡生成/AI 配置测试失败，多是断言文案与实际 UI/mock 不符。需逐个核对。

## 5. Fix Strategies by Root Cause

> 约束：禁止 skip/fixme；禁止扩大 timeout / waitForTimeout；禁止 mock 掩盖真实权限；修根因不修症状；小而可验证；改 API/service 核对 owner 隔离。

### S1 — 若 H1 确证（dev server 长跑退化）

根因：Next 16 dev server 单 worker 长压后退化，后期首次 client 渲染超时。

1. **治本首选**：本地 e2e 默认 CI 模式（全新 server）。改 `package.json` 的 `test:e2e` 加 `CI=1`，或新增 `test:e2e:clean`。验证 admin isolated 127 → ≤~20。
2. 保留本地复用体验：给 webServer 加 gracefulShutdown、禁 telemetry、关无关 watcher（缓解非根治）。
3. project 级 server 隔离：5 project 各起独立 server（复杂度高，备选）。

**禁止**：把 page-header 的 15000 加到 30000；`waitForTimeout`；skip 失败 spec。

### S2 — 若 H4 确证（ART-016/018 Class D 回归）

根因：article-detail client component，header 在 fetch 后渲染；`domcontentloaded` 在 fetch 完成前返回。Class D 移除 networkidle 是对的（Next 16 流式不稳），但替换方案不稳。

**模式（等真实数据，不回退 networkidle）**：给 article-detail 页加显式数据态契约 `data-state="loading|error|ready"`（或 loading 骨架 testid）。测试改：等 loading 出现 → 等 loading 消失 → 断言内容。

代表文件：`src/app/articles/[id]/page.tsx`、`e2e/articles-enhanced.spec.ts`（916/968 附近及所有 `article-detail-page-header` 行）。
判断标准：12 次失败 → 0，ART-016/018 单跑仍过。

### S3 — 若 H5 确证（ES-007 历史坏断言）

- **方案 A（改测试，推荐）**：确认 404 分支应显示什么。让 mock 走正确 404 渲染分支（返回 404 status 而非 500 throw），断言「文章不存在」。
- **方案 B（改页面）**：404 应显示「文章不存在」却显示「请求失败」→ 改页面文案。**动业务，PR 须标注 + 评估所有 404 路径。**

### S4 — 若 H2 确证（真·串扰）

定位到的 spec 加 `afterEach`/`afterAll` 清理（DB 回滚 / `unrouteAll` / 清 localStorage）。严守 owner 隔离 / 数据安全（仅 e2e DB）。

## 6. Verification Matrix

| 阶段 | 命令 | 通过标准 |
|------|------|---------|
| 诊断基线 | `pnpm exec playwright test --project=admin --workers=1 --retries=0` | 记录 127 |
| Exp-1 | `CI=1 pnpm exec playwright test --project=admin --workers=1 --retries=0` | failed 变化 |
| 每项修复后（admin） | 同基线命令 | 该类失败 → 0，无新增 |
| ART-016/018 | `... e2e/articles-enhanced.spec.ts -g "ART-016|ART-018"` | 2 用例过 |
| ES-007 | `... e2e/error-states.spec.ts -g "ES-007"` | 过 |
| **admin isolated 全绿门槛** | `pnpm exec playwright test --project=admin --workers=1 --retries=0` | **0 failed** |
| 其余 4 project isolated | 依次 anonymous/userA/userB/verified | 各自 0 failed |
| **合并门槛** | `pnpm exec playwright test`（5-project） | failed 大降，无新确定性失败 |
| 标准验证 | `pnpm harness:validate` | lint+test+build 过 |
| 视觉（若加 data-state） | `pnpm exec playwright test e2e/visual-regression.spec.ts` | 无视觉回归 |

声称「0 failed」前必须实际跑并贴日志（CLAUDE.md）。

## 7. Risks

- H1 误判（实为 H2）→ Exp-1/Exp-2 强制区分，不跳步。
- S2 加 data-state → 仅加 `data-*`，不改 DOM/文案/逻辑；跑 visual-regression。
- S3 方案 B 改文案动业务 → 优先方案 A；方案 B 须 PR 标注 + 评估所有 404 路径。
- 拆 project 独立 server 增复杂度 → 先用 S1 方案 1。
- owner 隔离/数据安全 → service 层复核 owner；破坏性操作 dry-run。
- 全新 server 启动慢 → webServer timeout 已 120s，必要时增至 180s（**启动超时，非测试 timeout**，不违反规则）。

## 8. Rollback

- 所有诊断在独立 worktree/分支，主工作树零改动，失败即丢弃。
- 修复按 S1→S2→S3 小步独立提交，每步可单独 `git revert`。
- `playwright.config.ts` / `package.json` 改动单独提交，便于回退「复用 dev server」旧行为。
- 页面 data-state / 文案改动单独提交，便于回退而不影响测试改动。
- 合并前保留一个「仅诊断、无修复」基线 commit 作对照锚点。

## 9. 执行顺序

1. Exp-1（CI 模式 admin isolated）判 H1 主因【~40min】
2. Exp-5（ART-016/018、ES-007 单跑）独立确认 H4/H5【~5min】
3. 据 Exp-1：failed≈127 → Exp-2/3/4 继续；failed 大降 → 落 S1
4. 落 S2（article-detail data-state）+ S3（ES-007）
5. admin isolated 0 failed → 其余 4 project isolated → 5-project 全量
6. 更新 `docs/audit/development-todolist.md`、`docs/audit/development-handoff.md`，开 PR

## 10. 关键文件

- `playwright.config.ts`（webServer reuseExistingServer / retries）
- `package.json`（test:e2e 脚本）
- `src/app/cards/page.tsx:79,209,336`（loading / page-header 三态）
- `src/app/articles/[id]/page.tsx`（data-state 契约、404 文案）
- `e2e/articles-enhanced.spec.ts`（ART-016/018）
- `e2e/error-states.spec.ts`（ES-007）
- `docs/handoff/NEXT-AGENT-HANDOFF.md`（历史背景）
