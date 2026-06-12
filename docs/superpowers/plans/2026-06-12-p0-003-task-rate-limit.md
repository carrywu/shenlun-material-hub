# P0-003: 任务限流原子化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** 修复素材卡生成任务限流的并发竞态——把「限流检查 + 任务创建」原子化，同一用户同一文章同卡片类型并发请求只产生一个任务；并在报告明确内存队列的部署限制。

**Architecture:** 给 AsyncTask 加 `dedupeKey` 字段 + partial unique index（仅 PENDING/RUNNING 状态唯一），任务创建走事务（advisory lock 用户 + count 限流 + insert），冲突时返回已有任务。限流检查移到事务内。

**Tech Stack:** Prisma schema + migration（新增字段 + partial index）· `$transaction` + `$executeRaw` advisory lock · Vitest。

---

## Context（为什么做这个）

**漏洞**：`src/app/api/content-items/[id]/generate-card/route.ts` 第 145 行 `checkTaskRateLimit` 在事务外 count，第 204 行 `createAsyncTask` 在事务外 insert——并发请求都可能通过检查然后都建任务。AsyncTask 无 dedupeKey，同一用户同一文章同卡片类型可并发生成重复任务。

**内存队列风险**（`src/lib/async-task.ts`）：`globalThis` 存队列状态，多副本/重启场景不共享、任务丢失。本 plan **不重构 DB worker**（YAGNI，单人 staging 部署），但在报告明确上线限制。

**与需求文档差异**：MaterialCard partial unique index 已存在（防最终重复卡），但**任务级去重没有**——本次加 dedupeKey 在任务阶段就防重复。

---

## File Structure

| 文件 | 操作 |
|---|---|
| `prisma/schema.prisma` | AsyncTask 加 `dedupeKey String?` |
| `prisma/migrations/<ts>_task_dedupe/migration.sql` | 新建：加列 + partial unique index |
| `src/lib/async-task.ts` | `createAsyncTask` 接受 dedupeKey；新增 `createDedupTask` 事务版 |
| `src/app/api/content-items/[id]/generate-card/route.ts` | 用 `createDedupTask` 替代 `createAsyncTask` + 移除外层 checkTaskRateLimit |
| 测试 | 单测覆盖并发/重复/超限 |

---

## Task 1: Schema 加 dedupeKey + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_task_dedupe/migration.sql`

- [ ] **Step 1: schema 加字段**

在 `model AsyncTask` 的 `user User?` 之前加：

```prisma
  dedupeKey   String?   // P0-003: 任务去重键，如 CARD_GENERATE:userId:contentItemId:cardType
```

- [ ] **Step 2: validate**

Run: `pnpm exec prisma validate` → valid。

- [ ] **Step 3: 用 migrate diff 生成 migration SQL（不 apply，方案 B）**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema_pre.prisma
pnpm exec prisma migrate diff \
  --from-schema /tmp/schema_pre.prisma \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/20260612000001_task_dedupe/migration.sql
```

mkdir 先：`mkdir -p prisma/migrations/20260612000001_task_dedupe`。

- [ ] **Step 4: 在 migration.sql 末尾追加 partial unique index**

```sql

-- P0-003: dedupeKey 部分唯一索引——同一去重键在 PENDING/RUNNING 状态下只能一个任务
CREATE UNIQUE INDEX IF NOT EXISTS "asynctask_dedupe_active_unique"
  ON "AsyncTask" ("dedupeKey", "userId")
  WHERE "dedupeKey" IS NOT NULL AND "status" IN ('PENDING', 'RUNNING');
