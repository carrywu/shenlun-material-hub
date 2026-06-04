import { test, expect } from '@playwright/test';

test.describe('Subscriptions Page WeWe RSS integration', () => {
  test('should load the subscriptions page and verify list renders without crashing', async ({ page }) => {
    await page.goto('/subscriptions');

    // Check that the page header exists
    await expect(page.locator('h1', { hasText: '来源管理' })).toBeVisible({ timeout: 10000 });

    // There should be no list key warnings in the console (Playwright captures console messages)
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push(msg.text());
      }
    });

    // Trigger any re-renders or data fetching if needed
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check if React list key warnings occurred
    const keyWarnings = consoleMessages.filter(msg => msg.includes('Each child in a list should have a unique "key" prop'));
    expect(keyWarnings).toHaveLength(0);
  });
});
