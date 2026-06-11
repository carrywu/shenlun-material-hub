# P5: generate-card 改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**前置依赖：** P2（审核字段 + MaterialCard partial unique index）、P4（adminReviewStatus 流转）已完成。

**Goal：** ① 素材卡生成准入从 `aiDecision=accept` 改为 `adminReviewStatus=approved`；② 去重 where 加 `ownerUserId`，公共卡（ownerUserId=null）不阻止私有卡生成；③ 支持常用卡包（金句+规范表达+案例+对策）串行 enqueue；④ 前端生卡按钮防抖（置灰 loading）。

**Architecture：** 路由准入检查换字段；去重 where 补 `ownerUserId: user.id`；卡包模式接收 `cardTypes: CardType[]`，串行调用现有 `enqueueAsyncTask`（全局并发=2 自动限流，叠加 `checkTaskRateLimit` 每用户 3 并发兜底）。复用 `resolveAiRuntimeConfig(userId)` 强制用户自付。

**Tech Stack：** Next.js App Router · Prisma · `createAsyncTask`/`enqueueAsyncTask`/`checkTaskRateLimit`（`src/lib/async-task.ts`）· Vitest · Playwright。

---

## File Structure

| 文件 | 责任 | 操作 |
|---|---|---|
| `src/app/api/content-items/[id]/generate-card/route.ts` | 生卡路由 | 准入字段换、去重加 ownerUserId、卡包分支 |
| `src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts` | 单测 | 新建 |
| `src/components/ArticleDetail.tsx`（或对应生卡入口组件） | 生卡按钮 | 加防抖 loading |
| `e2e/material-card-ownership.spec.ts` | e2e | 新建/扩充 |
| `docs/handoff/P5-generate-card-handoff.md` | 交接 | 新建 |

---

## Task 1: generate-card 单测（先红）

**Files:**
- Create: `src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts`

- [ ] **Step 1: 新建测试**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
    USER: { id: "u", username: "u", role: "USER" as const, status: "ACTIVE" as const },
  },
  authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
}));

vi.mock("@/lib/auth", () => ({
  requireVerifiedUser: authMocks.getUserFromRequest,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirstCard: vi.fn(),
  create: vi.fn(),
  createTask: vi.fn(),
  enqueue: vi.fn(),
  rateLimit: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    materialCard: {
      findFirst: mocks.findFirstCard,
      create: mocks.create,
    },
  },
}));
vi.mock("@/lib/async-task", () => ({
  createAsyncTask: mocks.createTask,
  enqueueAsyncTask: mocks.enqueue,
  checkTaskRateLimit: mocks.rateLimit,
}));
vi.mock("@/services/ai", () => ({
  generateCardForContentItem: vi.fn(),
  AiServiceError: class extends Error {
    code = "X";
    status = 500;
  },
}));

import { POST } from "../route";

function makeReq(id: string, cookie: string | null, body: unknown) {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  init.headers = { ...(init.headers || {}), "content-type": "application/json" };
  init.body = JSON.stringify(body);
  return [
    new NextRequest(`http://localhost/api/content-items/${id}/generate-card`, init),
    { params: Promise.resolve({ id }) },
  ] as const;
}

const APPROVED_ITEM = {
  id: "x",
  fullText: "内容".repeat(200),
  aiDecision: "accept",
  adminReviewStatus: "approved",
  source: { name: "src" },
  title: "标题",
};

