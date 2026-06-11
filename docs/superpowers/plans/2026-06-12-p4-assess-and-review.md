# P4: assess 改管理员 + review 接口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**前置依赖：** P2（审核字段）、P3（可见性）已完成。

**Goal：** ① `/api/content-items/assess` 收紧为 ADMIN-only，AI 评估后写回 `adminReviewStatus`（accept→pending_admin, reject→rejected, error→pending_ai）；② 新增 `POST /api/admin/content-items/review`（批量审核，approve 要求 aiDecision=accept，force-approve 需 note；下架连带删全部用户的素材卡）；③ 新增 feature 接口（推送/撤下今日推荐，下架自动清标记）。

**Architecture：** assess 路由权限换 `requireAdmin`，状态写回扩展 `adminReviewStatus`；review 路由用事务保证「改文章状态 + 删关联 MaterialCard」原子性；feature 是简单的 `featuredToday` 布尔翻转。

**Tech Stack：** Next.js App Router · Prisma 事务 · `requireAdmin` · Vitest · Playwright。

---

## File Structure

| 文件 | 责任 | 操作 |
|---|---|---|
| `src/app/api/content-items/assess/route.ts` | AI 评估 | 权限换 requireAdmin + 状态写回 |
| `src/app/api/content-items/assess/__tests__/route.test.ts` | 单测 | 新建 |
| `src/app/api/admin/content-items/review/route.ts` | 审核接口 | 新建 |
| `src/app/api/admin/content-items/review/__tests__/route.test.ts` | 单测 | 新建 |
| `src/app/api/admin/content-items/feature/route.ts` | 今日推荐 | 新建 |
| `src/app/api/admin/content-items/feature/__tests__/route.test.ts` | 单测 | 新建 |
| `e2e/admin-review.spec.ts` | 审核 e2e | 扩充现有 review.spec.ts 或新建 |
| `docs/handoff/P4-assess-review-handoff.md` | 交接 | 新建 |

---

## Task 1: assess 路由权限单测（先红）

**Files:**
- Create: `src/app/api/content-items/assess/__tests__/route.test.ts`

- [ ] **Step 1: 新建测试**

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
  requireVerifiedUser: authMocks.getUserFromRequest,
  requireAdmin: authMocks.getUserFromRequest,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const taskMocks = vi.hoisted(() => ({
  create: vi.fn(),
  enqueue: vi.fn(),
  count: vi.fn(),
}));
vi.mock("@/lib/async-task", () => ({
  createAsyncTask: taskMocks.create,
  enqueueAsyncTask: taskMocks.enqueue,
}));

vi.mock("@/lib/db", () => ({
  db: { contentItem: { count: taskMocks.count } },
}));

import { POST } from "../route";

function makeReq(cookie: string | null, body?: unknown) {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/content-items/assess", init);
}

