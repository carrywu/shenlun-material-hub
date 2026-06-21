import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

const materialCardItems = '[data-testid^="material-card-"]:not([data-testid="material-card-grid"])';
import { ensureCardExists } from './helpers/seed';

// P0-004 (B3): 文件级 admin storageState——素材卡列表与详情均依赖 admin 视角（管理、确认、删除）
test.use({ storageState: '.auth/admin-storage.json' });

test.describe('素材卡列表 /cards', () => {
  test('素材卡列表：页面加载', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/cards');
    // Wait for page to finish loading
    await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 15000 });

    // Either cards are rendered, or the empty state is visible
    // heading 出现时卡片可能还在异步加载，轮询等数据落定
    await expect(async () => {
      const hasCards = await page.locator(materialCardItems).first().isVisible().catch(() => false);
      const hasEmpty = await page.getByTestId('cards-empty-state').isVisible().catch(() => false);
      expect(hasCards || hasEmpty).toBe(true);
    }).toPass({ timeout: 15000, intervals: [1000, 2000, 5000] });

    guard.report(test.info());
  });

  test('素材卡列表：确认状态筛选', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/cards');
    await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 15000 });

    // The three confirmed filter buttons: 全部 / 已确认 / 未确认
    const btnAll = page.getByRole('button', { name: '全部' });
    const btnConfirmed = page.getByRole('button', { name: '已确认' });
    const btnUnconfirmed = page.getByRole('button', { name: '未确认' });

    await expect(btnAll).toBeVisible();
    await expect(btnConfirmed).toBeVisible();
    await expect(btnUnconfirmed).toBeVisible();

    // Click "已确认"
    await btnConfirmed.click();

    // Click "未确认"
    await btnUnconfirmed.click();

    // Click "全部" to restore
    await btnAll.click();

    guard.report(test.info());
  });

  test('素材卡列表：搜索', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/cards');
    await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder('搜索素材卡...');
    await expect(searchInput).toBeVisible();

    // Fill a search term and press Enter
    await searchInput.fill('申论');
    await page.keyboard.press('Enter');

    // Clear search
    await searchInput.clear();
    await page.keyboard.press('Enter');

    guard.report(test.info());
  });

  test('素材卡列表：点击卡片跳转详情', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/cards');
    await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 15000 });

    // Find the first clickable card container（轮询等异步加载，避免 heading 一出现就扑空）
    const firstCard = page.locator(materialCardItems).first();
    try {
      await expect(firstCard).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, 'DB 无素材卡数据，跳过点击跳转');
    }

    await firstCard.click();
    await page.waitForURL(/\/cards\/[^/]+/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/cards\/[^/]+/);

    // Detail page should load
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 10000 });

    guard.report(test.info());
  });

  test('素材卡列表：批量选择', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/cards');
    await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 15000 });

    // Check if there are cards to select（轮询等异步加载）
    const cardCheckboxes = page.locator('[data-testid^="card-select-"] [role="checkbox"], [data-testid^="card-select-"] button');
    try {
      await expect(cardCheckboxes.first()).toBeVisible({ timeout: 15000 });
    } catch {
      test.skip(true, 'DB 无素材卡数据，跳过批量选择');
    }

    // Click the first checkbox
    await cardCheckboxes.first().click();

    // Batch action bar should appear showing selected count
    await expect(page.getByText(/已选/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /批量同步/ })).toBeVisible();

    guard.report(test.info());
  });

  test('素材卡列表：分页', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/cards');
    await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 15000 });

    // Pagination controls only appear when totalPages > 1
    const nextBtn = page.getByRole('button', { name: /下一页/ });
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      // Should still be on /cards
      await expect(page.getByTestId('cards-page-header')).toBeVisible({ timeout: 10000 });
      expect(page.url()).toContain('/cards');
    }
    // If no pagination controls, the test passes trivially (single page)

    guard.report(test.info());
  });
});

test.describe('素材卡详情 /cards/[id]', () => {
  test('素材卡详情：页面加载', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const card = await ensureCardExists();

    await page.goto(`/cards/${card.id}`);
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 15000 });

    // Card content should be visible — no raw JSON keys exposed
    const visibleText = await page.innerText('body');
    expect(visibleText).not.toContain('expression:');
    expect(visibleText).not.toContain('oral:');
    expect(visibleText).not.toContain('examType:');

    guard.report(test.info());
  });

  test('素材卡详情：编辑按钮', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const card = await ensureCardExists();
    await page.goto(`/cards/${card.id}`);
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 15000 });

    // Click the edit button
    const editBtn = page.getByRole('button', { name: /编辑/ });
    await expect(editBtn).toBeVisible({ timeout: 10000 });
    await editBtn.click();

    // MaterialCardEditor form should appear — look for a save/cancel button
    await expect(page.getByRole('button', { name: /取消|保存/ }).first()).toBeVisible({ timeout: 5000 });

    guard.report(test.info());
  });

  test('素材卡详情：确认切换', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const card = await ensureCardExists();
    await page.goto(`/cards/${card.id}`);
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 15000 });

    // Find confirm/unconfirm toggle button
    const confirmBtn = page.getByRole('button', { name: /确认|取消确认/ });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });

    // Get initial state text
    const initialText = await confirmBtn.innerText();

    // Click to toggle
    await confirmBtn.click();

    // State should have changed
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    const newText = await confirmBtn.innerText().catch(() => '');
    // The button label should toggle between "确认" and "取消确认"
    expect(newText).not.toBe(initialText);

    guard.report(test.info());
  });

  test('素材卡详情：删除按钮弹出确认对话框', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const card = await ensureCardExists();
    await page.goto(`/cards/${card.id}`);
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 15000 });
    const deleteBtn = page.getByRole('button', { name: /删除|Delete/i });
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      // Should show confirmation dialog or popover
      await expect(page.getByText(/确认|取消|确定/)).toBeVisible({ timeout: 3000 });
    }

    guard.report(test.info());
  });

  test('素材卡详情：删除按钮', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    const card = await ensureCardExists();
    await page.goto(`/cards/${card.id}`);
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 15000 });

    // The delete button is a ghost button with a trash icon, no visible text label
    // It is inside the header actions area
    const deleteBtn = page.getByTestId('card-delete-button');
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });

    // Click delete — should trigger a confirm dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      // Dismiss the dialog to avoid actually deleting test data
      await dialog.dismiss();
    });
    await deleteBtn.click();

    // After dismissing, we should still be on the detail page
    await expect(page.getByTestId('card-detail-title')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain(`/cards/${card.id}`);

    guard.report(test.info());
  });
});
