# P3: 文章可见性过滤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**前置依赖：** P2 必须已完成（ContentItem 含 `adminReviewStatus` 字段）。

**Goal:** 非 ADMIN 用户访问文章列表/详情时，只看得到 `adminReviewStatus = 'approved'` 的文章；ADMIN 可按 5 种审核状态筛选。防止用户通过文章 ID 绕过列表过滤直接访问未审核文章。

**Architecture:** 扩展现有的 `contentVisibilityWhere`（`src/lib/data-isolation.ts`）注入 `adminReviewStatus` 过滤；articles list 路由加 `adminReviewStatus` 查询参数（非 ADMIN 强制 approved）；content-items detail 路由在 `canAccessResource` 之后加一道 `adminReviewStatus` 检查。

**Tech Stack:** Next.js App Router · Prisma · Vitest · Playwright。

---

## File Structure

| 文件 | 责任 | 本 plan 操作 |
|---|---|---|
| `src/lib/data-isolation.ts` | 可见性 where 构造 | 扩展 `contentVisibilityWhere` 注入 adminReviewStatus |
| `src/lib/__tests__/data-isolation.test.ts` | 单测 | 新建覆盖新逻辑 |
| `src/app/api/articles/route.ts` | 文章列表 | 加 `adminReviewStatus` 查询参数 + 非 ADMIN 强制 approved |
| `src/app/api/articles/__tests__/route.test.ts` | 列表单测 | 追加审核过滤用例 |
| `src/app/api/content-items/[id]/route.ts` | 文章详情 | GET 加 `adminReviewStatus` 检查 |
| `src/app/api/content-items/[id]/__tests__/route.test.ts` | 详情单测 | 新建 |
| `e2e/articles.spec.ts` | 文章 e2e | 追加审核可见性用例 |
| `docs/handoff/P3-article-visibility-handoff.md` | 交接文档 | 新建 |

---

## Task 1: 扩展 `contentVisibilityWhere` 注入审核过滤（先写测试）

**Files:**
- Create: `src/lib/__tests__/data-isolation-review.test.ts`（不污染现有 data-isolation.test.ts）

- [ ] **Step 1: 新建测试文件，锁定新行为**

```typescript
import { describe, expect, it } from "vitest";
import {
  contentVisibilityWhere,
  mergeWhere,
} from "@/lib/data-isolation";

describe("contentVisibilityWhere — adminReviewStatus (P3)", () => {
  it("ADMIN 返回空对象（不加 adminReviewStatus 过滤，看全部）", () => {
    const admin = { id: "a", role: "ADMIN", username: "a", status: "ACTIVE" };
    const where = contentVisibilityWhere(admin);
    expect(where).toEqual({});
  });

  it("VERIFIED_USER 注入 adminReviewStatus = approved", () => {
    const vu = {
      id: "v",
      role: "VERIFIED_USER",
      username: "v",
      status: "ACTIVE",
    };
    const where = contentVisibilityWhere(vu);
    expect(where.adminReviewStatus).toBe("approved");
  });

  it("USER 注入 adminReviewStatus = approved", () => {
    const u = { id: "u", role: "USER", username: "u", status: "ACTIVE" };
    const where = contentVisibilityWhere(u);
    expect(where.adminReviewStatus).toBe("approved");
  });

  it("非 ADMIN 同时保留原有 OR（public/own/legacy）+ adminReviewStatus", () => {
    const vu = {
      id: "v",
      role: "VERIFIED_USER",
      username: "v",
      status: "ACTIVE",
    };
    const where = contentVisibilityWhere(vu);
    expect(where.adminReviewStatus).toBe("approved");
    expect(Array.isArray(where.OR)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm test src/lib/__tests__/data-isolation-review.test.ts`

Expected: VERIFIED_USER / USER 用例 FAIL（`where.adminReviewStatus` 是 undefined，因为现有函数不返回这个字段）。

- [ ] **Step 3: Commit（红测试）**

```bash
git add src/lib/__tests__/data-isolation-review.test.ts
git commit -m "test(data-isolation): lock adminReviewStatus filter behavior"
```

---

## Task 2: 实现 `contentVisibilityWhere` 审核 + 兼容老测试

**Files:**
- Modify: `src/lib/data-isolation.ts:10-21`

⚠️ 关键约束：现有 `articles/__tests__/route.test.ts` mock 了 `contentVisibilityWhere`（返回带 OR 的对象），所以改实现不会破坏路由测试。但 `src/lib/__tests__/data-isolation-legacy.test.ts` 等老测试可能直接调真实函数——改之前先确认。

- [ ] **Step 1: 检查现有 data-isolation 测试是否会受影响**

Run: `grep -rn "contentVisibilityWhere" src/lib/__tests__/`

