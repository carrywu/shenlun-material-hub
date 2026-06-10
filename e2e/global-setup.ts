import { chromium, type FullConfig } from '@playwright/test';

/**
 * Playwright globalSetup — 在所有测试之前执行一次登录，保存 storageState。
 * 这样所有需要认证的测试都自动携带 auth_token cookie，无需每个测试单独登录。
 *
 * 解决问题：125 个测试中有 99 个调用 loginAsAdmin，并发冲击 dev server 导致 Suspense 超时。
 *
 * 注意：不能使用 waitForURL(/\/admin/) 因为该 regex 同时匹配 /admin/login，
 * 导致在 cookie 设置之前就匹配成功，保存了空的 storageState。
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3001';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // 导航到 /admin，middleware 重定向到登录页
  await page.goto(`${baseURL}/admin`);
  await page.waitForURL(/\/admin\/login/, { timeout: 15000 });

  // 等待 Suspense 解析——表单 placeholder 出现
  const accountInput = page.getByPlaceholder('请输入账号');
  await accountInput.waitFor({ state: 'visible', timeout: 15000 });

  await accountInput.fill(adminUsername);
  await page.getByPlaceholder('请输入密码').fill(adminPassword);
  await page.locator("form button[type='submit']").click();

  // 等待登录成功——必须等待导航离开 /admin/login 页面
  // 使用 URL predicate 而非 regex，避免 regex 同时匹配 login 页面
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/admin/login'),
    { timeout: 15000 },
  );

  // 等待页面主体内容加载
  await page.waitForSelector('main', { timeout: 10000 });

  // 验证 auth_token cookie 已设置
  const cookies = await page.context().cookies();
  const authToken = cookies.find((c) => c.name === 'auth_token');
  if (!authToken) {
    throw new Error(
      'globalSetup: 登录成功但 auth_token cookie 不存在，storageState 将为空',
    );
  }

  // 保存 storageState（包含 auth_token cookie）
  await page.context().storageState({ path: '.auth/admin-storage.json' });
  await browser.close();
}

export default globalSetup;
