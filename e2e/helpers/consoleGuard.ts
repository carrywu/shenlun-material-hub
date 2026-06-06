import { Page, TestInfo } from '@playwright/test';

export interface ConsoleError {
  type: string;
  text: string;
  location?: string;
}

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

      // 检查 critical pattern —— 发现则直接 throw，不假装通过
      const allText = [...errors.map((e) => e.text), ...pageErrors.map((e) => e.message)].join('\n');
      const criticals = CRITICAL_PATTERNS.filter((p) => p.test(allText));
      if (criticals.length > 0) {
        const matchedPatterns = criticals.map((p) => p.source).join(', ');
        const matchedTexts = errors
          .filter((e) => CRITICAL_PATTERNS.some((p) => p.test(e.text)))
          .map((e) => e.text)
          .concat(
            pageErrors
              .filter((e) => CRITICAL_PATTERNS.some((p) => p.test(e.message)))
              .map((e) => e.message),
          )
          .join('\n');

        throw new Error(
          `[ConsoleGuard] 发现关键错误 (${matchedPatterns})，测试不通过：\n${matchedTexts}`,
        );
      }
    },
  };
}