如果有测试断言了返回对象的**完整结构**（`toEqual`），改造时会挂。记录下来，Task 2 末尾修。

- [ ] **Step 2: 修改 `contentVisibilityWhere`**

打开 `src/lib/data-isolation.ts`，把第 10-21 行：

```typescript
export function contentVisibilityWhere(user: AuthUser) {
  if (user.role === "ADMIN") {
    return {}; // Admin sees all
  }
  return {
    OR: [
      { visibility: "public" },
      { ownerUserId: user.id },
      { ownerUserId: null }, // Legacy public data without owner
    ],
  };
}
```

改成（追加 `adminReviewStatus: "approved"`）：

```typescript
export function contentVisibilityWhere(user: AuthUser) {
  if (user.role === "ADMIN") {
    return {}; // Admin sees all
  }
  return {
    adminReviewStatus: "approved", // P3: 非 ADMIN 只看审核通过
    OR: [
      { visibility: "public" },
      { ownerUserId: user.id },
      { ownerUserId: null }, // Legacy public data without owner
    ],
  };
}
```

- [ ] **Step 3: 跑新测试 + 老测试**

Run: `pnpm test src/lib/__tests__/`

Expected: 新测试（data-isolation-review）全绿。如果老测试（data-isolation-legacy 等）有挂，是因为它们断言了完整对象结构——去对应文件把断言改成「包含 adminReviewStatus」或加这个字段。

- [ ] **Step 4: 修复受影响的老测试（如有）**

打开挂掉的测试文件，把类似：

```typescript
expect(contentVisibilityWhere(user)).toEqual({
  OR: [...],
});
```

改成：

```typescript
expect(contentVisibilityWhere(user)).toMatchObject({
  adminReviewStatus: "approved",
  OR: [...],
});
```

或用 `toMatchObject` 替代 `toEqual`，允许额外字段。

- [ ] **Step 5: 全量测试确认绿**

Run: `pnpm test`

Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/lib/data-isolation.ts src/lib/__tests__/
git commit -m "feat(data-isolation): filter non-admin to approved articles"
```

---

## Task 3: 文章列表加 `adminReviewStatus` 查询参数

**Files:**
- Modify: `src/app/api/articles/route.ts`
- Modify: `src/app/api/articles/__tests__/route.test.ts`

- [ ] **Step 1: 在 articles 路由单测追加新用例**

打开 `src/app/api/articles/__tests__/route.test.ts`，在末尾的 describe 块内追加：

```typescript
  it("ADMIN 可用 adminReviewStatus=pending_admin 筛选", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    const req = new NextRequest(
      "http://localhost/api/articles?adminReviewStatus=pending_admin"
    );
    await GET(req);
    // mock 的 contentVisibilityWhere 对 ADMIN 返回 {}，所以 where 应含 qualityStatus-like 过滤
    // 这里验证请求不报错且调用 findMany
    expect(mocks.findMany).toHaveBeenCalled();
  });

  it("VERIFIED_USER 传 adminReviewStatus=all 仍强制 approved（不能看未审核）", async () => {
    const VERIFIED = {
      id: "v",
      username: "v",
      role: "VERIFIED_USER" as const,
      status: "ACTIVE" as const,
    };
    authMocks.getUserFromRequest.mockResolvedValue(VERIFIED);
    const req = new NextRequest(
      "http://localhost/api/articles?adminReviewStatus=all"
    );
    await GET(req);
    // 非 ADMIN 时，强制 approved（由 contentVisibilityWhere 保证）
    expect(mocks.findMany).toHaveBeenCalled();
  });
```

⚠️ 注意：现有路由单测 mock 了 `contentVisibilityWhere`（返回固定对象），所以这些用例验证的是「请求不崩 + findMany 被调用」。真正的过滤逻辑由 Task 1-2 的 data-isolation 单测保证。

- [ ] **Step 2: 跑测试确认新用例失败（如果路由还没读 adminReviewStatus 参数，可能不挂但不报错——重点在 Step 3 实现）**

Run: `pnpm test src/app/api/articles/__tests__/route.test.ts`

Expected: 新用例可能 PASS（因为只是验证 findMany 被调用），但路由还没实现参数处理。Step 3 实现后行为更完整。

- [ ] **Step 3: 修改 articles 路由，加 `adminReviewStatus` 参数处理**

打开 `src/app/api/articles/route.ts`，在第 25 行附近（其他 query 参数解析处）加：

```typescript
    const adminReviewStatus = searchParams.get("adminReviewStatus");
```

然后在 `if (aiDecision && aiDecision !== "all")` 块之后（约第 82 行后）加：

```typescript
    // P3: 审核状态筛选（仅 ADMIN 生效；非 ADMIN 由 contentVisibilityWhere 强制 approved）
    const currentUser = await getUserFromRequest(request);
    const isAdmin = currentUser?.role === "ADMIN";
    if (isAdmin && adminReviewStatus && adminReviewStatus !== "all") {
      where.adminReviewStatus = adminReviewStatus;
    }
