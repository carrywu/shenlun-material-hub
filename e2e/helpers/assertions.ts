import { Page, expect } from '@playwright/test';

const LOADING_INDICATORS = [
  'text=/Loading/i',
  'text=/加载中/',
  'text=/正在加载/',
  'text=/处理中/',
  'text=/生成中/',
  'text=/评估中/',
  '[role="progressbar"]',
  '[aria-busy="true"]',
  '[data-loading="true"]',
  '[data-slot="loading-skeleton"]',
  '[data-slot="loading-indicator"]',
  '.animate-spin',
];

/** Assert no infinite loading (all loading indicators should disappear within timeout) */
export async function expectNoInfiniteLoading(page: Page, timeoutMs = 10_000) {
  for (const selector of LOADING_INDICATORS) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await expect(locator).not.toBeVisible({ timeout: timeoutMs });
    }
  }
}

/** Assert page is stable (no loading, no errors, content visible) */
export async function expectPageStable(page: Page) {
  await expectNoInfiniteLoading(page);
  await expect(page.locator('main')).toBeVisible({ timeout: 5_000 });
}
