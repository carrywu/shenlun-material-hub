import { Page, TestInfo } from '@playwright/test';

export interface ConsoleError {
  type: string;
  text: string;
  location?: string;
}

/**
 * 监听页面 console.error 和 pageerror，收集并在测试结束时自动附加到报告。
 * 用法：
 *   let guard: ConsoleGuard;
 *   test.beforeEach(async ({ page }) => { guard = attachConsoleGuard(page); });
 *   test.afterEach(async () => { guard.report(testInfo); });
 */
export interface ConsoleGuard {
  errors: ConsoleError[];
  pageErrors: Error[];
  report: (testInfo: TestInfo) => void;
  hasErrors: () => boolean;
}

const CRITICAL_PATTERNS = [
  /React key warning/i,
  /Hydration failed/i,
  /Unhandled Runtime Error/i,
  /TypeError/i,
  /ReferenceError/i,
  /Cannot read properties of/i,
  /Unhandled Runtime Error/i,
  /NEXT_NOT_FOUND/i,
];

export function attachConsoleGuard(page: Page): ConsoleGuard {
  const errors: ConsoleError[] = [];
  const pageErrors: Error[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({
        type: 'console.error',
        text: msg.text(),
        location: msg.location() ? `${msg.location().url}:${msg.location().lineNumber}` : undefined,
      });
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return {
    errors,
    pageErrors,
    hasErrors() {
      return errors.length > 0 || pageErrors.length > 0;
    },
    report(testInfo: TestInfo) {
      if (errors.length > 0) {
        const json = JSON.stringify(errors, null, 2);
        testInfo.attachments.push({
          name: 'console-errors',
          contentType: 'application/json',
          body: Buffer.from(json),
        });
      }
      if (pageErrors.length > 0) {
        const json = JSON.stringify(
          pageErrors.map((e) => ({ name: e.name, message: e.message, stack: e.stack })),
          null,
          2,
        );
        testInfo.attachments.push({
          name: 'page-errors',
          contentType: 'application/json',
          body: Buffer.from(json),
        });
      }
      // 检查是否有 critical pattern 匹配
      const allText = [...errors.map((e) => e.text), ...pageErrors.map((e) => e.message)].join('\n');
      const criticals = CRITICAL_PATTERNS.filter((p) => p.test(allText));
      if (criticals.length > 0) {
        console.warn(`[ConsoleGuard] Critical patterns detected: ${criticals.map((p) => p.source).join(', ')}`);
      }
    },
  };
}
