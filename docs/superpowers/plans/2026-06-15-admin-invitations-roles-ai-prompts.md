# Admin Invitations, Roles, and AI Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-managed invitation codes, role upgrade/downgrade with session revocation, and AI prompt template management polish.

**Architecture:** Reuse existing Prisma models and admin routes, adding only the missing invitation status field, invitation revoke endpoint/page, role-change confirmation UI, and prompt-template warnings. Keep all mutating paths admin-only and audit logged. Implement in small commits with API tests before UI changes.

**Tech Stack:** Next.js 16 App Router, React 19 client pages, Prisma 7 with PostgreSQL, Vitest, Playwright, shadcn-style local UI components, sonner toast.

## Implementation Status

- [x] 邀请码增加停用状态，并兼容历史 `isEnabled` / `updatedAt` 数据库漂移。
- [x] 注册接口拒绝已停用邀请码，后台邀请码列表支持创建、复制、作废和中文反馈。
- [x] 后台用户管理支持角色升降级，变更前弹窗确认，后端保留最后管理员保护。
- [x] 后台 AI 配置页明确展示“AI 默认提示词模板”，文章评估提示词走现有 `article_evaluation` 数据库模板链路。
- [x] 已补充 Vitest 单测和 Playwright E2E：`admin-invitations.spec.ts`、`admin-user-roles.spec.ts`、`admin-ai-prompts.spec.ts`。

---

## File Structure

- Modify: `prisma/schema.prisma`
  Add `Invitation.status String @default("ACTIVE")`.
- Create: `prisma/migrations/<timestamp>_invitation_status/migration.sql`
  Add database column for existing invitations.
- Modify: `src/app/api/auth/register/route.ts`
  Reject disabled invitation codes before expiry/use-count checks.
- Modify: `src/app/api/admin/invitations/route.ts`
  Return status and use 7-day default expiry.
- Create: `src/app/api/admin/invitations/[id]/route.ts`
  Add admin-only PATCH endpoint to disable invitations.
- Create: `src/app/admin/invitations/page.tsx`
  Admin invitation management page.
- Modify: `src/components/admin/AdminShell.tsx`
  Add `邀请码管理` navigation item near `用户管理`.
- Modify: `src/app/api/admin/users/[id]/route.ts`
  Revoke sessions on role change and include old/new role in audit detail.
- Modify: `src/app/admin/users/page.tsx`
  Add role-change dialog and remove any implicit immediate role edit path.
- Modify: `src/components/ai/AiConfigPage.tsx`
  Improve prompt-template management labels, metadata, and `article_evaluation` content warning.
- Modify tests:
  - `src/app/api/auth/register/__tests__/route.test.ts`
  - `src/app/api/admin/users/__tests__/route.test.ts`
  - `src/app/api/ai-config/prompts/__tests__/route.test.ts`
- Create tests:
  - `src/app/api/admin/invitations/__tests__/route.test.ts`
  - `src/app/api/admin/invitations/[id]/__tests__/route.test.ts`
  - `e2e/admin-invitations.spec.ts`
  - `e2e/admin-users-role.spec.ts`
- Modify tests:
  - `e2e/admin-ai-config.spec.ts`

---

### Task 1: Add Invitation Status Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_invitation_status/migration.sql`

- [ ] **Step 1: Update Prisma schema**

In `prisma/schema.prisma`, update `model Invitation`:

