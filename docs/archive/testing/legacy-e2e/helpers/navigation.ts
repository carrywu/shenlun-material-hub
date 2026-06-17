import { Page, expect } from '@playwright/test';

/** Navigate to a page and wait for it to stabilize */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  // Wait for network to settle
  await page.waitForLoadState('networkidle').catch(() => {/* may timeout on some pages */});
}

/** Check if a nav link exists and is clickable */
export async function expectNavLink(page: Page, name: string) {
  const nav = page.locator('header').first();
  await expect(nav.getByRole('link', { name })).toBeVisible({ timeout: 5_000 });
}

/** Navigate via sidebar link in admin */
export async function navigateAdminSidebar(page: Page, name: string) {
  await page.getByRole('link', { name }).click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Assert we're on a specific page */
export async function expectOnPage(page: Page, pathPattern: string | RegExp) {
  await expect(page).toHaveURL(pathPattern, { timeout: 10_000 });
}

/** Scroll to bottom and back to trigger lazy loading */
export async function scrollPage(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
}
