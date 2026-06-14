import { Page, Locator } from '@playwright/test';

/** Get the main navigation banner */
export function navBanner(page: Page): Locator {
  return page.locator('header').first();
}

/** Get the admin sidebar */
export function adminSidebar(page: Page): Locator {
  return page.locator('aside').first();
}

/** Get the page header (PageHeader component) */
export function pageHeader(page: Page): Locator {
  return page.locator('[data-slot="page-header"]').first();
}

/** Get empty state component */
export function emptyState(page: Page): Locator {
  return page.locator('[data-slot="empty-state"]').first();
}

/** Get loading indicator */
export function loadingIndicator(page: Page): Locator {
  return page.locator('[data-slot="loading-indicator"], [data-slot="loading-skeleton"]').first();
}

/** Get a form field by label text */
export function formField(page: Page, label: string): Locator {
  return page.locator('[data-slot="form-field"]').filter({ hasText: label });
}

/** Get a dialog/modal */
export function dialog(page: Page): Locator {
  return page.getByRole('dialog').first();
}

/** Get toast notifications */
export function toasts(page: Page): Locator {
  return page.locator('[data-sonner-toast]');
}

/** Get the main content area */
export function mainContent(page: Page): Locator {
  return page.locator('main');
}

/** Get a data table */
export function dataTable(page: Page): Locator {
  return page.locator('table').first();
}

/** Get error boundary fallback UI */
export function errorBoundary(page: Page): Locator {
  return page.locator('[data-slot="error-boundary"]').first();
}