describe("POST /api/content-items/assess — permission lockdown (P4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER → 403（不再放行）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    taskMocks.count.mockResolvedValue(1);
    const res = await POST(makeReq("auth_token=t", { ids: ["x"] }));
    expect(res.status).toBe(403);
    expect(taskMocks.create).not.toHaveBeenCalled();
  });

  it("匿名 → 401", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null);
    const res = await POST(makeReq(null, { ids: ["x"] }));
    expect(res.status).toBe(401);
  });

  it("ADMIN → 进入任务队列（202）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    taskMocks.count.mockResolvedValue(2);
    taskMocks.create.mockResolvedValue({ id: "task-1", type: "AI_ASSESS" });
    const res = await POST(makeReq("auth_token=t", { ids: ["a", "b"] }));
    expect(res.status).toBe(202);
    expect(taskMocks.create).toHaveBeenCalled();
    expect(taskMocks.enqueue).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认 VERIFIED_USER 用例失败**

Run: `pnpm test src/app/api/content-items/assess/__tests__/route.test.ts`

Expected: VERIFIED_USER 用例 FAIL（期望 403 实际 202，因为路由现在还放行）。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/content-items/assess/__tests__/route.test.ts
git commit -m "test(assess): lock admin-only permission"
```

---

## Task 2: assess 路由权限收紧 + 状态写回

**Files:**
- Modify: `src/app/api/content-items/assess/route.ts`

- [ ] **Step 1: 改 import（第 5 行）**

```typescript
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
```

改成：

```typescript
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
```

- [ ] **Step 2: 改 POST handler 权限调用（第 134 行）**

```typescript
const user = await requireVerifiedUser(request);
```

改成：

```typescript
const user = await requireAdmin(request);
```

- [ ] **Step 3: 扩展 assessSingleItem 的状态写回（第 36-54 行的 db.contentItem.update）**

找到 `assessSingleItem` 内的 `data: { aiDecision: result.decision, ... }`，在 accept 分支补 `adminReviewStatus: "pending_admin"`，reject 分支补 `adminReviewStatus: "rejected"`：

```typescript
    await db.contentItem.update({
      where: { id: item.id },
      data: {
        aiDecision: result.decision,
        aiReason: result.reason,
        contentGenre: result.contentGenre,
        aiCategories: JSON.stringify(result.categories),
        aiUsableFor: JSON.stringify(result.usableFor),
        aiSummary: result.summary || null,
        aiQuotes: JSON.stringify(result.quotes),
        aiAssessedAt: new Date(),
        aiAssessmentError: null,
        qualityStatus: result.decision === "accept" ? "accepted" : "filtered",
        processingStatus:
          result.decision === "accept" ? "pending" : "filtered",
        filterReason:
          result.decision === "reject" ? `AI 拒绝: ${result.reason}` : null,
        // P4: 写回 adminReviewStatus
        adminReviewStatus:
          result.decision === "accept" ? "pending_admin" : "rejected",
      },
    });
```

- [ ] **Step 4: error 分支保持 pending_ai（第 61-67 行）**

确认 catch 块的 update 不改 `adminReviewStatus`（默认值已是 pending_ai，无需写）。但显式补一行更清晰：

```typescript
    await db.contentItem.update({
      where: { id: item.id },
      data: {
        aiAssessmentError: msg,
        aiAssessedAt: new Date(),
        adminReviewStatus: "pending_ai", // P4: 显式保持待评估
      },
    });
```

- [ ] **Step 5: 跑单测确认全绿**

Run: `pnpm test src/app/api/content-items/assess/__tests__/route.test.ts`

Expected: 3 个用例全绿。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/content-items/assess/route.ts
git commit -m "feat(assess): admin-only and write back adminReviewStatus"
```

---

## Task 3: review 接口单测（先红）

**Files:**
- Create: `src/app/api/admin/content-items/review/__tests__/route.test.ts`

- [ ] **Step 1: 新建测试**

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
    id: "v",
    username: "v",
    role: "VERIFIED_USER" as const,
    status: "ACTIVE" as const,
  };
  return {
    USERS: { ADMIN, VERIFIED },
    authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
  };
});

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.getUserFromRequest,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const tx = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  updateFeatured: vi.fn(),
}));
const dbMock = {
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      contentItem: {
        findMany: tx.findMany,
        updateMany: tx.updateMany,
      },
      materialCard: { deleteMany: tx.deleteMany },
    })
  ),
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/audit-logger", () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "../route";

function makeReq(cookie: string | null, body: unknown) {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  init.headers = { ...(init.headers || {}), "content-type": "application/json" };
  init.body = JSON.stringify(body);
  return new NextRequest("http://localhost/api/admin/content-items/review", init);
}

