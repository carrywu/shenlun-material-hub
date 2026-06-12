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

// 良性错误：浏览器在导航/卸载页面时中止进行中的 fetch，会抛 TypeError: Failed to fetch
// （Chromium）或 NetworkError（其它）。这是预期行为，不是应用 bug。
// Playwright 测试里 page.goto 会主动取消未完成的请求，这类噪声必须忽略，
// 否则任何"加载 dashboard 后立即跳走"的用例都会误报。
const BENIGN_PATTERNS = [
  /Failed to fetch/i,
  /Load failed/i,
  /NetworkError when attempting to fetch/i,
  /The user aborted a request/i,
  /navigation/i,
];

function isBenign(text: string): boolean {
  return BENIGN_PATTERNS.some((p) => p.test(text));
}

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
      // 先剔除良性错误（导航中止 fetch 等浏览器噪声），避免误报。
      const realErrors = errors.filter((e) => !isBenign(e.text));
      const realPageErrors = pageErrors.filter((e) => !isBenign(e.message));
      const allText = [
        ...realErrors.map((e) => e.text),
        ...realPageErrors.map((e) => e.message),
      ].join('\n');
      const criticals = CRITICAL_PATTERNS.filter((p) => p.test(allText));
      if (criticals.length > 0) {
        const matchedPatterns = criticals.map((p) => p.source).join(', ');
        const matchedTexts = realErrors
          .filter((e) => CRITICAL_PATTERNS.some((p) => p.test(e.text)))
          .map((e) => e.text)
          .concat(
            realPageErrors
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
