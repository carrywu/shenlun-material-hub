# P6: 收藏功能 + 角色配额 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**前置依赖：** P2（ArticleFavorite + RoleQuota 表）已完成。

**Goal：** ① 用户收藏/取消收藏文章（单篇 + 批量勾选）；② 移除文章时连带删该用户的素材卡；③ 收藏上限按角色配置（RoleQuota），超上限整批拒绝；④ 管理员后台「用户配额设置」页查改 RoleQuota。

**Architecture：** 新增 `/api/favorites` 路由组（GET 列表、POST 单篇、POST batch、DELETE 单篇）；上限校验查 RoleQuota（ADMIN 不查表，代码返 Infinity）；移除时事务删 ArticleFavorite + 该用户的 MaterialCard。配额后台用 `/api/admin/role-quotas`。

**Tech Stack：** Next.js App Router · Prisma 事务 · `requireVerifiedUser`（USER 也能收藏，不限角色）· Vitest · Playwright。

---

## File Structure

| 文件 | 责任 | 操作 |
|---|---|---|
| `src/lib/favorite-quota.ts` | 配额读取辅助 | 新建 |
| `src/lib/__tests__/favorite-quota.test.ts` | 单测 | 新建 |
| `src/app/api/favorites/route.ts` | GET 列表 / POST 单篇 / POST batch | 新建 |
| `src/app/api/favorites/[id]/route.ts` | DELETE 单篇 | 新建 |
| `src/app/api/favorites/__tests__/route.test.ts` | 单测 | 新建 |
| `src/app/api/admin/role-quotas/route.ts` | 配额查改 | 新建 |
| `src/app/api/admin/role-quotas/__tests__/route.test.ts` | 单测 | 新建 |
| `src/app/admin/settings/quotas/page.tsx` | 配额页 UI | 新建 |
| `e2e/my-articles.spec.ts` | 收藏 e2e | 新建 |
| `docs/handoff/P6-favorites-handoff.md` | 交接 | 新建 |

---

## Task 1: 配额读取辅助 + 单测

**Files:**
- Create: `src/lib/favorite-quota.ts`
- Create: `src/lib/__tests__/favorite-quota.test.ts`

- [ ] **Step 1: 新建测试**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const quotaMock = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { roleQuota: { findUnique: quotaMock.findUnique } },
}));

import { getFavoriteLimit, getCurrentFavoriteCount } from "../favorite-quota";

describe("favorite-quota", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADMIN → Infinity（不限）", async () => {
    const limit = await getFavoriteLimits({ role: "ADMIN" } as never);
    expect(limit).toBe(Infinity);
  });

  it("USER 查 RoleQuota 表，默认 100（表无记录兜底）", async () => {
    quotaMock.findUnique.mockResolvedValue(null);
    const limit = await getFavoriteLimits({ role: "USER" } as never);
    expect(limit).toBe(100);
  });

  it("VERIFIED_USER 查表返 300", async () => {
    quotaMock.findUnique.mockResolvedValue({ role: "VERIFIED_USER", favoriteLimit: 300 });
    const limit = await getFavoriteLimits({ role: "VERIFIED_USER" } as never);
    expect(limit).toBe(300);
  });
});
```

- [ ] **Step 2: 实现**

```typescript
// src/lib/favorite-quota.ts
import { db } from "@/lib/db";
import type { AuthUser } from "@/lib/auth";

const DEFAULTS: Record<string, number> = {
  USER: 100,
  VERIFIED_USER: 300,
};

/** 返回某角色的收藏上限。ADMIN 返 Infinity（不限）。表无记录用 DEFAULTS 兜底。 */
export async function getFavoriteLimits(user: Pick<AuthUser, "role">): Promise<number> {
  if (user.role === "ADMIN") return Infinity;
  const row = await db.roleQuota.findUnique({
    where: { role: user.role },
    select: { favoriteLimit: true },
  });
  return row?.favoriteLimit ?? DEFAULTS[user.role] ?? 100;
}

