import { chromium, type FullConfig } from '@playwright/test';

/**
 * Playwright globalSetup — 在所有测试之前执行一次登录，保存 storageState。
 * 这样所有需要认证的测试都自动携带 auth_token cookie，无需每个测试单独登录。
 *
 * 解决问题：125 个测试中有 99 个调用 loginAsAdmin，并发冲击 dev server 导致 Suspense 超时。
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3001';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 导航到 /admin，middleware 重定向到登录页
  await page.goto(`${baseURL}/admin`);
  await page.waitForURL(/\/admin\/login/, { timeout: 15000 });

  // 等待 Suspense 解析——表单 placeholder 出现
  const accountInput = page.getByPlaceholder('请输入账号');
  await accountInput.waitFor({ state: 'visible', timeout: 15000 });

  await accountInput.fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.locator("form button[type='submit']").click();

  // 等待登录成功
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  // admin dashboard 用 h3 不是 h1，验证页面内容已加载即可
  await page.waitForSelector('main', { timeout: 10000 });

  // 保存 storageState（包含 auth_token cookie）
  await page.context().storageState({ path: '.auth/admin-storage.json' });
  await browser.close();
}

export default globalSetup;