describe("POST /api/content-items/[id]/generate-card (P5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("USER（普通用户）→ 403（不能生卡）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const [req, ctx] = makeReq("x", "auth_token=t", { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("adminReviewStatus != approved → 400（不再看 aiDecision）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({ ...APPROVED_ITEM, adminReviewStatus: "pending_admin" });
    const [req, ctx] = makeReq("x", "auth_token=t", { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("同用户同类型已存在 → 409", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue({ id: "existing", ownerUserId: "v" });
    const [req, ctx] = makeReq("x", "auth_token=t", { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(409);
  });

  it("公共卡（ownerUserId=null）不阻止私有卡生成", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    // findFirst 用 ownerUserId=user.id 查不到（公共卡 null 不匹配）
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", "auth_token=t", { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    // 关键：findFirst 调用时 where 含 ownerUserId
    expect(mocks.findFirstCard).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerUserId: "v" }),
      })
    );
  });

  it("卡包模式：cardTypes 数组 → 串行 enqueue 多任务", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.createTask.mockResolvedValue({ id: "t1", type: "CARD_GENERATE" });
    const [req, ctx] = makeReq("x", "auth_token=t", {
      cardTypes: ["golden_sentence", "standard_expression", "case_material", "countermeasure"],
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(202);
    expect(mocks.createTask).toHaveBeenCalledTimes(4);
  });

  it("速率限制命中 → 429", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue(APPROVED_ITEM);
    mocks.findFirstCard.mockResolvedValue(null);
    mocks.rateLimit.mockResolvedValue({ allowed: false, reason: "并发上限" });
    const [req, ctx] = makeReq("x", "auth_token=t", { cardType: "golden_sentence" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts`

Expected: 多数用例 FAIL（路由现状不查 adminReviewStatus、去重不含 ownerUserId、不支持 cardTypes 数组、不查 rateLimit）。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts
git commit -m "test(generate-card): lock P5 behavior"
```

---

## Task 2: 改造 generate-card 路由

**Files:**
- Modify: `src/app/api/content-items/[id]/generate-card/route.ts`

- [ ] **Step 1: 改造 POST handler。** 用下面这段完整替换现有 POST 函数体（保留 `errorResponse`、`newRequestId`、`runGenerateCardTask` 不变，但 `runGenerateCardTask` 内的去重也要改）：

先改 `runGenerateCardTask` 内的去重（第 33-35 行）：

```typescript
  const existingCard = await db.materialCard.findFirst({
    where: { contentItemId: id, cardType, ownerUserId },
  });
```

然后在 POST handler 入口加 USER 拦截（在 `requireVerifiedUser` 之后，约第 99-106 行后加）：

```typescript
  // P5: USER 不能生卡
  if (user.role === "USER") {
    return forbiddenResponse("普通用户不能生成素材卡，请升级为认证用户");
  }
```

把准入检查（第 149-156 行）从：

```typescript
    if (item.aiDecision !== "accept") {
      return errorResponse(
        "AI_DECISION_NOT_ACCEPT",
        "该内容尚未通过 AI 评估或已被拒绝，请先进行 AI 评估",
        400,
        { aiDecision: item.aiDecision, aiReason: item.aiReason, requestId }
      );
    }
```

改成：

```typescript
    // P5: 准入改为 adminReviewStatus = approved
    if (item.adminReviewStatus !== "approved") {
      return errorResponse(
        "NOT_APPROVED",
        "该内容尚未通过管理员审核，无法生成素材卡",
        400,
        { adminReviewStatus: item.adminReviewStatus, requestId }
      );
    }
```

把去重检查（第 158-168 行）从：

```typescript
    const existingCard = await db.materialCard.findFirst({
      where: { contentItemId: id, cardType },
    });
    if (existingCard) {
      return errorResponse(
        "MATERIAL_CARD_ALREADY_EXISTS",
        "该内容已存在同类型素材卡",
        409,
        { existingCardId: existingCard.id, requestId }
      );
    }
```

改成（加 ownerUserId，公共卡不阻止）：

```typescript
    const existingCard = await db.materialCard.findFirst({
      where: { contentItemId: id, cardType, ownerUserId: user.id },
    });
    if (existingCard) {
      return errorResponse(
        "MATERIAL_CARD_ALREADY_EXISTS",
        "您已为该内容生成过同类型素材卡",
        409,
        { existingCardId: existingCard.id, requestId }
      );
    }

    // P5: 用户级速率限制
    const rateLimit = await checkTaskRateLimit(user.id);
    if (!rateLimit.allowed) {
      return errorResponse(
        "RATE_LIMITED",
        rateLimit.reason ?? "任务数已达上限",
        429,
        { requestId }
      );
    }
```

（import 区补 `checkTaskRateLimit`：`import { createAsyncTask, enqueueAsyncTask, checkTaskRateLimit } from "@/lib/async-task";`）

- [ ] **Step 2: 加卡包分支。** 在 POST handler 解析 body 处（第 111-112 行附近），支持 `cardTypes` 数组：

把：

```typescript
    const body = await request.json().catch(() => ({}));
    const cardType = (body.cardType as CardType) ?? "golden_sentence";
```

后面追加卡包解析：

```typescript
    const cardTypesRaw = body.cardTypes as CardType[] | undefined;
```

然后在准入检查 + 速率限制通过之后（原 `createAsyncTask` 单任务那段），替换为分支逻辑：

```typescript
    // P5: 卡包模式 vs 单类型
    const validTypes: CardType[] = [
      "golden_sentence",
      "standard_expression",
      "case_material",
      "countermeasure",
      "problem_statement",
      "reason_analysis",
      "policy_expression",
      "person_story",
      "article_structure",
    ];

    const requestedTypes: CardType[] = (
      Array.isArray(cardTypesRaw) && cardTypesRaw.length > 0
        ? cardTypesRaw
        : [cardType]
    ).filter((t) => validTypes.includes(t));

    if (requestedTypes.length === 0) {
      return errorResponse(
        "AI_RESPONSE_INVALID_JSON",
        "无效的卡片类型",
        400,
        { requestId }
      );
    }

    // 串行 enqueue（全局并发由 async-task 限流=2；同用户 rateLimit 已查）
    const tasks = [];
    for (const ct of requestedTypes) {
      // 卡包内每类型再查一次去重（已生成的跳过）
      const dup = await db.materialCard.findFirst({
        where: { contentItemId: id, cardType: ct, ownerUserId: user.id },
      });
      if (dup) {
        tasks.push({ cardType: ct, duplicated: true, existingCardId: dup.id });
        continue;
      }
      const task = await createAsyncTask(
        "CARD_GENERATE",
        { contentItemId: id, cardType: ct, requestId },
        user.id
      );
      enqueueAsyncTask(task, () =>
        runGenerateCardTask(id, ct, requestId, user.id)
      );
      tasks.push({ cardType: ct, taskId: task.id, duplicated: false });
    }

    return NextResponse.json(
      {
        accepted: true,
        requestId,
        contentItemId: id,
        tasks,
      },
      { status: 202 }
    );
```

⚠️ 这段替换掉原来的「单任务 createAsyncTask + enqueueAsyncTask + return 202」整块（第 170-189 行）。注意删除原来对单一 `cardType` 的 `validTypes.includes(cardType)` 校验块（第 114-132 行），因为新逻辑在 requestedTypes 里统一校验。

- [ ] **Step 3: 跑单测确认全绿**

Run: `pnpm test src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts`

Expected: 6 个用例全绿。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/content-items/[id]/generate-card/route.ts
git commit -m "feat(generate-card): approved-only, per-user dedup, bundle serial"
```

---

## Task 3: 前端生卡按钮防抖

**Files:**
- Modify: `src/components/ArticleDetail.tsx`（或实际承载生卡按钮的组件——先 grep 确认）

- [ ] **Step 1: 定位生卡按钮组件**

Run: `grep -rln "generate-card" src/components/ src/app/articles/`

确认调用 `/api/content-items/.../generate-card` 的客户端组件文件路径。

- [ ] **Step 2: 在该组件加 loading 状态 + 按钮 disabled**

找到触发 fetch 的按钮，加 `useState`：

```typescript
const [generating, setGenerating] = useState(false);
const [bundleGenerating, setBundleGenerating] = useState(false);
```

单类型生成函数：

```typescript
async function handleGenerate(cardType: CardType) {
  if (generating) return; // 防抖
  setGenerating(true);
  try {
    const res = await fetch(`/api/content-items/${id}/generate-card`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardType }),
    });
    if (res.ok) {
      toast.success("已加入生成队列");
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.message ?? "生成失败");
    }
  } finally {
    setGenerating(false);
  }
}
```

按钮 JSX：

```tsx
<button
  onClick={() => handleGenerate("golden_sentence")}
  disabled={generating}
  className={generating ? "opacity-50 cursor-not-allowed" : ""}
>
  {generating ? "生成中..." : "生成金句卡"}
</button>
```

卡包按钮同理用 `bundleGenerating`。

- [ ] **Step 3: lint 确认**

Run: `pnpm lint src/components/ArticleDetail.tsx`（或对应文件）

Expected: 0 error。

- [ ] **Step 4: Commit**

```bash
git add src/components/ArticleDetail.tsx
git commit -m "feat(ui): debounce generate-card buttons with loading state"
```

---

## Task 4: e2e 素材卡归属

**Files:**
- Create: `e2e/material-card-ownership.spec.ts`

- [ ] **Step 1: 新建 e2e**

```typescript
import { expect, test } from "@playwright/test";
import { loginAsVerifiedUserAPI } from "./helpers/auth";

test.describe("素材卡归属（P5）", () => {
  test("USER 调 generate-card → 403", async ({ request }) => {
    // 用 USER 账号登录（fixture）
    const res = await request.post(`/api/content-items/fixture-approved-id/generate-card`, {
      data: { cardType: "golden_sentence" },
    });
    expect(res.status()).toBe(401); // 未登录先 401
  });

  test("VERIFIED_USER 对 approved 文章生卡 → 202", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, "需 fixture");
    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: { cardType: "golden_sentence" },
    });
    expect(res.status()).toBe(202);
  });

  test("卡包生成 → 返回多 task", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, "需 fixture");
    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: {
        cardTypes: ["golden_sentence", "standard_expression", "case_material", "countermeasure"],
      },
    });
    expect(res.status()).toBe(202);
    const j = await res.json();
    expect(j.tasks.length).toBe(4);
  });

  test("未审核文章生卡 → 400", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const id = process.env.E2E_PENDING_ARTICLE_ID;
    if (!id) test.skip(true, "需 fixture");
    const res = await request.post(`/api/content-items/${id}/generate-card`, {
      data: { cardType: "golden_sentence" },
    });
    expect(res.status()).toBe(400);
  });
});
```

⚠️ 卡包 e2e 会真实调用 AI（消耗 VERIFIED_USER 的 Key）。如果 staging 没有可用 AI mock，把卡包用例标记 `test.skip` 并在交接文档记录。单类型用例依赖 fixture 文章已 approved。

- [ ] **Step 2: 跑 e2e**

Run: `pnpm exec playwright test e2e/material-card-ownership.spec.ts`

Expected: 全绿或 fixture/AI 依赖的用例 skip。

- [ ] **Step 3: Commit**

```bash
git add e2e/material-card-ownership.spec.ts
git commit -m "test(e2e): material card ownership and bundle generation"
```

---

## Task 5: 全量验收 + 交接

**Files:**
- Create: `docs/handoff/P5-generate-card-handoff.md`

- [ ] **Step 1: 验收**

```bash
pnpm lint && pnpm test && pnpm build && pnpm exec playwright test
```

- [ ] **Step 2: 交接文档**

```markdown
# P5 交接文档：generate-card 改造

