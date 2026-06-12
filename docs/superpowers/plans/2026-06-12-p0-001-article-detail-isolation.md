# P0-001: 文章详情子资源隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `GET /api/content-items/[id]` 泄露其他用户素材卡和批注的漏洞——非 ADMIN 用户只能看到自己的子资源，ADMIN 看全部，legacy null 数据默认只给 ADMIN。

**Architecture:** 移除详情接口对 `materialCards`/`annotations` 的无差别 include，改为按当前用户角色过滤（ADMIN 全量、非 ADMIN 仅 `ownerUserId/userId = currentUser.id`）。legacy null 子资源默认对非 ADMIN 隐藏。新增单元测试覆盖 A/B 用户隔离。

**Tech Stack:** Next.js 15 App Router · Prisma · Vitest（`vi.hoisted` + `vi.mock` 风格）· 复用 `src/lib/data-isolation.ts` 的现有 helper。

---

## Context（为什么做这个）

**漏洞**：`src/app/api/content-items/[id]/route.ts` GET handler 第 20-21 行 `include: { materialCards, annotations }` 没有任何 where 过滤。当 A 和 B 都能访问同一篇 public 文章时，A 在详情响应里能看到 B 的素材卡和批注。

**与需求文档的差异**（需求文档第 9 条要求说明）：
- 需求文档假设「单人可用」状态，但 P1-P8 已部分改动此文件（加了 `adminReviewStatus` 检查），**子资源泄露漏洞依然存在**——本次修复。
- 列表接口（`/api/material-cards`、`/api/content-items/[id]/annotations`）**已经正确隔离**（用 `ownerScopeWhere` / 角色分支），不需要改。本次只修详情接口。

**预期产出**：详情接口对非 ADMIN 只返回自己的子资源；单测覆盖 A/B 隔离；不破坏现有测试。

---

## File Structure

| 文件 | 责任 | 本 plan 操作 |
|---|---|---|
| `src/app/api/content-items/[id]/route.ts` | 文章详情 GET | 修改 include 加 where 过滤 |
| `src/app/api/content-items/[id]/__tests__/route.test.ts` | 详情单测 | 追加 A/B 隔离用例 |

**复用现有 helper**（不动）：
- `src/lib/data-isolation.ts` 的 `ownerScopeWhere(user)` 返回 `{ OR: [{ ownerUserId: user.id }, { ownerUserId: null }] }` —— 但本 plan **不用它**，因为 legacy null 子资源要默认隐藏，改为显式 `{ ownerUserId: user.id }`。

---

## Task 1: 单测锁定「非 ADMIN 看不到别人卡/批注」（先红）

**Files:**
- Modify: `src/app/api/content-items/[id]/__tests__/route.test.ts`

- [ ] **Step 1: 读现有测试文件，确认 mock 结构**

Run: `cat src/app/api/content-items/[id]/__tests__/route.test.ts`

确认它 mock 了 `@/lib/auth`（requireAuth/requireAdmin）和 `@/lib/db`，且现有用例（VERIFIED_USER 访问 pending_admin→404、approved→200、ADMIN→200）已存在。

- [ ] **Step 2: 在 describe 块末尾追加 3 个新用例**

```typescript
  it("非 ADMIN 详情只返回自己的 materialCards（不含别人的）", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    // DB 返回文章 + 混合卡（自己的 + 别人的 + legacy null）
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [
        { id: "own", ownerUserId: "v", cardType: "golden_sentence" },
        { id: "other", ownerUserId: "user-b", cardType: "golden_sentence" },
        { id: "legacy", ownerUserId: null, cardType: "golden_sentence" },
      ],
      annotations: [
        { id: "own-ann", userId: "v" },
        { id: "other-ann", userId: "user-b" },
      ],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    // 只有自己的卡；别人的和 legacy null 被过滤
    const cardIds = body.materialCards.map((c: { id: string }) => c.id);
    expect(cardIds).toEqual(["own"]);
    // 只有自己的批注
    const annIds = body.annotations.map((a: { id: string }) => a.id);
    expect(annIds).toEqual(["own-ann"]);
  });

  it("ADMIN 详情返回全部 materialCards 和 annotations", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.ADMIN);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [
        { id: "own", ownerUserId: "admin-id" },
        { id: "other", ownerUserId: "user-b" },
        { id: "legacy", ownerUserId: null },
      ],
      annotations: [{ id: "a1", userId: "user-b" }],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materialCards.length).toBe(3);
    expect(body.annotations.length).toBe(1);
  });

  it("非 ADMIN 详情无自己的卡时 materialCards 为空数组", async () => {
    authMocks.getUserFromRequest.mockResolvedValue(USERS.VERIFIED);
    mocks.findUnique.mockResolvedValue({
      id: "x",
      ownerUserId: null,
      visibility: "public",
      adminReviewStatus: "approved",
      source: { id: "s", name: "n", platform: "website" },
      materialCards: [{ id: "other", ownerUserId: "user-b" }],
      annotations: [{ id: "other-ann", userId: "user-b" }],
    });
    const [req, ctx] = makeReq("x", "auth_token=t");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.materialCards).toEqual([]);
    expect(body.annotations).toEqual([]);
  });
```

