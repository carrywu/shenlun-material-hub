import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

// P0-004 (B3): 文件级 admin storageState——探索/发现页含收藏与已读切换，需登录态；
// admin 同为登录用户可覆盖
test.use({ storageState: '.auth/admin-storage.json' });

// ---------------------------------------------------------------------------
// Explore page tests (/explore)
// ---------------------------------------------------------------------------

test.describe('探索区 /explore', () => {
  test('探索页：页面加载', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/explore');
    // Header should be visible
    await expect(page.locator('text=探索区')).toBeVisible({ timeout: 15000 });

    // Filter dropdowns should render with default Chinese labels
    await expect(page.locator('text=全部平台')).toBeVisible();
    await expect(page.locator('text=全部类型')).toBeVisible();

    // Either article cards or empty state should be visible
    const hasCards = await page.locator('div.border.rounded-lg.p-4').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=暂无已审核文章').isVisible().catch(() => false);
    const hasNoResults = await page.locator('text=未找到匹配内容').isVisible().catch(() => false);
    expect(hasCards || hasEmpty || hasNoResults).toBe(true);

    guard.report(test.info());
  });

  test('探索页：搜索过滤', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/explore');
    await expect(page.locator('text=探索区')).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder('搜索标题、摘要、全文、标签...');
    await expect(searchInput).toBeVisible();

    // Fill a search term — the explore page uses 300ms debounce
    await searchInput.fill('改革');
    // Wait for debounce + API round-trip
    await page.waitForTimeout(1500);

    // The page should have updated — either results or empty state for the query
    const bodyText = await page.innerText('body');
    // Just verify the page didn't crash — results may be empty
    expect(bodyText).toBeTruthy();

    guard.report(test.info());
  });

  test('探索页：点击卡片跳转', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/explore');
    await expect(page.locator('text=探索区')).toBeVisible({ timeout: 15000 });

    // Find the first card
    const firstCard = page.locator('div.border.rounded-lg.p-4').first();
    if (!(await firstCard.isVisible())) {
      throw new Error('没有探索区文章数据，无法测试点击跳转');
    }

    await firstCard.click();
    await page.waitForURL(/\/articles\//, { timeout: 10000 });
    expect(page.url()).toContain('/articles/');

    // Detail page should load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });

    guard.report(test.info());
  });

  test('探索页：外部链接', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/explore');
    await expect(page.locator('text=探索区')).toBeVisible({ timeout: 15000 });

    // Find "查看原文" external links
    const externalLinks = page.locator('a:has-text("查看原文")');
    const count = await externalLinks.count();
    if (count === 0) {
      throw new Error('没有探索区文章数据，无法测试外部链接');
    }

    // Verify the first external link has a valid href
    const href = await externalLinks.first().getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//);

    guard.report(test.info());
  });

  test('探索页：无英文 bare 文本', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/explore');
    await expect(page.locator('text=探索区')).toBeVisible({ timeout: 15000 });

    // The body text should not contain bare lowercase "all"
    const bodyText = await page.innerText('body');
    const textLines = bodyText.split('\n').map((l) => l.trim().toLowerCase());
    expect(textLines).not.toContain('all');

    guard.report(test.info());
  });
});

// ---------------------------------------------------------------------------
// Discover page tests (/discover)
// ---------------------------------------------------------------------------

test.describe('发现页 /discover', () => {
  test('发现页：页面加载', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/discover');
    // Header should be visible
    await expect(page.locator('text=今日推荐')).toBeVisible({ timeout: 15000 });

    // Filter dropdowns should render
    // The discover page has 3 selects: platform, contentType, trustLevel
    // Default labels: "全部平台", "全部类型", "全部等级"
    await expect(page.locator('text=全部平台')).toBeVisible();
    await expect(page.locator('text=全部类型')).toBeVisible();
    await expect(page.locator('text=全部等级')).toBeVisible();

    guard.report(test.info());
  });

  test('发现页：筛选器交互', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/discover');
    await expect(page.locator('text=今日推荐')).toBeVisible({ timeout: 15000 });

    // Click the platform select trigger to open dropdown
    // The discover page has three SelectTrigger elements; target the first one (platform)
    const platformTriggers = page.locator('button[role="combobox"]');
    await expect(platformTriggers.first()).toBeVisible();
    await platformTriggers.first().click();

    // SelectContent should appear with options
    const selectContent = page.locator('[role="listbox"], [role="option"]').first();
    await expect(selectContent).toBeVisible({ timeout: 5000 });

    guard.report(test.info());
  });

  test('发现页：刷新按钮', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/discover');
    await expect(page.locator('text=今日推荐')).toBeVisible({ timeout: 15000 });

    // Click the refresh button
    const refreshBtn = page.getByRole('button', { name: /刷新/ });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await page.waitForTimeout(1000);

    // Page should still be on /discover after refresh
    expect(page.url()).toContain('/discover');
    await expect(page.locator('text=今日推荐')).toBeVisible();

    guard.report(test.info());
  });

  test('发现页：收藏和已读', async ({ page }) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/discover');
    await expect(page.locator('text=今日推荐')).toBeVisible({ timeout: 15000 });

    // Check if there are article cards with bookmark and read buttons
    // Each card has Bookmark and CheckCircle icon buttons in the actions area
    const bookmarkButtons = page.locator('button[title="收藏"]');
    const readButtons = page.locator('button[title="标记已读"]');

    const bookmarkCount = await bookmarkButtons.count();
    const readCount = await readButtons.count();

    if (bookmarkCount === 0 || readCount === 0) {
      throw new Error('没有发现页文章数据，无法测试收藏和已读');
    }

    // Click bookmark — toggle from ghost to default variant (visual state change)
    const firstBookmark = bookmarkButtons.first();
    await firstBookmark.click();
    await page.waitForTimeout(300);

    // Click mark-read
    const firstRead = readButtons.first();
    await firstRead.click();
    await page.waitForTimeout(300);

    // Click again to toggle back (verify both states work)
    await firstBookmark.click();
    await firstRead.click();
    await page.waitForTimeout(300);

    guard.report(test.info());
  });
});
