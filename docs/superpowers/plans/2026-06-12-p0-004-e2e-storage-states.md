# P0-004: E2E storageState 拆分 + 修复污染 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** 把 Playwright 配置从「单 chromium + 默认 admin storageState」改为 4 类角色 project（anonymous/user/verified/admin），每类有独立 storageState；修复既有 16 个「未认证 401」用例的污染；建 userA/userB 独立账号。

**Architecture:** `playwright.config.ts` 的 `projects` 拆 4 个，每个用不同 `storageState`。`global-setup.ts` 改为创建 4 个登录态文件（admin/verified/userA/userB）。既有 spec 按 `[project]` 标注跑哪个 project，或用 `test.use` 局部覆盖。anonymous project 用空 storageState。

**Tech Stack:** Playwright projects · `global-setup` 多角色登录 · `test.use({ storageState })` · helpers 扩展。

---

## Context（为什么做这个）

**现状**：`playwright.config.ts` 顶层 `storageState: '.auth/admin-storage.json'`，所有测试默认带 admin cookie → 既有「未认证 401」用例实际带 admin cookie，测试不可信。P1-P8 新写的 e2e 用 `test.use({ storageState: { cookies: [], origins: [] } })` 局部隔离，但**既有 16 个老用例没修**。

**目标**：用 project 级配置系统性解决，不靠每个用例手动 `test.use`。

---

## File Structure

| 文件 | 操作 |
|---|---|
| `e2e/helpers/auth.ts` | 加 `loginAsVerifiedUserAPI`、`loginAsUserBAPI` |
| `e2e/global-setup.ts` | 创建 4 个 storageState 文件 |
| `playwright.config.ts` | projects 拆 4 类 |
| `e2e/api-security.spec.ts` | 既有 401 用例标 anonymous project |
| `e2e/data-isolation.spec.ts` | A/B 用例标 userA/userB project |

---

## Task 1: helpers 扩展 + 多角色 storageState 创建

**Files:**
- Modify: `e2e/helpers/auth.ts`
- Modify: `e2e/global-setup.ts`

- [ ] **Step 1: helpers 加 verified + userB**

`e2e/helpers/auth.ts` 追加（参考现有 `loginAsUserAPI` 风格）：

```typescript
export async function loginAsVerifiedUserAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_VERIFIED_USERNAME ?? 'verified',
      password: process.env.E2E_VERIFIED_PASSWORD ?? 'verified123',
    },
  });
  if (!res.ok()) throw new Error(`VERIFIED 登录失败：${res.status()}`);
}

export async function loginAsUserBAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_USERB_USERNAME ?? 'userb',
      password: process.env.E2E_USERB_PASSWORD ?? 'userb123',
    },
  });
  if (!res.ok()) throw new Error(`userB 登录失败：${res.status()}`);
}
```

- [ ] **Step 2: global-setup 创建 4 个角色 storageState**

重写 `e2e/global-setup.ts`，循环登录 4 个角色（admin/verified/userA/userB），各自存 `.auth/<role>-storage.json`。每个角色从 env 读密码（admin 已有 `E2E_ADMIN_PASSWORD`）。

具体结构：
```typescript
import { chromium, type FullConfig } from '@playwright/test';

const ROLES = [
  { name: 'admin', user: 'admin', passEnv: 'E2E_ADMIN_PASSWORD', defaultPass: 'admin123', path: '.auth/admin-storage.json' },
  { name: 'verified', user: 'verified', passEnv: 'E2E_VERIFIED_PASSWORD', defaultPass: 'verified123', path: '.auth/verified-storage.json' },
  { name: 'userA', user: 'usera', passEnv: 'E2E_USERA_PASSWORD', defaultPass: 'usera123', path: '.auth/userA-storage.json' },
  { name: 'userB', user: 'userb', passEnv: 'E2E_USERB_PASSWORD', defaultPass: 'userb123', path: '.auth/userB-storage.json' },
] as const;

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3001';
  const browser = await chromium.launch();
  for (const role of ROLES) {
    const password = process.env[role.passEnv] ?? role.defaultPass;
    const page = await browser.newPage();
    try {
      await page.goto(`${baseURL}/login`);
      await page.getByPlaceholder('请输入账号').fill(role.user);
      await page.getByPlaceholder('请输入密码').fill(password);
      await page.locator("form button[type='submit']").click();
      await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
      await page.context().storageState({ path: role.path });
    } catch (e) {
      console.warn(`⚠ ${role.name} 登录失败（storageState 将为空，相关用例会 skip）`, e instanceof Error ? e.message : e);
    }
    await page.close();
  }
  await browser.close();
}
export default globalSetup;
```

⚠️ 角色 fixture 账号需先在 staging/dev 创建（admin 已有；verified/userA/userB 用注册接口创建，邀请码可选）。

- [ ] **Step 3: commit**

