# shenlun-material-hub 全面测试体系建设方案

生成日期：2026-06-16  
项目：`carrywu/shenlun-material-hub`  
适用对象：Claude Code / Codex / Hermes / 人工测试工程师  
目标：建立一套覆盖 **业务功能、权限安全、AI 输出质量、接口异常、异步任务、视觉回归、可访问性、CI 门禁** 的完整测试体系。

---

## 0. 总目标

本项目是一个 **申论官方文章采集、AI 评估、AI 素材卡生成、IMA 同步、管理后台、用户权限/RBAC** 系统。

测试目标不是“跑几个页面不白屏”，而是确保：

1. 文章采集可靠。
2. AI 评估结果结构稳定。
3. AI 素材卡生成链路可靠。
4. 用户权限不能穿透。
5. 多用户数据不能串。
6. 异步任务不会重复、不会失控、限流生效。
7. 页面异常状态可理解、可恢复。
8. AI Prompt 修改后有回归评测。
9. UI 关键页面不会无意回归。
10. 每次交付前有明确质量门禁。

最终测试栈：

```txt
静态检查：ESLint + TypeScript + Next Build
单元测试：Vitest
API/服务测试：Vitest + vi.mock + MSW
组件测试：Vitest + Testing Library + MSW
E2E 测试：Playwright
接口安全测试：Playwright request + Vitest route tests
视觉回归：Playwright toHaveScreenshot
可访问性：@axe-core/playwright
AI 回归测试：Promptfoo
测试数据：Prisma seed + factories + 独立 test database
CI 门禁：lint + unit + build + e2e smoke + nightly full e2e + manual promptfoo
```

---

## 1. 当前仓库测试现状

### 1.1 已有技术栈

当前项目技术栈：

```txt
Next.js 16
React 19
Tailwind CSS 4
Prisma 7
PostgreSQL 16
OpenAI SDK 兼容模型
Vitest
Playwright
@axe-core/playwright
Testing Library
```

当前 `package.json` 已有脚本：

```json
{
  "dev": "node scripts/run-next.mjs dev",
  "build": "next build",
  "start": "node scripts/run-next.mjs start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:staging": "PLAYWRIGHT_BASE_URL=http://100.117.96.1:3001 playwright test"
}
```

当前已具备：

- Vitest 配置
- Playwright 配置
- E2E globalSetup
- 多角色 storageState
- admin / verified / userA / userB / anonymous 项目
- API 安全测试
- 错误状态测试
- 移动端响应式测试
- a11y 测试
- 视觉回归测试
- AI 服务部分单元测试

### 1.2 当前关键问题

| 编号 | 问题 | 风险 | 优先级 |
|---|---|---|---|
| T-001 | Playwright 配置只跑 `./e2e`，但仓库存在 `tests/e2e` | 测试文件存在但实际不执行 | P0 |
| T-002 | 没有 Promptfoo 测试 | Prompt 改坏后无法量化发现 | P0 |
| T-003 | MSW 没有成体系 handlers | Mock 分散，错误态难复用 | P1 |
| T-004 | 错误态测试大量停留在“不白屏” | 用户可用性不足 | P1 |
| T-005 | 素材卡生成 API 涉及权限/AI/任务/限流，但仍需更完整 route tests | 核心业务回归风险 | P0 |
| T-006 | AI 评估 `decision` 异常值可能被静默归为 reject | 数据质量风险 | P0 |
| T-007 | 部分 E2E 用例依赖 fixture 环境变量，可能 skip | 覆盖率不稳定 | P1 |
| T-008 | CI 分层策略不够清晰 | 测试慢、成本高、容易被跳过 | P1 |

---

## 2. 测试原则

### 2.1 禁止假通过

禁止：

```txt
test.skip 掩盖失败
删除断言换通过
把精确断言改成 bodyText.length > 0
expect(true).toBe(true)
mock 掉所有业务逻辑
用固定 sleep 替代真实状态等待
线上模型参与单元测试
失败时只写“已处理”但不说明原因
```

必须：

```txt
失败就暴露
业务 bug 修业务代码
测试 bug 修测试代码
外部依赖不稳定就 mock 外部依赖
测试数据不可用就补 seed/factory
找不到原因就 throw，不要假装通过
```

### 2.2 测试分层

| 层级 | 工具 | 目标 | 是否允许 Mock |
|---|---|---|---|
| 静态检查 | ESLint / TypeScript / build | 语法、类型、构建 | 不需要 |
| 单元测试 | Vitest | 函数、状态机、解析器 | 允许 |
| API Route 测试 | Vitest | 请求/响应、权限、DB 逻辑 | Mock DB 或测试 DB |
| 组件测试 | Vitest + Testing Library | 表单、按钮、状态展示 | MSW |
| E2E | Playwright | 真人点击、页面闭环 | 尽量真实，错误态可 route mock |
| 视觉回归 | Playwright screenshot | 关键 UI 不回归 | 固定数据 |
| a11y | axe | 基础无障碍 | 不需要 |
| AI 回归 | Promptfoo | Prompt + 模型输出质量 | 使用真实模型或稳定兼容模型 |
| 安全测试 | Vitest + Playwright request | 权限、SSRF、越权 | 允许 |

---

## 3. 推荐最终目录结构