⚠️ 注意：现有测试的 mock 返回 `materialCards: []` / `annotations: []`（空数组），所以现有「200」用例不会受新过滤逻辑影响。但**新用例的 mock 返回完整数组**，验证过滤逻辑会剔除别人的。

- [ ] **Step 3: 跑测试确认新用例失败**

Run: `pnpm test src/app/api/content-items/[id]/__tests__/route.test.ts`

Expected: 3 个新用例 FAIL（路由现在返回全部卡，`cardIds` 包含 `other`/`legacy`，不等于 `["own"]`）。

- [ ] **Step 4: Commit（红测试）**

```bash
git add src/app/api/content-items/[id]/__tests__/route.test.ts
git commit -m "test(content-items): lock child resource isolation in detail"
```

---

## Task 2: 详情接口按角色过滤子资源

**Files:**
- Modify: `src/app/api/content-items/[id]/route.ts:16-23`

- [ ] **Step 1: 改造 GET 的 findUnique，按角色过滤 include**

打开 `src/app/api/content-items/[id]/route.ts`，找到第 16-23 行：

```typescript
    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, platform: true } },
        materialCards: { orderBy: { createdAt: "desc" } },
        annotations: { orderBy: { createdAt: "desc" } },
      },
    });
```

替换为（按角色过滤子资源）：

```typescript
    // P0-001: 非 ADMIN 只能看自己的子资源；ADMIN 看全部
    const isAdmin = user.role === "ADMIN";
    const item = await db.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { id: true, name: true, platform: true } },
        materialCards: isAdmin
          ? { orderBy: { createdAt: "desc" } }
          : {
              where: { ownerUserId: user.id },
              orderBy: { createdAt: "desc" },
            },
        annotations: isAdmin
          ? { orderBy: { createdAt: "desc" } }
          : {
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
            },
      },
    });
```

⚠️ 注意：
- `user` 变量在第 12 行已经 `await requireAuth(request)` 拿到，可以直接用。
- legacy null 子资源（`ownerUserId = null` / `userId = null`）对非 ADMIN **不再可见**——符合需求文档 P0-001 第 4 条「默认不要暴露给普通用户」。如果产品后续要放开，单独决策。
- Prisma 的 `include` 子查询支持 `where` 过滤，这是标准用法。

- [ ] **Step 2: 跑单测确认全绿**

Run: `pnpm test src/app/api/content-items/[id]/__tests__/route.test.ts`

Expected: 全部用例 PASS（含新 3 个 + 现有 adminReviewStatus 用例）。

⚠️ 如果现有「VERIFIED_USER 访问 approved 文章 → 200」用例挂了，检查它的 mock 是否返回了带别人卡的数组——如果是，调整 mock 让它返回空数组或自己的卡（测试本意是验证文章可访问，不是验证卡列表）。

- [ ] **Step 3: 跑全量单测确认无回归**

Run: `pnpm test 2>&1 | tail -8`

