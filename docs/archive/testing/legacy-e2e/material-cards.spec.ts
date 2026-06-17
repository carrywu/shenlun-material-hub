import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading, expectEmptyStateVisible } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';
import { getFirstCardId } from './helpers/test-data';

test.describe('素材卡列表页 /cards', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/verified.json') });

  test('页面加载成功', async ({ page }) => {
    await navigateTo(page, '/cards');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Tab 切换功能', async ({ page }) => {
    await navigateTo(page, '/cards');
    await expectNoInfiniteLoading(page);
    
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      for (let i = 0; i < Math.min(tabCount, 2); i++) {
        await tabs.nth(i).click();
        await expectNoInfiniteLoading(page);
      }
    }
  });

  test('点击卡片进入详情', async ({ page }) => {
    await navigateTo(page, '/cards');
    await expectNoInfiniteLoading(page);
    
    const firstCard = page.locator('a[href*="/cards/"]').first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      await expect(page).toHaveURL(/\/cards\/\w+/);
      await expectNoInfiniteLoading(page);
    }
  });
});

test.describe('素材卡详情', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/verified.json') });

  test('详情页加载正常', async ({ page, request }) => {
    const cardId = await getFirstCardId(request);
    test.skip(!cardId, '没有素材卡');

    await page.goto(`/cards/${cardId}`);
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('普通用户不能访问素材卡', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未登录访问 /cards 重定向', async ({ page }) => {
    await page.goto('/cards');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
