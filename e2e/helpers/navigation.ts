import { Page, expect } from '@playwright/test';

/** Navigate to a page and wait for it to stabilize */
export async function navigateTo(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle').catch(() => {
    /* may timeout on some pages */
  });
}

/** Assert we're on a specific page */
export async function expectOnPage(page: Page, pathPattern: string | RegExp) {
  await expect(page).toHaveURL(pathPattern, { timeout: 10_000 });
}