Expected: 全绿（331+ 个用例，新增 3 个）。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/content-items/[id]/route.ts
git commit -m "fix(security): isolate article detail child resources by role"
```

---

## Task 3: 全量验收 + 文档

**Files:**
- 无代码改动，跑验收命令

- [ ] **Step 1: 跑完整验收**

```bash
pnpm lint
pnpm test
pnpm build
```

Expected:
- `pnpm lint` → 0 error（既有 16 warning 不变）
- `pnpm test` → 全绿（含新 3 个用例）
- `pnpm build` → 成功

- [ ] **Step 2: 把修复记录追加到加固 todolist**

新建 `docs/audit/multi-user-hardening-todolist.md`（如果不存在），追加：

```markdown
## P0-001：文章详情子资源隔离 ✅

- **问题**：`GET /api/content-items/[id]` 的 include 未过滤子资源，非 ADMIN 能看到别人的素材卡和批注。
- **影响**：多人场景下数据泄露（A 看到 B 的卡/批注）。
- **修法**：详情接口 include 按 `user.role` 分支——ADMIN 全量，非 ADMIN 仅 `ownerUserId/userId = currentUser.id`。legacy null 子资源默认对非 ADMIN 隐藏。
- **涉及文件**：`src/app/api/content-items/[id]/route.ts`、`src/app/api/content-items/[id]/__tests__/route.test.ts`
- **验证命令**：`pnpm test src/app/api/content-items/[id]/__tests__/route.test.ts`
- **测试结果**：新增 3 个用例（非 ADMIN 只看自己的、ADMIN 全量、无自己卡时空数组），全绿。
- **与需求文档差异**：列表接口（material-cards / annotations）已经正确隔离（P1-P8 用 ownerScopeWhere），本次只修详情接口。
- **完成状态**：✅ 完成
```

- [ ] **Step 3: Commit 文档**

```bash
git add docs/audit/multi-user-hardening-todolist.md
git commit -m "docs(audit): record P0-001 fix in hardening todolist"
```

---

## Verification（端到端验证）

P0-001 完成后，以下必须成立：

1. **A 看不到 B 的卡**：VERIFIED_USER A 访问公共文章详情，响应 `materialCards` 只含 `ownerUserId = A.id` 的 ✅
2. **A 看不到 B 的批注**：同上，`annotations` 只含 `userId = A.id` 的 ✅
3. **legacy null 子资源对非 ADMIN 隐藏**：`ownerUserId = null` 的卡不出现在非 ADMIN 响应里 ✅
4. **ADMIN 看全部**：ADMIN 响应包含所有卡和批注（含 legacy null）✅
5. **现有功能不回归**：文章详情的 adminReviewStatus 检查、404/403 逻辑不变 ✅
6. **单测全绿**：新 3 + 现有用例全过 ✅

---

## Self-Review

**Spec coverage（对照需求文档 P0-001 验收标准）**：
- 「用户 A 访问公共文章详情，看不到用户 B 的素材卡」→ Task 1/2 ✅
- 「用户 A 访问公共文章详情，看不到用户 B 的批注」→ Task 1/2 ✅
- 「管理员可以看到全部」→ Task 1/2 ✅
- 「未登录访问受保护接口返回 401」→ 已有（requireAuth）✅
- 「普通用户访问未审核文章返回 404」→ 已有（P3 加的 adminReviewStatus 检查）✅
- 「legacy null 默认不暴露给普通用户」→ Task 2（非 ADMIN where 不含 null）✅
- 「新增单元测试」→ Task 1 ✅

**Placeholder scan**：无 TBD/TODO。所有代码片段完整。✅

**Type consistency**：`materialCards.where.ownerUserId` / `annotations.where.userId` 字段名与 schema 一致（MaterialCard.ownerUserId、ArticleAnnotation.userId）。`user.role` / `user.id` 与 AuthUser 类型一致。✅

---

## 范围说明（本 plan 不覆盖的）

本 plan **只修 P0-001**。其他加固项是独立 plan：
- **P0-002 收藏 TOCTOU**：需 advisory lock，独立 plan
- **P0-003 任务限流原子化**：需 AsyncTask 加 dedupeKey + 事务，独立 plan
- **P0-004 E2E storageState 拆 projects**：需重构 playwright config + global-setup，独立 plan
- **P1/P2**：legacy null 策略、content-items POST 权限、素材卡编辑权限、Prisma 7 seed、migration drift、tsc 错误、ArticleChecklist——独立 plan

每份独立交付，避免一份 plan 过大。
