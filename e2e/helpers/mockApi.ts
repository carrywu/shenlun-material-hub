import { expect, Page } from '@playwright/test';

/**
 * Mock an API endpoint to always return an error response.
 * Returns an object with hit count tracking for assertions.
 */
export async function mockApiError(
  page: Page,
  pattern: string,
  options?: { status?: number; body?: Record<string, unknown> }
) {
  let hit = 0;
  await page.route(pattern, async (route) => {
    hit += 1;
    await route.fulfill({
      status: options?.status ?? 500,
      contentType: 'application/json',
      body: JSON.stringify(options?.body ?? { error: 'mock error' }),
    });
  });
  return {
    get hitCount() { return hit; },
    expectHit() { expect(hit).toBeGreaterThan(0); },
  };
}
