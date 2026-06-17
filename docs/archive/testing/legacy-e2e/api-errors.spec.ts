import path from 'path';
import { test, expect } from '@playwright/test';
import { mockApiFailure, mockApiResponse } from './helpers/api';
import { expectNoInfiniteLoading } from './helpers/assertions';

type HealthResponse = {
  status: string;
};

type ArticlesResponse = {
  data?: unknown;
  total?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

test.describe('API 404 处理', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('访问不存在页面显示 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    await expectNoInfiniteLoading(page);
    // Next.js default 404 page shows "404" and "This page could not be found."
    // Middleware may also redirect to login for unauthenticated users
    const has404 = await page.getByText('404').isVisible().catch(() => false);
    const hasNotFound = await page.getByText(/could not be found|not found|不存在|找不到/i).isVisible().catch(() => false);
    const redirectedToLogin = page.url().includes('/login');
    expect(has404 || hasNotFound || redirectedToLogin).toBeTruthy();
  });
});

test.describe('API 500 处理', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('文章列表 500 不白屏', async ({ page }) => {
    await mockApiFailure(page, /\/api\/articles/, 500);
    await page.goto('/articles');
    await expectNoInfiniteLoading(page, 15_000);
    // Page should not be blank
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe('网络错误处理', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('网络中断时不白屏', async ({ page }) => {
    await page.route(/\/api\/articles/, route => route.abort());
    await page.goto('/articles');
    await expectNoInfiniteLoading(page, 15_000);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('API 返回结构验证', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('health API 返回正确结构', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/health');
    expect(res.ok()).toBeTruthy();
    const data = await res.json() as HealthResponse;
    expect(data.status).toBe('ok');
  });

  test('articles API 返回正确结构', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/articles');
    expect(res.ok()).toBeTruthy();
    const data = await res.json() as ArticlesResponse;
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('page');
    expect(data).toHaveProperty('pageSize');
  });
});
