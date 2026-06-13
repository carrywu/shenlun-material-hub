import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';

interface Role {
  name: string;
  username: string;
  passwordEnv: string;
  defaultPassword: string;
  storagePath: string;
  /** 登录 context：admin 或 user */
  loginContext: 'admin' | 'user';
}

const ROLES: Role[] = [
  { name: 'admin', username: 'admin', passwordEnv: 'E2E_ADMIN_PASSWORD', defaultPassword: 'admin123', storagePath: '.auth/admin-storage.json', loginContext: 'admin' },
  { name: 'verified', username: 'e2e_verified', passwordEnv: 'E2E_VERIFIED_PASSWORD', defaultPassword: 'verified123', storagePath: '.auth/verified-storage.json', loginContext: 'user' },
  { name: 'usera', username: 'e2e_usera', passwordEnv: 'E2E_USERA_PASSWORD', defaultPassword: 'usera123', storagePath: '.auth/usera-storage.json', loginContext: 'user' },
  { name: 'userb', username: 'e2e_userb', passwordEnv: 'E2E_USERB_PASSWORD', defaultPassword: 'userb123', storagePath: '.auth/userb-storage.json', loginContext: 'user' },
];

/**
 * 通过 API 登录，提取 auth_token cookie，注入浏览器 context 并存 storageState。
 *
 * 比浏览器表单提交更可靠：不依赖 Playwright 对 client-side routing 和 cookie 检测的行为。
 */
async function apiLoginAndSave(
  baseURL: string,
  username: string,
  password: string,
  storagePath: string,
  loginContext: 'admin' | 'user',
): Promise<void> {
  // 1. API 登录，提取 token
  const loginUrl = `${baseURL}/api/auth/login`;
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, context: loginContext }),
    // 不自动跟随重定向，手动处理 cookie
    redirect: 'manual',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API 登录失败 (${res.status}): ${body}`);
  }

  const setCookieHeader = res.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error(`API 登录成功但 Set-Cookie 头不存在`);
  }

  // 解析 auth_token 值
  const tokenMatch = setCookieHeader.match(/auth_token=([^;]+)/);
  if (!tokenMatch) {
    throw new Error(`Set-Cookie 中未找到 auth_token`);
  }
  const token = tokenMatch[1];

  // 2. 启动浏览器，注入 cookie，导航并存 storageState
  const url = new URL(baseURL);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    await context.addCookies([{
      name: 'auth_token',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    }]);

    const page = await context.newPage();
    // 导航到目标页面验证登录态
    const destination = loginContext === 'admin' ? '/' : '/articles';
    await page.goto(`${baseURL}${destination}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('main', { timeout: 15000 });

    await context.storageState({ path: storagePath });
  } finally {
    await browser.close();
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
    await apiLoginAndSave(baseURL, adminRole.username, adminPassword, adminRole.storagePath, adminRole.loginContext);
  } catch (e) {
    throw new Error(
      `globalSetup: admin 登录失败，无法继续：${e instanceof Error ? e.message : e}`,
    );
  }

  // 3. verified/usera/userb 登录（seed 已确保账号存在，这里只登录）
  for (const role of ROLES.slice(1)) {
    const password = process.env[role.passwordEnv] ?? role.defaultPassword;
    try {
      await apiLoginAndSave(baseURL, role.username, password, role.storagePath, role.loginContext);
    } catch (e) {
      console.warn(
        `⚠ P0-004: 角色 ${role.name} 登录失败（${role.storagePath} 将缺，相关用例会 fail/skip）：${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

export default globalSetup;