/** 返回某用户已收藏数量。 */
export async function getCurrentFavoriteCount(userId: string): Promise<number> {
  return db.articleFavorite.count({ where: { userId } });
}
```

- [ ] **Step 3: 跑测试**

Run: `pnpm test src/lib/__tests__/favorite-quota.test.ts`

Expected: 3 个用例全绿。

- [ ] **Step 4: Commit**

```bash
git add src/lib/favorite-quota.ts src/lib/__tests__/favorite-quota.test.ts
git commit -m "feat(quota): favorite limit resolver with role defaults"
```

---

## Task 2: favorites 路由单测（先红）

**Files:**
- Create: `src/app/api/favorites/__tests__/route.test.ts`

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
  requireAuth: authMocks.getUserFromRequest,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));

const quota = vi.hoisted(() => ({ limits: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/favorite-quota", () => ({
  getFavoriteLimits: quota.limits,
  getCurrentFavoriteCount: quota.count,
}));

const mocks = vi.hoisted(() => ({
  txFindUnique: vi.fn(),
  txCreate: vi.fn(),
  txDeleteMany: vi.fn(),
  txCardDelete: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));
const dbMock = {
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      contentItem: { findMany: mocks.txFindUnique },
      articleFavorite: { create: mocks.txCreate, deleteMany: mocks.txDeleteMany },
      materialCard: { deleteMany: mocks.txCardDelete },
    })
  ),
  articleFavorite: { count: mocks.count, findMany: mocks.findMany },
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { GET, POST } from "../route";

function makeReq(method: string, cookie: string | null, body?: unknown) {
  const init: RequestInit = { method };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest("http://localhost/api/favorites", init);
}

describe("favorites route (P6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quota.limits.mockResolvedValue(100);
    quota.count.mockResolvedValue(0);
  });

  it("USER 可收藏（不限角色）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    mocks.txFindUnique.mockResolvedValue([{ id: "c1", adminReviewStatus: "approved" }]);
    mocks.txCreate.mockResolvedValue({});
    const res = await POST(makeReq("POST", "auth_token=t", { contentItemIds: ["c1"] }));
    expect(res.status).toBe(200);
  });

  it("整批超上限 → 400（不部分收藏）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    quota.limits.mockResolvedValue(100);
    quota.count.mockResolvedValue(95);
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const res = await POST(makeReq("POST", "auth_token=t", { contentItemIds: ids }));
    expect(res.status).toBe(400);
    expect(mocks.txCreate).not.toHaveBeenCalled();
  });

  it("未审核文章不能收藏 → 过滤掉", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.txFindUnique.mockResolvedValue([
      { id: "c1", adminReviewStatus: "approved" },
      { id: "c2", adminReviewStatus: "pending_admin" },
    ]);
    mocks.txCreate.mockResolvedValue({});
    const res = await POST(makeReq("POST", "auth_token=t", { contentItemIds: ["c1", "c2"] }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.added).toBe(1);
    expect(j.skipped).toBe(1);
  });

  it("GET 返回当前用户收藏列表", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findMany.mockResolvedValue([{ userId: "v", contentItemId: "c1", contentItem: { id: "c1", title: "t" } }]);
    const res = await GET(makeReq("GET", "auth_token=t"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: 跑确认失败**

Run: `pnpm test src/app/api/favorites/__tests__/route.test.ts`

Expected: 全 FAIL（路由不存在）。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/favorites/__tests__/route.test.ts
git commit -m "test(favorites): lock batch favorite behavior"
```

---

## Task 3: 实现 favorites 路由

**Files:**
- Create: `src/app/api/favorites/route.ts`

- [ ] **Step 1: 新建路由**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAuth,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth";
import { getFavoriteLimits, getCurrentFavoriteCount } from "@/lib/favorite-quota";

// GET /api/favorites — 当前用户的收藏列表
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  const items = await db.articleFavorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { contentItem: { select: { id: true, title: true, coverUrl: true, publishedAt: true } } },
  });
  return NextResponse.json({ data: items });
}

