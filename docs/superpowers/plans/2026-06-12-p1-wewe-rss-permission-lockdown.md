# P1: WeWe RSS 权限收紧 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 WeWe RSS 用户级配置接口与设置入口从 VERIFIED_USER 收紧为 ADMIN-only，普通（非管理员）用户完全无法配置、调用或看到 WeWe RSS。

**Architecture:** 5 个 API handler 把 `requireVerifiedUser` 换成 `requireAdmin`（保持现有「无 cookie→401 / 有 cookie 但角色不够→403」的双段式响应）；设置页「外部集成」入口从 `isVerifiedUser` 收紧为 `isAdmin`；VERIFIED_USER 专用的 `/settings/integrations` 页面加客户端 admin 守卫，非管理员重定向回 `/settings`。

**Tech Stack:** Next.js 15 App Router · Prisma · `src/lib/auth.ts` 的 `requireAdmin` · Vitest（单测，`vi.hoisted` + `vi.mock` 风格）· Playwright（e2e，扩充 `api-security.spec.ts`）。

**Scope（本 plan 覆盖、不覆盖）：**
- ✅ 覆盖：5 个 settings/wewe-rss API handler 权限 + 设置页入口 + integrations 页守卫 + 单测 + e2e
- ❌ 不覆盖：`/api/integrations/wewe-rss/**`（已经是 `requireAdmin`，无需改）、管理员后台 `/admin/integrations/wewe-rss` 页面（保持不动）、其他 PR 的内容

---

## File Structure

| 文件 | 责任 | 本 plan 操作 |
|---|---|---|
| `src/app/api/settings/integrations/wewe-rss/route.ts` | 用户级 WeWe RSS 配置（GET/POST/DELETE/PUT） | 改 4 个 handler 的权限校验 |
| `src/app/api/settings/integrations/wewe-rss/test/route.ts` | 测试连接（POST） | 改权限校验 |
| `src/app/api/settings/integrations/wewe-rss/__tests__/route.test.ts` | 主路由单测 | 新建（覆盖 4 个 handler 的 ADMIN/VERIFIED_USER/USER/匿名 4 种角色） |
| `src/app/api/settings/integrations/wewe-rss/test/__tests__/route.test.ts` | test 子路由单测 | 新建 |
| `src/app/settings/page.tsx` | 设置首页（外部集成入口卡片） | 入口条件 `isVerifiedUser` → `isAdmin` |
| `src/app/settings/integrations/page.tsx` | VERIFIED_USER 配置页（含 WeWe RSS 表单） | 加客户端 admin 守卫 |
| `e2e/api-security.spec.ts` | API 安全 e2e | 追加 WeWe RSS 接口的权限用例 |
| `docs/handoff/P1-wewe-rss-permission-handoff.md` | 交接文档 | 新建 |

---

## Task 1: 主路由单测 — 锁定「VERIFIED_USER 被拒绝」的失败行为

**Files:**
- Create: `src/app/api/settings/integrations/wewe-rss/__tests__/route.test.ts`

- [ ] **Step 1: 新建测试文件，写入 VERIFIED_USER 被拒绝的用例**

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
  const USER = {
    id: "user-id",
    username: "plainuser",
    role: "USER" as const,
    status: "ACTIVE" as const,
  };
  return {
    USERS: { ADMIN, VERIFIED, USER },
    authMocks: {
      getUserFromRequest: vi.fn().mockResolvedValue(null),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: authMocks.getUserFromRequest,
  unauthorizedResponse: (msg = "未登录或会话已过期") =>
    Response.json({ error: msg }, { status: 401 }),
  forbiddenResponse: (msg = "权限不足") =>
    Response.json({ error: msg }, { status: 403 }),
}));

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    userIntegration: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
      update: mocks.update,
    },
  },
}));

vi.mock("@/services/integrations/wewe-rss-api", () => ({
  checkHealth: vi.fn(),
}));

import { GET, POST, DELETE, PUT } from "../route";

