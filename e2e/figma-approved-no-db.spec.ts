import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const evidenceDir = resolve(process.cwd(), 'docs/testing/figma-alignment');

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

async function expectNoSeriousAxeFindings(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}

async function hideDevOverlays(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  });
}

test.describe('Figma-approved no-DB authentication evidence', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ] as const;

  const themes = ['light', 'dark'] as const;

  for (const route of ['/login', '/register', '/admin/login'] as const) {
    for (const viewport of viewports) {
      for (const theme of themes) {
        test(`${route} keeps the auth shell navigation-free at ${viewport.width}x${viewport.height} ${theme} without PostgreSQL`, async ({ page }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          if (theme === 'dark') {
            await page.addInitScript(() =>
              document.documentElement.classList.add('dark'),
            );
          }
          await page.goto(route);
          await hideDevOverlays(page);
          if (theme === 'dark') {
            await page.evaluate(() =>
              document.documentElement.classList.add('dark'),
            );
          }

          await expect(page.getByTestId('auth-shell')).toBeVisible();
          await expect(
            page.getByRole('navigation', { name: '主导航', exact: true }),
          ).toHaveCount(0);
          await expect(
            page.getByRole('navigation', {
              name: '移动端主导航',
              exact: true,
            }),
          ).toHaveCount(0);
          await expectNoHorizontalOverflow(page);
          await expectNoSeriousAxeFindings(page);

          const name = route.replaceAll('/', '-').replace(/^-/, '') || 'home';
          await page.screenshot({
            path: resolve(
              evidenceDir,
              `auth-${name}-${viewport.name}-${theme}-no-db.png`,
            ),
            fullPage: true,
            animations: 'disabled',
          });
        });
      }
    }
  }
});
