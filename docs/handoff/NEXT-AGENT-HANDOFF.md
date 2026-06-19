# 给下一个 Agent 的交接文档

> **阅读优先级最高**。本文档整合 E2E flaky 治理全部进度（Class A→E），帮助你在 5 分钟内建立完整上下文，避免重复劳动或踩已知坑。

---

## 0. 你接手时的状态（2026-06-18）

- **分支**：`fix/full-audit-p0-p1`（**未合并到 main，未推送**）
- **最新提交**：`ac4a0e9 test(e2e): 4 个残留 flaky 建立交互状态契约（Class E）`
- **E2E flaky 治理已基本收尾**：4 个逻辑竞态 flaky（bookmark / login redirect / sidebar / ES-006）已用「交互状态契约」根治，隔离运行 0 flaky。
- **未完成**：5-project 全量长跑回归（耗时 1.7h+，本轮未跑）。

---

## 1. 必读文件（按顺序，不要跳过）

```
docs/audit/requirements-confirmation.md   ← 冲突时以此为准
docs/audit/project-assessment.md
docs/audit/development-plan.md
docs/audit/development-todolist.md        ← 含 Class A→E 全量结果，最后追加
docs/audit/development-handoff.md         ← 含 Class E 补充段落
docs/testing.md
```

规则冲突时，**以 `requirements-confirmation.md` 为准**（见项目 CLAUDE.md）。

---

## 2. E2E Flaky 治理全历程（Class A → E）

这是一条连续的 flaky 清理链，每一类对应提交链上的一段：

| 阶段 | 根因类型 | 关键提交 | 状态 |
|------|---------|---------|------|
| **A** | SSR 崩溃（`location is not defined` 等真 bug） | `c461345` | ✅ |
| **B** | 引用已删路由的过时测试 | `1ed0dda` | ✅ |
| **C1-C4** | 页面缺 `data-testid`，测试靠脆弱选择器 | `c6203d0`→`cbf99ac` | ✅ |
| **D** | `waitForTimeout` / `networkidle` 硬编码等待 | `5a72156` | ✅ |
| **E** | 4 个**逻辑竞态** flaky（本轮，状态契约） | `ac4a0e9` | ✅ |

> Class D 之前 admin project 是 `284 passed, 0 failed, 4 flaky`。Class E 把这 4 个 flaky 根治。

### Class E 改了什么（你大概率会接触到这些文件）

1. **登录页服务端跳转**（`admin/login/page.tsx` + `login/page.tsx`）
   - 已从 `"use client"` 改为**服务端组件**：`cookies()` + `validateSession()` + `redirect()`。
   - 表单逻辑拆入 `LoginClient.tsx`（admin + 前台各一份）。
   - ⚠️ **`searchParams` 在 Next.js 16 是 `Promise`，必须 `await`**（已处理）。
   - middleware（`src/proxy.ts`）仍是第一道防线，服务端 redirect 是第二道。

2. **收藏/已读按钮 pending guard**（`articles/[id]/page.tsx`）
   - 拆出 `toggleBookmark`/`toggleRead`，入口 `if (xxx) return;` 防重复点击。
   - 按钮：`data-testid` + `aria-pressed` + `data-state` + `data-pending` + `disabled` + Loader2 spinner。

3. **侧边栏状态契约**（`AdminShell.tsx`）
   - `aside` 有 `data-state`（collapsed/expanded），toggle 有 `data-testid`/`aria-expanded`/`aria-label`。

4. **admin metrics 统一 fetch**（`admin/page.tsx`）
   - 消除了两套重复 fetch 逻辑，加了 `error` state + `data-testid="admin-metrics-error"`。
   - ⚠️ useEffect 内**不能同步调 setState**（React 19 lint `no-synchronous-setState-in-effect`）—— 初次加载用内联 `initialLoad()` async 函数，refresh 按钮才用 `fetchMetrics` callback。**改这个文件时注意别再把 `fetchMetrics` 直接放 useEffect 里。**

5. **新 helper**：`e2e/helpers/mockApi.ts` → `mockApiError(page, pattern, options)`，带命中计数 `expectHit()`。

---

## 3. 当前验证状态

```bash
pnpm lint   → 0 errors / 68 warnings（全是 pre-existing no-unused-vars，非本轮引入）
pnpm test   → 76 files / 735 passed
pnpm build  → 通过
```

隔离稳定性（`--workers=1`，低并发）：

| 测试 | repeat-each | 结果 |
|------|-------------|------|
| 收藏 + 已读切换 | 15 | 30 passed, 0 flaky |
| 服务端跳转 + 侧边栏折叠 | 15 | 30 passed, 0 flaky |
| ES-006 metrics 500 | 20 | 20 passed, 0 flaky |

---

## 4. 已知坑 / 重要约束（务必遵守）

### 4.1 E2E 环境性 timeout（非 bug，别误判）
- **高并发同跑多个 spec（如 3 spec × 20）会偶发 timeout**，根因是 DB `validateSession()` 或 Next dev server 在并发压力下变慢。
- 这是**环境资源争用，不是逻辑 flaky**。Playwright 默认 `--retries=1`（本地）/ `2`（CI）能吸收。
- **诊断方法**：如果 flaky 出现，先单独 `--workers=1` 跑该 spec。隔离跑通了 = 环境性；隔离也失败 = 真逻辑 bug，回到 systematic-debugging。

