import path from 'path';
import { test, expect } from '@playwright/test';
import { expectNoInfiniteLoading } from './helpers/assertions';
import { navigateTo } from './helpers/navigation';

test.describe('未登录导航', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('未登录访问受保护页面跳转登录', async ({ page }) => {
    for (const path of ['/cards', '/search', '/review', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    }
  });

  test('未登录访问管理后台跳转后台登录', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 5_000 });
  });

  test('公开页面可访问', async ({ page }) => {
    await page.goto('/register');
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });
});

test.describe('管理员导航', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/admin.json') });

  test('导航栏显示所有链接', async ({ page }) => {
    await navigateTo(page, '/');
    const nav = page.locator('header').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
    
    for (const name of ['首页', '文章', '素材卡', '检索', '复习', '设置']) {
      await expect(nav.getByRole('link', { name })).toBeVisible({ timeout: 5_000 });
    }
  });

  test('点击导航链接正常跳转', async ({ page }) => {
    await navigateTo(page, '/');
    const nav = page.locator('header').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
    
    await nav.getByRole('link', { name: '文章' }).click();
    await expect(page).toHaveURL(/\/articles/);
    await expectNoInfiniteLoading(page);

    await nav.getByRole('link', { name: '素材卡' }).click();
    await expect(page).toHaveURL(/\/cards/);
    await expectNoInfiniteLoading(page);

    await nav.getByRole('link', { name: '检索' }).click();
    await expect(page).toHaveURL(/\/search/);
    
    await nav.getByRole('link', { name: '复习' }).click();
    await expect(page).toHaveURL(/\/review/);
    
    await nav.getByRole('link', { name: '设置' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('首页加载正常', async ({ page }) => {
    await navigateTo(page, '/');
    await expectNoInfiniteLoading(page);
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('普通用户导航', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/usera.json') });

  test('普通用户可以访问基础页面', async ({ page }) => {
    for (const path of ['/articles', '/review', '/settings']) {
      await navigateTo(page, path);
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
      await expectNoInfiniteLoading(page);
    }
  });

  test('普通用户不能访问管理员页面', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login|\/$|\/articles/, { timeout: 10_000 });
  });
});

test.describe('已认证用户导航', () => {
  test.use({ storageState: path.resolve(__dirname, '.auth/verified.json') });

  test('认证用户可以访问全部学习页面', async ({ page }) => {
    for (const path of ['/articles', '/cards', '/search', '/review', '/settings']) {
      await navigateTo(page, path);
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
      await expectNoInfiniteLoading(page);
    }
  });
});