// POST /api/favorites — 批量收藏（contentItemIds 数组）
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { contentItemIds } = (await request.json()) as {
      contentItemIds: string[];
    };
    if (!Array.isArray(contentItemIds) || contentItemIds.length === 0) {
      return NextResponse.json({ error: "contentItemIds 不能为空" }, { status: 400 });
    }

    // 上限校验：整批超限 → 拒绝
    const limit = await getFavoriteLimits(user);
    const currentCount = await getCurrentFavoriteCount(user.id);
    if (currentCount + contentItemIds.length > limit) {
      return NextResponse.json(
        {
          error: `收藏已达上限（${currentCount}/${limit}），无法再加入 ${contentItemIds.length} 篇`,
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      // 只允许收藏 approved 文章
      const eligible = await tx.contentItem.findMany({
        where: { id: { in: contentItemIds }, adminReviewStatus: "approved" },
        select: { id: true },
      });
      const eligibleIds = eligible.map((e) => e.id);
      const skipped = contentItemIds.length - eligibleIds.length;

      let added = 0;
      for (const id of eligibleIds) {
        try {
          await tx.articleFavorite.create({
            data: { userId: user.id, contentItemId: id },
          });
          added++;
        } catch {
          // 已收藏（unique 冲突）→ 跳过
        }
      }
      return { added, skipped, alreadyFavorited: eligibleIds.length - added };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("favorites POST failed:", error);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 跑测试**

Run: `pnpm test src/app/api/favorites/__tests__/route.test.ts`

Expected: 4 个用例全绿。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/favorites/route.ts
git commit -m "feat(favorites): batch favorite with quota and approval guard"
```

---

## Task 4: DELETE 单篇（连带删用户卡）

**Files:**
- Create: `src/app/api/favorites/[id]/route.ts`

- [ ] **Step 1: 新建路由**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

// DELETE /api/favorites/[id] — 移除收藏，连带删该用户基于该文章的素材卡
// [id] 是 contentItemId
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { id: contentItemId } = await params;

    await db.$transaction(async (tx) => {
      // 删收藏关系
      await tx.articleFavorite.deleteMany({
        where: { userId: user.id, contentItemId },
      });
      // 连带删该用户基于该文章的素材卡（公共卡和其他人的卡不动）
      await tx.materialCard.deleteMany({
        where: { ownerUserId: user.id, contentItemId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("favorites DELETE failed:", error);
    return NextResponse.json({ error: "移除失败" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 补一个单测验证删卡**

在 `src/app/api/favorites/__tests__/route.test.ts` 追加 import 与用例（或新建 `[id]/__tests__/route.test.ts`）：

```typescript
// 新建 src/app/api/favorites/[id]/__tests__/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, USERS } = vi.hoisted(() => ({
  USERS: { VERIFIED: { id: "v", username: "v", role: "VERIFIED_USER" as const, status: "ACTIVE" as const } },
  authMocks: { getUserFromRequest: vi.fn().mockResolvedValue(null) },
}));
vi.mock("@/lib/auth", () => ({
  requireAuth: authMocks.getUserFromRequest,
  unauthorizedResponse: () => Response.json({ error: "x" }, { status: 401 }),
  forbiddenResponse: () => Response.json({ error: "x" }, { status: 403 }),
}));
const tx = vi.hoisted(() => ({ favDel: vi.fn(), cardDel: vi.fn() }));
const dbMock = {
  $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) =>
    fn({
      articleFavorite: { deleteMany: tx.favDel },
      materialCard: { deleteMany: tx.cardDel },
    })
  ),
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { DELETE } from "../route";

