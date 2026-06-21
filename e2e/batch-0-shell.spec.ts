import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';

const evidenceDir = resolve(
  process.cwd(),
  'tasks/2026-06-21-batch-0-shell-implementation/evidence/implementation',
);

const storage = {
  user: '.auth/usera-storage.json',
  verified: '.auth/verified-storage.json',
  admin: '.auth/admin-storage.json',
};

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

async function expectNoApplicationShell(page: Page) {
  await expect(page.getByRole('navigation', { name: '主导航', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '移动端主导航', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('admin-sidebar')).toHaveCount(0);
}

async function openAccountMenu(page: Page) {
  const trigger = page.getByRole('button', { name: /账户菜单/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await expect(page.getByRole('menu')).toBeVisible();
  return trigger;
}

test.describe('Batch 0 authentication shell', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of ['/login', '/register', '/admin/login']) {
    test(`${route} renders one navigation-free authentication shell`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByTestId('auth-shell')).toBeVisible();
      await expectNoApplicationShell(page);
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('form input').first()).toBeEditable();
      await expect(page.locator('form button[type="submit"]')).toBeEnabled();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('Batch 0 USER navigation', () => {
  test.use({ storageState: storage.user });

  test('shows only USER learning and account capabilities', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/articles');
    const navigation = page.getByRole('navigation', { name: '主导航', exact: true });

    for (const name of ['首页', '文章', '复习', '设置']) {
      await expect(navigation.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(navigation.getByRole('link', { name: '素材卡' })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: '检索' })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: '文章' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await openAccountMenu(page);
    await expect(page.getByRole('menuitem', { name: '账号设置' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'AI 设置' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'IMA 设置' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /管理后台/ })).toHaveCount(0);
  });
});

test.describe('Batch 0 VERIFIED_USER navigation', () => {
  test.use({ storageState: storage.verified });

  test('shows verified learning and personal integration capabilities', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const navigation = page.getByRole('navigation', { name: '主导航', exact: true });
    await expect(navigation.getByRole('link', { name: '素材卡' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: '检索' })).toBeVisible();

    const trigger = await openAccountMenu(page);
    await expect(page.getByRole('menuitem', { name: 'AI 设置' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'IMA 设置' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /管理后台/ })).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(trigger).toBeFocused();

    await openAccountMenu(page);
    await page.mouse.click(20, 240);
    await expect(page.getByRole('menu')).toBeHidden();
  });
});

test.describe('Batch 0 ADMIN shells', () => {
  test.use({ storageState: storage.admin });

  test('keeps the admin entry inside the frontend account menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await openAccountMenu(page);
    await expect(page.getByRole('menuitem', { name: /管理后台/ })).toHaveAttribute(
      'href',
      '/admin',
    );
  });

  test('admin routes render only the grouped admin shell', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin');
    await expect(page.getByTestId('admin-shell-heading')).toHaveText('系统概览');
    await expect(page.getByRole('navigation', { name: '主导航', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '移动端主导航', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '后台主导航' })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('.admin-shell-theme')
          .evaluate((element) => getComputedStyle(element).getPropertyValue('--primary').trim()),
      )
      .toBe('#244936');
    const sidebar = page.getByTestId('admin-sidebar');
    for (const group of ['概览', '内容运营', '自动化与 AI', '用户与权限', '系统维护']) {
      await expect(sidebar.getByRole('heading', { name: group, exact: true })).toBeVisible();
    }
    await expect(page.getByText(/系统状态|正常运行|当前时间|在线/)).toHaveCount(0);
  });

  test('mobile drawer closes through Escape, overlay, close button, and route change', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    const trigger = page.getByTestId('admin-mobile-menu-trigger');

    await trigger.click();
    const drawer = page.getByTestId('admin-mobile-drawer');
    await expect(drawer).toBeVisible();
    await expect
      .poll(() =>
        drawer.evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--primary').trim(),
        ),
      )
      .toBe('#244936');
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
      .toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('admin-mobile-drawer')).toBeHidden();

    await trigger.click();
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 385, y: 400 } });
    await expect(page.getByTestId('admin-mobile-drawer')).toBeHidden();

    await trigger.click();
    await page.getByRole('button', { name: '关闭后台导航' }).click();
    await expect(page.getByTestId('admin-mobile-drawer')).toBeHidden();

    await trigger.click();
    await page
      .getByTestId('admin-mobile-drawer')
      .getByRole('link', { name: '异步任务' })
      .click();
    await expect(page).toHaveURL(/\/admin\/tasks$/);
    await expect(page.getByTestId('admin-mobile-drawer')).toBeHidden();
  });
});

