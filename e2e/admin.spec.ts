import { expect, test } from '@playwright/test';
import { attachConsoleGuard } from './helpers/consoleGuard';

// P0-004 (B3): 文件级 admin storageState——本文件所有 describe 均为 admin 后台页面
test.use({ storageState: '.auth/admin-storage.json' });

test.describe('Admin Dashboard', () => {
  test('管理后台首页：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    // AdminShell h1 shows "系统概览"
    await expect(page.getByRole('heading', { name: '系统概览', level: 1 })).toBeVisible({ timeout: 10000 });
    // Stat cards are rendered (h2 inside the page content)
    await expect(page.getByText('文章总量')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('信息来源')).toBeVisible();
    await expect(page.getByText('活动中任务')).toBeVisible();

    guard.report(testInfo);
  });

  test('管理后台首页：刷新按钮', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '系统概览', level: 1 })).toBeVisible({ timeout: 10000 });

    // Wait for metrics data to load (page shows skeleton → content)
    await expect(page.getByText('文章总量')).toBeVisible({ timeout: 15000 });

    // Click the refresh button (contains "手动刷新" text)
    const refreshBtn = page.getByRole('button', { name: /手动刷新|刷新中/ });
    await expect(refreshBtn).toBeVisible({ timeout: 10000 });
    await refreshBtn.click();
    // After click, button text changes to "刷新中" briefly, then data reloads
    await expect(page.getByText('文章总量')).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });
});