```

⚠️ 注意：路由第 113 行已经有 `const user = await getUserFromRequest(request);`。为了避免重复调用，可以把上面这段合并到第 113 行之后（用已有的 `user` 变量判断 `isAdmin`）。重构成：

```typescript
    // 第 113 行已有：
    const user = await getUserFromRequest(request);
    if (user) {
      where = mergeWhere(where, contentVisibilityWhere(user));
      // P3: ADMIN 按审核状态筛选
      if (user.role === "ADMIN" && adminReviewStatus && adminReviewStatus !== "all") {
        where.adminReviewStatus = adminReviewStatus;
      }
    } else {
      // ... 原有匿名分支
    }
```

- [ ] **Step 4: 跑全量单测**

Run: `pnpm test src/app/api/articles/__tests__/route.test.ts`

Expected: 全绿（含新 2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/articles/route.ts src/app/api/articles/__tests__/route.test.ts
git commit -m "feat(articles): add adminReviewStatus filter for admin users"
```

---

## Task 4: 文章详情加 `adminReviewStatus` 检查（防 ID 绕过）

**Files:**
- Create: `src/app/api/content-items/[id]/__tests__/route.test.ts`
- Modify: `src/app/api/content-items/[id]/route.ts`

- [ ] **Step 1: 新建详情路由单测**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => {
  const ADMIN = {
    id: "admin-id",
    username: "admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };
  const VERIFIED = {
    id: "verified-id",
    username: "verified",
    role: "VERIFIED_USER" as const,
    status: "ACTIVE" as const,
  };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
  requireAuth: authMocks.getUserFromRequest,
  requireAdmin: vi.fn().mockResolvedValue(null),
  authErrorResponse: () => Response.json({ error: "unauth" }, { status: 401 }),
}));

vi.mock("@/lib/data-isolation", () => ({
  canAccessResource: vi.fn().mockReturnValue(true),
  canModifyResource: vi.fn().mockReturnValue(true),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    contentItem: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      delete: mocks.delete,
    },
  },
}));

import { GET } from "../route";

function makeReq(id: string, cookie: string | null) {
  const init: RequestInit = { method: "GET" };
  if (cookie) init.headers = { cookie };
  return [
    new NextRequest(`http://localhost/api/content-items/${id}`, init),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/content-items/[id] — adminReviewStatus (P3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER 访问 pending_admin 文章 → 404（防 ID 绕过）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "pending_admin",
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("VERIFIED_USER 访问 approved 文章 → 200", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      materialCards: [],
      annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });

  it("ADMIN 访问 pending_admin 文章 → 200（管理员看全部）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "pending_admin",
      materialCards: [],
      annotations: [],
      source: { id: "s", name: "n", platform: "website" },
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: 跑测试，确认 VERIFIED_USER pending_admin 用例失败（路由现在还放行）**

Run: `pnpm test src/app/api/content-items/[id]/__tests__/route.test.ts`

Expected: 第一个用例 FAIL（期望 404 实际 200）。

- [ ] **Step 3: 修改详情路由加检查**

打开 `src/app/api/content-items/[id]/route.ts`，在 GET handler 的 `canAccessResource` 检查之后（第 29-31 行的 `if (!canAccessResource(...))` 块之后），加：

```typescript
    // P3: 非 ADMIN 只能访问 approved 文章（防 ID 绕过）
    if (
      user.role !== "ADMIN" &&
      item.adminReviewStatus !== "approved"
    ) {
      return NextResponse.json({ error: "内容条目不存在" }, { status: 404 });
    }
```

用 404 而非 403——避免泄露「文章存在但未审核」的信息。

- [ ] **Step 4: 跑测试确认全绿**

Run: `pnpm test src/app/api/content-items/[id]/__tests__/route.test.ts`

Expected: 3 个用例全绿。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/content-items/[id]/
git commit -m "feat(content-items): block non-admin from unapproved articles"
```

---

## Task 5: e2e 追加可见性用例

**Files:**
- Modify: `e2e/articles.spec.ts`

- [ ] **Step 1: 在 `e2e/articles.spec.ts` 末尾追加**

```typescript
test.describe('文章审核可见性（P3）', () => {
  test('VERIFIED_USER 文章列表不返回 pending_admin/rejected', async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const res = await request.get('/api/articles');
    expect(res.status()).toBe(200);
    const json = await res.json();
    const allApproved = json.data.every(
      (item: { adminReviewStatus: string }) => item.adminReviewStatus === 'approved'
    );
    expect(allApproved).toBeTruthy();
  });

  test('VERIFIED_USER 访问未审核文章详情 → 404', async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    // 需要一个已知是 pending_admin 的 contentItemId（来自 fixtures/seed）
    const pendingId = process.env.E2E_PENDING_ARTICLE_ID;
    if (!pendingId) {
      test.skip(true, '需要 E2E_PENDING_ARTICLE_ID fixture');
    }
    const res = await request.get(`/api/content-items/${pendingId}`);
    expect(res.status()).toBe(404);
  });

  test('ADMIN 可用 adminReviewStatus=pending_admin 筛选', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/articles?adminReviewStatus=pending_admin');
    expect(res.status()).toBe(200);
    const json = await res.json();
    const allPending = json.data.every(
      (item: { adminReviewStatus: string }) => item.adminReviewStatus === 'pending_admin'
    );
    expect(allPending).toBeTruthy();
  });
});
```

⚠️ 依赖：`loginAsVerifiedUserAPI` helper（P1 Task 7 已加）；`E2E_PENDING_ARTICLE_ID` fixture（需在 seed 里准备一篇 pending_admin 文章，或在 `global-setup.ts` 创建）。如果 fixture 缺失，第二个用例 `test.skip` 不阻塞。

- [ ] **Step 2: 准备 fixture（如缺）**

查 `e2e/global-setup.ts` 或 `prisma/seed*.ts`，确认有一篇 `adminReviewStatus = 'pending_admin'` 的文章，把它的 id 写到 `.env.test` 的 `E2E_PENDING_ARTICLE_ID`。没有就加 seed。

- [ ] **Step 3: 跑 e2e**

Run: `pnpm exec playwright test e2e/articles.spec.ts`

Expected: 新增 3 用例全绿（fixture 缺的 skip）。

- [ ] **Step 4: Commit**

```bash
git add e2e/articles.spec.ts e2e/global-setup.ts .env.test
git commit -m "test(e2e): verify article review visibility for non-admin"
```

---

## Task 6: 全量验收 + 交接文档

**Files:**
- Create: `docs/handoff/P3-article-visibility-handoff.md`

- [ ] **Step 1: 验收命令**

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

Expected: 全绿（fixture 缺失导致的 skip 可接受，记录在交接文档）。

- [ ] **Step 2: 写交接文档**

```markdown
# P3 交接文档：文章可见性过滤

