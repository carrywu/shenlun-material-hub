import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login page
  await page.goto('http://localhost:3001/admin/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-login.png', fullPage: true });

  // Login and go to dashboard
  await page.getByLabel('管理账号').fill('admin');
  await page.getByLabel('管理密码').fill('admin123');
  await page.getByRole('button', { name: '进入管理后台' }).click();
  await page.waitForURL(/\/admin$/);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: true });

  // Articles page
  await page.goto('http://localhost:3001/admin/articles');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/03-articles.png', fullPage: true });

  // Sources page
  await page.goto('http://localhost:3001/admin/sources');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/04-sources.png', fullPage: true });

  // Tasks page
  await page.goto('http://localhost:3001/admin/tasks');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/05-tasks.png', fullPage: true });

  // AI config page
  await page.goto('http://localhost:3001/admin/settings/ai');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/06-ai-config.png', fullPage: true });

  await browser.close();
  console.log('Screenshots saved!');
})();