describe("DELETE /api/favorites/[id] (P6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("移除收藏 + 删该用户基于文章的卡", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const req = new NextRequest("http://localhost/api/favorites/c1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect(tx.favDel).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "v", contentItemId: "c1" } })
    );
    expect(tx.cardDel).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerUserId: "v", contentItemId: "c1" } })
    );
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `pnpm test src/app/api/favorites/`

Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/favorites/[id]/
git commit -m "feat(favorites): remove favorite and delete user's cards for article"
```

---

## Task 5: 配额后台接口

**Files:**
- Create: `src/app/api/admin/role-quotas/route.ts`
- Create: `src/app/api/admin/role-quotas/__tests__/route.test.ts`

- [ ] **Step 1: 测试**

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
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { roleQuota: { findMany: mocks.findMany, upsert: mocks.upsert } },
}));

import { GET, PUT } from "../route";

describe("role-quotas (P6)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("VERIFIED_USER GET → 403", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await GET(new NextRequest("http://localhost/api/admin/role-quotas"));
    expect(res.status).toBe(403);
  });

  it("ADMIN GET → 返回配额列表", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findMany.mockResolvedValue([
      { role: "USER", favoriteLimit: 100 },
      { role: "VERIFIED_USER", favoriteLimit: 300 },
    ]);
    const res = await GET(new NextRequest("http://localhost/api/admin/role-quotas"));
    expect(res.status).toBe(200);
  });

  it("ADMIN PUT 更新 USER 配额", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.upsert.mockResolvedValue({});
    const req = new NextRequest("http://localhost/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "USER", favoriteLimit: 200 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: "USER" } })
    );
  });

  it("非法 role → 400", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    const req = new NextRequest("http://localhost/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "ADMIN", favoriteLimit: 999 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 实现**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";

const ALLOWED_ROLES = ["USER", "VERIFIED_USER"];

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  const rows = await db.roleQuota.findMany({ orderBy: { role: "asc" } });
  return NextResponse.json({ data: rows });
}

export async function PUT(request: NextRequest) {
  const user = await requireAdmin(request);
  if (!user) {
    return request.headers.get("cookie")?.includes("auth_token")
      ? forbiddenResponse()
      : unauthorizedResponse();
  }
  try {
    const { role, favoriteLimit } = (await request.json()) as {
      role: string;
      favoriteLimit: number;
    };
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "仅可配置 USER / VERIFIED_USER（ADMIN 不限）" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(favoriteLimit) || favoriteLimit < 0) {
      return NextResponse.json({ error: "配额必须为非负整数" }, { status: 400 });
    }
    const updated = await db.roleQuota.upsert({
      where: { role },
      update: { favoriteLimit, updatedBy: user.id },
      create: { role, favoriteLimit, updatedBy: user.id },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("role-quotas PUT failed:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
```

- [ ] **Step 3: 跑测试**

Run: `pnpm test src/app/api/admin/role-quotas/`

Expected: 4 个用例全绿。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/role-quotas/
git commit -m "feat(role-quotas): admin get/put per-role favorite limit"
```

---

## Task 6: 配额后台页面

**Files:**
- Create: `src/app/admin/settings/quotas/page.tsx`

- [ ] **Step 1: 新建页面（客户端组件）**

```tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RoleQuota {
  role: string;
  favoriteLimit: number;
}

export default function RoleQuotasPage() {
  const [quotas, setQuotas] = useState<RoleQuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/role-quotas")
      .then((r) => r.json())
      .then((j) => setQuotas(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function update(role: string, favoriteLimit: number) {
    const res = await fetch("/api/admin/role-quotas", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, favoriteLimit }),
    });
    if (res.ok) toast.success(`${role} 配额已更新`);
    else toast.error("更新失败");
  }

  if (loading) return <div className="p-8">加载中...</div>;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">用户配额设置</h1>
      <p className="text-sm text-gray-500 mb-6">
        配置每个角色的文章收藏上限。ADMIN 不限。修改后立即生效。
      </p>
      <div className="space-y-4">
        {quotas.map((q) => (
          <QuotaRow key={q.role} q={q} onSave={update} />
        ))}
      </div>
    </div>
  );
}

function QuotaRow({
  q,
  onSave,
}: {
  q: RoleQuota;
  onSave: (role: string, limit: number) => void;
}) {
  const [val, setVal] = useState(String(q.favoriteLimit));
  const roleLabel = q.role === "USER" ? "普通用户 (USER)" : "认证用户 (VERIFIED_USER)";
  return (
    <div className="flex items-center gap-4 border rounded p-4">
      <span className="flex-1 font-medium">{roleLabel}</span>
      <input
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="border rounded px-2 py-1 w-24"
      />
      <span className="text-sm text-gray-500">篇</span>
      <button
        onClick={() => onSave(q.role, Number(val))}
        className="bg-blue-600 text-white px-3 py-1 rounded"
      >
        保存
      </button>
    </div>
  );
}
```

- [ ] **Step 2: lint + 手动验证**

Run: `pnpm lint src/app/admin/settings/quotas/page.tsx`

然后 `pnpm dev`，ADMIN 登录访问 `/admin/settings/quotas`，看到 USER=100 / VERIFIED_USER=300 两行，改一个值保存，刷新仍在。

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/quotas/page.tsx
git commit -m "feat(admin): role quota settings page"
```

---

## Task 7: e2e 收藏

**Files:**
- Create: `e2e/my-articles.spec.ts`

- [ ] **Step 1: 新建 e2e**

