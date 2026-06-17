import { Page, Response } from '@playwright/test';

interface ApiLog {
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: number;
}

interface ApiError extends ApiLog {
  body?: string;
}

/** Attach API request monitoring to a page */
export function attachApiMonitor(page: Page) {
  const logs: ApiLog[] = [];
  const errors: ApiError[] = [];
  const pending = new Map<string, number>();

  page.on('request', req => {
    if (req.url().includes('/api/')) {
      pending.set(req.url(), Date.now());
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (!url.includes('/api/')) return;

    const start = pending.get(url) || Date.now();
    pending.delete(url);

    const log: ApiLog = {
      url,
      method: res.request().method(),
      status: res.status(),
      duration: Date.now() - start,
      timestamp: Date.now(),
    };
    logs.push(log);

    if (res.status() >= 400) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      errors.push({ ...log, body });
    }
  });

  return {
    getLogs: () => [...logs],
    getErrors: () => [...errors],
    getPending: () => [...pending.keys()],
    clear: () => { logs.length = 0; errors.length = 0; },
    /** Assert no 500 errors occurred */
    assertNo500: () => {
      const server500 = errors.filter(e => e.status >= 500);
      if (server500.length > 0) {
        throw new Error(`Found ${server500.length} server errors:\n${server500.map(e => `${e.method} ${e.url} → ${e.status}`).join('\n')}`);
      }
    },
    /** Assert no requests are pending longer than threshold */
    assertNoStuckRequests: (thresholdMs = 15_000) => {
      const now = Date.now();
      const stuck = [...pending.entries()]
        .filter(([, start]) => now - start > thresholdMs)
        .map(([url]) => url);
      if (stuck.length > 0) {
        throw new Error(`Stuck requests (>${thresholdMs}ms):\n${stuck.join('\n')}`);
      }
    },
  };
}

/** Wait for a specific API response and return its JSON body */
export async function waitForApiJson<T = unknown>(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number; expectedStatus?: number }
): Promise<T> {
  const response = await page.waitForResponse(
    res => {
      const url = res.url();
      const match = typeof urlPattern === 'string'
        ? url.includes(urlPattern)
        : urlPattern.test(url);
      return match;
    },
    { timeout: options?.timeout ?? 15_000 }
  );

  if (options?.expectedStatus) {
    if (response.status() !== options.expectedStatus) {
      throw new Error(`Expected status ${options.expectedStatus}, got ${response.status()} for ${response.url()}`);
    }
  }

  return response.json() as Promise<T>;
}

/** Intercept and mock an API response */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  responseBody: unknown,
  options?: { status?: number; delay?: number }
) {
  await page.route(
    urlPattern,
    async route => {
      if (options?.delay) {
        await new Promise(r => setTimeout(r, options.delay));
      }
      await route.fulfill({
        status: options?.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(responseBody),
      });
    }
  );
}

/** Intercept and simulate API failure */
export async function mockApiFailure(
  page: Page,
  urlPattern: string | RegExp,
  status = 500,
  body?: unknown
) {
  await page.route(urlPattern, async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body ?? { error: 'Internal Server Error' }),
    });
  });
}