describe("POST /api/admin/content-items/review (P4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER → 403", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await POST(makeReq("auth_token=t", { ids: ["x"], action: "approve" }));
    expect(res.status).toBe(403);
  });

  it("approve 但文章 aiDecision != accept → 400", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    tx.findMany.mockResolvedValue([
      { id: "x", aiDecision: "reject", adminReviewStatus: "rejected" },
    ]);
    const res = await POST(makeReq("auth_token=t", { ids: ["x"], action: "approve" }));
    expect(res.status).toBe(400);
  });

  it("approve（aiDecision=accept）→ 设 approved", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    tx.findMany.mockResolvedValue([
      { id: "x", aiDecision: "accept", adminReviewStatus: "pending_admin" },
    ]);
    tx.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(makeReq("auth_token=t", { ids: ["x"], action: "approve" }));
    expect(res.status).toBe(200);
    expect(tx.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminReviewStatus: "approved" }),
      })
    );
  });

  it("force-approve（aiDecision=reject + force=true + note）→ 设 approved", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    tx.findMany.mockResolvedValue([
      { id: "x", aiDecision: "reject", adminReviewStatus: "rejected" },
    ]);
    tx.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(
      makeReq("auth_token=t", {
        ids: ["x"],
        action: "approve",
        force: true,
        note: "AI 误判，人工确认可用",
      })
    );
    expect(res.status).toBe(200);
  });

  it("force-approve 无 note → 400", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    tx.findMany.mockResolvedValue([
      { id: "x", aiDecision: "reject", adminReviewStatus: "rejected" },
    ]);
    const res = await POST(
      makeReq("auth_token=t", { ids: ["x"], action: "approve", force: true })
    );
    expect(res.status).toBe(400);
  });

  it("reject（下架 approved 文章）→ 删除全部用户的素材卡", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    tx.findMany.mockResolvedValue([
      { id: "x", aiDecision: "accept", adminReviewStatus: "approved" },
    ]);
    tx.updateMany.mockResolvedValue({ count: 1 });
    tx.deleteMany.mockResolvedValue({ count: 5 });
    const res = await POST(
      makeReq("auth_token=t", { ids: ["x"], action: "reject", note: "内容过期" })
    );
    expect(res.status).toBe(200);
    expect(tx.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contentItemId: { in: ["x"] } } })
    );
  });
});
```

- [ ] **Step 2: 跑测试确认全部失败（路由还没建）**

Run: `pnpm test src/app/api/admin/content-items/review/__tests__/route.test.ts`

Expected: 全 FAIL（import 失败，路由不存在）。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/content-items/review/__tests__/route.test.ts
git commit -m "test(review): lock admin review endpoint behavior"
```

---

## Task 4: 实现 review 接口

**Files:**
- Create: `src/app/api/admin/content-items/review/route.ts`

- [ ] **Step 1: 新建路由**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";

type ReviewAction = "approve" | "reject";

interface ReviewBody {
  ids: string[];
  action: ReviewAction;
  note?: string;
  force?: boolean;
}