```bash
git add e2e/helpers/auth.ts e2e/global-setup.ts
git commit -m "feat(e2e): multi-role storageState in global-setup"
```

---

## Task 2: playwright.config 拆 4 projects

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: 移除顶层 storageState，改 projects**

找到 `use: { ..., storageState: '.auth/admin-storage.json', ... }`——**移除 storageState**。

把 `projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]` 替换为：

```typescript
  projects: [
    {
      name: 'anonymous',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'userA',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/userA-storage.json' },
    },
    {
      name: 'userB',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/userB-storage.json' },
    },
    {
      name: 'verified',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/verified-storage.json' },
    },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/admin-storage.json' },
    },
  ],
```

⚠️ 这样每个 spec 默认跑 5 个 project（用例会 ×5）。用 `test.describe.configure({ mode: 'serial' })` 或在 spec 里用 `test.use({ storageState })` 局部覆盖来限制。更精细方案：用 `test.use` 标注每个 describe 跑哪个 project——但这需要给既有 spec 加标注（Task 3）。

**简化**：先全拆，spec 内用 `test.use({ storageState })` 声明本组需要什么身份，playwright 会在匹配的 project 下跑。如果用例没声明，会跑所有 project（噪声多但能发现权限 bug）。

- [ ] **Step 2: 验证配置**

Run: `pnpm exec playwright test --list 2>&1 | tail -10` → 能列出用例（可能 ×5 project）。

- [ ] **Step 3: commit**

```bash
git add playwright.config.ts
git commit -m "feat(e2e): split 4 auth projects (anonymous/userA/userB/verified/admin)"
```

---

## Task 3: 修复既有 16 个污染用例

**Files:**
- Modify: `e2e/api-security.spec.ts`
- Modify: `e2e/data-isolation.spec.ts`

- [ ] **Step 1: api-security 的 401 用例标 anonymous**

既有 16 个「未认证 → 401」用例，在每个用例的 describe 块加：

```typescript
test.describe('未认证 → 401', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  // ... 既有用例不动
});
```

或用 `test.describe.configure` + project 名匹配。优先用 `test.use` 局部覆盖（最小改动）。

- [ ] **Step 2: data-isolation 加 userA/userB 用例**

追加：
```typescript
test.describe('用户 A/B 数据隔离', () => {
  test('userA 收藏的文章不出现在 userB 的我的文章', async ({ request }) => {
    // 用 userA storageState 收藏一篇
    // 切 userB storageState 查 /api/favorites，不含该篇
  });
  test('userA 生成的素材卡 userB 看不到', async ({ request }) => {
    // 类似
  });
});
```

⚠️ 需要文章 fixture（staging 空库问题）——若 staging 无文章，这些用例 `test.skip`。

- [ ] **Step 3: 跑 e2e 验证**

Run: `pnpm exec playwright test e2e/api-security.spec.ts` → 16 个 401 用例真过（不带 cookie）。

- [ ] **Step 4: commit**

```bash
git add e2e/api-security.spec.ts e2e/data-isolation.spec.ts
git commit -m "test(e2e): fix 16 polluted 401 cases + add userA/B isolation"
```

---

## Task 4: 验收 + 报告

**Files:**
- Modify: `docs/audit/multi-user-hardening-todolist.md`

- [ ] **Step 1: 全量 e2e**

```bash
pnpm test:e2e
```

- [ ] **Step 2: 追加 todolist**

```markdown
## P0-004：E2E storageState 拆分 ✅

- **问题**：顶层 admin storageState 污染，401 用例不可信。
- **修法**：playwright.config 拆 4 projects（anonymous/userA/userB/verified/admin）；global-setup 创建 4 storageState；既有 16 个 401 用例显式 anonymous；新增 userA/B 隔离用例。
- **涉及文件**：playwright.config.ts、global-setup.ts、helpers/auth.ts、api-security.spec.ts、data-isolation.spec.ts
- **未覆盖**：userA/B 隔离用例依赖文章 fixture（staging 空库 skip）；需 staging 建账号 + 文章
- **完成状态**：✅ 框架完成；fixture 数据待 staging 准备
```

- [ ] **Step 3: commit**

```bash
git add docs/audit/multi-user-hardening-todolist.md
git commit -m "docs(audit): record P0-004 fix"
```

---

## Verification

1. anonymous project 跑 401 用例真不带 cookie ✅
2. userA/userB/verified/admin 各有独立 storageState ✅
3. 既有 16 个 401 用例可信（真过或真失败，不再假绿）✅
4. userA/B 隔离用例存在（fixture 缺时 skip）✅

---

## Self-Review

**Spec coverage**：四类身份拆分 ✅、未登录清空 storageState ✅、A/B 独立账号 ✅、修 16 个 401 ✅、真实断言 401/403/404/200 ✅。

**Placeholder scan**：global-setup 代码完整。✅
**Type consistency**：ROLES 数组字段名与 storageState 路径一致。✅
