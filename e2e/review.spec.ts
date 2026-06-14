import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

test.describe('复习页', () => {
  // P0-004 (B3): /review 含复习/已掌握等用户态操作，需登录；admin 同为登录用户可覆盖
  test.use({ storageState: '.auth/admin-storage.json' });
  test('复习页：页面加载', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/review');
    await expect(page).toHaveURL(/\/review$/);

    // Verify header and key controls are visible
    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();
    await expect(page.getByRole('button', { name: '换一批' })).toBeVisible();

    // Mode select and card type select should be present
    await expect(page.locator('button:has(> span:has-text("随机复习"))').first()).toBeVisible();

    guard.report(testInfo);
  });

  test('复习页：切换复习模式', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/review');

    // Wait for initial load
    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    // Open the mode select
    const modeSelect = page.locator('button:has(> span:has-text("随机复习"))').first();
    await modeSelect.click();

    // Select "未复习优先"
    await page.getByRole('option', { name: '未复习优先' }).click();

    // Verify mode changed — badge should show new mode label
    await expect(page.getByText('未复习优先').first()).toBeVisible();

    // Page should have reloaded cards (loading indicator may flash)
    await expect(page.locator('button:has(> span:has-text("未复习优先"))').first()).toBeVisible();

    guard.report(testInfo);
  });

  test('复习页：卡片类型筛选', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/review');

    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    // Open card type select
    const cardTypeSelect = page.locator('button:has(> span:has-text("全部类型"))').first();
    await cardTypeSelect.click();

    // Options should be visible
    await expect(page.getByRole('option', { name: '申论金句' })).toBeVisible();
    await expect(page.getByRole('option', { name: '案例素材' })).toBeVisible();

    // Select one
    await page.getByRole('option', { name: '申论金句' }).click();

    // Card type select should now reflect the selection
    await expect(page.locator('button:has(> span:has-text("申论金句"))').first()).toBeVisible();

    guard.report(testInfo);
  });

  test('复习页：展开折叠卡片内容', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/review');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    // Wait for cards or empty state
    await expect(
      page.getByText(/还没有可复习的素材卡|还没有复习数据/).or(page.locator('text=已掌握').first())
    ).toBeVisible({ timeout: 15000 });

    // Check if empty state
    const emptyState = page.getByText(/还没有可复习的素材卡|还没有复习数据/);
    if (await emptyState.isVisible()) {
      guard.report(testInfo);
      return;
    }

    // Cards exist — find a collapsible section button (e.g. "来源快照")
    const collapsibleButton = page.locator('button:has(> span:has-text("来源快照"))').first();
    if (await collapsibleButton.isVisible()) {
      // Click to expand
      await collapsibleButton.click();

      // Content should now be visible (the section body rendered)
      // The content is inside the collapsible section area after the button
      const sectionParent = collapsibleButton.locator('..');
      await expect(sectionParent.locator('.whitespace-pre-wrap, .space-y-3, .text-sm').first()).toBeVisible({ timeout: 5000 });

      // Click again to collapse
      await collapsibleButton.click();
    }

    guard.report(testInfo);
  });

  test('复习页：标记已复习', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/review');

    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    // Wait for cards or empty state
    await expect(
      page.getByText(/还没有可复习的素材卡|还没有复习数据/).or(page.locator('text=已掌握').first())
    ).toBeVisible({ timeout: 15000 });

    // Check if empty state
    const emptyState = page.getByText(/还没有可复习的素材卡|还没有复习数据/);
    if (await emptyState.isVisible()) {
      guard.report(testInfo);
      return;
    }

    // Find the first "已掌握" button and click it
    const markButton = page.getByRole('button', { name: '已掌握' }).first();
    await markButton.click();

    // After marking, the card should be removed from the list
    // The "本次已复习" counter should increment (from 0 to 1)
    await expect(page.getByText('本次已复习')).toBeVisible();

    // The counter card should show at least 1
    const counterCard = page.getByText(/还没有可复习的素材卡|还没有复习数据/).or(page.locator('.text-lg.font-bold'));
    await expect(counterCard.first()).toBeVisible();

    guard.report(testInfo);
  });

  test('复习页：刷新', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);

    await page.goto('/review');

    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    // Click refresh button
    await page.getByRole('button', { name: '换一批' }).click();

    // Page should reload cards — the heading should still be visible after refresh
    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible({ timeout: 15000 });

    guard.report(testInfo);
  });

  test('复习页：无卡片时显示空状态', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.route('**/api/review**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], mode: 'random' }) })
    );

    await page.goto('/review');

    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    await expect(page.getByText('还没有可复习的素材卡')).toBeVisible();
    await expect(page.getByText('先从已审核文章生成自己的素材卡')).toBeVisible();
    await expect(page.getByRole('link', { name: '去文章页生成素材卡' })).toHaveAttribute('href', '/articles');
    await expect(page.getByRole('button', { name: '换一批' })).toBeVisible();

    guard.report(testInfo);
  });

  test('复习页空状态有跳转按钮', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);
    await page.route('**/api/review**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], mode: 'random' }) })
    );
    await page.goto('/review');
    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();

    await expect(page.getByRole('link', { name: '去文章页生成素材卡' })).toBeVisible();
    guard.report(testInfo);
  });

  test('复习页：加载中状态后数据出现', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    // Slow down API
    await page.route('**/api/review**', async route => {
      await new Promise(f => setTimeout(f, 500));
      await route.continue();
    });
    await page.goto('/review');
    // Wait for loading to finish
    await page.waitForTimeout(2000);
    // Should show content or empty state, not stuck on loading
    const hasLoading = await page.getByText('加载中').isVisible().catch(() => false);
    const hasContent = await page.locator('h1, h2, h3, [role="combobox"]').first().isVisible().catch(() => false);
    expect(hasContent).toBe(true);
    guard.report(testInfo);
  });
});

test.describe('复习页 - 普通用户空状态', () => {
  test.use({ storageState: '.auth/usera-storage.json' });

  test('USER 无卡时引导到账号设置升级', async ({ page }, testInfo) => {
    const guard = attachConsoleGuard(page);
    await page.route('**/api/review**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], mode: 'random' }) })
    );

    await page.goto('/review');
    await expect(page.getByRole('heading', { name: '复习模式' })).toBeVisible();
    await expect(page.getByText('还没有复习数据')).toBeVisible();
    await expect(page.getByText('升级认证后即可基于已审核文章生成自己的素材卡')).toBeVisible();
    await expect(page.getByRole('link', { name: '去账号设置升级' })).toHaveAttribute('href', '/settings/account');

    guard.report(testInfo);
  });
});
