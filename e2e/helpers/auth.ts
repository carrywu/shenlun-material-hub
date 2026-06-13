import { expect, Page } from '@playwright/test';

/**
 * 统一登录工具 —— 所有 spec 必须使用此函数登录。
 *
 * 使用 getByPlaceholder 避免 Suspense 时序问题：
 * login/page.tsx 的 LoginForm 被 <Suspense> 包裹，
 * 首次渲染显示"加载中..."，useSearchParams 解析后才渲染表单。
 * getByPlaceholder 会自动等待元素出现。
 *
 * 注意：waitForURL 使用 URL predicate 而非 regex /\/admin/，
 * 因为 regex 同时匹配 /admin/login，导致在 cookie 设置前就匹配成功。
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  await page.waitForURL(/\/admin\/login/, { timeout: 10000 });

  // 等待 Suspense 解析完成——表单 placeholder 出现
  const accountInput = page.getByPlaceholder('请输入账号');
  await expect(accountInput).toBeVisible({ timeout: 10000 });

  await accountInput.fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.locator("form button[type='submit']").click();

  // 等待登录成功——必须等待导航离开 /admin/login 页面
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/admin/login'),
    { timeout: 15000 },
  );

  // 验证页面主体内容已加载（等待 main 元素，兼容 h1/h2/h3）
  await expect(page.locator('main').first()).toBeVisible({ timeout: 5000 });

  // 验证 auth_token cookie 存在且 httpOnly
  const cookies = await page.context().cookies();
  const authToken = cookies.find((c) => c.name === 'auth_token');
  if (!authToken) {
    throw new Error('登录失败：auth_token cookie 不存在');
  }
  if (!authToken.httpOnly) {
    throw new Error('登录失败：auth_token cookie 不是 httpOnly');
  }
}

/**
 * API 级别登录 —— 返回带 auth cookie 的 request context。
 * 用于不需要浏览器的 API 测试。
 */
export async function loginAsAdminAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin123', context: 'admin' },
  });
  if (!res.ok()) {
    throw new Error(`API 登录失败：${res.status()} ${await res.text()}`);
  }
}

/**
 * P8-T7: USER 角色 API 登录。
 *
 * 注意：Playwright 的 `request` fixture 默认携带 globalSetup 注入的 admin
 * storageState，会让本次调用带上 admin cookie 造成污染。使用此 helper 的测试
 * 必须用 `test.use({ storageState: { cookies: [], origins: [] } })` 覆盖项目级
 * storageState，或通过 `playwright.request.newContext({ storageState: ... })`
 * 创建独立 context。
 *
 * USER 账号由 global-setup 自动注册（e2e_usera），不再需要 seed 预创建。
 */
export async function loginAsUserAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_USERA_USERNAME ?? 'e2e_usera',
      password: process.env.E2E_USERA_PASSWORD ?? 'usera123',
    },
  });
  if (!res.ok()) {
    throw new Error(`USER API 登录失败：${res.status()} ${await res.text()}`);
  }
}

/**
 * P0-004: VERIFIED_USER 角色 API 登录。
 * 账号由 global-setup 自动注册（e2e_verified），密码从 env 读默认 verified123。
 */
export async function loginAsVerifiedUserAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_VERIFIED_USERNAME ?? 'e2e_verified',
      password: process.env.E2E_VERIFIED_PASSWORD ?? 'verified123',
    },
  });
  if (!res.ok()) {
    throw new Error(`VERIFIED API 登录失败：${res.status()} ${await res.text()}`);
  }
}

/**
 * P0-004: userB 角色 API 登录（A/B 隔离测试用）。
 */
export async function loginAsUserBAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_USERB_USERNAME ?? 'e2e_userb',
      password: process.env.E2E_USERB_PASSWORD ?? 'userb123',
    },
  });
  if (!res.ok()) {
    throw new Error(`userB API 登录失败：${res.status()} ${await res.text()}`);
  }
}

/**
 * P0-004: 通过注册 API 创建账号（幂等：用户名已存在返回 409 视为成功）。
 * 带 invitationCode → VERIFIED_USER；不带 → USER。
 * 返回登录态 cookie（调用方负责存 storageState）。
 */
export async function registerUserAPI(
  request: import('@playwright/test').APIRequestContext,
  username: string,
  password: string,
  invitationCode?: string,
): Promise<void> {
  const res = await request.post('/api/auth/register', {
    data: { username, password, invitationCode },
  });
  // 201 = 新注册成功；409 = 用户名已存在（幂等，视为成功）
  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(`注册 ${username} 失败：${res.status()} ${await res.text()}`);
  }
}