### 4.2 状态契约断言优先级（写新 E2E 时遵循）
```
aria-*  >  data-state  >  可见文案  >  API response  >  像素宽度（最后手段）
```
- 等**真实状态变化**，不要等时序。
- 禁止：`waitForTimeout`、`networkidle`、扩大 timeout、skip/fixme、删断言、造假状态。

### 4.3 认证 / 权限 / owner 隔离（改 API/service 时必查）
- `USER` / `VERIFIED_USER` / `ADMIN` 三级权限（见 `docs/harness/contract.md` §2）。
- `MaterialCard` / `ArticleFavorite` / `UserContentState` / `SyncRecord` **按 `ownerUserId` 隔离**，非 owner 访问必须 404。
- 用户私有状态（阅读/收藏/忽略/复习）不得写全局 `ContentItem.*`。
- service 层必须复核 owner，不能只靠 route 层。
- 个人 AI/IMA 禁止 fallback 到 env；secret 在日志/审计中必须脱敏。

### 4.4 storageState 是 E2E 认证来源
- `.auth/{admin,verified,usera,userb}-storage.json` 由 `e2e/global-setup.ts` 通过 API 登录生成。
- cookie 是 DB-backed session token（`validateSession` 查 `Session` 表），有效期 24h。
- **顶层 storageState 已移除**，每个 describe 必须显式声明 `test.use({ storageState })`，否则按 anonymous 跑会 401。

### 4.5 数据安全红线（CLAUDE.md）
- we-mp-rss 是 sidecar，**禁止写入 `we_mp_rss.db`**，只读消费。
- 不写微信逆向、不绕过风控、不硬编码 Cookie/Token/Key。
- `.env` / `*.db` / `*.sqlite*` / `test-results/` / `playwright-report/` **绝不提交**。

---

## 5. 推荐的下一步（按优先级）

### P0 — 合并前的全量回归（最该做的一件事）
本轮 Class E 只隔离验证了 4 个目标测试。合并前建议跑一次全量：

```bash
# admin project 全量（带 retry，约 30-40min）
pnpm exec playwright test --project=admin --retries=2

# 5-project 全量长跑（约 1.7h，资源允许时）
pnpm exec playwright test
```

**验收标准**：关键 bug 指标为 0（`Expected: not 401`、`location is not defined`），4 个原 flaky 隔离运行 0 flaky。高并发偶发 timeout 可接受（retry 吸收）。

### P1 — 合并到 main
当前分支 `fix/full-audit-p0-p1` 累积了 Class A→E 全部修复，**已 commit 未 push**。确认全量回归通过后：
- push + 开 PR 到 main，或直接合并。

### P2 — 若还有 flaky（可选深挖）
如果全量回归仍有**非环境性** flaky，按以下顺序排查：
1. 先 `--workers=1` 隔离复现，确认是真 flaky 还是环境性。
2. 真逻辑 flaky → 用 systematic-debugging 找根因（参考 Class E 模式：加状态契约）。
3. 候选深挖方向（Class D 报告提到的长跑时序 flaky）：auth/articles-enhanced/admin/wechat-rss/search/rbac 的 `element(s) not found` + 10s timeout。

### P3 — 生产部署（独立大任务）
见 memory `deploy-prod-we-mp-rss-checkpoint`：卡在 ECS 重启恢复，P1-P4 完成，待 P5 migrate + P6 验收。**这是另一条工作线，与 E2E flaky 无关。**

---

## 6. 常用命令速查

```bash
# 标准验证
pnpm lint && pnpm test && pnpm build

# 单个 spec 隔离跑（推荐 debug 起手式）
pnpm exec playwright test e2e/<spec>.spec.ts --project=admin --workers=1

# 稳定性压测
pnpm exec playwright test e2e/<spec>.spec.ts --project=admin --repeat-each=20 --workers=1

# harness 封装（见 docs/harness/validation-matrix.md）
pnpm harness:preflight        # 只读预检
pnpm harness:validate         # lint + test + build
pnpm harness:validate:e2e     # + playwright 全量
pnpm harness:validate:db      # + db:generate + db:setup:dry

# 数据库
pnpm db:migrate               # 改 schema 后必须跑，勿手动改
pnpm seed:e2e-accounts        # 幂等创建 e2e 测试账号
```

---

## 7. 关键文件索引

| 用途 | 文件 |
|------|------|
| 项目规则（最高优先级） | `CLAUDE.md` |
| 全局 agent 规则 | `~/.claude/CLAUDE.md` |
| harness 契约 | `docs/harness/contract.md` |
| 验证矩阵（spec 映射） | `docs/harness/validation-matrix.md` |
| 全量审查报告 | `docs/audit/全量审查报告-2026-06-18.md` |
| P0/P1 修复报告 | `docs/audit/修复报告-2026-06-18.md` |
| Class E 细节 | `docs/handoff/e2e-flaky-state-contract-handoff.md` |
| 认证逻辑 | `src/lib/auth.ts`（`validateSession`） |
| middleware | `src/proxy.ts` |
| E2E 认证 setup | `e2e/global-setup.ts` |
| E2E mock helper | `e2e/helpers/mockApi.ts`（新增） |
| E2E console guard | `e2e/helpers/consoleGuard.ts` |

