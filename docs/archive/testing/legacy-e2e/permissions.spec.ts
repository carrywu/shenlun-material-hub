import path from 'path';
import { test, expect } from '@playwright/test';

test.describe('权限边界 - 未登录', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('不能访问 /cards', async ({ page }) => {
    await page.goto('/cards');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('不能访问 /search', async ({ page }) => {
    await page.goto('/search');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('不能访问 /settings', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('不能访问 /review', async ({ page }) => {
    await page.goto('/review');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('不能访问 /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 });
  });

  test('受保护 API 返回 401', async ({ request }) => {
    const protectedApis = [
      '/api/material-cards',
      '/api/favorites',
      '/api/sync-records',
      '/api/user-content-state',
    ];
    for (const api of protectedApis) {
      const res = await request.get(`http://localhost:3001${api}`);
      expect(res.status()).toBe(401);
    }
  });

  test('管理 API 返回 401', async ({ request }) => {
    const adminApis = [
      '/api/admin/users',
      '/api/admin/logs',
      '/api/admin/tasks',
      '/api/admin/metrics',
    ];
    for (const api of adminApis) {
      const res = await request.get(`http://localhost:3001${api}`);
      expect(res.status()).toBe(401);
    }
  });
});

test.describe('权限边界 - 普通用户', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/usera.json') });

  test('可以访问基础学习页面', async ({ page }) => {
    await page.goto('/articles');
    await expect(page).toHaveURL(/\/articles/);
    await page.goto('/review');
    await expect(page).toHaveURL(/\/review/);
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('不能访问管理员页面', async ({ page }) => {
    await page.goto('/admin');
    // Should redirect away from admin
    await expect(page).not.toHaveURL(/\/admin(?!\s*login)/, { timeout: 10_000 });
  });

  test('不能调用管理员 API', async ({ request }) => {
    const cookies = request.storageState ? {} : {};
    const res = await request.get('http://localhost:3001/api/admin/users');
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('权限边界 - 已认证用户', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/verified.json') });

  test('可以访问全部学习页面', async ({ page }) => {
    for (const path of ['/articles', '/cards', '/search', '/review', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
    }
  });

  test('不能访问管理员页面', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/^http:\/\/localhost:3001\/admin$/, { timeout: 10_000 });
  });
});

test.describe('权限边界 - 管理员', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('可以进入后台', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('可以访问管理 API', async ({ page }) => {
    const apis = ['/api/admin/users', '/api/admin/logs', '/api/admin/tasks'];
    for (const api of apis) {
      const res = await page.request.get(api);
      expect(res.status()).not.toBe(401);
    }
  });
});