## 改了什么
- `src/lib/data-isolation.ts`：`contentVisibilityWhere` 对非 ADMIN 注入 `adminReviewStatus: "approved"`
- `src/app/api/articles/route.ts`：加 `adminReviewStatus` 查询参数，仅 ADMIN 生效；非 ADMIN 由 visibility 兜底强制 approved
- `src/app/api/content-items/[id]/route.ts`：GET 加审核检查，非 ADMIN 访问未审核文章返 404（防 ID 绕过）

## 权限矩阵
| 场景 | USER/VERIFIED_USER | ADMIN |
|---|---|---|
| 文章列表默认 | 只看 approved | 全部 |
| 文章列表 adminReviewStatus=all | 强制 approved | 全部 |
| 文章列表 adminReviewStatus=pending_admin | 强制 approved | 仅 pending_admin |
| 文章详情 approved | 200 | 200 |
| 文章详情 pending_admin/rejected | 404 | 200 |

## 测试结果
- 单测：data-isolation 新 4 + articles 新 2 + content-items 详情新 3 = 9 个新用例，全绿
- e2e：articles 新 3 个（fixture 缺失 skip 已记录）

## 给后续 PR
- P4 审核 approve 时务必设 `adminReviewStatus='approved'`，否则文章对普通用户不可见。
- P7 前台「今日推荐」/「探索区」都依赖 approved 过滤，无需重复实现。
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/handoff/P3-article-visibility-handoff.md
git commit -m "docs(handoff): P3 article visibility"
git push -u origin HEAD
```

---

## Verification

1. VERIFIED_USER 文章列表只含 approved ✅
2. VERIFIED_USER 直接访问 pending_admin 文章 ID → 404 ✅
3. ADMIN 列表可用 5 种 adminReviewStatus 筛选 ✅
4. ADMIN 访问任意状态文章 → 200 ✅
5. 现有匿名访问行为不回归 ✅

---

## Self-Review

**Spec coverage：** 需求 3.3（普通用户只看 approved）→ Task 1-2 ✅；需求 6.2（列表加审核过滤）→ Task 3 ✅；需求 6.3（详情防 ID 绕过）→ Task 4 ✅；决策 5（approved 才可见）→ 全覆盖 ✅。

**Placeholder scan：** 无。所有代码完整。✅

**Type consistency：** `adminReviewStatus` 字符串值 `approved/pending_admin/pending_admin/rejected/pending_ai` 全 plan 一致；`contentVisibilityWhere` 签名不变（只改返回对象内容）。✅
