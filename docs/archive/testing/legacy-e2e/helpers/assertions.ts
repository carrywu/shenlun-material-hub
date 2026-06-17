import { Page, Locator, expect } from '@playwright/test';

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

/** Assert no critical console errors */
export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter benign errors
      if (
        text.includes('Failed to fetch') ||
        text.includes('Load failed') ||
        text.includes('NetworkError') ||
        text.includes('user aborted') ||
        text.includes('NEXT_NOT_FOUND')
      ) return;
      errors.push(text);
    }
  });
  return () => {
    const critical = errors.filter(e =>
      e.includes('TypeError') ||
      e.includes('ReferenceError') ||
      e.includes('Cannot read properties of') ||
      e.includes('Hydration failed') ||
      e.includes('Unhandled Runtime Error')
    );
    expect(critical).toEqual([]);
  };
}

/** Assert no unhandled page errors */
export async function expectNoPageErrors(page: Page) {
  const pageErrors: Error[] = [];
  page.on('pageerror', err => pageErrors.push(err));
  return () => {
    expect(pageErrors.map(e => e.message)).toEqual([]);
  };
}

/** Assert API response is OK (intercept next matching request) */
export async function expectApiResponseOk(
  page: Page,
  urlPattern: string | RegExp
) {
  const response = await page.waitForResponse(
    res => {
      const url = res.url();
      if (typeof urlPattern === 'string') return url.includes(urlPattern);
      return urlPattern.test(url);
    },
    { timeout: 15_000 }
  );
  expect(response.status()).toBeLessThan(400);
  return response;
}

/** Assert toast/notification is visible */
export async function expectToastVisible(page: Page, text?: string | RegExp) {
  const toast = text
    ? page.locator('[data-sonner-toast]').filter({ hasText: text })
    : page.locator('[data-sonner-toast]').first();
  await expect(toast).toBeVisible({ timeout: 5_000 });
}

/** Assert error message is visible */
export async function expectErrorVisible(page: Page, text?: string | RegExp) {
  const errorEl = text
    ? page.locator('[role="alert"], [data-slot="error-boundary"], .text-destructive').filter({ hasText: text })
    : page.locator('[role="alert"]').first();
  await expect(errorEl).toBeVisible({ timeout: 5_000 });
}

/** Assert empty state is visible */
export async function expectEmptyStateVisible(page: Page) {
  await expect(page.locator('[data-slot="empty-state"], [role="status"]').first())
    .toBeVisible({ timeout: 5_000 });
}

/** Assert button prevents double-submit (disabled during loading) */
export async function expectButtonNotDoubleSubmit(page: Page, buttonLocator: Locator) {
  await buttonLocator.click();
  // Button should become disabled immediately
  await expect(buttonLocator).toBeDisabled({ timeout: 2_000 });
  // Wait for it to re-enable (operation completes)
  await expect(buttonLocator).toBeEnabled({ timeout: 15_000 });
}

/** Assert page is stable (no loading, no errors, content visible) */
export async function expectPageStable(page: Page) {
  await expectNoInfiniteLoading(page);
  await expect(page.locator('main')).toBeVisible({ timeout: 5_000 });
}

/** Assert protected route redirects to login */
export async function expectProtectedRouteRedirect(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
}