test.describe('Batch 0 responsive and accessibility gates', () => {
  test.use({ storageState: storage.admin });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`${viewport.width}x${viewport.height} has no page-level horizontal overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expectNoHorizontalOverflow(page);
      if (viewport.width < 768) {
        const bottomTab = page.getByRole('navigation', { name: '移动端主导航', exact: true });
        await expect(bottomTab).toBeVisible();
        await expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeHidden();
        await expect
          .poll(async () => {
            const tabHeight = await bottomTab.evaluate((element) => element.getBoundingClientRect().height);
            const mainPadding = await page
              .getByTestId('frontend-shell-main')
              .evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
            return mainPadding >= tabHeight;
          })
          .toBe(true);
      } else {
        await expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible();
        await expect(page.getByRole('navigation', { name: '移动端主导航', exact: true })).toBeHidden();
      }

      await page.goto('/admin');
      await expect(page.getByTestId('admin-shell-heading')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (viewport.width < 1024) {
        await expect(page.getByTestId('admin-sidebar')).toBeHidden();
        await expect(page.getByTestId('admin-mobile-menu-trigger')).toBeVisible();
      } else {
        await expect(page.getByTestId('admin-sidebar')).toBeVisible();
      }
    });
  }

  test('frontend and admin shells have no serious or critical axe findings', async ({ page }) => {
    for (const route of ['/', '/admin']) {
      await page.goto(route);
      if (route === '/admin') {
        await expect(page.getByTestId('admin-shell-heading')).toBeVisible();
      } else {
        await expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible();
      }
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blocking = results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact ?? ''),
      );
      expect(blocking, `${route}: ${JSON.stringify(blocking, null, 2)}`).toEqual([]);
    }
  });

  test('frontend and admin scoped tokens respond to dark mode', async ({ page }) => {
    await page.goto('/');
    const frontendLightBackground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    );
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const frontendDarkBackground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    );
    expect(frontendDarkBackground).not.toBe(frontendLightBackground);

    await page.goto('/admin');
    await expect(page.getByTestId('admin-shell-heading')).toBeVisible();
    const adminShell = page.locator('.admin-shell-theme');
    const adminLightBackground = await adminShell.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--background').trim(),
    );
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const adminDarkBackground = await adminShell.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--background').trim(),
    );
    expect(adminDarkBackground).not.toBe(adminLightBackground);
  });
});

async function screenshot(
  browser: Browser,
  name: string,
  options: {
    route: string;
    storageState: string | { cookies: never[]; origins: never[] };
    viewport: { width: number; height: number };
    dark?: boolean;
    ready?: (page: Page) => Promise<void>;
  },
) {
  const context = await browser.newContext({
    storageState: options.storageState,
    viewport: options.viewport,
  });
  if (options.dark) {
    await context.addInitScript(() => document.documentElement.classList.add('dark'));
  }
  const page = await context.newPage();
  try {
    await page.goto(options.route);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    if (options.dark) {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
    }
    await options.ready?.(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: resolve(evidenceDir, name), animations: 'disabled' });
  } finally {
    await context.close();
  }
}

test.describe('Batch 0 visual evidence', () => {
  test('captures approved role, viewport, auth, menu, drawer, and dark states', async ({ browser }) => {
    test.setTimeout(180_000);
    mkdirSync(evidenceDir, { recursive: true });
    const desktop = { width: 1440, height: 900 };

    await screenshot(browser, 'frontend-user-desktop-1440x900.png', {
      route: '/', storageState: storage.user, viewport: desktop,
      ready: (page) => expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible(),
    });
    await screenshot(browser, 'frontend-verified-desktop-1440x900.png', {
      route: '/', storageState: storage.verified, viewport: desktop,
      ready: (page) => expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible(),
    });
    await screenshot(browser, 'frontend-admin-desktop-1440x900.png', {
      route: '/', storageState: storage.admin, viewport: desktop,
      ready: (page) => expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible(),
    });
    await screenshot(browser, 'frontend-mobile-390x844.png', {
      route: '/', storageState: storage.verified, viewport: { width: 390, height: 844 },
      ready: (page) => expect(page.getByRole('navigation', { name: '移动端主导航', exact: true })).toBeVisible(),
    });
    await screenshot(browser, 'frontend-tablet-768x1024.png', {
      route: '/', storageState: storage.verified, viewport: { width: 768, height: 1024 },
      ready: (page) => expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible(),
    });
    await screenshot(browser, 'admin-desktop-1440x900.png', {
      route: '/admin', storageState: storage.admin, viewport: desktop,
      ready: (page) => expect(page.getByTestId('admin-shell-heading')).toBeVisible(),
    });
    await screenshot(browser, 'admin-tablet-768x1024.png', {
      route: '/admin', storageState: storage.admin, viewport: { width: 768, height: 1024 },
      ready: (page) => expect(page.getByTestId('admin-shell-heading')).toBeVisible(),
    });
    await screenshot(browser, 'admin-mobile-drawer-open-390x844.png', {
      route: '/admin', storageState: storage.admin, viewport: { width: 390, height: 844 },
      ready: async (page) => {
        await page.getByTestId('admin-mobile-menu-trigger').click();
        await expect(page.getByTestId('admin-mobile-drawer')).toBeVisible();
      },
    });
    for (const [route, name] of [
      ['/login', 'login-390x844.png'],
      ['/register', 'register-390x844.png'],
      ['/admin/login', 'admin-login-390x844.png'],
    ] as const) {
      await screenshot(browser, name, {
        route,
        storageState: { cookies: [], origins: [] },
        viewport: { width: 390, height: 844 },
        ready: (page) => expect(page.getByTestId('auth-shell')).toBeVisible(),
      });
    }
    await screenshot(browser, 'dark-frontend-1440x900.png', {
      route: '/', storageState: storage.admin, viewport: desktop, dark: true,
      ready: (page) => expect(page.getByRole('navigation', { name: '主导航', exact: true })).toBeVisible(),
    });
    await screenshot(browser, 'dark-admin-1440x900.png', {
      route: '/admin', storageState: storage.admin, viewport: desktop, dark: true,
      ready: (page) => expect(page.getByRole('button', { name: '手动刷新' })).toBeVisible(),
    });
    await screenshot(browser, 'account-menu-open-1440x900.png', {
      route: '/', storageState: storage.admin, viewport: desktop,
      ready: async (page) => { await openAccountMenu(page); },
    });
  });
});
