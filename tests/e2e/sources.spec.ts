import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';

test.describe('采集源管理', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('采集源页面加载', async ({ page }) => {
    await navigateTo(page, '/admin/sources');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