// POST /api/admin/content-items/review
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as ReviewBody;
    const { ids, action, note, force } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action 非法" }, { status: 400 });
    }

    // force-approve 必须填 note
    if (action === "approve" && force && !note?.trim()) {
      return NextResponse.json(
        { error: "强制通过必须填写理由" },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const items = await tx.contentItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, aiDecision: true, adminReviewStatus: true },
      });

      if (action === "approve") {
        // 非 force：必须 aiDecision=accept
        if (!force) {
          const notAcceptable = items.filter((i) => i.aiDecision !== "accept");
          if (notAcceptable.length > 0) {
            throw new Error("REQUIRE_AI_ACCEPT");
          }
        }

        await tx.contentItem.updateMany({
          where: { id: { in: ids } },
          data: {
            adminReviewStatus: "approved",
            adminReviewedAt: new Date(),
            adminReviewedBy: user.id,
            adminReviewNote: note ?? null,
            publicVisibleAt: new Date(),
            visibility: "public",
          },
        });

        return { reviewed: ids.length, action, force: !!force };
      }

      // reject：下架 → 删除全部用户的素材卡 + 清今日推荐
      await tx.materialCard.deleteMany({
        where: { contentItemId: { in: ids } },
      });

      await tx.contentItem.updateMany({
        where: { id: { in: ids } },
        data: {
          adminReviewStatus: "rejected",
          adminReviewedAt: new Date(),
          adminReviewedBy: user.id,
          adminReviewNote: note ?? null,
          featuredToday: false, // 下架自动清今日推荐
          publicVisibleAt: null,
        },
      });

      return { reviewed: ids.length, action, cardsDeleted: true };
    });

    await auditLog({
      userId: user.id,
      action: "review",
      resource: "ContentItem",
      resourceId: ids.join(","),
      detail: { action, note: note?.slice(0, 200), force: !!force },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "REQUIRE_AI_ACCEPT") {
      return NextResponse.json(
        { error: "审批通过要求文章已通过 AI 评估（或使用 force 强制）" },
        { status: 400 }
      );
    }
    console.error("review failed:", error);
    return NextResponse.json({ error: "审核失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 跑单测确认全绿**

Run: `pnpm test src/app/api/admin/content-items/review/__tests__/route.test.ts`

Expected: 6 个用例全绿。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/content-items/review/route.ts
git commit -m "feat(review): admin batch review with force-approve and card cleanup"
```

---

## Task 5: feature 接口（今日推荐推送/撤下）

**Files:**
- Create: `src/app/api/admin/content-items/feature/route.ts`
- Create: `src/app/api/admin/content-items/feature/__tests__/route.test.ts`

- [ ] **Step 1: 新建测试**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: {
    ADMIN: { id: "a", username: "a", role: "ADMIN" as const, status: "ACTIVE" as const },
    VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const },
  },
  authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: authMocks.getUserFromRequest,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { contentItem: { findUnique: mocks.findUnique, update: mocks.update } },
}));

import { POST, DELETE } from "../route";

function makeReq(method: string, cookie: string | null, body?: unknown) {
  const init: RequestInit = { method };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/admin/content-items/feature", init);
}

describe("feature endpoints (P4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER POST → 403", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await POST(makeReq("POST", "auth_token=t", { id: "x" }));
    expect(res.status).toBe(403);
  });

  it("推送未审核文章 → 400（必须先 approved）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      adminReviewStatus: "pending_admin",
    });
    const res = await POST(makeReq("POST", "auth_token=t", { id: "x" }));
    expect(res.status).toBe(400);
  });

  it("推送 approved 文章 → featuredToday=true", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      adminReviewStatus: "approved",
    });
    mocks.update.mockResolvedValue({});
    const res = await POST(makeReq("POST", "auth_token=t", { id: "x" }));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { featuredToday: true } })
    );
  });

  it("DELETE 撤下 → featuredToday=false", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.update.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE", "auth_token=t", { id: "x" }));
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { featuredToday: false } })
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/app/api/admin/content-items/feature/__tests__/route.test.ts`

Expected: 全 FAIL（路由不存在）。

- [ ] **Step 3: 实现 feature 路由**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth";

// POST /api/admin/content-items/feature — 推送到今日推荐
export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { id } = (await request.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id 必填" }, { status: 400 });

    const item = await db.contentItem.findUnique({
      where: { id },
      select: { id: true, adminReviewStatus: true },
    });
    if (!item)
      return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (item.adminReviewStatus !== "approved") {
      return NextResponse.json(
        { error: "仅审核通过的文章可推送至今日推荐" },
        { status: 400 }
      );
    }

    await db.contentItem.update({
      where: { id },
      data: { featuredToday: true },
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("feature POST failed:", error);
    return NextResponse.json({ error: "推送失败" }, { status: 500 });
  }
}

// DELETE /api/admin/content-items/feature — 从今日推荐撤下
export async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id 必填" }, { status: 400 });

    await db.contentItem.update({
      where: { id },
      data: { featuredToday: false },
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("feature DELETE failed:", error);
    return NextResponse.json({ error: "撤下失败" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 跑测试确认全绿**

Run: `pnpm test src/app/api/admin/content-items/feature/__tests__/route.test.ts`

Expected: 4 个用例全绿。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/content-items/feature/
git commit -m "feat(feature): admin push/remove today recommend"
```

---

## Task 6: e2e 审核流

**Files:**
- Modify or Create: `e2e/admin-review.spec.ts`

- [ ] **Step 1: 新建或扩充审核 e2e**

```typescript
import { expect, test } from "@playwright/test";
import { loginAsAdminAPI } from "./helpers/auth";

test.describe("管理员审核流（P4）", () => {
  test("ADMIN 批量通过 pending_admin 文章", async ({ request }) => {
    await loginAsAdminAPI(request);
    // 先取一篇 pending_admin
    const list = await request.get(
      "/api/articles?adminReviewStatus=pending_admin&pageSize=1"
    );
    const listJson = await list.json();
    if (!listJson.data?.length) {
      test.skip(true, "无 pending_admin 文章 fixture");
    }
    const id = listJson.data[0].id;

    const res = await request.post("/api/admin/content-items/review", {
      data: { ids: [id], action: "approve" },
    });
    expect(res.status()).toBe(200);

    // 验证文章已 approved
    const detail = await request.get(`/api/content-items/${id}`);
    expect(detail.status()).toBe(200);
    const dj = await detail.json();
    expect(dj.adminReviewStatus).toBe("approved");
  });

  test("force-approve AI 拒绝的文章（需 note）", async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.post("/api/admin/content-items/review", {
      data: {
        ids: [process.env.E2E_REJECTED_ARTICLE_ID ?? "unknown"],
        action: "approve",
        force: true,
        note: "AI 误判",
      },
    });
    // 如果 fixture 存在 → 200；不存在 → 跳过逻辑由 fixture 保证
    expect([200, 404]).toContain(res.status());
  });

  test("下架 approved 文章 → 用户素材卡被删", async ({ request }) => {
    await loginAsAdminAPI(request);
    // 前置：需有一篇已 approved 且用户已生卡的文章（fixture）
    const id = process.env.E2E_APPROVED_WITH_CARDS_ID;
    if (!id) test.skip(true, "需 fixture");

    const res = await request.post("/api/admin/content-items/review", {
      data: { ids: [id], action: "reject", note: "下架测试" },
    });
    expect(res.status()).toBe(200);

    // 验证 MaterialCard 已删（管理员看 cards 列表）
    const cards = await request.get(`/api/material-cards?contentItemId=${id}`);
    const cj = await cards.json();
    const count = cj.data?.length ?? cj.length ?? 0;
    expect(count).toBe(0);
  });

  test("推送 approved 文章到今日推荐", async ({ request }) => {
    await loginAsAdminAPI(request);
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, "需 fixture");

    const res = await request.post("/api/admin/content-items/feature", {
      data: { id },
    });
    expect(res.status()).toBe(200);
  });
});
```

- [ ] **Step 2: 准备 fixtures（在 global-setup 或 seed）**

确保 seed 里有：一篇 `pending_admin`、一篇 `rejected`、一篇 `approved`（带 cards）、一篇 `approved`（无 cards）。把 id 写到 `.env.test`。

- [ ] **Step 3: 跑 e2e**

Run: `pnpm exec playwright test e2e/admin-review.spec.ts`

Expected: 全绿（fixture 缺失的 skip 可接受）。

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-review.spec.ts e2e/global-setup.ts .env.test
git commit -m "test(e2e): admin review flow with force-approve and takedown"
```

---

## Task 7: 全量验收 + 交接

**Files:**
- Create: `docs/handoff/P4-assess-review-handoff.md`

- [ ] **Step 1: 验收**

```bash
pnpm lint && pnpm test && pnpm build && pnpm exec playwright test
```

- [ ] **Step 2: 交接文档**

```markdown
# P4 交接文档：assess + review + feature

## 改了什么
- `assess/route.ts`：权限 requireVerifiedUser → requireAdmin；AI 评估后写回 adminReviewStatus（accept→pending_admin, reject→rejected, error→pending_ai）
- 新增 `POST /api/admin/content-items/review`：批量审核
  - approve：要求 aiDecision=accept；force+note 可破例
  - reject（下架）：事务内删除全部用户的 MaterialCard + 清 featuredToday
- 新增 `POST/DELETE /api/admin/content-items/feature`：今日推荐推送/撤下，仅 approved 可推送

## 状态机（assess 后）
| AI 结果 | adminReviewStatus |
|---|---|
| accept | pending_admin |
| reject | rejected |
| error | pending_ai |

## 测试结果
- 单测：assess 3 + review 6 + feature 4 = 13 个新用例，全绿
- e2e：admin-review 4 个（fixture 依赖，缺失 skip）

## 给后续 PR
- P5 generate-card 准入检查改用 adminReviewStatus=approved。
- P7 后台审核页调用 review 接口，feature 接口驱动今日推荐。
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/handoff/P4-assess-review-handoff.md
git commit -m "docs(handoff): P4 assess and review"
git push -u origin HEAD
```

---

## Verification

1. VERIFIED_USER 调 assess → 403 ✅
2. AI accept 后文章 = pending_admin（不可见于普通用户）✅
3. approve 不传 force + 文章 aiDecision≠accept → 400 ✅
4. force-approve 无 note → 400；有 note → 200 ✅
5. 下架 approved 文章 → 该文章全部 MaterialCard 删除 ✅
6. 推送 pending_admin 到今日推荐 → 400 ✅
7. 撤下今日推荐 → featuredToday=false ✅

---

## Self-Review

**Spec coverage：** 需求 6.4（assess 状态流转）→ Task 2 ✅；需求 6.5（review 接口 + force + 删卡）→ Task 3-4 ✅；决策 2（强制通过二次确认+note）→ Task 4 ✅；决策 4（下架删卡）→ Task 4 ✅；决策 12-13（今日推荐）→ Task 5 ✅。

**Placeholder scan：** 无。✅

**Type consistency：** `adminReviewStatus` 值全 plan 一致；`ReviewBody` 接口与测试 body 字段（ids/action/note/force）一致。✅