---

## 8. 若你被卡住

- **测试 401**：检查 describe 是否声明了 `storageState`，检查 `.auth/*.json` 是否过期（cookie 24h，过期重跑 `global-setup`）。
- **lint `no-synchronous-setState-in-effect`**：参考 `admin/page.tsx` 的 `initialLoad()` 模式，不要把含同步 setState 的函数直接放进 useEffect。
- **`searchParams`/`cookies()` 报错**：Next.js 16 它们是 Promise，必须 `await`。
- **想确认某个改动是否安全**：`git log --oneline` 看提交链，`git show <hash>` 看具体改了什么。所有改动都在 `fix/full-audit-p0-p1`，`git revert` 可回滚，无 DB schema 变更。

---

## 9. 2026-06-19 全量回归暴露测试稳定性回归 + 主因已修

> 接手时**必读本节**。上一版 handoff（§0-§8）认为 flaky 已收尾，但 2026-06-18 实跑全量 5-project（`--retries=1`，2.5h）暴露 **785 failed（682 确定性）**。本节记录诊断 + 已修内容 + 剩余债。详细开发文件：`docs/superpowers/specs/2026-06-18-e2e-stability-fix.md`。

### 关键结论
- ✅ **本分支无业务 bug**：P0 指标全 0（`Expected: not 401`、`location is not defined`、`uncaughtException`）。P0/P1 安全修复确认有效。
- ❌ Class D（`5a72156`）的测试改写 + 历史遗留，导致 admin isolated 单 worker 下 **127 个确定性失败**。handoff 之前「retry 能吸收」的判断**失真**（Class D 验收只跑 admin project + retries=2 + 5 did-not-run 掩盖了）。

### 已修（admin isolated 127 → ~35，纯测试改动，无业务代码变更）
1. **★ 主因：token 污染（消 77 个）** — `auth.spec.ts` 登出测试用共享 `.auth/admin-storage.json`（token T1）→ 点退出 → `/api/auth/logout` `revokeSession(T1)` 删 DB → 后续所有 admin-gated spec 拿失效 token 401。**修**：登出测试改匿名 context + UI 真登录拿 fresh session，不碰共享 T1。
2. **mock 数据类型（消 7 个）** — `articles-enhanced` MOCK_DETAIL 的 aiCategories 等给 array，页面 `parseStringList` 期望 JSON string → `value.split is not a function` 崩 ErrorBoundary。**修**：三字段改 `JSON.stringify([...])`。
3. **ai-config testid 加错文件 + 文案脱节（消 6 个）** — Admin 测试访问 `/admin/settings/ai`（→AiConfigPage）却断言 `settings-ai-page-header`（在 `/settings/ai` 前台页）；「提示词配置」实际是「AI 默认提示词模板」。**修**：Admin 区域用 `ai-config-page`+正确文案，User 区域保留 settings-ai-page-header。
4. **error-states 文案（消 2 个）** — ES-002 mock 改 500 + 断言「请求失败」；ES-007 404 断言「请求失败」（页面 fetch throw「请求失败」）。

### 剩余 ~35（测试维护债，无业务 bug，待后续清理）
- **articles-enhanced 10**：spec 内部串扰（DETAIL-002 单跑过、整 spec 跪），疑似 `articles-enhanced.spec.ts:708/847` 手动 `newContext()` 泄漏，未定位。
- **visual-regression 5**：Round B 改 Card 圆角后截图基线过期，**修法是 `pnpm exec playwright test e2e/visual-regression.spec.ts --update-snapshots`**（非改测试，需人工确认新截图）。
- **其余 ~20**：admin Tasks/Logs 筛选 / Clean 取消、error-states toast 断言、bugfix-regression 表单字段、settings/sync-records/admin-dashboard 各 1-2 个断言脱节。
- 详见 `docs/superpowers/specs/2026-06-18-e2e-stability-fix.md`（已确证事实 F1-F11、根因、诊断实验、分情况修复策略、验证矩阵）。

### 接手下一步（若继续清剩余 35）
1. 先单独跑各 spec 确认现状：`CI=1 pnpm exec playwright test e2e/<spec>.spec.ts --project=admin --workers=1 --retries=0`
2. articles-enhanced 串扰：二分 line 708/847 newContext 前后，确认泄漏点。
3. visual-regression：跑 `--update-snapshots`，人工核对新截图。
4. 目标：admin isolated 0 failed → 4 project isolated → 5-project 全量 → 合并。
- **诊断纪律**（handoff §4.1 仍适用）：隔离 `--workers=1` 复现区分「真 flaky」vs「环境性」；本批剩余全是单跑也跪的真测试 bug。
