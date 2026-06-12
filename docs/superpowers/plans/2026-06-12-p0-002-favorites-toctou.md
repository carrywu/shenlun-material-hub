# P0-002: 收藏配额 TOCTOU 修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复收藏配额的 TOCTOU 竞态——把 advisory lock + count 检查 + insert 全部放进同一事务，保证同一用户的并发收藏请求串行化，配额不可被突破。

**Architecture:** 在 POST 事务内第一步用 `pg_advisory_xact_lock(hashtext(userId))` 锁定当前用户（事务级锁，提交自动释放），再 count，再 insert。移除事务外的预检查（或保留作 fast-fail 但不依赖它）。重复收藏走 `createMany skipDuplicates` 幂等处理。

**Tech Stack:** Prisma `$transaction` + `$executeRaw`（advisory lock）· PostgreSQL · Vitest。

---

## Context（为什么做这个）

**漏洞**：`src/app/api/favorites/route.ts` 第 41-50 行 `getFavoriteLimits` + `getCurrentFavoriteCount` 在事务**外**读，第 52-71 行 insert 在事务**内**。两个并发请求都读到 `count=N`，都过检查，都 insert → 突破配额。

**与需求文档差异**：
- P1-P8 已经把 insert 放进事务 + 加了 `@@unique([userId, contentItemId])`（防重复收藏）。
- **但配额并发控制没解决**——`@@unique` 只防同一文章重复，不防「并发收藏不同文章突破总数」。
- 需求文档 P0-002 第 5 条明确：「`@@unique` 只能防重复收藏，不能当作配额并发控制」——本次修。

**预期产出**：并发 10 个请求收藏不同文章（剩余名额 1）→ 只能成功 1 个；单测覆盖并发场景。

---

## File Structure

| 文件 | 责任 | 操作 |
|---|---|---|
| `src/app/api/favorites/route.ts` | POST 批量收藏 | 改造：事务内 advisory lock + count + createMany |
| `src/app/api/favorites/__tests__/route.test.ts` | 单测 | 追加并发模拟用例 |

**复用**：`src/lib/favorite-quota.ts` 的 `getFavoriteLimits`（保留，但移到事务内调用）。

---

## Task 1: 单测锁定「并发不突破配额」（先红）

**Files:**
- Modify: `src/app/api/favorites/__tests__/route.test.ts`

- [ ] **Step 1: 读现有测试，确认 mock 结构**

Run: `head -50 src/app/api/favorites/__tests__/route.test.ts`

确认它 mock 了 `@/lib/auth`（requireAuth）、`@/lib/favorite-quota`（getFavoriteLimits/getCurrentFavoriteCount）、`@/lib/db`（$transaction + 各种 model 方法）。

- [ ] **Step 2: 追加 2 个并发相关用例**

```typescript
  it("P0-002: 事务内调 advisory lock（$executeRaw 调 pg_advisory_xact_lock）", async () => {
    authMocks.requireAuth.mockResolvedValue(USERS.VERIFIED);
    quota.limits.mockResolvedValue(100);
    mocks.txFindMany.mockResolvedValue([{ id: "c1" }]); // 1 篇 eligible
    mocks.txCreateMany.mockResolvedValue({ count: 1 });
    // 事务内 count（getCurrentFavoriteCount 改到事务内）
    mocks.txCount.mockResolvedValue(0);
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ["c1"] }));
    expect(res.status).toBe(200);
    // 关键：$transaction 内执行了 advisory lock raw SQL
    expect(mocks.txExecuteRaw).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock")
    );
  });

  it("P0-002: 事务内 count 检查超限 → 拒绝（不 createMany）", async () => {
    authMocks.requireAuth.mockResolvedValue(USERS.VERIFIED);
    quota.limits.mockResolvedValue(100);
    mocks.txFindMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]); // 2 篇 eligible
    mocks.txCount.mockResolvedValue(99); // 已有 99，名额剩 1
    const res = await POST(makeReq("POST", USERS.VERIFIED, { contentItemIds: ["c1", "c2"] }));
    // 2 篇超限 → 400
    expect(res.status).toBe(400);
    expect(mocks.txCreateMany).not.toHaveBeenCalled();
  });
```