```

- [ ] **Step 5: generate client + commit**

```bash
pnpm exec prisma generate
git add prisma/schema.prisma prisma/migrations/20260612000001_task_dedupe/
git commit -m "feat(schema): add AsyncTask.dedupeKey with partial unique index"
```

---

## Task 2: createDedupTask 事务版 + 单测

**Files:**
- Modify: `src/lib/async-task.ts`
- Create: `src/lib/__tests__/async-task-dedupe.test.ts`

- [ ] **Step 1: 写失败单测**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  executeRaw: vi.fn().mockResolvedValue(1),
  count: vi.fn().mockResolvedValue(0),
  create: vi.fn(),
  findFirst: vi.fn().mockResolvedValue(null),
}));
const dbMock = {
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      $executeRaw: mocks.executeRaw,
      asyncTask: { count: mocks.count, create: mocks.create, findFirst: mocks.findFirst },
    })
  ),
};
vi.mock("@/lib/db", () => ({ db: dbMock }));

import { createDedupTask } from "../async-task";

describe("createDedupTask (P0-003)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("事务内 advisory lock + 限流检查 + 创建", async () => {
    mocks.count.mockResolvedValue(0); // 未超限
    mocks.create.mockResolvedValue({ id: "task-1" });
    const task = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: { foo: "bar" },
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(mocks.executeRaw).toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("pg_advisory_xact_lock") })
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
          status: "PENDING",
        }),
      })
    );
    expect(task.id).toBe("task-1");
  });

  it("已有活跃同键任务 → 返回已存在，不重复创建", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-task" });
    mocks.create.mockResolvedValue({ id: "should-not-call" });
    const task = await createDedupTask({
      type: "CARD_GENERATE",
      userId: "u1",
      dedupeKey: "CARD_GENERATE:u1:c1:golden_sentence",
      params: {},
      maxConcurrent: 3,
      maxDaily: 50,
    });
    expect(task.id).toBe("existing-task");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("并发超限 → 抛 RATE_LIMITED", async () => {
    mocks.count.mockResolvedValue(3); // 并发已达上限 3
    await expect(
      createDedupTask({
        type: "CARD_GENERATE",
        userId: "u1",
        dedupeKey: "CARD_GENERATE:u1:c2:golden_sentence",
        params: {},
        maxConcurrent: 3,
        maxDaily: 50,
      })
    ).rejects.toThrow("RATE_LIMITED");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm test src/lib/__tests__/async-task-dedupe.test.ts` → 全 FAIL（函数不存在）。Commit 红。

- [ ] **Step 2: 实现 createDedupTask**

在 `src/lib/async-task.ts` 追加：

```typescript
export interface DedupTaskInput {
  type: AsyncTaskType;
  userId: string;
  dedupeKey: string;
  params?: unknown;
  maxConcurrent: number;
  maxDaily: number;
}

export class RateLimitError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = "RateLimitError";
  }
}

/**
 * P0-003: 事务内创建去重任务。
 * - advisory lock 串行化同一用户
 * - 查已有活跃同键任务 → 有则返回
 * - 限流检查（并发 + 日）
 * - insert（dedupeKey partial unique 兜底）
 */
export async function createDedupTask(input: DedupTaskInput) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;

    // 已有活跃同键任务？
    const existing = await tx.asyncTask.findFirst({
      where: {
        dedupeKey: input.dedupeKey,
        userId: input.userId,
        status: { in: ["PENDING", "RUNNING"] },
      },
      select: { id: true },
    });
    if (existing) return existing;

    // 限流检查
    const runningCount = await tx.asyncTask.count({
      where: { userId: input.userId, status: { in: ["PENDING", "RUNNING"] } },
    });
    if (runningCount >= input.maxConcurrent) {
      throw new RateLimitError(`并发任务数已达上限 (${input.maxConcurrent})`);
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dailyCount = await tx.asyncTask.count({
      where: { userId: input.userId, createdAt: { gte: todayStart } },
    });
    if (dailyCount >= input.maxDaily) {
      throw new RateLimitError(`今日任务数已达上限 (${input.maxDaily})`);
    }

    return tx.asyncTask.create({
      data: {
        type: input.type,
        status: "PENDING",
        params: serialize(input.params),
        userId: input.userId,
        dedupeKey: input.dedupeKey,
      },
    });
  });
}
```

Run → 全绿。Commit:

```bash
git add src/lib/async-task.ts src/lib/__tests__/async-task-dedupe.test.ts
git commit -m "feat(async-task): createDedupTask with advisory lock + rate limit in tx"
```

---

## Task 3: generate-card 路由用 createDedupTask

**Files:**
- Modify: `src/app/api/content-items/[id]/generate-card/route.ts`
- Modify: 对应测试

- [ ] **Step 1: 路由替换**