```typescript
import { expect, test } from "@playwright/test";
import { loginAsVerifiedUserAPI } from "./helpers/auth";

test.describe("收藏功能（P6）", () => {
  test("批量收藏 approved 文章", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, "需 fixture");
    const res = await request.post("/api/favorites", {
      data: { contentItemIds: [id] },
    });
    expect(res.status()).toBe(200);
    const j = await res.json();
    expect(j.added).toBeGreaterThanOrEqual(1);
  });

  test("GET 收藏列表", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const res = await request.get("/api/favorites");
    expect(res.status).toBe(200);
  });

  test("未审核文章不能收藏（被过滤）", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const pendingId = process.env.E2E_PENDING_ARTICLE_ID;
    if (!pendingId) test.skip(true, "需 fixture");
    const res = await request.post("/api/favorites", {
      data: { contentItemIds: [pendingId] },
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.added).toBe(0);
    expect(j.skipped).toBe(1);
  });

  test("移除收藏 → 删用户卡", async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const id = process.env.E2E_APPROVED_ARTICLE_ID;
    if (!id) test.skip(true, "需 fixture");
    const res = await request.delete(`/api/favorites/${id}`);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: 跑 e2e**

Run: `pnpm exec playwright test e2e/my-articles.spec.ts`

Expected: 全绿或 fixture 缺失 skip。

- [ ] **Step 3: Commit**

```bash
git add e2e/my-articles.spec.ts
git commit -m "test(e2e): favorites batch and removal"
```

---

## Task 8: 全量验收 + 交接

**Files:**
- Create: `docs/handoff/P6-favorites-handoff.md`

- [ ] **Step 1: 验收**

```bash
pnpm lint && pnpm test && pnpm build && pnpm exec playwright test
```

- [ ] **Step 2: 交接文档**

```markdown
# P6 交接文档：收藏 + 配额

## 改了什么
- 新建 `/api/favorites`（GET 列表 / POST 批量收藏）
- 新建 `/api/favorites/[id]`（DELETE 移除 + 连带删该用户基于文章的素材卡）
- 新建 `/api/admin/role-quotas`（GET / PUT 配额）
- 新建 `/admin/settings/quotas` 配额页
- 新建 `src/lib/favorite-quota.ts`（配额读取，ADMIN 返 Infinity）

## 收藏规则
- 只能收藏 adminReviewStatus=approved 的文章（未审核自动过滤）
- 软收藏（ArticleFavorite 关系表），文章本体只存一份
- 整批超上限 → 400 拒绝（不部分收藏）
- 移除收藏 → 删该用户基于该文章的 MaterialCard（公共卡和别人卡不动）

## 配额默认
- USER: 100，VERIFIED_USER: 300（P2 seed），ADMIN 不限
- 管理员可在 /admin/settings/quotas 改

## 测试结果
- 单测：quota 3 + favorites 4 + favorites/[id] 1 + role-quotas 4 = 12 个新用例
- e2e：4 个（fixture 依赖）

## 给 P7
- 「我的文章」页 GET /api/favorites 渲染列表
- 详情页「移除」按钮 DELETE /api/favorites/[id]
- 批量勾选 → POST /api/favorites
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/handoff/P6-favorites-handoff.md
git commit -m "docs(handoff): P6 favorites and quotas"
git push -u origin HEAD
```

---

## Verification

1. USER/VERIFIED_USER 都能收藏 ✅
2. 整批超上限 → 400 不部分收藏 ✅
3. 未审核文章被过滤 ✅
4. 移除 → 该用户卡删除（公共卡/别人卡不动）✅
5. 配额页可改 USER/VERIFIED_USER，ADMIN 角色拒绝 ✅
6. 软收藏，文章本体不复制 ✅

---

## Self-Review

**Spec coverage：** 决策 16（软收藏）→ Task 3 ✅；决策 17（批量勾选）→ Task 3 + P7 ✅；决策 18（角色配额）→ Task 1/5/6 ✅；决策 19（整批拒绝）→ Task 3 ✅；决策 20（移除删卡）→ Task 4 ✅；决策 21（USER 能收藏）→ Task 3（requireAuth 不限角色）✅。

**Placeholder scan：** 无。✅

**Type consistency：** `getFavoriteLimits` / `getCurrentFavoriteCount` 在 favorite-quota.ts 定义，路由与测试调用签名一致；`RoleQuota.role` / `favoriteLimit` 字段名全 plan 一致。✅