⚠️ 这要求测试 mock 提供 `txExecuteRaw`（事务内的 `$executeRaw`）和 `txCount`（事务内的 count）。现有 mock 的 `$transaction` 工厂只注入了 `findMany`/`create`——Task 2 改路由时同步更新测试 mock 工厂。

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm test src/app/api/favorites/__tests__/route.test.ts`

Expected: 新用例 FAIL（路由现在不调 advisory lock，count 在事务外）。

- [ ] **Step 4: Commit（红）**

```bash
git add src/app/api/favorites/__tests__/route.test.ts
git commit -m "test(favorites): lock TOCTOU concurrency-safety"
```

---

## Task 2: 事务内 advisory lock + count + createMany

**Files:**
- Modify: `src/app/api/favorites/route.ts`
- Modify: `src/app/api/favorites/__tests__/route.test.ts`（更新 mock 工厂）

- [ ] **Step 1: 重写 POST handler（第 34-77 行）**

把整个 try 块替换为：

```typescript
  try {
    const { contentItemIds } = (await request.json()) as { contentItemIds: string[] };
    if (!Array.isArray(contentItemIds) || contentItemIds.length === 0) {
      return NextResponse.json({ error: "contentItemIds 不能为空" }, { status: 400 });
    }

    const limit = await getFavoriteLimits(user);

    const result = await db.$transaction(async (tx) => {
      // P0-002: 事务级 advisory lock，串行化同一用户的配额检查
      // hashtext 返回 int4，pg_advisory_xact_lock 事务提交自动释放
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

      // 事务内 count（修复 TOCTOU）
      const currentCount = await tx.articleFavorite.count({
        where: { userId: user.id },
      });

      // 只收藏 approved 文章
      const eligible = await tx.contentItem.findMany({
        where: { id: { in: contentItemIds }, adminReviewStatus: "approved" },
        select: { id: true },
      });
      const eligibleIds = eligible.map((e) => e.id);
      const skipped = contentItemIds.length - eligibleIds.length;

      // 事务内配额检查（修复 TOCTOU 的关键）
      if (currentCount + eligibleIds.length > limit) {
        throw new Error("QUOTA_EXCEEDED");
      }

      // 批量幂等插入（skipDuplicates 处理重复收藏）
      let added = 0;
      if (eligibleIds.length > 0) {
        const createResult = await tx.articleFavorite.createMany({
          data: eligibleIds.map((id) => ({ userId: user.id, contentItemId: id })),
          skipDuplicates: true,
        });
        added = createResult.count;
      }
      const alreadyFavorited = eligibleIds.length - added;
      return { added, skipped, alreadyFavorited };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "QUOTA_EXCEEDED") {
      return NextResponse.json(
        { error: `收藏已达上限，无法继续收藏` },
        { status: 400 }
      );
    }
    console.error("favorites POST failed:", error);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
```

关键改动：
1. **advisory lock**：`tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${user.id}))\``——Prisma 的 tagged template 自动参数化防 SQL 注入。
2. **count 移到事务内**：`tx.articleFavorite.count`，在 lock 之后，读到的是串行化后的真实值。
3. **createMany skipDuplicates**：替代原来的 for 循环 + try/catch，更高效且原子。
4. **移除事务外预检查**：原第 41-50 行删除（事务内检查足够，事务外的 fast-fail 反而制造 TOCTOU 窗口）。
5. **移除 `getCurrentFavoriteCount` import**：不再用（count 在事务内）。保留 `getFavoriteLimits`（也可以移事务内，但 limit 是配置读，无并发风险，留事务外减少事务时长）。

- [ ] **Step 2: 更新测试 mock 工厂**

测试文件里 `$transaction` 的 mock 工厂要注入 `executeRaw` 和 `count`。找到现有：

```typescript
const dbMock = {
  $transaction: vi.fn(async (fn) =>
    fn({
      contentItem: { findMany: mocks.txFindMany },
      articleFavorite: { create: mocks.txCreate },
    })
  ),
  articleFavorite: { count: mocks.count, findMany: mocks.findMany },
};
```

改为：