第 145-148 行的 `checkTaskRateLimit` 块**删除**（移到事务内）。第 200-210 行的循环内 `createAsyncTask` 改用 `createDedupTask`：

```typescript
// import 改：移除 checkTaskRateLimit，加 createDedupTask + RateLimitError
import { createDedupTask, RateLimitError } from "@/lib/async-task";

// 循环内（替换原 createAsyncTask 块）：
try {
  const task = await createDedupTask({
    type: "CARD_GENERATE",
    userId: user.id,
    dedupeKey: `CARD_GENERATE:${user.id}:${id}:${ct}`,
    params: { contentItemId: id, cardType: ct, requestId },
    maxConcurrent: 3,
    maxDaily: 50,
  });
  enqueueAsyncTask(task, () => runGenerateCardTask(id, ct, requestId, user.id));
  tasks.push({ cardType: ct, taskId: task.id, duplicated: false });
} catch (e) {
  if (e instanceof RateLimitError) {
    return errorResponse("RATE_LIMITED", e.reason, 429, { requestId });
  }
  throw e;
}
```

⚠️ `createDedupTask` 已含去重逻辑（同键活跃任务返回 existing），所以循环前的 `dup = findFirst` 检查可保留（用于在 UI 标 duplicated）或删除（让 createDedupTask 处理）。**保留** + createDedupTask 兜底更稳。

- [ ] **Step 2: 更新测试**

`src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts`：
- mock `createDedupTask` 替代 `createAsyncTask` + `checkTaskRateLimit`
- 新增「重复点击同类型 → 同 task」（createDedupTask 返回 existing）
- 「超限 → 429」用例改用 `createDedupTask` mock throw RateLimitError

- [ ] **Step 3: 跑 + commit**

```bash
pnpm test src/app/api/content-items/\[id\]/generate-card/__tests__/route.test.ts
git add src/app/api/content-items/\[id\]/generate-card/
git commit -m "fix(generate-card): atomic dedup task creation, no race"
```

---

## Task 4: 验收 + 报告内存队列风险

**Files:**
- Modify: `docs/audit/multi-user-hardening-todolist.md`

- [ ] **Step 1: 验收**

```bash
pnpm lint && pnpm test && pnpm build
```

- [ ] **Step 2: 追加 todolist（含内存队列风险声明）**

```markdown
## P0-003：任务限流原子化 ✅

- **问题**：checkTaskRateLimit + createAsyncTask 非原子，可并发生成重复任务。
- **修法**：AsyncTask 加 dedupeKey + partial unique index；createDedupTask 事务内 advisory lock + 查重 + 限流 + insert。
- **涉及文件**：schema、async-task.ts、generate-card/route.ts + 测试
- **测试**：并发去重、超限 429、重复点击同任务 → 全绿
- **⚠️ 未解决（上线限制）**：
  - 内存队列（globalThis）多副本不共享，重启丢任务
  - **单副本部署 OK；多副本/水平扩展前必须重构 DB worker**
  - 生产前人工确认：部署是否单副本？
- **完成状态**：✅ 任务级去重完成；DB worker 升级独立 issue
```

- [ ] **Step 3: commit**

```bash
git add docs/audit/multi-user-hardening-todolist.md
git commit -m "docs(audit): record P0-003 fix + memory queue risk"
```

---

## Verification

1. 同用户同文章同类型并发 → 只一个任务 ✅
2. 超并发 → 429 ✅
3. 超日限 → 429 ✅
4. dedupeKey partial unique index 存在 ✅
5. 单测全绿 ✅

---

## Self-Review

**Spec coverage**：
- 「并发点击只产生一个任务/卡」→ createDedupTask advisory lock + dedupeKey ✅
- 「超并发/日限 → 429」→ RateLimitError ✅
- 「服务重启 PENDING 策略」→ 报告声明（内存队列丢，单副本限制）✅
- 「MaterialCard partial index 真实存在」→ 已验证（P2 加的）✅
- 「DB worker 评估」→ 报告声明不重构 + 上线限制 ✅

**Placeholder scan**：无。✅
**Type consistency**：`createDedupTask(DedupTaskInput)` 接口与调用一致；`RateLimitError` 命名一致。✅