```txt
.
├── e2e/
│   ├── auth.spec.ts
│   ├── api-security.spec.ts
│   ├── rbac-capability-matrix.spec.ts
│   ├── articles.spec.ts
│   ├── article-detail.spec.ts
│   ├── admin-articles.spec.ts
│   ├── admin-review.spec.ts
│   ├── ai-config.spec.ts
│   ├── admin-ai-prompts.spec.ts
│   ├── generate-card-flow.spec.ts
│   ├── cards.spec.ts
│   ├── material-card-ownership.spec.ts
│   ├── collectors.spec.ts
│   ├── we-mp-rss.spec.ts
│   ├── error-states.spec.ts
│   ├── chinese-copy.spec.ts
│   ├── accessibility.spec.ts
│   ├── mobile-responsive.spec.ts
│   ├── visual-regression.spec.ts
│   ├── global-setup.ts
│   ├── helpers/
│   │   ├── auth.ts
│   │   ├── consoleGuard.ts
│   │   ├── assertions.ts
│   │   ├── testData.ts
│   │   └── routes.ts
│   └── __screenshots__/
│
├── src/
│   ├── app/
│   │   └── api/
│   │       └── **/__tests__/
│   ├── lib/
│   │   └── __tests__/
│   ├── services/
│   │   └── __tests__/
│   └── test/
│       ├── setup.ts
│       ├── factories/
│       │   ├── user.factory.ts
│       │   ├── article.factory.ts
│       │   ├── source.factory.ts
│       │   ├── material-card.factory.ts
│       │   ├── ai-config.factory.ts
│       │   └── async-task.factory.ts
│       └── mocks/
│           ├── server.ts
│           ├── browser.ts
│           ├── handlers/
│           │   ├── auth.handlers.ts
│           │   ├── articles.handlers.ts
│           │   ├── ai.handlers.ts
│           │   ├── cards.handlers.ts
│           │   ├── tasks.handlers.ts
│           │   ├── collectors.handlers.ts
│           │   └── we-mp-rss.handlers.ts
│           └── data/
│               ├── users.ts
│               ├── articles.ts
│               ├── material-cards.ts
│               └── ai-responses.ts
│
├── tests/
│   └── promptfoo/
│       ├── promptfooconfig.yaml
│       ├── prompts/
│       │   ├── article-evaluation.txt
│       │   ├── card-golden-sentence.txt
│       │   ├── card-standard-expression.txt
│       │   ├── card-case-material.txt
│       │   └── card-bundle.txt
│       ├── datasets/
│       │   ├── article-evaluation-cases.csv
│       │   ├── material-card-cases.csv
│       │   └── adversarial-cases.csv
│       └── assertions/
│           ├── article-evaluation-schema.js
│           ├── material-card-schema.js
│           └── shenlun-rubric.js
│
└── docs/
    └── testing/
        ├── testing-current-status.md
        ├── testing-roadmap.md
        ├── testing-matrix.md
        ├── ai-eval-report.md
        └── release-quality-gate.md
```

---

## 4. package.json 脚本建议

