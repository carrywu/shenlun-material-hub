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
    data: { username: 'admin', password: 'admin123' },
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
 * USER 账号需在 global-setup 或 seed 脚本里预创建；dev DB 暂缺该 fixture，
 * 调用方应做好 try/catch 或 test.skip 兜底。
 */
export async function loginAsUserAPI(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  const res = await request.post('/api/auth/login', {
    data: {
      username: process.env.E2E_USER_USERNAME ?? 'plainuser',
      password: process.env.E2E_USER_PASSWORD ?? 'user-password',
    },
  });
  if (!res.ok()) {
    throw new Error(`USER API 登录失败：${res.status()} ${await res.text()}`);
  }
}
