import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';

interface Role {
  name: string;
  username: string;
  passwordEnv: string;
  defaultPassword: string;
  storagePath: string;
}

const ROLES: Role[] = [
  { name: 'admin', username: 'admin', passwordEnv: 'E2E_ADMIN_PASSWORD', defaultPassword: 'admin123', storagePath: '.auth/admin-storage.json' },
  { name: 'verified', username: 'e2e_verified', passwordEnv: 'E2E_VERIFIED_PASSWORD', defaultPassword: 'verified123', storagePath: '.auth/verified-storage.json' },
  { name: 'usera', username: 'e2e_usera', passwordEnv: 'E2E_USERA_PASSWORD', defaultPassword: 'usera123', storagePath: '.auth/usera-storage.json' },
  { name: 'userb', username: 'e2e_userb', passwordEnv: 'E2E_USERB_PASSWORD', defaultPassword: 'userb123', storagePath: '.auth/userb-storage.json' },
];

/**
 * 浏览器登录，存 storageState。
 *
 * 注意：项目只有 /admin/login 一个登录页（无 /login 路由）。先 goto /admin 触发
 * middleware 重定向到 /admin/login，等表单 placeholder 出现（Suspense 解析完）再填。
 * URL predicate 不用 regex，避免同时匹配 /admin/login。
 */
async function browserLoginAndSave(
  baseURL: string,
  username: string,
  password: string,
  storagePath: string,
): Promise<void> {
  // Dev server 冷启时首次编译 /admin/login 可能要 20-30s，给 40s + 1 次重试。
  // webServer 起来后端口就 ready，但 Next 路由是 lazy 编译的，global-setup 抢跑会撞上。
  const LOGIN_NAV_TIMEOUT = 40000;
  const FORM_TIMEOUT = 30000;
  const POST_LOGIN_TIMEOUT = 30000;

  const tryLogin = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
      await page.goto(`${baseURL}/admin`, {
        waitUntil: 'domcontentloaded',
        timeout: LOGIN_NAV_TIMEOUT,
      });
      await page.waitForURL(/\/admin\/login/, { timeout: LOGIN_NAV_TIMEOUT });

      const accountInput = page.getByPlaceholder('请输入账号');
      await accountInput.waitFor({ state: 'visible', timeout: FORM_TIMEOUT });
      await accountInput.fill(username);
      await page.getByPlaceholder('请输入密码').fill(password);
      await page.locator("form button[type='submit']").click();

      await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'), {
        timeout: POST_LOGIN_TIMEOUT,
      });
      await page.waitForSelector('main', { timeout: 15000 });

      const cookies = await page.context().cookies();
      const authToken = cookies.find((c) => c.name === 'auth_token');
      if (!authToken) {
        throw new Error(`${username} 登录成功但 auth_token cookie 不存在`);
      }
      await page.context().storageState({ path: storagePath });
    } finally {
      await browser.close();
    }
  };

  try {
    await tryLogin();
  } catch (firstErr) {
    // 重试一次：首次常因 dev server 冷启编译慢导致 timeout，第二次路由已缓存。
    console.warn(
      `⚠ globalSetup: ${username} 首次登录失败，重试一次：${firstErr instanceof Error ? firstErr.message : firstErr}`,
    );
    await tryLogin();
  }
}

/**
 * P0-004 globalSetup —— 在所有测试之前为 4 个角色登录并存 storageState。
 *
 * 账号准备策略（决策 11 修正版）：
 * - 非 admin 账号（e2e_verified/e2e_usera/e2e_userb）由 seed-e2e-accounts 脚本幂等创建
 *   （tsx 运行，Prisma 正常）。不用 register API 的原因：
 *   1. /api/admin/invitations 有 pre-existing DB drift（P1-005），VERIFIED_USER 注册会 500
 *   2. e2e 上下文不能直接 import Prisma（Playwright loader 不转换 .ts 动态 import）
 * - global-setup 只负责登录，不碰 DB / 注册 / 邀请码
 *
 * fixture 文章：不在此创建。A/B 隔离用例（data-isolation.spec.ts）改用「列表里任意一篇
 * approved 文章」——dev/staging DB 都有真实 approved 文章，避免在 e2e 里做 DB 写入。
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3001';

  // 1. 确保 e2e 测试账号存在 + 角色正确（幂等）。打远端 staging 时也跑（账号在远端 DB）。
  //    脚本连的是 DATABASE_URL 指向的库——本地 e2e 指本地 DB，staging e2e 指远端 DB。
  try {
    const repoRoot = resolve(__dirname, '..');
    execFileSync('pnpm', ['seed:e2e-accounts'], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '0' },
    });
  } catch (e) {
    console.warn(
      `⚠ P0-004: seed:e2e-accounts 失败（非 admin 角色登录可能失败）：${e instanceof Error ? e.message : e}`,
    );
  }

  // 2. admin 先登录（必须成功，否则后续无法判断是 server 没起还是凭据错）
  const adminRole = ROLES[0];
  const adminPassword = process.env[adminRole.passwordEnv] ?? adminRole.defaultPassword;
  try {
    await browserLoginAndSave(baseURL, adminRole.username, adminPassword, adminRole.storagePath);
  } catch (e) {
    throw new Error(
      `globalSetup: admin 登录失败，无法继续：${e instanceof Error ? e.message : e}`,
    );
  }

  // 3. verified/usera/userb 登录（seed 已确保账号存在，这里只登录）
  for (const role of ROLES.slice(1)) {
    const password = process.env[role.passwordEnv] ?? role.defaultPassword;
    try {
      await browserLoginAndSave(baseURL, role.username, password, role.storagePath);
    } catch (e) {
      console.warn(
        `⚠ P0-004: 角色 ${role.name} 登录失败（${role.storagePath} 将缺，相关用例会 fail/skip）：${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

export default globalSetup;