请在 `package.json` 中补充：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:unit:coverage": "vitest run --coverage",

    "test:e2e": "playwright test",
    "test:e2e:list": "playwright test --list",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report",
    "test:e2e:staging": "PLAYWRIGHT_BASE_URL=http://100.117.96.1:3001 playwright test",

    "test:ai": "promptfoo eval -c tests/promptfoo/promptfooconfig.yaml",
    "test:ai:view": "promptfoo view",
    "test:ai:article": "promptfoo eval -c tests/promptfoo/promptfooconfig.yaml --filter article-evaluation",
    "test:ai:card": "promptfoo eval -c tests/promptfoo/promptfooconfig.yaml --filter material-card",

    "test:smoke": "playwright test e2e/auth.spec.ts e2e/api-security.spec.ts",
    "test:all": "pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e",
    "test:release": "pnpm lint && pnpm test:unit && pnpm build && pnpm test:e2e && pnpm test:ai"
  }
}
```

说明：

- `test:all` 不默认跑 Promptfoo，避免每次消耗模型额度。
- `test:release` 可以在正式发布前手动执行。
- CI 的 PR 阶段可以只跑 `lint + unit + build + smoke e2e`。
- nightly 再跑 full e2e + promptfoo。

---

## 5. P0 测试任务

---

# P0-1：统一 E2E 测试目录

## 背景

当前 Playwright 配置：

```ts
testDir: './e2e'
```

因此只有 `e2e/` 下的 spec 会执行。若仓库存在 `tests/e2e/*.spec.ts`，这些文件不会被当前 Playwright 配置执行。

## 任务

```txt
[ ] 搜索 tests/e2e/*.spec.ts
[ ] 判断是否仍有业务价值
[ ] 有价值的迁移到 e2e/
[ ] 无价值的移动到 docs/archive/testing/legacy-e2e/
[ ] 在 docs/testing/testing-current-status.md 记录唯一 E2E 入口
[ ] 执行 pnpm test:e2e:list
[ ] 检查输出 spec 是否与文档一致
```

## 验收标准

```bash
pnpm test:e2e:list
```

必须满足：

```txt
所有预期 E2E spec 都被列出
没有 tests/e2e 下的孤儿 spec
没有重复测试同一功能但断言冲突
```

---

# P0-2：AI 评估服务测试

## 目标文件

```txt
src/services/__tests__/ai-relevance.test.ts
```

## 测试对象

```txt
parseAiJson
buildAiContent
assessRelevance
assessRelevanceWithRetry
validateContentGenre 间接行为
getAiRuntime
getTemperature
```

## 用例清单

| 用例 ID | 场景 | 输入 | 期望 |
|---|---|---|---|
| AI-001 | 直接 JSON | `{"decision":"accept"}` | 正常解析 |
| AI-002 | Markdown JSON | ```json 包裹 | 正常解析 |
| AI-003 | 非 JSON | `abc` | 抛 `AI_RESPONSE_INVALID_JSON` |
| AI-004 | Markdown 内 JSON 非法 | ```json {a} | 抛错误 |
| AI-005 | 空 choices | `choices: []` | 抛“AI 未返回有效内容” |
| AI-006 | decision=accept | accept | 返回 accept |
| AI-007 | decision=reject | reject | 返回 reject |
| AI-008 | decision=maybe | maybe | 建议抛 schema invalid，不应静默 reject |
| AI-009 | contentGenre 合法 | case_practice | 保留 |
| AI-010 | contentGenre 非法 | unknown | 归为 other 或抛错，需锁定 |
| AI-011 | categories 非数组 | string | 返回 [] |
| AI-012 | usableFor 非数组 | string | 返回 [] |
| AI-013 | quotes 超过 5 条 | 10 条 | 只保留 5 条 |
| AI-014 | reason 超长 | 500 字 | 截断到 200 |
| AI-015 | summary 超长 | 1000 字 | 截断到 500 |
| AI-016 | 长文 | 10000 字 | 保留头尾 + 省略标记 |
| AI-017 | 用户级 AI 配置缺失 | userId 有值但 DB 无配置 | 抛 AI_CONFIG_MISSING |
| AI-018 | 全局 AI 配置缺失 | DB/env 都无 | 抛 AI_CONFIG_MISSING |
| AI-019 | 解密失败 | encryptedKey 无法解密 | 抛 AI_CONFIG_DECRYPT_FAILED |
| AI-020 | provider 401 | OpenAI SDK reject status 401 | AiServiceError + key 脱敏 |
| AI-021 | provider 429 | status 429 | 可重试 |
| AI-022 | provider 500 | status 500 | 可重试 |
| AI-023 | timeout | Promise 超时 | 重试后失败 |
| AI-024 | 永久错误 | API key invalid | 不重试 |

## 建议修复点

当前如果 AI 返回：

```json
{"decision": "maybe"}
```

不建议静默转成 reject。推荐改为：

```ts
if (data.decision !== "accept" && data.decision !== "reject") {
  throw new AiServiceError(
    "AI_RESPONSE_SCHEMA_INVALID",
    "AI 返回的 decision 字段无效",
    502
  );
}
```

然后新增测试锁住。

---

# P0-3：素材卡生成服务测试

## 目标文件

```txt
src/services/__tests__/material-card-generation.test.ts
```

## 测试对象

```txt
generateCardForContentItem
normalizeMaterialCardTextField
CARD_TYPE_PROMPTS 间接行为
getPromptTemplate
renderPromptTemplate
buildMaterialCardPrompt
```

## 用例清单

| 用例 ID | 场景 | 期望 |
|---|---|---|
| MC-SVC-001 | string 字段 | 不二次 JSON stringify |
| MC-SVC-002 | object 字段 | 转 JSON string |
| MC-SVC-003 | array 字段 | 转 JSON string |
| MC-SVC-004 | null 字段 | 返回 null |
| MC-SVC-005 | undefined 字段 | 返回 null |
| MC-SVC-006 | number 字段 | 转 string |
| MC-SVC-007 | boolean 字段 | 转 string |
| MC-SVC-008 | AI 返回非法 JSON | 抛 AI_RESPONSE_INVALID_JSON |
| MC-SVC-009 | AI 返回空内容 | 抛错误 |
| MC-SVC-010 | 9 种 cardType 都有 prompt | 全部存在 |
| MC-SVC-011 | data_fact 不再存在 | 不应暴露旧类型 |
| MC-SVC-012 | 自定义 prompt 启用 | 优先使用 DB prompt |
| MC-SVC-013 | 自定义 prompt 为空 | fallback 默认 prompt |
| MC-SVC-014 | prompt 变量渲染 | title/source/content 替换正确 |
| MC-SVC-015 | 长文生成素材卡 | 使用 buildAiContent，保留头尾 |
| MC-SVC-016 | provider 401 | key 脱敏 |
| MC-SVC-017 | provider 429 | AiServiceError status 429 |
| MC-SVC-018 | provider 500 | AiServiceError status 500 |

---

# P0-4：素材卡生成 API Route 测试

## 目标文件

```txt
src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts
```

## 测试接口

```txt
POST /api/content-items/[id]/generate-card
```

## 业务规则

生成素材卡必须满足：

```txt
用户已登录
用户角色为 ADMIN 或 VERIFIED_USER
USER 不能生成
内容存在
内容有 fullText
内容 adminReviewStatus = approved
cardType 合法
未重复生成，或者 force=true
未超过限流
异步任务成功入队
```

## 用例清单

| 用例 ID | 角色 | 场景 | 期望 |
|---|---|---|---|
| GC-001 | anonymous | 未登录 | 401 |
| GC-002 | USER | 普通用户生成 | 403，中文错误 |
| GC-003 | VERIFIED_USER | 生成单张 golden_sentence | 202 |
| GC-004 | ADMIN | 生成单张 golden_sentence | 202 |
| GC-005 | VERIFIED_USER | 文章不存在 | 404 |
| GC-006 | VERIFIED_USER | 文章无 fullText | 400 |
| GC-007 | VERIFIED_USER | 文章未 approved | 400 |
| GC-008 | VERIFIED_USER | 非法 cardType | 400 |
| GC-009 | VERIFIED_USER | 已存在同类型卡片 | 409 |
| GC-010 | VERIFIED_USER | force=true 重新生成 | 202 |
| GC-011 | VERIFIED_USER | 卡包模式多个 cardTypes | 202，返回多个 tasks |
| GC-012 | VERIFIED_USER | 卡包模式部分已存在 | 202，duplicated=true |
| GC-013 | VERIFIED_USER | 单类型限流 | 429 |
| GC-014 | VERIFIED_USER | 卡包模式部分限流 | 202 + rateLimited=true |
| GC-015 | VERIFIED_USER | createDedupTask 抛错 | 500 |
| GC-016 | VERIFIED_USER | AI AiServiceError | 对应 code/status |
| GC-017 | VERIFIED_USER | 普通 Error | 500 + AI_API_CALL_FAILED |
| GC-018 | VERIFIED_USER | 重复快速点击 | dedupeKey 保证不重复任务 |
| GC-019 | userA/userB | A 生成的卡 B 不可见 | 403/404 |
| GC-020 | VERIFIED_USER | 每日生成次数达上限 | 429 + 中文提示 |

## 断言要求

至少断言：

```ts
expect(res.status).toBe(202)
expect(body.accepted).toBe(true)
expect(body.requestId).toMatch(/^gen_/)
expect(body.tasks[0].cardType).toBe("golden_sentence")
expect(body.tasks[0].duplicated).toBe(false)
```

错误态必须断言：

```ts
expect(body.message).toContain("中文错误")
expect(body.code).toBe("NOT_APPROVED")
expect(body.status).toBe(400)
expect(body.requestId).toBeTruthy()
```

---

# P0-5：异步任务测试

## 目标文件

```txt
src/lib/__tests__/async-task.test.ts
```

## 测试对象

```txt
createDedupTask
enqueueAsyncTask
RateLimitError
task 状态流转
dedupeKey
maxConcurrent
maxDaily
```

## 用例清单

| 用例 ID | 场景 | 期望 |
|---|---|---|
| TASK-001 | 创建新任务 | pending/running 状态正确 |
| TASK-002 | 同 dedupeKey 重复创建 | 返回已有任务或拒绝重复 |
| TASK-003 | 不同用户同文章同卡 | 允许各自任务 |
| TASK-004 | 同用户不同 cardType | 允许不同任务 |
| TASK-005 | maxConcurrent 达上限 | 抛 RateLimitError |
| TASK-006 | maxDaily 达上限 | 抛 RateLimitError |
| TASK-007 | 任务执行成功 | status=completed |
| TASK-008 | 任务执行失败 | status=failed + error |
| TASK-009 | 任务失败不会吞异常 | logger 记录 |
| TASK-010 | 队列执行顺序稳定 | 不乱序 |
| TASK-011 | 进程内并发点击 | 只有一个有效任务 |
| TASK-012 | dedupeKey 包含 userId | 防止跨用户互相影响 |

---

# P0-6：Promptfoo AI 回归测试

## 安装

```bash
pnpm add -D promptfoo
```

## 目录

```txt
tests/promptfoo/
  promptfooconfig.yaml
  prompts/
  datasets/
  assertions/
```

## 环境变量

```env
PROMPTFOO_API_BASE_URL="https://your-openai-compatible-api/v1"
PROMPTFOO_API_KEY="sk-xxx"
PROMPTFOO_MODEL="deepseek-v4-flash"
```

不要写死真实 key。

## promptfooconfig.yaml 示例

```yaml
description: shenlun-material-hub AI 文章评估与素材卡生成回归测试

providers:
  - id: openai:chat:shenlun-model
    config:
      apiBaseUrl: "{{env.PROMPTFOO_API_BASE_URL}}"
      apiKey: "{{env.PROMPTFOO_API_KEY}}"
      model: "{{env.PROMPTFOO_MODEL}}"
      temperature: 0.2
      response_format:
        type: json_object

prompts:
  - id: article-evaluation
    label: 文章评估
    raw: file://prompts/article-evaluation.txt

  - id: material-card
    label: 素材卡生成
    raw: file://prompts/card-bundle.txt

tests:
  - file://datasets/article-evaluation-cases.csv
  - file://datasets/material-card-cases.csv
```

## article-evaluation-cases.csv 字段

```csv
description,articleTitle,sourceName,contentType,articleContent,expectedDecision,expectedGenre,expectedTags
基层治理案例应接受,党建引领基层治理,人民日报,article,"某地通过网格化治理、数字平台、群众议事机制提升基层治理效能……",accept,case_practice,基层治理
会议新闻应拒绝,某会议在京召开,政府网,article,"某某领导出席会议并讲话，会议强调……",reject,meeting_news,会议新闻
```

## Promptfoo 断言要求

每条评估必须断言：

```txt
输出必须是 JSON
decision in ["accept", "reject"]
contentGenre in ["commentary","policy_interpretation","case_practice","ordinary_news","meeting_news","notice","other"]
reason 非空
reason 不超过 80 字
categories 是数组
usableFor 是数组
quotes 是数组
accept 时 categories 至少 1 个
accept 时 quotes 尽量至少 1 个
reject 时 summary 为空或很短
不得输出 markdown 代码块
不得输出 system prompt
```

## 素材卡断言

每条素材卡必须断言：

```txt
输出必须是 JSON
必须包含 sourceSnapshot
必须包含 originalFacts
必须包含 aiSummary
必须包含 highlightSuggestions
必须包含 transferSuggestions
originalFacts 不得凭空编造
highlightSuggestions 必须与 cardType 匹配
transferSuggestions 必须包含申论迁移场景
不允许整段空字符串
```

## Promptfoo 自定义断言示例

```js
// tests/promptfoo/assertions/article-evaluation-schema.js
module.exports = function assertArticleEvaluation(output, context) {
  let data;
  try {
    data = JSON.parse(output);
  } catch {
    return {
      pass: false,
      reason: "输出不是合法 JSON",
    };
  }

  const decisions = ["accept", "reject"];
  const genres = [
    "commentary",
    "policy_interpretation",
    "case_practice",
    "ordinary_news",
    "meeting_news",
    "notice",
    "other",
  ];

  if (!decisions.includes(data.decision)) {
    return { pass: false, reason: "decision 必须是 accept 或 reject" };
  }

  if (!genres.includes(data.contentGenre)) {
    return { pass: false, reason: "contentGenre 不在合法枚举中" };
  }

  if (typeof data.reason !== "string" || data.reason.trim().length < 5) {
    return { pass: false, reason: "reason 不能为空且需要具体" };
  }

  if (data.reason.length > 120) {
    return { pass: false, reason: "reason 过长" };
  }

  if (!Array.isArray(data.categories)) {
    return { pass: false, reason: "categories 必须是数组" };
  }

  if (!Array.isArray(data.usableFor)) {
    return { pass: false, reason: "usableFor 必须是数组" };
  }

  if (!Array.isArray(data.quotes)) {
    return { pass: false, reason: "quotes 必须是数组" };
  }

  return { pass: true, reason: "ok" };
};
```

---

## 6. P1 测试任务

---

# P1-1：MSW Mock 体系

## 目标

统一前端组件测试、服务集成测试中的 API mock，避免每个测试里散落 `page.route` / `vi.fn`。

## 安装

```bash
pnpm add -D msw
```

## server.ts

```ts
// src/test/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

## setup.ts

```ts
// src/test/setup.ts
import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## handlers/index.ts

```ts
import { authHandlers } from "./auth.handlers";
import { articleHandlers } from "./articles.handlers";
import { aiHandlers } from "./ai.handlers";
import { cardHandlers } from "./cards.handlers";
import { taskHandlers } from "./tasks.handlers";
import { weweRssHandlers } from "./we-mp-rss.handlers";

export const handlers = [
  ...authHandlers,
  ...articleHandlers,
  ...aiHandlers,
  ...cardHandlers,
  ...taskHandlers,
  ...weweRssHandlers,
];
```

## 必须 Mock 的接口

| 分类 | 接口 |
|---|---|
| Auth | `/api/auth/login`, `/api/auth/me`, `/api/auth/logout` |
| Articles | `/api/articles`, `/api/content-items/:id` |
| AI | OpenAI-compatible `/v1/chat/completions` |
| AI Config | `/api/ai-config`, `/api/ai-config/test`, `/api/ai-config/prompts` |
| Cards | `/api/material-cards`, `/api/content-items/:id/generate-card` |
| Tasks | `/api/admin/tasks`, `/api/tasks/:id` |
| we-mp-rss | `/api/settings/integrations/wechat-rss`, `/api/collectors/wechat/*` |
| Admin | `/api/admin/users`, `/api/admin/sources`, `/api/admin/logs` |

## AI Mock 场景

```txt
ai.accept
ai.reject
ai.invalidJson
ai.emptyContent
ai.unauthorized401
ai.rateLimited429
ai.serverError500
ai.timeout
ai.missingFields
ai.markdownJson
```

---

# P1-2：错误状态测试升级

## 当前问题

现有错误状态测试如果只断言：

```ts
expect(bodyText.length).toBeGreaterThan(0)
```

不够。页面不白屏不代表用户可用。

## 新标准

每个错误态必须断言：

```txt
错误文案
是否中文
是否有重试按钮
是否保留导航
是否阻止重复提交
是否记录错误状态
```

## 目标文件

```txt
e2e/error-states.spec.ts
```

## 用例清单

| 页面 | Mock 异常 | 断言 |
|---|---|---|
| `/articles` | `/api/articles` 500 | 显示“加载文章失败” |
| `/articles` | 网络失败 | 显示“网络异常” + 重试按钮 |
| `/articles` | 空数据 | 显示“暂无文章” |
| `/search` | 空结果 | 显示“未找到相关内容” |
| `/review` | 空数据 | 显示“暂无可复习素材” |
| `/admin` | metrics 500 | 指标卡失败，但导航可用 |
| `/articles/[id]` | 404 | 显示“内容不存在” |
| `/cards/[id]` | 404 | 显示“素材卡不存在” |
| 素材卡生成 | 429 | 显示限流中文原因 |
| 素材卡生成 | AI 500 | 显示“生成失败” + 重试 |
| AI 配置连接 | 401 | 显示“API Key 无效” |
| AI 配置连接 | timeout | 显示“连接超时” |
| we-mp-rss 测试连接 | 连接失败 | 显示中文失败原因 |

---

# P1-3：RBAC 能力矩阵 E2E

## 目标文件

```txt
e2e/rbac-capability-matrix.spec.ts
```

## 角色

```txt
anonymous
USER
VERIFIED_USER
ADMIN
```

## 能力矩阵

| 功能 | anonymous | USER | VERIFIED_USER | ADMIN |
|---|---|---|---|---|
| 访问首页 | redirect/login 或允许按业务 | 允许 | 允许 | 允许 |
| 文章列表 | 401/redirect 或按业务 | 允许 | 允许 | 允许 |
| 文章详情 | 401/redirect 或按业务 | 允许 | 允许 | 允许 |
| 生成素材卡 | 401 | 403 | 202 | 202 |
| 查看自己的素材卡 | 401 | 按业务 | 允许 | 允许 |
| 查看他人素材卡 | 401 | 403/404 | 403/404 | 按后台能力 |
| AI 个人配置 | 401 | 按业务 | 允许 | 允许 |
| 管理 AI 配置 | 401 | 403 | 403 | 允许 |
| 管理来源 | 401 | 403 | 403 | 允许 |
| we-mp-rss 管理 | 401 | 403 | 403 | 允许 |
| 用户管理 | 401 | 403 | 403 | 允许 |
| 数据清理 | 401 | 403 | 403 | 允许 |
| 备份导出 | 401 | 403 | 403 | 允许 |

## 测试方法

每个能力同时测：

```txt
页面入口：按钮/菜单是否可见
页面访问：直接 goto 是否拦截
API 访问：直接 request 是否返回 401/403/200
错误文案：中文
数据隔离：A 用户不能访问 B 用户资源
```

---

# P1-4：AI 配置测试

## 目标文件

```txt
src/app/api/ai-config/__tests__/route.security.test.ts
e2e/ai-config.spec.ts
```

## 用例清单

| 用例 ID | 场景 | 期望 |
|---|---|---|
| AIC-001 | 未登录 GET | 401 |
| AIC-002 | 未登录 POST | 401 |
| AIC-003 | USER GET 个人配置 | 按业务允许/禁止，需明确 |
| AIC-004 | VERIFIED_USER 保存个人配置 | 200 |
| AIC-005 | ADMIN 保存全局配置 | 200 |
| AIC-006 | API Key 保存后加密 | DB 不存明文 |
| AIC-007 | GET 配置不返回完整 key | 只返回 keySuffix |
| AIC-008 | baseURL 为空 | 使用默认或报错 |
| AIC-009 | model 为空 | fallback 默认 |
| AIC-010 | temperature < 0 | 400 |
| AIC-011 | temperature > 2 | 400 |
| AIC-012 | 测试连接成功 | 中文成功 |
| AIC-013 | 测试连接 401 | 中文失败 + key 脱敏 |
| AIC-014 | 测试连接 429 | 中文限流 |
| AIC-015 | 测试连接 timeout | 中文超时 |
| AIC-016 | 删除配置 | 缓存清空 |
| AIC-017 | 解密失败 | 中文错误 |
| AIC-018 | AI_CONFIG_ENCRYPTION_KEY 缺失 | 500 + 中文错误 |

---

# P1-5：文章列表与详情测试

## 目标文件

```txt
e2e/articles.spec.ts
e2e/article-detail.spec.ts
src/app/api/articles/__tests__/route.test.ts
src/app/api/content-items/[id]/__tests__/route.test.ts
```

## 文章列表用例

| 用例 ID | 场景 | 期望 |
|---|---|---|
| ART-001 | 打开文章列表 | 展示标题、来源、时间 |
| ART-002 | 来源筛选 | 结果只包含该来源 |
| ART-003 | 网站/公众号筛选 | 结果类型正确 |
| ART-004 | AI 决策筛选 accept | 只展示 accept |
| ART-005 | AI 决策筛选 reject | 只展示 reject |
| ART-006 | 审核状态筛选 | 状态正确 |
| ART-007 | 是否生成素材卡筛选 | 结果正确 |
| ART-008 | 时间筛选 | 发布时间范围正确 |
| ART-009 | 多条件筛选 | AND 逻辑正确 |
| ART-010 | 空结果 | 中文空状态 |
| ART-011 | 分页 | 页码/总数正确 |
| ART-012 | 点击标题 | 进入系统内详情，不跳原站 |
| ART-013 | 返回列表 | 筛选条件保留 |
| ART-014 | 生成时间 | 显示采集时间 |
| ART-015 | 发布时间 | 显示文章发布时间 |
| ART-016 | 正文图片 | 图片通过代理显示 |
| ART-017 | XSS 内容 | 不执行脚本 |
| ART-018 | 图片代理失败 | 有占位/错误提示 |

## 文章详情用例

| 用例 ID | 场景 | 期望 |
|---|---|---|
| DETAIL-001 | 展示标题 | 正确 |
| DETAIL-002 | 展示来源 | 正确 |
| DETAIL-003 | 展示发布时间 | 正确 |
| DETAIL-004 | 展示采集时间 | 正确 |
| DETAIL-005 | 展示正文 | 正确 |
| DETAIL-006 | 展示图片 | 可见 |
| DETAIL-007 | 展示 AI 评估 | decision/reason/categories |
| DETAIL-008 | 展示素材卡入口 | 角色允许时可见 |
| DETAIL-009 | 未审核文章 | 禁止生成素材卡 |
| DETAIL-010 | 原文链接 | 存在但不替代系统详情 |
| DETAIL-011 | 404 | 中文内容不存在 |
| DETAIL-012 | 权限不足 | 中文权限不足 |
| DETAIL-013 | 收藏/批注 | 用户隔离 |
| DETAIL-014 | 返回列表 | 状态保留 |

---

# P1-6：管理后台测试

## 目标文件

```txt
e2e/admin.spec.ts
e2e/admin-articles.spec.ts
e2e/admin-review.spec.ts
e2e/sources.spec.ts
e2e/admin-user-roles.spec.ts
e2e/admin-invitations.spec.ts
```

## 后台首页

| 用例 | 期望 |
|---|---|
| admin 可进入 `/admin` | 200 |
| USER 访问 `/admin` | redirect/403 |
| metrics 加载成功 | 指标显示 |
| metrics 500 | 页面不崩，中文错误 |
| 侧边栏菜单 | 全中文 |
| 快速入口 | 可点击 |

## 文章审核

| 用例 | 期望 |
|---|---|
| pending_admin 批量通过 | adminReviewStatus=approved |
| AI reject 强制通过 | 必须填写 note |
| approved 下架 | adminReviewStatus=rejected |
| 下架后用户素材卡处理 | 按业务删除/隐藏 |
| 未审核文章推送今日推荐 | 400 |
| approved 文章推送今日推荐 | 200 |
| 批量操作空 ids | 400 |
| 普通用户调用审核 API | 403 |
| 未登录调用审核 API | 401 |

## 来源管理

| 用例 | 期望 |
|---|---|
| 新增来源 | 200 |
| 编辑来源 | 200 |
| 删除来源 | 有二次确认 |
| 禁用来源 | 不再采集 |
| sourceType 网站/公众号 | 正确 |
| 栏目配置 | 正确 |
| 重复来源 | 400 |
| URL 非法 | 400 |
| USER 调用来源 API | 403 |

---

# P1-7：采集器测试

## 目标文件

```txt
src/services/collectors/__tests__/
e2e/collectors.spec.ts
```

## 采集器范围

```txt
先锋文汇
人民日报
人民网观点
广东省政府网
湖南省政府网
we-mp-rss / 微信公众号
```

## 测试维度

| 维度 | 用例 |
|---|---|
| 列表解析 | 标题、URL、发布时间 |
| 详情解析 | 标题、正文、图片、来源 |
| 时间解析 | 发布时间不等于采集时间 |
| 图片处理 | 图片 URL、代理、白名单 |
| 去重 | 同 URL 不重复入库 |
| 栏目 | 栏目字段正确 |
| 来源类型 | website/wechat 正确 |
| 异常 HTML | 不崩溃，有日志 |
| 403/404/500 | CollectorRun 记录失败 |
| 网络超时 | 可重试 |
| 空列表 | 记录 0 条，不报成功采集 |
| 结构变更 | throw，不假装成功 |

## 验收标准

采集器解析测试必须使用固定 HTML fixture：

```txt
src/services/collectors/__fixtures__/
  people-daily-list.html
  people-daily-detail.html
  gd-gov-list.html
  gd-gov-detail.html
  hunan-gov-list.html
  hunan-gov-detail.html
  we-mp-rss-feed.xml
```

---

## 7. P2 测试任务

---

# P2-1：中文化测试

## 目标文件

```txt
e2e/chinese-copy.spec.ts
```

## 禁止出现的英文错误文案

```ts
const forbiddenEnglishErrors = [
  /Unauthorized/i,
  /Forbidden/i,
  /Internal Server Error/i,
  /Failed to fetch/i,
  /Network Error/i,
  /Something went wrong/i,
  /An error occurred/i,
  /Loading/i,
  /Submit/i,
  /Cancel/i,
  /Delete/i,
  /Edit/i,
  /Save/i
];
```

## 允许的英文

```txt
API
Base URL
OpenAI
model
token
JSON
HTTP
URL
we-mp-rss
IMA
```

## 页面范围

```txt
/admin
/admin/articles
/admin/sources
/admin/settings/ai
/admin/integrations/we-mp-rss
/articles
/articles/[id]
/cards
/cards/[id]
/settings
/settings/ai
/search
/review
```

---

# P2-2：视觉回归测试

## 目标文件

```txt
e2e/visual-regression.spec.ts
```

## 截图页面

| 页面 | 截图区域 |
|---|---|
| `/articles` | 筛选区 + 列表 |
| `/articles/[id]` | AI 评估区 |
| `/articles/[id]` | 素材卡生成区 |
| `/cards` | 卡片列表 |
| `/cards/[id]` | 素材卡详情 |
| `/admin` | 指标卡 |
| `/admin/articles` | 审核表格 |
| `/admin/settings/ai` | AI 配置表单 |
| `/admin/integrations/we-mp-rss` | we-mp-rss 配置 |
| `/search` | 搜索页 |
| `/review` | 复习页 |
| 错误页 | 401/403/404 |
| 空状态 | 文章空/搜索空/卡片空 |

## 稳定性要求

```txt
固定 viewport
固定测试数据
固定系统时间
禁用动画
屏蔽动态 ID
屏蔽动态时间
等待字体加载
等待 networkidle
只截关键区域
```

---

# P2-3：a11y 测试

## 目标文件

```txt
e2e/accessibility.spec.ts
```

## 页面范围

```txt
登录页
注册页
文章列表
文章详情
素材卡列表
素材卡详情
AI 配置
管理后台
来源管理
用户管理
搜索页
复习页
```

## 断言

```ts
const accessibilityScanResults = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .analyze();

expect(accessibilityScanResults.violations).toEqual([]);
```

## 重点关注

```txt
按钮有 accessible name
表单 input 有 label
Select/Combobox 有名称
错误提示可读
颜色对比度
键盘可操作
焦点状态可见
```

---

# P2-4：移动端响应式测试

## 目标文件

```txt
e2e/mobile-responsive.spec.ts
```

## 设备

```txt
iPhone 12
Pixel 5
iPad
Desktop Chrome
```

## 页面范围

```txt
/articles
/articles/[id]
/cards
/cards/[id]
/search
/review
/settings
/admin/login
```

## 断言

```txt
无横向滚动
主按钮可点击
筛选器可展开
表格有移动端替代布局或横向容器
详情页正文可读
素材卡内容不溢出
导航可用
```

---

## 8. 安全测试

---

# S-1：认证与授权

## 文件

```txt
e2e/api-security.spec.ts
src/lib/__tests__/auth.test.ts
```

## 必测

| 用例 | 期望 |
|---|---|
| 无 cookie 访问受保护 API | 401 |
| 伪造 cookie | 401 |
| 过期 session | 401 |
| DISABLED 用户 | 401 |
| USER 访问 ADMIN API | 403 |
| VERIFIED_USER 访问 ADMIN API | 403 |
| ADMIN 访问 ADMIN API | 200 |
| legacy JWT fallback | 按业务兼容 |
| 登出后旧 session | 失效 |
| 修改密码后旧 session | 失效或按业务明确 |

---

# S-2：数据隔离

## 文件

```txt
e2e/data-isolation.spec.ts
e2e/material-card-ownership.spec.ts
src/lib/__tests__/data-isolation.test.ts
```

## 必测

| 资源 | A 用户 | B 用户 |
|---|---|---|
| MaterialCard | 可读写自己的 | 不能读写 A 的 |
| ArticleAnnotation | 可读写自己的 | 不能读写 A 的 |
| SyncRecord | 可读自己的 | 不能读 A 的 |
| AI Config | 可读自己的 | 不能读 A 的 |
| UserIntegration | 可读自己的 | 不能读 A 的 |
| Review state | 可读自己的 | 不能读 A 的 |

---

# S-3：SSRF / XSS / 注入

## 图片代理 SSRF

必须覆盖：

```txt
127.0.0.1
localhost
0.0.0.0
10.0.0.1
172.16.0.1
192.168.1.1
169.254.169.254
file://
ftp://
gopher://
非白名单域名
重定向到私有 IP
DNS rebinding 风险
```

## XSS

文章正文测试：

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<a href="javascript:alert(1)">click</a>
```

期望：

```txt
不执行脚本
危险属性被清理
页面不报错
```

---

## 9. 测试数据策略

### 9.1 不建议继续大量依赖环境变量 fixture

不推荐：

```txt
E2E_REJECTED_ARTICLE_ID
E2E_APPROVED_WITH_CARDS_ID
E2E_APPROVED_ARTICLE_ID
E2E_PENDING_ARTICLE_ID
```

原因：

```txt
本地缺数据会 skip
staging 数据变化会失败
用例不可重复
覆盖率不可控
```

### 9.2 推荐使用 seed + factory

新增：

```txt
src/test/factories/
scripts/seed-e2e-fixtures.ts
```

## 标准 fixture

```txt
admin 用户
USER 用户 userA
VERIFIED_USER 用户 verifiedA
VERIFIED_USER 用户 verifiedB

approved 文章 3 篇
pending_admin 文章 2 篇
rejected 文章 2 篇
无 fullText 文章 1 篇
带图片文章 1 篇
带 XSS 正文文章 1 篇

userA 素材卡 2 张
userB 素材卡 2 张
异步任务 running 1 条
异步任务 failed 1 条
AI 配置 userA 1 条
AI 配置 global 1 条
```

## 每次 E2E 前

```bash
pnpm db:migrate
pnpm seed:e2e-accounts
pnpm seed:e2e-fixtures
```

---

## 10. CI 建议

### 10.1 PR 阶段

```yaml
name: PR Quality Gate

on:
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node
      - pnpm install
      - pnpm lint
      - pnpm test:unit
      - pnpm build
      - pnpm test:smoke
```

### 10.2 main 分支

```yaml
name: Main Full E2E

on:
  push:
    branches: [main]

jobs:
  full-e2e:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node
      - pnpm install
      - setup postgres
      - pnpm db:migrate
      - pnpm seed:e2e-accounts
      - pnpm seed:e2e-fixtures
      - pnpm test:e2e
```

### 10.3 nightly

```yaml
name: Nightly AI Eval

on:
  schedule:
    - cron: "0 18 * * *"

jobs:
  ai-eval:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup node
      - pnpm install
      - pnpm test:ai
```

---

## 11. 质量门禁

### 11.1 本地提交前

```bash
pnpm lint
pnpm test:unit
pnpm build
```

### 11.2 涉及页面改动

```bash
pnpm test:e2e
```

### 11.3 涉及 AI Prompt / AI 服务改动

```bash
pnpm test:unit
pnpm test:ai
```

### 11.4 涉及权限 / 用户 / 数据隔离

```bash
pnpm test:unit
pnpm test:e2e e2e/api-security.spec.ts e2e/rbac-capability-matrix.spec.ts e2e/data-isolation.spec.ts
```

### 11.5 发布前

```bash
pnpm lint
pnpm test:unit
pnpm build
pnpm test:e2e
pnpm test:ai
```

---

## 12. 最终交付物

完成测试体系建设后，必须交付：

```txt
package.json 测试脚本更新
e2e/ 统一后的 E2E 用例
src/services/__tests__/ai-relevance.test.ts
src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts
src/lib/__tests__/async-task.test.ts
src/test/mocks/**
src/test/factories/**
tests/promptfoo/**
docs/testing/testing-current-status.md
docs/testing/testing-roadmap.md
docs/testing/testing-matrix.md
docs/testing/ai-eval-report.md
```

---

## 13. Agent 执行提示词

下面这段可以直接复制给 Claude Code / Codex / Hermes：

```md
你是资深全栈测试工程师 + AI 应用质量工程师。请基于当前 shenlun-material-hub 仓库建立完整测试体系。

硬性要求：
1. 不允许 test.skip 掩盖问题。
2. 不允许删除断言换通过。
3. 不允许 expect(true).toBe(true)。
4. 找不到原因就 throw，不要假装通过。
5. Playwright 唯一主目录为 e2e/。
6. tests/e2e/ 中有价值用例必须迁移，无价值用例归档并记录。
7. 单元测试不得请求真实 AI 模型。
8. Promptfoo 才允许请求真实模型，必须通过环境变量读取 key/baseURL/model。
9. 所有错误提示必须断言中文文案。
10. 每完成阶段更新 docs/testing/testing-current-status.md。
11. 所有新增测试必须被 package.json 脚本执行到。
12. 每完成一项在 TodoList 打勾，最后 git commit。

执行任务：

阶段一：测试入口清理
- [ ] 检查 package.json
- [ ] 检查 playwright.config.ts
- [ ] 检查 vitest.config.ts
- [ ] 列出 e2e/ 与 tests/e2e/ 所有 spec
- [ ] 迁移或归档 tests/e2e/
- [ ] 补齐 package.json 测试脚本
- [ ] 执行 pnpm test:e2e:list

阶段二：P0 单元/API 测试
- [ ] 新增 src/services/__tests__/ai-relevance.test.ts
- [ ] 补强 src/services/__tests__/material-card-generation.test.ts
- [ ] 新增 src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts
- [ ] 新增 src/lib/__tests__/async-task.test.ts
- [ ] 新增 AI 配置安全测试
- [ ] 执行 pnpm test:unit

阶段三：P0/P1 E2E 测试
- [ ] 新增 e2e/rbac-capability-matrix.spec.ts
- [ ] 新增 e2e/generate-card-flow.spec.ts
- [ ] 升级 e2e/error-states.spec.ts，不只断言不白屏，要断言中文错误和重试入口
- [ ] 补 article list/detail 关键业务闭环
- [ ] 补 admin review 关键业务闭环
- [ ] 执行 pnpm test:e2e

阶段四：MSW
- [ ] 安装 msw
- [ ] 新增 src/test/mocks/server.ts
- [ ] 新增 src/test/mocks/browser.ts
- [ ] 新增 auth/articles/ai/cards/tasks/we-mp-rss handlers
- [ ] 接入 src/test/setup.ts
- [ ] 将分散 mock 抽取为可复用 handlers

阶段五：Promptfoo
- [ ] 安装 promptfoo
- [ ] 新增 tests/promptfoo/promptfooconfig.yaml
- [ ] 新增 article-evaluation-cases.csv，至少 30 条
- [ ] 新增 material-card-cases.csv，至少 27 条
- [ ] 新增 JSON schema / custom assertion
- [ ] package.json 增加 test:ai
- [ ] 如有环境变量，执行 pnpm test:ai

阶段六：文档与交付
- [ ] 更新 docs/testing/testing-current-status.md
- [ ] 更新 docs/testing/testing-roadmap.md
- [ ] 更新 docs/testing/testing-matrix.md
- [ ] 记录所有失败和修复
- [ ] 执行 pnpm lint
- [ ] 执行 pnpm test:unit
- [ ] 执行 pnpm build
- [ ] 执行 pnpm test:e2e
- [ ] 如可用，执行 pnpm test:ai
- [ ] git status
- [ ] git add
- [ ] git commit -m "test: strengthen comprehensive testing system"

最终输出：
1. 新增/修改文件清单
2. 测试命令执行结果
3. 未解决问题
4. 下一步建议
5. git commit hash
```

---

## 14. 完整测试矩阵总表

| 模块 | Unit | API Route | Component | E2E | Visual | a11y | AI Eval | Security |
|---|---|---|---|---|---|---|---|---|
| Auth 登录 | ✅ | ✅ | ✅ | ✅ | - | ✅ | - | ✅ |
| RBAC | ✅ | ✅ | - | ✅ | - | - | - | ✅ |
| 数据隔离 | ✅ | ✅ | - | ✅ | - | - | - | ✅ |
| 文章列表 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| 文章详情 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| 采集器 | ✅ | ✅ | - | ✅ | - | - | - | ✅ |
| we-mp-rss | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| AI 配置 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| AI Prompt 管理 | ✅ | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ |
| AI 文章评估 | ✅ | ✅ | - | ✅ | - | - | ✅ | - |
| 素材卡生成 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 素材卡列表 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| 复习系统 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| 搜索 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| 异步任务 | ✅ | ✅ | ✅ | ✅ | - | - | - | ✅ |
| 系统日志 | ✅ | ✅ | - | ✅ | - | - | - | ✅ |
| 图片代理 | ✅ | ✅ | - | ✅ | - | - | - | ✅ |
| 错误状态 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | - | - |
| 中文化 | - | - | ✅ | ✅ | ✅ | - | - | - |
| 移动端 | - | - | - | ✅ | ✅ | ✅ | - | - |

---

## 15. 一句话总结

这个项目当前已经有不错的 Vitest + Playwright 基础。下一步要做的不是继续堆“页面不白屏”测试，而是建立：

```txt
AI 质量回归 + 素材卡生成链路测试 + 异步任务去重/限流测试 + RBAC 能力矩阵 + MSW 统一 Mock + Promptfoo 评测
```

最高优先级：

```txt
1. 统一 e2e 目录，避免测试文件存在但不执行
2. 补 generate-card API 全面测试
3. 补 AI relevance 输出 schema 测试
4. 接入 Promptfoo
5. 把 error-states 从“不白屏”升级为“中文错误 + 可重试 + 状态可恢复”
```