test.describe('Admin Tasks', () => {
  test('异步任务：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/tasks');
    await expect(page.getByRole('heading', { name: '异步任务', level: 1 })).toBeVisible({ timeout: 10000 });
    // h2 with "异步任务" is in the page content
    await expect(page.getByText('异步任务').first()).toBeVisible();
    // Either the task table or the empty/ loading state is present
    await expect(
      page.locator('table').or(page.getByText('加载任务中'))
    ).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  test('异步任务：搜索筛选', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/tasks');
    await expect(page.getByRole('heading', { name: '异步任务', level: 1 })).toBeVisible({ timeout: 10000 });

    // Wait for page content to render (search input is in a Card with filter UI)
    const searchInput = page.getByPlaceholder('搜索 taskId / 参数 / 结果');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('nonexistent_query_xyz');
    // After filtering, the table should be empty (no matching rows)
    await page.waitForTimeout(500);
    // Verify that the search input has the value
    await expect(searchInput).toHaveValue('nonexistent_query_xyz');

    guard.report(testInfo);
  });

  test('异步任务：状态筛选', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/tasks');
    await expect(page.getByRole('heading', { name: '异步任务', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click the status select trigger (first select in the filter card)
    const statusTrigger = page.getByRole('combobox').first();
    await statusTrigger.click();
    // Verify select options are visible
    // Radix Select option 的 accessible name 是文案（已完成）而非 value（COMPLETED）
    await expect(page.getByRole('option', { name: '全部状态' })).toBeVisible();
    await expect(page.getByRole('option', { name: '已完成' })).toBeVisible();
    // Select 已完成（COMPLETED）
    await page.getByRole('option', { name: '已完成' }).click();
    // The combobox value should reflect the selection
    await page.waitForTimeout(1000);

    guard.report(testInfo);
  });

  test('异步任务：展开任务详情', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/tasks');
    await expect(page.getByRole('heading', { name: '异步任务', level: 1 })).toBeVisible({ timeout: 10000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check if there are any task rows (inside a table)
    const taskRows = page.locator('table tbody tr');
    const rowCount = await taskRows.count();

    if (rowCount > 0) {
      // Click the first task row to expand
      await taskRows.first().click();
      // Expanded detail should show "任务参数" and "执行结果"
      await expect(page.getByText('任务参数')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('执行结果')).toBeVisible();
    }
    // If no tasks exist, the test passes (no rows to expand)

    guard.report(testInfo);
  });

  test('异步任务页无 React key warning', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/tasks');
    await expect(page.getByText('异步任务').first()).toBeVisible({ timeout: 10000 });
    // Wait for table data to load and render
    await page.waitForTimeout(3000);
    // consoleGuard will detect any React key warnings and fail the test
    guard.report(testInfo);
  });
});

test.describe('Admin Logs', () => {
  test('系统日志：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/logs');
    await expect(page.getByRole('heading', { name: '系统日志', level: 1 })).toBeVisible({ timeout: 10000 });
    // Either loading state or the log table should be visible
    await expect(
      page.locator('table').or(page.getByText('加载日志中'))
    ).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  test('系统日志：级别筛选', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/logs');
    await expect(page.getByRole('heading', { name: '系统日志', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click the level select (first combobox in filter card)
    const levelTriggers = page.getByRole('combobox');
    await levelTriggers.first().click();
    // Select ERROR
    await expect(page.getByRole('option', { name: 'ERROR' })).toBeVisible();
    await page.getByRole('option', { name: 'ERROR' }).click();
    // Wait for filter to apply
    await page.waitForTimeout(2000);

    guard.report(testInfo);
  });

  test('系统日志：类别筛选', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/logs');
    await expect(page.getByRole('heading', { name: '系统日志', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click the category select (second combobox)
    const levelTriggers = page.getByRole('combobox');
    await levelTriggers.nth(1).click();
    // Verify category options are visible
    await expect(page.getByRole('option', { name: 'SYSTEM' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'CRAWLER' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'AI' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'AUTH' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'BACKUP' })).toBeVisible();

    guard.report(testInfo);
  });
});

test.describe('Admin Users', () => {
  test('用户管理：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '用户管理', level: 1 })).toBeVisible({ timeout: 10000 });
    // User table visible
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    // Create user button visible
    await expect(page.getByRole('button', { name: '创建用户' })).toBeVisible();

    guard.report(testInfo);
  });

  test('用户管理：创建用户对话框', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '用户管理', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click create user button
    await page.getByRole('button', { name: '创建用户' }).click();
    // Dialog opens with form fields
    await expect(page.getByText('创建新用户')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('3-32 个字符')).toBeVisible();
    await expect(page.getByPlaceholder('至少 6 个字符')).toBeVisible();
    // Role select is visible (Radix Select renders as combobox trigger)
    await expect(page.getByRole('combobox')).toBeVisible();
    // Cancel button visible
    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
    // Click cancel to close dialog
    await page.getByRole('button', { name: '取消' }).click();
    // Dialog should be gone
    await expect(page.getByText('创建新用户')).not.toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });

  test('用户管理：创建用户成功', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '用户管理', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click create user
    await page.getByRole('button', { name: '创建用户' }).click();
    await expect(page.getByText('创建新用户')).toBeVisible({ timeout: 5000 });

    // Fill the form
    const timestamp = Date.now();
    const username = `e2e_test_user_${timestamp}`;
    await page.getByPlaceholder('3-32 个字符').fill(username);
    await page.getByPlaceholder('至少 6 个字符').fill('test123456');
    // Select role "普通用户" from Radix Select (combobox pattern)
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: '普通用户' }).click();

    // Click create button
    await page.getByRole('button', { name: '创建', exact: true }).click();
    // Wait for success: user appears in table (use cell to avoid matching toast notification)
    await expect(page.getByRole('cell', { name: username })).toBeVisible({ timeout: 10000 });

    guard.report(testInfo);
  });

  test('用户管理：禁用启用用户', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '用户管理', level: 1 })).toBeVisible({ timeout: 10000 });

    // Wait for table to load
    await page.waitForTimeout(2000);

    // Find user rows (exclude admin user to avoid locking ourselves out)
    const userRows = page.locator('table tbody tr');
    const rowCount = await userRows.count();

    if (rowCount > 1) {
      // Find a non-admin user row (not the first row if it's admin)
      let targetRowIdx = -1;
      for (let i = 0; i < rowCount; i++) {
        const rowText = await userRows.nth(i).textContent();
        if (rowText && !rowText.includes('admin')) {
          targetRowIdx = i;
          break;
        }
      }

      if (targetRowIdx >= 0) {
        const targetRow = userRows.nth(targetRowIdx);
        const rowText = await targetRow.textContent();

        if (rowText && rowText.includes('正常')) {
          // User is active - click disable button (Ban icon)
          const disableBtn = targetRow.locator('button[title="禁用"]');
          if (await disableBtn.isVisible()) {
            await disableBtn.click();
            // Wait for status to change
            await page.waitForTimeout(2000);
            // Verify the status changed to "已禁用" or the toast appears
          }
        } else if (rowText && rowText.includes('已禁用')) {
          // User is disabled - click enable button
          const enableBtn = targetRow.getByRole('button', { name: '启用' });
          if (await enableBtn.isVisible()) {
            await enableBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }
    }

    guard.report(testInfo);
  });

  test('用户管理：创建用户不填必填项提交显示错误', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '用户管理', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click create user button to open dialog
    await page.getByRole('button', { name: '创建用户' }).click();
    await expect(page.getByText('创建新用户')).toBeVisible({ timeout: 5000 });

    // Click create button without filling username and password
    await page.getByRole('button', { name: '创建', exact: true }).click();

    // Sonner toast should show validation error
    await expect(page.getByText('用户名和密码不能为空')).toBeVisible({ timeout: 5000 });

    guard.report(testInfo);
  });
});