## 改了什么
- 准入：`aiDecision=accept` → `adminReviewStatus=approved`
- 去重：where 加 `ownerUserId=user.id`；公共卡（null）不阻止私有卡
- USER 角色 → 403（不能生卡）
- 卡包模式：`{ cardTypes: [...] }`，串行 enqueue，已生成跳过
- 用户级速率限制：复用 checkTaskRateLimit（3 并发 / 日 50）
- 前端按钮：loading + disabled 防抖

## AI 调用归属
- VERIFIED_USER 生卡 → resolveAiRuntimeConfig(user.id) → 用户自己的 Key，无 fallback
- USER 被拦在权限层，不消耗任何 Key

## 测试结果
- 单测：6 个新用例，全绿
- e2e：4 个（卡包依赖真实 AI，staging 无 mock 时 skip 已记录）

## ⚠️ 风控/外部依赖
卡包 e2e 会真实调用 AI。staging 跑时如果 AI 服务不可达或 Key 配额耗尽，卡包用例会失败——这不是代码 bug。在最终报告标注。

## 给后续 PR
- P6 收藏功能完成后，P7 详情页要在「我的文章」上下文里展示生卡入口（今日推荐/探索区不放）。
- 决策 9（必须先收藏才能生卡）由 P7 前端控制入口位置保证。
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/handoff/P5-generate-card-handoff.md
git commit -m "docs(handoff): P5 generate card"
git push -u origin HEAD
```

---

## Verification

1. USER 调 generate-card → 403 ✅
2. adminReviewStatus≠approved → 400 ✅
3. 同用户同类型重复 → 409 ✅
4. 公共卡不阻止私有卡 ✅
5. 卡包返回 4 个 task ✅
6. 速率限制 → 429 ✅
7. 前端连点不重复发请求 ✅

---

## Self-Review

**Spec coverage：** 需求 3.5（用户私有卡）→ Task 2 ✅；需求 3.6（去重含 ownerUserId）→ Task 2 ✅；需求 3.8（卡包）→ Task 2 ✅；需求 6.6（generate-card 准入 approved + 自付）→ Task 2 ✅；决策 7（前端防抖+后端约束）→ Task 2-3 ✅；决策 8（卡包串行）→ Task 2 ✅；决策 21（USER 不能生卡）→ Task 2 ✅。

**Placeholder scan：** 无。✅

**Type consistency：** `CardType` 枚举 9 值与 P1/generate-card 现有 validTypes 一致；`checkTaskRateLimit` 返回 `{allowed, reason?}` 与 async-task.ts:200 签名一致。✅
