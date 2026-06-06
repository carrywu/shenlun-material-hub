import { expect, Page } from '@playwright/test';

/**
 * 统一登录工具 —— 所有 spec 必须使用此函数登录。
 *
 * 使用 getByPlaceholder 避免 Suspense 时序问题：
 * login/page.tsx 的 LoginForm 被 <Suspense> 包裹，
 * 首次渲染显示"加载中..."，useSearchParams 解析后才渲染表单。
 * getByPlaceholder 会自动等待元素出现。
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

  // 等待登录成功跳转
  await page.waitForURL(/\/admin/, { timeout: 15000 });

  // 验证页面内容已加载（h1 可见）
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 5000 });

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
