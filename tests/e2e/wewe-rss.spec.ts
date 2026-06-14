import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';
import { isWeWeRssAvailable } from './helpers/test-data';

test.describe('WeWe RSS 集成', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('WeWe RSS 管理页加载', async ({ page }) => {
    await navigateTo(page, '/admin/integrations/wewe-rss');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('WeWe RSS 不可用时不拖死页面', async ({ page }) => {
    const available = await isWeWeRssAvailable();
    test.skip(available, 'WeWe RSS 可用，跳过不可用测试');
    
    await navigateTo(page, '/admin/integrations/wewe-rss');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