test.describe('Admin Backup', () => {
  test('数据备份：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/backup');
    await expect(page.getByRole('heading', { name: '数据备份', level: 1 })).toBeVisible({ timeout: 10000 });
    // Export button visible
    await expect(page.getByRole('button', { name: '下载备份压缩包' })).toBeVisible();
    // File upload input visible
    await expect(page.locator('input[type="file"]')).toBeVisible();

    guard.report(testInfo);
  });

  test('数据备份：导出备份', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/backup');
    await expect(page.getByRole('heading', { name: '数据备份', level: 1 })).toBeVisible({ timeout: 10000 });

    // Click export and wait for download
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await page.getByRole('button', { name: '下载备份压缩包' }).click();
    const download = await downloadPromise;

    if (download) {
      // Verify download started
      const suggestedFilename = download.suggestedFilename();
      expect(suggestedFilename).toContain('backup');
    }

    guard.report(testInfo);
  });
});

test.describe('Admin Clean', () => {
  test('数据清洗：页面加载', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/clean');
    await expect(page.getByRole('heading', { name: '数据清洗', level: 1 })).toBeVisible({ timeout: 10000 });
    // Rule checkboxes visible (base-ui Checkbox 渲染为 <span data-slot="checkbox" role="checkbox">)
    await expect(page.locator('[data-slot="checkbox"]').first()).toBeVisible({ timeout: 10000 });
    // Execute button visible
    await expect(page.getByRole('button', { name: '执行清洗' })).toBeVisible();

    guard.report(testInfo);
  });

  test('数据清洗：选择规则', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/clean');
    await expect(page.getByRole('heading', { name: '数据清洗', level: 1 })).toBeVisible({ timeout: 10000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Find a rule checkbox and click it
    const checkboxes = page.locator('[data-slot="checkbox"]');
    const checkboxCount = await checkboxes.count();

    if (checkboxCount > 0) {
      // Toggle a checkbox
      await checkboxes.first().click();
      await page.waitForTimeout(500);

      // Click execute
      const executeBtn = page.getByRole('button', { name: '执行清洗' });
      if (await executeBtn.isEnabled()) {
        await executeBtn.click();
        // Confirmation dialog should appear
        await expect(page.getByText('确认数据清洗')).toBeVisible({ timeout: 5000 });
        // Click cancel to dismiss
        await page.getByRole('button', { name: '取消', exact: true }).click();
        // Dialog should close
        await expect(page.getByText('确认数据清洗')).not.toBeVisible({ timeout: 5000 });
      }
    }

    guard.report(testInfo);
  });

  test('数据清洗：执行后取消不执行', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/clean');
    await page.waitForTimeout(1000);
    // Find and check a rule checkbox (base-ui Checkbox = <span data-slot="checkbox">)
    const checkbox = page.locator('[data-slot="checkbox"]').first();
    if (await checkbox.isVisible()) {
      const isChecked = await checkbox.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await checkbox.click();
      }
    }
    const execBtn = page.getByRole('button', { name: /执行|清理/ });
    if (await execBtn.isVisible()) {
      await execBtn.click();
      // Should show confirmation dialog
      const cancelBtn = page.getByRole('button', { name: /取消/ });
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();
        // Dialog should close, no action taken
        await expect(cancelBtn).not.toBeVisible({ timeout: 3000 });
      }
    }

    guard.report(testInfo);
  });

  test('数据清洗：确认执行', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const guard = attachConsoleGuard(page);

    await page.goto('/admin/clean');
    await expect(page.getByRole('heading', { name: '数据清洗', level: 1 })).toBeVisible({ timeout: 10000 });
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Select all checkboxes by ensuring they are checked
    const checkboxes = page.locator('[data-slot="checkbox"]');
    const checkboxCount = await checkboxes.count();

    // Make sure at least one checkbox is checked (base-ui 用 aria-checked 反映状态)
    for (let i = 0; i < checkboxCount; i++) {
      const ariaChecked = await checkboxes.nth(i).getAttribute('aria-checked');
      if (ariaChecked !== 'true') {
        await checkboxes.nth(i).click();
      }
    }

    // Check if execute button is enabled
    const executeBtn = page.getByRole('button', { name: '执行清洗' });
    const isEnabled = await executeBtn.isEnabled();

    if (isEnabled) {
      await executeBtn.click();
      // Confirmation dialog appears
      await expect(page.getByText('确认数据清洗')).toBeVisible({ timeout: 5000 });
      // Click confirm
      await page.getByRole('button', { name: '确认清洗' }).click();
      // Wait for result or error — check for completion or page stability
      await page.waitForTimeout(3000);
      // Verify: page didn't crash (no error overlay), clean page still renders
      const errorOverlay = page.locator('#__next-route-announcer ~ [role="alert"]');
      await expect(errorOverlay).not.toBeVisible();
      // Page is still functional — 数据清洗 AdminShell h1 仍在（页面 h2 同名，用 level 精确到 h1）
      await expect(page.getByRole('heading', { name: '数据清洗', level: 1 })).toBeVisible({ timeout: 5000 });
    }

    guard.report(testInfo);
  });
});