```prisma
model Invitation {
  id          String    @id @default(cuid())
  code        String    @unique
  createdBy   String
  maxUses     Int       @default(1)
  usedCount   Int       @default(0)
  status      String    @default("ACTIVE")
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())

  creator     User      @relation("CreatedInvitations", fields: [createdBy], references: [id], onDelete: Cascade)
  uses        InvitationUse[]

  @@index([code])
  @@index([createdBy])
  @@index([status])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Create migration**

Run:

```bash
pnpm prisma migrate dev --name invitation_status
```

Expected: Prisma creates a migration under `prisma/migrations/*_invitation_status/`.

If local DB is not available, create the migration SQL manually with this exact content:

```sql
ALTER TABLE "Invitation" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX "Invitation_status_idx" ON "Invitation"("status");
```

- [ ] **Step 3: Regenerate Prisma client**

Run:

```bash
pnpm db:generate
```

Expected: command exits 0.

- [ ] **Step 4: Commit schema change**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add disabled state for invitation codes" -m "Invitation codes need a non-destructive revoke path so admins can stop future use without losing audit history.

Constraint: Revoking an invitation must not affect users who already registered with it.
Confidence: high
Scope-risk: narrow
Tested: pnpm db:generate"
```

---

### Task 2: Invitation API and Register Enforcement

**Files:**
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/admin/invitations/route.ts`
- Create: `src/app/api/admin/invitations/[id]/route.ts`
- Modify: `src/app/api/auth/register/__tests__/route.test.ts`
- Create: `src/app/api/admin/invitations/__tests__/route.test.ts`
- Create: `src/app/api/admin/invitations/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write register test for disabled invitations**

In `src/app/api/auth/register/__tests__/route.test.ts`, extend invitation mock records to include `status: "ACTIVE"` in existing valid-code tests, then add:

```ts
it("已停用邀请码 -> 400", async () => {
  mocks.invitationFindUnique.mockResolvedValue({
    id: "inv-disabled",
    code: "STOPPED",
    status: "DISABLED",
    usedCount: 0,
    maxUses: 5,
    expiresAt: null,
  });

  const res = await POST(makeReq({
    username: "newuser3",
    password: "pass123",
    invitationCode: "STOPPED",
  }));
  const payload = await res.json();

  expect(res.status).toBe(400);
  expect(payload.error).toBe("邀请码已停用");
  expect(mocks.userCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run failing register test**

Run:

```bash
pnpm test src/app/api/auth/register/__tests__/route.test.ts
```

Expected: FAIL because `register/route.ts` does not check `invitation.status`.

- [ ] **Step 3: Implement disabled invitation check**

In `src/app/api/auth/register/route.ts`, update the local `invitation` type:

```ts
let invitation: {
  id: string;
  code: string;
  status: string;
  usedCount: number;
  maxUses: number;
  expiresAt: Date | null;
} | null = null;
```

After the `if (!invitation)` block and before the expiry check, add:

```ts
if (invitation.status === "DISABLED") {
  await auditLog({
    action: "create",
    resource: "User",
    detail: {
      reason: "invitation_disabled",
      invitationId: invitation.id,
      attemptedUsername: username,
    },
  });
  return NextResponse.json(
    { error: "邀请码已停用" },
    { status: 400 }
  );
}
```

- [ ] **Step 4: Write invitation list/create API tests**

Create `src/app/api/admin/invitations/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, dbMocks, auditMock } = vi.hoisted(() => ({
  authMocks: {
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" }),
    unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
    forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  },
  dbMocks: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/audit-logger", () => ({ auditLog: auditMock }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: {
      findMany: dbMocks.findMany,
      findUnique: dbMocks.findUnique,
      create: dbMocks.create,
    },
  },
}));

function makeReq(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/invitations", {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/admin/invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdmin.mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" });
    dbMocks.findMany.mockResolvedValue([]);
    dbMocks.findUnique.mockResolvedValue(null);
  });

  it("GET returns status and display counters", async () => {
    dbMocks.findMany.mockResolvedValue([{
      id: "inv-1",
      code: "ABCD1234",
      status: "ACTIVE",
      createdBy: "admin-1",
      creator: { id: "admin-1", username: "admin", displayName: null },
      maxUses: 2,
      usedCount: 1,
      expiresAt: null,
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      uses: [],
    }]);

    const { GET } = await import("../route");
    const res = await GET(makeReq());
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.items[0]).toMatchObject({
      code: "ABCD1234",
      status: "ACTIVE",
      remainingUses: 1,
      isDisabled: false,
    });
  });

  it("POST defaults to one use and seven day expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    dbMocks.create.mockResolvedValue({
      id: "inv-2",
      code: "WXYZ5678",
      status: "ACTIVE",
      createdBy: "admin-1",
      creator: { id: "admin-1", username: "admin", displayName: null },
      maxUses: 1,
      usedCount: 0,
      expiresAt: new Date("2026-06-22T00:00:00.000Z"),
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({}));

    expect(res.status).toBe(201);
    expect(dbMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        maxUses: 1,
        status: "ACTIVE",
        expiresAt: new Date("2026-06-22T00:00:00.000Z"),
      }),
    }));
    vi.useRealTimers();
  });

  it("POST supports neverExpires", async () => {
    dbMocks.create.mockResolvedValue({
      id: "inv-3",
      code: "NEVER999",
      status: "ACTIVE",
      createdBy: "admin-1",
      creator: { id: "admin-1", username: "admin", displayName: null },
      maxUses: 3,
      usedCount: 0,
      expiresAt: null,
      createdAt: new Date(),
    });

    const { POST } = await import("../route");
    const res = await POST(makeReq({ maxUses: 3, neverExpires: true }));

    expect(res.status).toBe(201);
    expect(dbMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ maxUses: 3, expiresAt: null }),
    }));
  });
});
```

- [ ] **Step 5: Write invitation disable API test**

Create `src/app/api/admin/invitations/[id]/__tests__/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMocks, dbMocks, auditMock } = vi.hoisted(() => ({
  authMocks: {
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", username: "admin", role: "ADMIN", status: "ACTIVE" }),
    unauthorizedResponse: vi.fn(() => new Response(JSON.stringify({ error: "未登录" }), { status: 401 })),
    forbiddenResponse: vi.fn(() => new Response(JSON.stringify({ error: "权限不足" }), { status: 403 })),
  },
  dbMocks: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/audit-logger", () => ({ auditLog: auditMock }));
vi.mock("@/lib/db", () => ({
  db: {
    invitation: {
      findUnique: dbMocks.findUnique,
      update: dbMocks.update,
    },
  },
}));

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/invitations/inv-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/invitations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables an active invitation", async () => {
    dbMocks.findUnique.mockResolvedValue({ id: "inv-1", code: "ABCD1234", status: "ACTIVE" });
    dbMocks.update.mockResolvedValue({ id: "inv-1", code: "ABCD1234", status: "DISABLED" });

    const { PATCH } = await import("../route");
    const res = await PATCH(makeReq({ status: "DISABLED" }), { params: Promise.resolve({ id: "inv-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.invitation.status).toBe("DISABLED");
    expect(dbMocks.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { status: "DISABLED" },
      select: expect.any(Object),
    });
    expect(auditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "disable",
      resource: "Invitation",
      resourceId: "inv-1",
    }));
  });

  it("rejects attempts to restore invitation status", async () => {
    const { PATCH } = await import("../route");
    const res = await PATCH(makeReq({ status: "ACTIVE" }), { params: Promise.resolve({ id: "inv-1" }) });
    const payload = await res.json();

    expect(res.status).toBe(400);
    expect(payload.error).toBe("邀请码只能作废，不能恢复");
    expect(dbMocks.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run failing invitation tests**

Run:

```bash
pnpm test src/app/api/admin/invitations/__tests__/route.test.ts src/app/api/admin/invitations/[id]/__tests__/route.test.ts
```

Expected: FAIL until route implementation exists.

- [ ] **Step 7: Implement invitation API changes**

In `src/app/api/admin/invitations/route.ts`:

Update GET mapper:

```ts
status: inv.status,
isDisabled: inv.status === "DISABLED",
```

Update POST body handling:

```ts
const { maxUses, expiresAt, neverExpires } = body;
const uses = typeof maxUses === "number" ? Math.max(1, Math.floor(maxUses)) : 1;

let expiry: Date | null = null;
if (neverExpires === true) {
  expiry = null;
} else if (expiresAt) {
  expiry = new Date(expiresAt);
} else {
  expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
```

Keep the existing invalid-date and past-date validation for non-null `expiry`. Include `status: "ACTIVE"` in create data:

```ts
data: {
  code,
  createdBy: user.id,
  maxUses: uses,
  status: "ACTIVE",
  expiresAt: expiry,
}
```

Create `src/app/api/admin/invitations/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
import { auditLog } from "@/lib/audit-logger";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireAdmin(request);
  if (!user) {
    const cookieHeader = request.headers.get("cookie") || "";
    return cookieHeader.includes("auth_token") ? forbiddenResponse() : unauthorizedResponse();
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是有效 JSON" }, { status: 400 });
  }

  if (body.status !== "DISABLED") {
    return NextResponse.json({ error: "邀请码只能作废，不能恢复" }, { status: 400 });
  }

  const existing = await db.invitation.findUnique({
    where: { id },
    select: { id: true, code: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "邀请码不存在" }, { status: 404 });
  }

  const invitation = await db.invitation.update({
    where: { id },
    data: { status: "DISABLED" },
    select: {
      id: true,
      code: true,
      status: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  await auditLog({
    userId: user.id,
    action: "disable",
    resource: "Invitation",
    resourceId: id,
    detail: { code: existing.code.slice(0, 2) + "****", previousStatus: existing.status },
  });

  return NextResponse.json({ invitation });
}
```

- [ ] **Step 8: Run API tests**

Run:

```bash
pnpm test src/app/api/auth/register/__tests__/route.test.ts src/app/api/admin/invitations/__tests__/route.test.ts src/app/api/admin/invitations/[id]/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit invitation API**

```bash
git add src/app/api/auth/register/route.ts src/app/api/admin/invitations src/app/api/auth/register/__tests__/route.test.ts
git commit -m "Support revoking invitation codes" -m "Admins need to stop future use of issued invitation codes without deleting audit history or affecting existing users.

Constraint: Disabled invitations must not downgrade users who already registered.
Confidence: high
Scope-risk: moderate
Tested: pnpm test src/app/api/auth/register/__tests__/route.test.ts src/app/api/admin/invitations/__tests__/route.test.ts src/app/api/admin/invitations/[id]/__tests__/route.test.ts"
```

---

### Task 3: Invitation Management UI

**Files:**
- Create: `src/app/admin/invitations/page.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Create: `e2e/admin-invitations.spec.ts`

- [ ] **Step 1: Write Playwright invitation UI test**

Create `e2e/admin-invitations.spec.ts`:

```ts
import path from "path";
import { test, expect } from "@playwright/test";
import { navigateTo } from "./helpers/navigation";
import { expectNoInfiniteLoading } from "./helpers/assertions";

test.describe("后台邀请码管理", () => {
  test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

  test("管理员可以打开邀请码管理页", async ({ page }) => {
    await navigateTo(page, "/admin/invitations");
    await expectNoInfiniteLoading(page);
    await expect(page.getByRole("heading", { name: "邀请码管理" })).toBeVisible();
    await expect(page.getByRole("button", { name: "创建邀请码" })).toBeVisible();
  });

  test("创建邀请码后列表展示新邀请码", async ({ page }) => {
    await navigateTo(page, "/admin/invitations");
    await page.getByRole("button", { name: "创建邀请码" }).click();
    await page.getByLabel("最大使用次数").fill("2");
    await page.getByRole("button", { name: "确认创建" }).click();
    await expect(page.getByText(/邀请码已创建/)).toBeVisible();
    await expect(page.getByText("剩余 2 次")).toBeVisible();
  });

  test("管理员可以作废邀请码", async ({ page }) => {
    await navigateTo(page, "/admin/invitations");
    await page.getByRole("button", { name: "创建邀请码" }).click();
    await page.getByRole("button", { name: "确认创建" }).click();
    await expect(page.getByText(/邀请码已创建/)).toBeVisible();
    await page.getByRole("button", { name: "作废" }).first().click();
    await page.getByRole("button", { name: "确认作废" }).click();
    await expect(page.getByText("已作废").first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Run failing UI test**

Run:

```bash
pnpm exec playwright test e2e/admin-invitations.spec.ts --project=admin
```

Expected: FAIL because `/admin/invitations` does not exist.

- [ ] **Step 3: Add admin nav item**

In `src/components/admin/AdminShell.tsx`, import `Ticket`:

```ts
import {
  BookText,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  FolderTree,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  LucideIcon,
  Loader2,
  Menu,
  Rss,
  Settings,
  Terminal,
  Ticket,
  User,
  Shield,
  X,
} from "lucide-react";
```

Add nav item immediately before `用户管理`:

```ts
{ name: "邀请码管理", href: "/admin/invitations", icon: Ticket },
{ name: "用户管理", href: "/admin/users", icon: User },
```

- [ ] **Step 4: Implement invitation page**

Create `src/app/admin/invitations/page.tsx` as a client page with these state types and core handlers:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, Ticket, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface InvitationItem {
  id: string;
  code: string;
  status: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expiresAt: string | null;
  isExpired: boolean;
  isExhausted: boolean;
  isDisabled: boolean;
  createdAt: string;
  creator?: { username: string; displayName: string | null };
  uses: Array<{ id: string; usedAt: string; user: { username: string; displayName: string | null } }>;
}

function statusLabel(invitation: InvitationItem) {
  if (invitation.isDisabled || invitation.status === "DISABLED") return "已作废";
  if (invitation.isExpired) return "已过期";
  if (invitation.isExhausted) return "已用完";
  return "正常";
}

export default function AdminInvitationsPage() {
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [disableTarget, setDisableTarget] = useState<InvitationItem | null>(null);
  const [maxUses, setMaxUses] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [neverExpires, setNeverExpires] = useState(false);

  async function fetchInvitations() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/invitations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      toast.error("加载邀请码失败", { description: error instanceof Error ? error.message : "请稍后重试" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchInvitations();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses: Number(maxUses),
          expiresAt: neverExpires || !expiresAt ? undefined : expiresAt,
          neverExpires,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      toast.success(`邀请码已创建：${data.invitation.code}`);
      setShowCreateDialog(false);
      setMaxUses("1");
      setExpiresAt("");
      setNeverExpires(false);
      await fetchInvitations();
    } catch (error) {
      toast.error("创建邀请码失败", { description: error instanceof Error ? error.message : "请稍后重试" });
    } finally {
      setCreating(false);
    }
  }

  async function handleDisable() {
    if (!disableTarget) return;
    try {
      const res = await fetch(`/api/admin/invitations/${disableTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISABLED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "作废失败");
      toast.success("邀请码已作废");
      setDisableTarget(null);
      await fetchInvitations();
    } catch (error) {
      toast.error("作废邀请码失败", { description: error instanceof Error ? error.message : "请稍后重试" });
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    toast.success("邀请码已复制");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">邀请码管理</h2>
          <p className="text-sm text-muted-foreground">创建、查看和作废注册邀请码</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchInvitations()} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            刷新
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus />
            创建邀请码
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">加载中...</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Ticket} title="暂无邀请码" description="点击「创建邀请码」生成第一个邀请码" className="py-16" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邀请码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>使用情况</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>创建人</TableHead>
                <TableHead>使用记录</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-mono font-medium">{invitation.code}</TableCell>
                  <TableCell>{statusLabel(invitation)}</TableCell>
                  <TableCell>已用 {invitation.usedCount} 次，剩余 {invitation.remainingUses} 次</TableCell>
                  <TableCell>{invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleString("zh-CN") : "不过期"}</TableCell>
                  <TableCell>{invitation.creator?.displayName || invitation.creator?.username || "未知"}</TableCell>
                  <TableCell>{invitation.uses.length === 0 ? "暂无" : invitation.uses.map((use) => use.user.displayName || use.user.username).join("、")}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-xs" title="复制" onClick={() => void copyCode(invitation.code)}>
                        <Copy />
                      </Button>
                      {invitation.status !== "DISABLED" && (
                        <Button variant="ghost" size="xs" onClick={() => setDisableTarget(invitation)}>
                          作废
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建邀请码</DialogTitle>
            <DialogDescription>默认 1 次使用、7 天后过期，可按发放场景调整。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="最大使用次数" required>
              <Input aria-label="最大使用次数" type="number" min={1} max={1000} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={neverExpires} onChange={(event) => setNeverExpires(event.target.checked)} />
              不设置过期时间
            </label>
            {!neverExpires && (
              <FormField label="过期时间">
                <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "创建中..." : "确认创建"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disableTarget} onOpenChange={(open) => { if (!open) setDisableTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>作废邀请码</DialogTitle>
            <DialogDescription>作废后该邀请码不能继续注册，但已注册用户不会受影响。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDisable}>
              <XCircle />
              确认作废
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: Run UI test**

Run:

```bash
pnpm exec playwright test e2e/admin-invitations.spec.ts --project=admin
```

Expected: PASS.

- [ ] **Step 6: Commit invitation UI**

```bash
git add src/app/admin/invitations/page.tsx src/components/admin/AdminShell.tsx e2e/admin-invitations.spec.ts
git commit -m "Add admin invitation management page" -m "Expose invitation creation and revocation in the admin backend so admins can manage registration access without database access.

Constraint: The page must not delete invitation records.
Confidence: high
Scope-risk: moderate
Tested: pnpm exec playwright test e2e/admin-invitations.spec.ts --project=admin"
```

---

### Task 4: User Role Change with Session Revocation

**Files:**
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/api/admin/users/__tests__/route.test.ts`
- Modify: `src/app/admin/users/page.tsx`
- Create: `e2e/admin-users-role.spec.ts`

- [ ] **Step 1: Add API tests for role-change session revocation**

In `src/app/api/admin/users/__tests__/route.test.ts`, add:

```ts
describe("PUT /api/admin/users/[id] — role changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockAdmin(ADMIN);
    authMocks.countActiveAdmins.mockResolvedValue(2);
  });

  it("revokes sessions when role changes", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "user-id",
      username: "alice",
      role: "USER",
      status: "ACTIVE",
    });
    dbMocks.update.mockResolvedValue({
      id: "user-id",
      username: "alice",
      email: null,
      displayName: null,
      role: "VERIFIED_USER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createAuthenticatedRequest(
      "http://localhost/api/admin/users/user-id",
      ADMIN,
      { method: "PUT", body: JSON.stringify({ role: "VERIFIED_USER" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "user-id" }) });

    expect(res.status).toBe(200);
    expect(authMocks.revokeAllUserSessions).toHaveBeenCalledWith("user-id");
    expect(dbMocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: "VERIFIED_USER" }),
    }));
  });

  it("does not revoke sessions when role is unchanged", async () => {
    dbMocks.findUnique.mockResolvedValue({
      id: "user-id",
      username: "alice",
      role: "USER",
      status: "ACTIVE",
    });
    dbMocks.update.mockResolvedValue({
      id: "user-id",
      username: "alice",
      email: null,
      displayName: null,
      role: "USER",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = createAuthenticatedRequest(
      "http://localhost/api/admin/users/user-id",
      ADMIN,
      { method: "PUT", body: JSON.stringify({ role: "USER" }) }
    );
    const res = await PUT(req, { params: Promise.resolve({ id: "user-id" }) });

    expect(res.status).toBe(200);
    expect(authMocks.revokeAllUserSessions).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run failing role tests**

Run:

```bash
pnpm test src/app/api/admin/users/__tests__/route.test.ts
```

Expected: FAIL because role changes currently do not revoke sessions.

- [ ] **Step 3: Implement role-change session revocation**

In `src/app/api/admin/users/[id]/route.ts`, after building `updates`, before `db.user.update`, calculate:

```ts
const roleChanged = typeof updates.role === "string" && updates.role !== target.role;
```

After `db.user.update`, add:

```ts
if (roleChanged) {
  await revokeAllUserSessions(id);
}
```

Update audit detail:

```ts
detail: {
  targetUsername: target.username,
  fields: Object.keys(updates),
  ...(roleChanged ? { oldRole: target.role, newRole: role } : {}),
  ...(status ? { newStatus: status } : {}),
},
```

- [ ] **Step 4: Write Playwright role dialog test**

Create `e2e/admin-users-role.spec.ts`:

```ts
import path from "path";
import { test, expect } from "@playwright/test";
import { navigateTo } from "./helpers/navigation";
import { expectNoInfiniteLoading } from "./helpers/assertions";

test.describe("后台用户身份管理", () => {
  test.use({ storageState: path.resolve(__dirname, ".auth/admin.json") });

  test("用户管理页显示更改身份入口", async ({ page }) => {
    await navigateTo(page, "/admin/users");
    await expectNoInfiniteLoading(page);
    await expect(page.getByRole("button", { name: /更改身份/ }).first()).toBeVisible();
  });

  test("更改身份弹窗提示重新登录影响", async ({ page }) => {
    await navigateTo(page, "/admin/users");
    await page.getByRole("button", { name: /更改身份/ }).first().click();
    await expect(page.getByRole("dialog")).toContainText("更改身份");
    await expect(page.getByText("该用户需要重新登录")).toBeVisible();
    await expect(page.getByRole("button", { name: "确认更改" })).toBeVisible();
  });
});
```

- [ ] **Step 5: Run failing UI test**

Run:

```bash
pnpm exec playwright test e2e/admin-users-role.spec.ts --project=admin
```

Expected: FAIL because role dialog does not exist.

- [ ] **Step 6: Implement role dialog UI**

In `src/app/admin/users/page.tsx`:

Add `UserCog` import from `lucide-react`.

Add state:

```ts
const [roleDialogUser, setRoleDialogUser] = useState<UserItem | null>(null);
const [selectedRole, setSelectedRole] = useState("USER");
const [changingRole, setChangingRole] = useState(false);
```

Add handler:

```ts
async function handleChangeRole() {
  if (!roleDialogUser) return;
  if (selectedRole === roleDialogUser.role) {
    toast.info("用户身份未变化");
    setRoleDialogUser(null);
    return;
  }

  setChangingRole(true);
  try {
    const res = await fetch(`/api/admin/users/${roleDialogUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: selectedRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "更改身份失败");
      return;
    }
    toast.success("用户身份已更新，该用户需要重新登录");
    setRoleDialogUser(null);
    void fetchUsers();
  } catch {
    toast.error("更改身份失败");
  } finally {
    setChangingRole(false);
  }
}
```

Add operation button before reset-password button:

```tsx
<Button
  variant="ghost"
  size="xs"
  onClick={() => {
    setRoleDialogUser(u);
    setSelectedRole(u.role);
  }}
  aria-label={`更改身份 ${u.username}`}
  title="更改身份"
>
  <UserCog />
  更改身份
</Button>
```

Add dialog near existing reset-password dialog:

```tsx
<Dialog open={roleDialogUser !== null} onOpenChange={(open) => { if (!open) setRoleDialogUser(null); }}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>更改身份</DialogTitle>
      <DialogDescription>
        更改后该用户需要重新登录。升级为管理员会授予后台权限，降级管理员会移除后台权限。
      </DialogDescription>
    </DialogHeader>
    {roleDialogUser && (
      <div className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p>用户：{roleDialogUser.displayName || roleDialogUser.username}</p>
          <p className="text-muted-foreground">当前身份：{ROLE_LABELS[roleDialogUser.role] || roleDialogUser.role}</p>
        </div>
        <FormField label="新身份" required>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择新身份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">普通用户</SelectItem>
              <SelectItem value="VERIFIED_USER">认证用户</SelectItem>
              <SelectItem value="ADMIN">管理员</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>
    )}
    <DialogFooter>
      <Button variant="outline" onClick={() => setRoleDialogUser(null)}>取消</Button>
      <Button onClick={handleChangeRole} disabled={changingRole || selectedRole === roleDialogUser?.role}>
        {changingRole ? "更改中..." : "确认更改"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 7: Run role tests**

Run:

```bash
pnpm test src/app/api/admin/users/__tests__/route.test.ts
pnpm exec playwright test e2e/admin-users-role.spec.ts --project=admin
```

Expected: PASS.

- [ ] **Step 8: Commit role management**

```bash
git add src/app/api/admin/users/[id]/route.ts src/app/api/admin/users/__tests__/route.test.ts src/app/admin/users/page.tsx e2e/admin-users-role.spec.ts
git commit -m "Require re-login after admin role changes" -m "Role changes alter authorization boundaries, so target-user sessions are revoked and the admin UI makes the impact explicit before submitting.

Constraint: The last active admin must remain protected from demotion.
Confidence: high
Scope-risk: moderate
Tested: pnpm test src/app/api/admin/users/__tests__/route.test.ts
Tested: pnpm exec playwright test e2e/admin-users-role.spec.ts --project=admin"
```

---

### Task 5: AI Prompt Template Management Polish

**Files:**
- Modify: `src/components/ai/AiConfigPage.tsx`
- Modify: `src/app/api/ai-config/prompts/__tests__/route.test.ts`
- Modify: `src/services/__tests__/ai-prompts.test.ts`
- Modify: `e2e/admin-ai-config.spec.ts`

- [ ] **Step 1: Add API test for article prompt without content**

In `src/app/api/ai-config/prompts/__tests__/route.test.ts`, add:

```ts
it("allows article_evaluation prompt without content variable", async () => {
  mocks.upsert.mockResolvedValue({});
  const { PUT } = await import("../route");

  const response = await PUT(new NextRequest("http://localhost/api/ai-config/prompts", {
    method: "PUT",
    body: JSON.stringify({ key: "article_evaluation", content: "请按申论标准评估文章并输出 JSON。" }),
  }));

  expect(response.status).toBe(200);
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { key: "article_evaluation" },
    update: expect.objectContaining({
      content: "请按申论标准评估文章并输出 JSON。",
    }),
  }));
});
```

- [ ] **Step 2: Run prompt API test**

Run:

```bash
pnpm test src/app/api/ai-config/prompts/__tests__/route.test.ts src/services/__tests__/ai-prompts.test.ts
```

Expected: PASS. Existing service tests already verify runtime appends article input when `{{content}}` is missing.

- [ ] **Step 3: Write Playwright prompt warning test**

Modify `e2e/admin-ai-config.spec.ts` and add:

```ts
test("文章评估模板缺少正文变量时显示提示但允许保存", async ({ page }) => {
  await navigateTo(page, "/admin/settings/ai");
  await expectNoInfiniteLoading(page);
  await expect(page.getByText("提示词模板管理")).toBeVisible();
  const articleTemplate = page.locator('[data-testid="prompt-template-article_evaluation"]');
  await expect(articleTemplate).toBeVisible();
  await articleTemplate.getByRole("textbox").fill("请按申论标准评估文章并输出 JSON。");
  await expect(articleTemplate.getByText("未包含正文变量")).toBeVisible();
  await articleTemplate.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("提示词已保存")).toBeVisible();
});
```

- [ ] **Step 4: Run failing Playwright test**

Run:

```bash
pnpm exec playwright test e2e/admin-ai-config.spec.ts --project=admin
```

Expected: FAIL because current heading is `提示词配置` and no test ids/warning exist.

- [ ] **Step 5: Update AI config page labels and warning**

In `src/components/ai/AiConfigPage.tsx`:

Change card title:

```tsx
<CardTitle className="text-base">提示词模板管理</CardTitle>
```

Add helper:

```ts
function missingArticleContentVariable(key: string, content: string) {
  return key === "article_evaluation" && !content.includes("{{content}}");
}
```

In template card root, add test id:

```tsx
<div
  key={template.key}
  data-testid={`prompt-template-${template.key}`}
  className="rounded-md border p-4 space-y-3"
>
```

After template description, add metadata:

```tsx
<p className="text-xs text-muted-foreground mt-1">
  版本：{template.version ?? 1}
  {template.updatedAt ? ` · 更新时间：${new Date(template.updatedAt).toLocaleString("zh-CN")}` : ""}
</p>
```

After `Textarea`, add warning:

```tsx
{missingArticleContentVariable(template.key, promptDrafts[template.key] ?? "") && (
  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    未包含正文变量 {"{{content}}"}，评估时系统会自动追加文章标题、来源、内容类型和正文输入块。
  </div>
)}
```

Update `PromptTemplate` interface:

```ts
interface PromptTemplate {
  key: string;
  name: string;
  description: string;
  content: string;
  defaultContent: string;
  customized: boolean;
  version?: number;
  updatedAt?: string | null;
}
```

- [ ] **Step 6: Run prompt UI tests**

Run:

```bash
pnpm test src/app/api/ai-config/prompts/__tests__/route.test.ts src/services/__tests__/ai-prompts.test.ts
pnpm exec playwright test e2e/admin-ai-config.spec.ts --project=admin
```

Expected: PASS.

- [ ] **Step 7: Commit AI prompt UI**

```bash
git add src/components/ai/AiConfigPage.tsx src/app/api/ai-config/prompts/__tests__/route.test.ts e2e/admin-ai-config.spec.ts
git commit -m "Clarify admin AI prompt template management" -m "Admins manage prompt templates directly, with article-evaluation warnings that explain the runtime content fallback instead of blocking useful custom prompts.

Constraint: Default prompt means template; do not add a second default-prompt concept.
Confidence: high
Scope-risk: narrow
Tested: pnpm test src/app/api/ai-config/prompts/__tests__/route.test.ts src/services/__tests__/ai-prompts.test.ts
Tested: pnpm exec playwright test e2e/admin-ai-config.spec.ts --project=admin"
```

---

### Task 6: Final Verification and Handoff

**Files:**
- Modify: `docs/handoff/admin-invitations-roles-ai-prompts.md`

- [ ] **Step 1: Run full static and unit verification**

Run:

```bash
pnpm lint
pnpm test
pnpm build
```

Expected:

- `pnpm lint` exits 0. Existing warnings are acceptable if unchanged.
- `pnpm test` exits 0.
- `pnpm build` exits 0.

- [ ] **Step 2: Run focused Playwright verification**

Run:

```bash
pnpm exec playwright test e2e/admin-invitations.spec.ts e2e/admin-users-role.spec.ts e2e/admin-ai-config.spec.ts --project=admin
```

Expected: PASS.

- [ ] **Step 3: Run broad Playwright only if local DB and seeded auth are healthy**

Run:

```bash
pnpm exec playwright test --project=admin
```

Expected: PASS. If this fails for unrelated existing E2E data assumptions, record failing tests, screenshot/trace paths, and rerun the focused tests above.

- [ ] **Step 4: Create handoff note**

Create `docs/handoff/admin-invitations-roles-ai-prompts.md`:

```md
# 后台邀请码、身份升降级与 AI 提示词模板交接

## 已完成

- 邀请码支持后台创建、查看、复制和作废。
- 已作废邀请码不能继续注册，已注册用户不受影响。
- 用户身份支持后台弹窗更改，角色变化后撤销目标用户会话。
- AI 配置页支持提示词模板管理，文章评估模板缺少正文变量时提示并由运行时兜底。

## 数据库迁移

- 新增 `Invitation.status`，默认 `ACTIVE`。
- 部署时执行 `pnpm db:migrate`。

## 验证命令

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm exec playwright test e2e/admin-invitations.spec.ts e2e/admin-users-role.spec.ts e2e/admin-ai-config.spec.ts --project=admin`

## 风险

- AI 模板可编辑后，管理员仍可能写出低质量 prompt；系统只保证正文输入不会丢失。
- 已作废邀请码不影响已注册用户，这是产品确认行为。
```

- [ ] **Step 5: Check generated file churn**

Run:

```bash
git status --short
git diff -- next-env.d.ts
```

If `next-env.d.ts` only changed from `./.next/dev/types/routes.d.ts` to `./.next/types/routes.d.ts`, restore it with `apply_patch` before committing.

- [ ] **Step 6: Commit final handoff**

```bash
git add docs/handoff/admin-invitations-roles-ai-prompts.md
git commit -m "Document admin management rollout" -m "Capture deployment and verification notes for invitation management, role changes, and AI prompt template administration.

Confidence: high
Scope-risk: narrow
Tested: pnpm lint
Tested: pnpm test
Tested: pnpm build
Tested: pnpm exec playwright test e2e/admin-invitations.spec.ts e2e/admin-users-role.spec.ts e2e/admin-ai-config.spec.ts --project=admin"
```

---

## Final Validation Commands

Run these before reporting completion:

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test e2e/admin-invitations.spec.ts e2e/admin-users-role.spec.ts e2e/admin-ai-config.spec.ts --project=admin
```

If the local database and seeded auth state are healthy, also run:

```bash
pnpm exec playwright test --project=admin
```

## Rollback Plan

- If invitation status migration causes issues, revert the migration and commits that read/write `Invitation.status`.
- If role-change session revocation causes excessive logout friction, revert only the `revokeAllUserSessions(id)` call for role changes while keeping audit detail.
- If AI prompt UI causes failures, revert the UI-only commit; the existing `/api/ai-config/prompts` route and runtime prompt fallback remain intact.

## Plan Self-Review

- Spec coverage: invitation creation/list/revoke, disabled-code register rejection, role dialog, role session revocation, AI prompt template warnings, tests, and migration are all mapped to tasks.
- Placeholder scan: no unresolved placeholder markers are intentionally left in this plan.
- Type consistency: invitation status uses `ACTIVE | DISABLED`; roles use existing `ADMIN | VERIFIED_USER | USER`; prompt key uses existing `article_evaluation`.
