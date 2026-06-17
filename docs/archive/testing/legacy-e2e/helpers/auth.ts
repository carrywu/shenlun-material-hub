import { Page, APIRequestContext, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

export const TEST_ACCOUNTS = {
  admin: { username: 'admin', password: 'admin123' },
  verified: { username: 'e2e_verified', password: 'verified123' },
  userA: { username: 'e2e_usera', password: 'usera123' },
  userB: { username: 'e2e_userb', password: 'userb123' },
} as const;

/** Login via browser form on /login page */
export async function loginViaForm(page: Page, username: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  // If already logged in, middleware redirects away from /login
  if (!page.url().includes('/login')) return;
  await page.getByPlaceholder('请输入账号').fill(username);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  // Wait for redirect away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Login via browser form on /admin/login page */
export async function loginAdminViaForm(page: Page, username = 'admin', password = 'admin123') {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  // If already logged in, middleware redirects to /admin — skip form fill
  if (!page.url().includes('/admin/login')) return;
  await page.getByPlaceholder('请输入账号').fill(username);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.getByRole('button', { name: '登录管理后台' }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 15_000 });
}

/** API login - returns auth_token cookie value */
export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string,
  context: 'user' | 'admin' = 'user'
): Promise<string | null> {
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { username, password, context },
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) return null;
  const cookies = res.headersArray()
    .filter(h => h.name.toLowerCase() === 'set-cookie')
    .map(h => h.value);
  const authCookie = cookies.find(c => c.startsWith('auth_token='));
  return authCookie?.split(';')[0].replace('auth_token=', '') ?? null;
}

/** Logout via API */
export async function apiLogout(request: APIRequestContext) {
  await request.post(`${BASE_URL}/api/auth/logout`);
}

/** Check if current page has auth (look for nav elements) */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const nav = page.getByRole('banner');
  return nav.isVisible().catch(() => false);
}

/** Wait for login state to stabilize */
export async function waitForAuth(page: Page) {
  // Wait for the auth check API call to complete
  await page.waitForResponse(
    res => res.url().includes('/api/auth/check'),
    { timeout: 10_000 }
  ).catch(() => {/* auth check may not fire on all pages */});
}
