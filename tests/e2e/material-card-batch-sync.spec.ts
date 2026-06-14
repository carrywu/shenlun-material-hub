import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';

test.describe('素材卡批量同步到 IMA', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('未选择素材卡时点击批量同步应提示先选择', async ({ page }) => {
    await page.goto('/cards');
    await expectNoInfiniteLoading(page);

    await page.getByRole('button', { name: '批量同步' }).click();

    await expect(page.getByText(/请先选择要同步的素材卡/)).toBeVisible();
  });

  test('选择素材卡后批量同步部分失败应显示失败数量和原因', async ({ page }) => {
    await page.route('**/api/sync', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 2,
          success: 1,
          failed: 1,
          skipped: 0,
          items: [
            { materialCardId: 'card-1', status: 'success', imaDocumentId: 'doc-1' },
            { materialCardId: 'card-2', status: 'failed', errorMessage: '测试环境模拟结果：IMA 鉴权失败' },
          ],
        }),
      });
    });

    await page.goto('/cards');
    await expectNoInfiniteLoading(page);
    const checkboxes = page.getByRole('checkbox');
    const count = await checkboxes.count();
    test.skip(count < 2, '没有可勾选素材卡');

    await checkboxes.nth(0).check();
    if (count > 1) await checkboxes.nth(1).check();
    await page.getByRole('button', { name: /批量同步到 IMA/ }).click();

    await expect(page.getByText('成功 1')).toBeVisible();
    await expect(page.getByText('失败 1')).toBeVisible();
    await expect(page.getByText(/失败原因：.*IMA 鉴权失败/)).toBeVisible();
  });

  test('批量同步过程中重复点击不会重复提交', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/api/sync', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          success: 1,
          failed: 0,
          skipped: 0,
          items: [{ materialCardId: 'card-1', status: 'success', imaDocumentId: 'doc-1' }],
        }),
      });
    });

    await page.goto('/cards');
    await expectNoInfiniteLoading(page);
    const checkboxes = page.getByRole('checkbox');
    test.skip(await checkboxes.count() === 0, '没有可勾选素材卡');

    await checkboxes.first().check();
    const button = page.getByRole('button', { name: /批量同步到 IMA/ });
    await button.click();
    await button.click({ force: true }).catch(() => null);

    await expect(page.getByText('成功 1')).toBeVisible();
    expect(requestCount).toBe(1);
  });
});
