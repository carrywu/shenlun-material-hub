import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';

test.describe('IMA 健康检查', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('IMA 配置页应显示健康检查正常状态', async ({ page }) => {
    await page.route('**/api/ima/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          reachable: true,
          authValid: true,
          workspace: 'e2e-kb',
          lastCheckedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/settings/ima');
    await expectNoInfiniteLoading(page);
    await expect(page.getByText('IMA 状态')).toBeVisible();
    await page.getByRole('button', { name: /检查连接/ }).click();

    await expect(page.getByText('正常')).toBeVisible();
    await expect(page.getByText(/e2e-kb/)).toBeVisible();
  });

  test('IMA 鉴权失败时配置页应显示明确错误', async ({ page }) => {
    await page.route('**/api/ima/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          configured: true,
          reachable: true,
          authValid: false,
          workspace: 'e2e-kb',
          lastCheckedAt: new Date().toISOString(),
          errorCode: 'IMA_AUTH_FAILED',
          errorMessage: '测试环境模拟结果：IMA 鉴权失败',
        }),
      });
    });

    await page.goto('/settings/ima');
    await expectNoInfiniteLoading(page);
    await page.getByRole('button', { name: /检查连接/ }).click();

    await expect(page.getByText('鉴权失败', { exact: true })).toBeVisible();
    await expect(page.getByText(/IMA 鉴权失败/)).toBeVisible();
  });
});
