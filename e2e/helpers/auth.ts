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
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  await page.goto('/admin');
  await page.waitForURL(/\/admin\/login/, { timeout: 10000 });

  // 等待 Suspense 解析完成——表单 placeholder 出现
  const accountInput = page.getByPlaceholder('请输入账号');
  await expect(accountInput).toBeVisible({ timeout: 10000 });

  await accountInput.fill(adminUsername);
  await page.getByPlaceholder('请输入密码').fill(adminPassword);
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
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const res = await request.post('/api/auth/login', {
    data: { username: adminUsername, password: adminPassword },
  });
  if (!res.ok()) {
    throw new Error(`API 登录失败：${res.status()} ${await res.text()}`);
  }
}