```typescript
const dbMock = {
  $transaction: vi.fn(async (fn) =>
    fn({
      contentItem: { findMany: mocks.txFindMany },
      articleFavorite: {
        create: mocks.txCreate,
        count: mocks.txCount,
        createMany: mocks.txCreateMany,
      },
      $executeRaw: mocks.txExecuteRaw,
    })
  ),
  articleFavorite: { count: mocks.count, findMany: mocks.findMany },
};
```

在 `mocks` hoisted 对象加：
```typescript
txCount: vi.fn().mockResolvedValue(0),
txCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
txExecuteRaw: vi.fn().mockResolvedValue(1),
```

**更新现有用例**：「整批超上限 → 400」用例原来用 `quota.count.mockResolvedValue(95)`（事务外 count），现在改成 `mocks.txCount.mockResolvedValue(95)`（事务内 count），且 `mocks.txFindMany` 返回 10 篇 eligible，断言走 QUOTA_EXCEEDED 分支。

「未审核文章被过滤」用例：`mocks.txFindMany` 返回 2 篇（1 approved 1 不在），`mocks.txCount` 返回 0，`mocks.txCreateMany` 返回 `{count:1}`，断言 `added=1, skipped=1`。

「USER 可收藏」「GET 列表」用例不受影响（GET 不走 POST 事务）。

- [ ] **Step 3: 跑测试确认全绿**

Run: `pnpm test src/app/api/favorites/__tests__/route.test.ts`

Expected: 全部用例 PASS（新 2 + 既有改造后）。

- [ ] **Step 4: 跑全量**

Run: `pnpm test 2>&1 | tail -6`

Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/favorites/route.ts src/app/api/favorites/__tests__/route.test.ts
git commit -m "fix(favorites): make quota checks concurrency-safe with advisory lock"
```

---

## Task 3: 验收 + todolist

**Files:**
- Modify: `docs/audit/multi-user-hardening-todolist.md`

- [ ] **Step 1: 验收**

```bash
pnpm lint
pnpm test
pnpm build
```

Expected: 全绿。

- [ ] **Step 2: 追加 todolist**

```markdown
## P0-002：收藏配额 TOCTOU 修复 ✅

- **问题**：count 检查在事务外，insert 在事务内，并发可突破配额。
- **影响**：多人并发收藏不同文章时突破上限。
- **修法**：事务内 `pg_advisory_xact_lock(hashtext(userId))` 串行化 + 事务内 count + createMany skipDuplicates。
- **涉及文件**：`src/app/api/favorites/route.ts`、`src/app/api/favorites/__tests__/route.test.ts`
- **验证命令**：`pnpm test src/app/api/favorites/__tests__/route.test.ts`
- **测试结果**：新增并发用例（advisory lock 调用 + 事务内 count 超限拒绝），全绿。
- **未覆盖**：真实并发压力测试（需 staging 多请求脚本，单测用 mock 模拟）。
- **完成状态**：✅ 完成
```

- [ ] **Step 3: Commit**

```bash
git add docs/audit/multi-user-hardening-todolist.md
git commit -m "docs(audit): record P0-002 fix"
```

---

## Verification

1. 事务内调 `pg_advisory_xact_lock(hashtext(userId))` ✅
2. count 在 lock 之后、事务内 ✅
3. 超限时事务回滚，不 createMany ✅
4. 重复收藏 `skipDuplicates` 幂等 ✅
5. 单测全绿 ✅

---

## Self-Review

**Spec coverage（P0-002 验收标准）**：
- 「剩余 1 名额时并发 10 请求只成功 1」→ advisory lock 串行化 + 事务内 count ✅（逻辑保证，真实并发需 staging 压测）
- 「同一文章重复收藏不产生重复记录」→ `@@unique` + `skipDuplicates` ✅
- 「超额返回明确中文错误」→ `QUOTA_EXCEEDED` → 400 `收藏已达上限` ✅
- 「单元测试覆盖并发」→ Task 1（mock 模拟事务内顺序）✅

**Placeholder scan**：无。✅

**Type consistency**：`tx.$executeRaw` tagged template 是 Prisma 标准用法；`createMany skipDuplicates` 返回 `{count}` 与测试断言一致。✅