function makeRequest(
  method: string,
  cookie: string | null,
  body?: unknown
): NextRequest {
  const init: RequestInit = { method };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(
    "http://localhost/api/settings/integrations/wewe-rss",
    init
  );
}

describe("WeWe RSS settings route — permission lockdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUserFromRequest.mockResolvedValue(null);
  });

  it("GET: 匿名（无 cookie）→ 401", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", null));
    expect(res.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("GET: VERIFIED_USER → 403（收紧后应被拒）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await GET(makeRequest("GET", "auth_token=xxx"));
    expect(res.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("GET: USER → 403", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const res = await GET(makeRequest("GET", "auth_token=xxx"));
    expect(res.status).toBe(403);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("GET: ADMIN → 调用 db 查询（200）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest("GET", "auth_token=xxx"));
    expect(res.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        userId_provider: { userId: "admin-id", provider: "wewe-rss" },
      },
    });
  });

  it("POST: VERIFIED_USER → 403（不写库）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await POST(
      makeRequest("POST", "auth_token=xxx", { baseUrl: "http://x" })
    );
    expect(res.status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("DELETE: VERIFIED_USER → 403（不删库）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await DELETE(makeRequest("DELETE", "auth_token=xxx"));
    expect(res.status).toBe(403);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("PUT: USER → 403（不更新）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.USER);
    const res = await PUT(
      makeRequest("PUT", "auth_token=xxx", { isEnabled: false })
    );
    expect(res.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败（因为路由现在还放行 VERIFIED_USER）**

Run: `pnpm test src/app/api/settings/integrations/wewe-rss/__tests__/route.test.ts`

Expected: **7 个用例全部 FAIL**。其中 VERIFIED_USER / USER 的用例应该失败在「期望 403 但实际 200」（因为路由还在放行），ADMIN/匿名的用例可能也会因为 mock 未配齐而失败——这是正常的，Task 2 修代码后会变绿。

- [ ] **Step 3: Commit（红测试先行）**

```bash
git add src/app/api/settings/integrations/wewe-rss/__tests__/route.test.ts
git commit -m "test(wewe-rss): add failing permission tests for settings route lockdown"
```

---

## Task 2: 主路由权限收紧 — `requireVerifiedUser` → `requireAdmin`

**Files:**
- Modify: `src/app/api/settings/integrations/wewe-rss/route.ts`（4 个 handler）

- [ ] **Step 1: 修改 import，把 `requireVerifiedUser` 换成 `requireAdmin`**

打开 `src/app/api/settings/integrations/wewe-rss/route.ts`，把第 3 行：

```typescript
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
```

改成：

```typescript
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
```

- [ ] **Step 2: 替换全部 4 个 handler 内的权限调用**

在 GET / POST / DELETE / PUT 四个函数开头，各自把：

```typescript
const user = await requireVerifiedUser(request);
```

替换为：

```typescript
const user = await requireAdmin(request);
```

四处都要改（GET 在第 8 行附近、POST 在第 47 行附近、DELETE 在第 99 行附近、PUT 在第 120 行附近）。改完后每个 handler 的「无 cookie→401 / 角色不够→403」双段式逻辑保持不变，只是门槛从 VERIFIED_USER 提到 ADMIN。

- [ ] **Step 3: 运行单测，确认全部通过**

Run: `pnpm test src/app/api/settings/integrations/wewe-rss/__tests__/route.test.ts`

Expected: **7 个用例全部 PASS**。VERIFIED_USER / USER 用例现在返回 403，ADMIN 用例正常调用 db，匿名返回 401。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/integrations/wewe-rss/route.ts
git commit -m "feat(wewe-rss): lock down settings route to admin only"
```

---

## Task 3: test 子路由单测 — 锁定 VERIFIED_USER 被拒

**Files:**
- Create: `src/app/api/settings/integrations/wewe-rss/test/__tests__/route.test.ts`

- [ ] **Step 1: 新建测试文件**

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
  unauthorizedResponse: (msg = "未登录或会话已过期") =>
    Response.json({ error: msg }, { status: 401 }),
  forbiddenResponse: (msg = "权限不足") =>
    Response.json({ error: msg }, { status: 403 }),
}));

const checkHealthMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/integrations/wewe-rss-api", () => ({
  checkHealth: checkHealthMock,
}));

import { POST } from "../route";

function makeRequest(cookie: string | null, body?: unknown): NextRequest {
  const init: RequestInit = { method: "POST" };
  if (cookie) init.headers = { cookie };
  if (body !== undefined) {
    init.headers = { ...(init.headers || {}), "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(
    "http://localhost/api/settings/integrations/wewe-rss/test",
    init
  );
}

describe("WeWe RSS settings test route — permission lockdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getUserFromRequest.mockResolvedValue(null);
  });

  it("匿名 → 401", async () => {
    const res = await POST(makeRequest(null, { baseUrl: "http://x" }));
    expect(res.status).toBe(401);
    expect(checkHealthMock).not.toHaveBeenCalled();
  });

  it("VERIFIED_USER → 403（不调用 checkHealth）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    const res = await POST(makeRequest("auth_token=xxx", { baseUrl: "http://x" }));
    expect(res.status).toBe(403);
    expect(checkHealthMock).not.toHaveBeenCalled();
  });

  it("ADMIN → 调用 checkHealth", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    checkHealthMock.mockResolvedValue({ reachable: true, message: "ok", feedCount: 3 });
    const res = await POST(makeRequest("auth_token=xxx", { baseUrl: "http://x" }));
    expect(res.status).toBe(200);
    expect(checkHealthMock).toHaveBeenCalledWith("http://x");
  });
});
```

- [ ] **Step 2: 运行，确认失败**

Run: `pnpm test src/app/api/settings/integrations/wewe-rss/test/__tests__/route.test.ts`

Expected: VERIFIED_USER 用例 FAIL（期望 403 实际 200）。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/integrations/wewe-rss/test/__tests__/route.test.ts
git commit -m "test(wewe-rss): add failing permission tests for test-connection route"
```

---

## Task 4: test 子路由权限收紧

**Files:**
- Modify: `src/app/api/settings/integrations/wewe-rss/test/route.ts`

- [ ] **Step 1: 修改 import（第 2 行）**

```typescript
import { requireVerifiedUser, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
```

改成：

```typescript
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth";
```

- [ ] **Step 2: 修改 POST handler（第 7 行附近）**

```typescript
const user = await requireVerifiedUser(request);
```

改成：

```typescript
const user = await requireAdmin(request);
```

- [ ] **Step 3: 运行单测，确认通过**

Run: `pnpm test src/app/api/settings/integrations/wewe-rss/test/__tests__/route.test.ts`

Expected: **3 个用例全部 PASS**。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/integrations/wewe-rss/test/route.ts
git commit -m "feat(wewe-rss): lock down test-connection route to admin only"
```

---

## Task 5: 设置首页入口收紧 — `isVerifiedUser` → `isAdmin`

**Files:**
- Modify: `src/app/settings/page.tsx`（第 101 行附近的「外部集成」入口卡片）

- [ ] **Step 1: 读取当前入口卡片代码，确认上下文**

Run: `sed -n '95,130p' src/app/settings/page.tsx`

确认第 101 行是 `{isVerifiedUser && (` 包裹的「外部集成」卡片（href=`/settings/integrations`，描述含「WeWe RSS」）。

- [ ] **Step 2: 把该入口的条件从 `isVerifiedUser` 改成 `isAdmin`**

在 `src/app/settings/page.tsx` 中找到「外部集成」入口块（约第 101 行）：

```tsx
          {isVerifiedUser && (
            <Link href="/settings/integrations">
```

改成：

```tsx
          {isAdmin && (
            <Link href="/settings/integrations">
```

注意：**只改「外部集成」这一个入口**。文件里其他 `{isVerifiedUser && (` 入口（如 AI 配置、IMA）保持不动——那些是 P7/P8 才动的范围。判断依据是看 Link 的 `href` 是否为 `/settings/integrations`。

- [ ] **Step 3: 启动本地 dev，手动验证**

Run（终端 A）: `pnpm dev`

然后开两个浏览器分别登录 VERIFIED_USER 和 ADMIN（或者用现成的测试账号），访问 `http://localhost:3000/settings`：

- VERIFIED_USER 登录后：**看不到**「外部集成」卡片。✅
- ADMIN 登录后：**看得到**「外部集成」卡片。✅

如果验证不通过，回看 Step 2 是否改对了入口（文件里有多个 `isVerifiedUser` 入口）。

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(settings): hide integrations entry from non-admin users"
```

---

## Task 6: `/settings/integrations` 页加客户端 admin 守卫

**Files:**
- Modify: `src/app/settings/integrations/page.tsx`

页面本身是客户端组件（用了 `useAuth()`）。即使入口藏起来了，VERIFIED_USER 仍可能直接输 URL `https://site/settings/integrations` 进来。加客户端守卫，非 admin 重定向回 `/settings`。

- [ ] **Step 1: 读取页面顶部，确认 useAuth 解构和返回结构**

Run: `sed -n '1,50p' src/app/settings/integrations/page.tsx`

确认第 32-33 行是：
```tsx
const { isAdmin, user } = useAuth();
const isVerified = isAdmin || user?.role === "VERIFIED_USER";
```
确认组件用了 `"use client"` 且有 `useEffect`/`useRouter` 的 import。

- [ ] **Step 2: 在加载完成且非 admin 时重定向**

在 `src/app/settings/integrations/page.tsx` 的组件函数体顶部（`useAuth()` 之后），加入守卫。如果文件已 import `useRouter`，复用；否则补 import。

先确认 import 区（文件顶部），如果没有 `useRouter` 和 `useEffect`，补上：

```tsx
import { useEffect } from "react";
import { useRouter } from "next/navigation";
```

然后在组件函数体内（`const { isAdmin, user } = useAuth();` 之后）插入：

```tsx
  const router = useRouter();
  const authLoaded = user !== undefined || isAdmin; // 根据 useAuth 实现调整
  useEffect(() => {
    // 等 auth 加载完再判断，避免闪烁
    if (user && !isAdmin) {
      router.replace("/settings");
    }
  }, [user, isAdmin, router]);
```

⚠️ 关键：必须**等 auth 加载完**再重定向，否则 ADMIN 用户在页面初始加载瞬间（`user` 还是 null）会被误重定向。如果项目的 `useAuth()` 有明确的 `isLoading` / `status` 字段，用那个判断更准（读 `src/components` 下 useAuth 的实现确认）。

- [ ] **Step 3: 运行 lint 确认 import 与 hooks 使用合法**

Run: `pnpm lint src/app/settings/integrations/page.tsx`

Expected: 0 error。

- [ ] **Step 4: 本地手动验证重定向**

Run: `pnpm dev`（如已在跑可跳过）

- 用 VERIFIED_USER 登录 → 浏览器直接访问 `http://localhost:3000/settings/integrations` → 应自动跳回 `/settings`。✅
- 用 ADMIN 登录 → 访问同 URL → 正常显示配置页。✅

- [ ] **Step 5: Commit**

```bash
git add src/app/settings/integrations/page.tsx
git commit -m "feat(settings/integrations): redirect non-admin users to /settings"
```

---

## Task 7: e2e — 扩充 `api-security.spec.ts` 覆盖 WeWe RSS 接口

**Files:**
- Modify: `e2e/api-security.spec.ts`

- [ ] **Step 1: 读取现有 e2e 的 auth helper，确认如何以 VERIFIED_USER 身份发请求**

Run: `cat e2e/helpers/auth.ts`

确认有类似 `loginAsAdminAPI` 的 helper。如果没有 `loginAsVerifiedUserAPI`，需要先加一个（参考 admin 版本，用 fixtures 里的 VERIFIED_USER 账号登录拿 cookie）。

- [ ] **Step 2: 若缺 VERIFIED_USER 登录 helper，在 `e2e/helpers/auth.ts` 追加**

参考现有 `loginAsAdminAPI` 的实现，新增：

```typescript
export async function loginAsVerifiedUserAPI(request: import('@playwright/test').APIRequestContext) {
  // 用 fixtures / env 里的 VERIFIED_USER 账号登录
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_VERIFIED_USERNAME ?? 'verified',
      password: process.env.E2E_VERIFIED_PASSWORD ?? 'verified-password',
    },
  });
  expect(res.ok()).toBeTruthy();
  return res;
}
```

⚠️ 凭据来自 `e2e/helpers/` 或 `global-setup.ts` 里的 fixtures。如果项目用数据库 seed 创建测试账号，确认 seed 里有 VERIFIED_USER 账号；没有就先在 `e2e/global-setup.ts` 加一个（账号信息写到 `.env.test` 或 `playwright.config.ts` 的 env 里）。

- [ ] **Step 3: 在 `e2e/api-security.spec.ts` 追加 WeWe RSS 权限用例**

在文件末尾追加：

```typescript
import { loginAsVerifiedUserAPI } from './helpers/auth';

test.describe('WeWe RSS 接口权限（P1 收紧）', () => {
  test('VERIFIED_USER 调 GET settings/wewe-rss → 403', async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const res = await request.get('/api/settings/integrations/wewe-rss');
    expect(res.status()).toBe(403);
  });

  test('VERIFIED_USER 调 POST settings/wewe-rss → 403', async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const res = await request.post('/api/settings/integrations/wewe-rss', {
      data: { baseUrl: 'http://localhost:4000' },
    });
    expect(res.status()).toBe(403);
  });

  test('VERIFIED_USER 调 POST settings/wewe-rss/test → 403', async ({ request }) => {
    await loginAsVerifiedUserAPI(request);
    const res = await request.post('/api/settings/integrations/wewe-rss/test', {
      data: { baseUrl: 'http://localhost:4000' },
    });
    expect(res.status()).toBe(403);
  });

  test('未认证调 GET settings/wewe-rss → 401', async ({ request }) => {
    const res = await request.get('/api/settings/integrations/wewe-rss');
    expect(res.status()).toBe(401);
  });

  test('ADMIN 调 GET settings/wewe-rss → 200', async ({ request }) => {
    await loginAsAdminAPI(request);
    const res = await request.get('/api/settings/integrations/wewe-rss');
    expect([200]).toContain(res.status());
  });
});
```

- [ ] **Step 4: 运行 e2e（仅 api-security 这一个 spec，本地）**

Run: `pnpm exec playwright test e2e/api-security.spec.ts`

Expected: **新增 5 个用例全部 PASS**，且原有用例不回归。如果 VERIFIED_USER 凭据缺失导致 helper 报错，回到 Step 2 补 seed/fixture。

- [ ] **Step 5: Commit**

```bash
git add e2e/api-security.spec.ts e2e/helpers/auth.ts e2e/global-setup.ts .env.test
git commit -m "test(e2e): verify wewe-rss settings routes reject verified users"
```

---

## Task 8: 全量验收 + 交接文档

**Files:**
- Create: `docs/handoff/P1-wewe-rss-permission-handoff.md`

- [ ] **Step 1: 跑完整验收命令**

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

Expected（必须全部满足，否则不算 P1 完成）：
- `pnpm lint` → 0 error
- `pnpm test` → 全绿（原有用例 + 新增 10 个 wewe-rss 单测）
- `pnpm build` → 成功
- `pnpm exec playwright test` → 全绿（含 api-security 新增 5 个用例；如果某个用例因外部 WeWe RSS 服务未起而失败，**仅限 test-connection 类**，记录在交接文档「风控/外部依赖」章节，不算阻塞）

- [ ] **Step 2: 新建交接文档 `docs/handoff/P1-wewe-rss-permission-handoff.md`**

```markdown
# P1 交接文档：WeWe RSS 权限收紧

## 改了什么
- 5 个 API handler 权限从 requireVerifiedUser 收紧为 requireAdmin：
  - `src/app/api/settings/integrations/wewe-rss/route.ts`（GET/POST/DELETE/PUT）
  - `src/app/api/settings/integrations/wewe-rss/test/route.ts`（POST）
- 设置首页「外部集成」入口从 `isVerifiedUser` 收紧为 `isAdmin`（`src/app/settings/page.tsx`）
- `/settings/integrations` 页加客户端 admin 守卫，非 admin 重定向回 `/settings`（`src/app/settings/integrations/page.tsx`）

## 为什么
WeWe RSS 仅作为管理员后台采集工具。普通（VERIFIED_USER/USER）用户不应配置、调用或看到 WeWe RSS，避免风控面扩大与误配置。

## 权限边界（最终）
| 接口/页面 | USER | VERIFIED_USER | ADMIN |
|---|---|---|---|
| GET/POST/DELETE/PUT /api/settings/integrations/wewe-rss | 403 | 403 | ✅ |
| POST /api/settings/integrations/wewe-rss/test | 403 | 403 | ✅ |
| /settings 「外部集成」入口 | 隐藏 | 隐藏 | 显示 |
| /settings/integrations 直访 | 重定向 | 重定向 | 正常 |

## 数据库迁移
无。P1 不涉及 schema 改动。

## 测试结果
- 单测：新增 10 个用例（主路由 7 + test 子路由 3），全绿。
- e2e：api-security.spec.ts 新增 5 个用例，全绿。
- lint / build：通过。

## 风控/外部依赖
无外部依赖失败。test-connection 接口依赖真实 WeWe RSS 服务，但 e2e 用 mock 或不依赖服务可达性，未触发风控。

## 给下一个 PR 的注意事项
- P2 会改 schema，与本 PR 无冲突。
- 管理员后台 `/admin/integrations/wewe-rss` 保持不动，本 PR 未触碰。
- 若 P7 重构设置页，注意保留本 PR 加的 admin 守卫逻辑。
```

- [ ] **Step 3: Commit 交接文档**

```bash
git add docs/handoff/P1-wewe-rss-permission-handoff.md
git commit -m "docs(handoff): P1 wewe-rss permission lockdown"
```

- [ ] **Step 4: 推送分支**

```bash
git push -u origin HEAD
```

PR 描述附上：本 plan 链接、测试结果截图、交接文档路径。

---

## Verification（端到端验证清单）

P1 完成后，以下场景必须全部成立：

1. **VERIFIED_USER 登录后**：
   - `/settings` 页面看不到「外部集成」卡片 ✅
   - 直接访问 `/settings/integrations` → 跳回 `/settings` ✅
   - 调用 `GET/POST/DELETE/PUT /api/settings/integrations/wewe-rss` → 403 ✅
   - 调用 `POST /api/settings/integrations/wewe-rss/test` → 403 ✅
2. **ADMIN 登录后**：
   - `/settings` 页面看得到「外部集成」卡片 ✅
   - `/settings/integrations` 正常显示配置表单 ✅
   - 调用上述 5 个接口 → 正常（200 或业务返回）✅
3. **匿名（未登录）**：
   - 5 个接口 → 401 ✅
4. **管理员后台 `/admin/integrations/wewe-rss`**：行为不变 ✅（未触碰）
5. **`/api/integrations/wewe-rss/**`**（管理员同步/采集接口）：行为不变 ✅（本就是 requireAdmin）

---

## Self-Review

**Spec coverage：**
- 需求 3.1「WeWe RSS 仅管理员」→ Task 1-7 全覆盖（5 个 API + 入口 + 守卫 + 单测 + e2e）✅
- 需求 6.1「禁用普通用户 WeWe RSS 配置接口」→ Task 1-4 覆盖 ✅
- 文档列出的检查点 `/integrations/wewe-rss` 普通用户入口 → Task 5-6 覆盖 ✅

**Placeholder scan：** 无 TBD / TODO / "类似上文" / "添加适当错误处理"。所有代码块完整。✅

**Type consistency：** `requireAdmin` / `unauthorizedResponse` / `forbiddenResponse` 在 `src/lib/auth.ts` 已定义且签名匹配；测试用的 `USERS` 角色常量与 `UserRole` 类型一致（`"ADMIN" | "VERIFIED_USER" | "USER"`）。✅
