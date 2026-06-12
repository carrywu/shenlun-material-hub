import { chromium, type FullConfig, type APIRequestContext } from '@playwright/test';

interface Role {
  name: string;
  username: string;
  passwordEnv: string;
  defaultPassword: string;
  storagePath: string;
  needInvitation: boolean;
}

const ROLES: Role[] = [
  { name: 'admin', username: 'admin', passwordEnv: 'E2E_ADMIN_PASSWORD', defaultPassword: 'admin123', storagePath: '.auth/admin-storage.json', needInvitation: false },
  { name: 'verified', username: 'e2e_verified', passwordEnv: 'E2E_VERIFIED_PASSWORD', defaultPassword: 'verified123', storagePath: '.auth/verified-storage.json', needInvitation: true },
  { name: 'usera', username: 'e2e_usera', passwordEnv: 'E2E_USERA_PASSWORD', defaultPassword: 'usera123', storagePath: '.auth/usera-storage.json', needInvitation: false },
  { name: 'userb', username: 'e2e_userb', passwordEnv: 'E2E_USERB_PASSWORD', defaultPassword: 'userb123', storagePath: '.auth/userb-storage.json', needInvitation: false },
];

/** 通过 API 登录，成功返回 true；失败返回 false */
async function tryLogin(
  request: APIRequestContext,
  username: string,
  password: string,
): Promise<boolean> {
  const res = await request.post('/api/auth/login', {
    data: { username, password },
  });
  if (!res.ok()) return false;
  // API request context 不会自动共享 cookie 到 browser；这里只验证登录可达
  return true;
}

/** 通过注册 API 创建账号（幂等：409 视为已存在） */
async function register(
  request: APIRequestContext,
  username: string,
  password: string,
  invitationCode?: string,
): Promise<void> {
  const res = await request.post('/api/auth/register', {
    data: { username, password, invitationCode },
  });
  if (res.status() !== 201 && res.status() !== 409) {
    throw new Error(`注册 ${username} 失败：${res.status()} ${await res.text()}`);
  }
}

/** admin 生成一次性邀请码 */
async function createInvitationCode(adminCookie: string, baseURL: string): Promise<string> {
  const res = await fetch(`${baseURL}/api/admin/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({ maxUses: 1 }),
  });
  if (!res.ok) throw new Error(`生成邀请码失败：${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.invitation.code;
}

/** 浏览器登录，存 storageState，返回 cookie 字符串（供 API 调用复用） */
async function browserLoginAndSave(
  baseURL: string,
  username: string,
  password: string,
  storagePath: string,
): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${baseURL}/login`);
    const accountInput = page.getByPlaceholder('请输入账号');
    await accountInput.waitFor({ state: 'visible', timeout: 15000 });
    await accountInput.fill(username);
    await page.getByPlaceholder('请输入密码').fill(password);
    await page.locator("form button[type='submit']").click();
    await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 15000 });
    const cookies = await page.context().cookies();
    const authToken = cookies.find((c) => c.name === 'auth_token');
    if (!authToken) {
      throw new Error(`${username} 登录成功但 auth_token cookie 不存在`);
    }
    await page.context().storageState({ path: storagePath });
    return `auth_token=${authToken.value}`;
  } finally {
    await browser.close();
  }
}

/** P0-004: 造 1 篇 approved 公共 fixture 文章（A/B 隔离测试用，决策 16）
 *
 * 注意：ContentItem 无 slug 字段，用 originalUrl（@unique）做幂等键。
 * platform/contentType/trustLevel 为必填无默认值，从所选 Source 继承。 */
async function createFixtureArticle(): Promise<void> {
  // 动态 import 与 src/scripts/seed-role-quotas.ts 一致（运行期 tsx 解析正常）；
  // 生成客户端带 @ts-nocheck 且无 .d.ts 入口，静态类型解析报错，故 expect-error。
  // @ts-expect-error generated prisma client has no type entry
  const { PrismaClient } = await import('../src/generated/prisma');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });
  try {
    const FIXTURE_URL = 'https://example.com/e2e-fixture-isolation-article';
    // 幂等：用固定 originalUrl，已存在就跳过
    const existing = await db.contentItem.findFirst({
      where: { originalUrl: FIXTURE_URL },
    });
    if (existing) return;
    // 找一个 source（没有就跳过 fixture 创建，不阻断 setup）
    const source = await db.source.findFirst();
    if (!source) {
      console.warn('⚠ P0-004: 无 Source，跳过 fixture 文章创建');
      return;
    }
    await db.contentItem.create({
      data: {
        title: 'E2E Fixture Isolation Article',
        originalUrl: FIXTURE_URL,
        sourceId: source.id,
        platform: source.platform,
        contentType: source.contentType,
        trustLevel: source.trustLevel,
        visibility: 'public',
        adminReviewStatus: 'approved',
      },
    });
    console.log('✓ P0-004: fixture 文章已创建');
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3001';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const apiCtx = ctx.request;

  try {
    // 1. admin 先登录（后续角色需要 admin 生成邀请码）
    const adminRole = ROLES[0];
    const adminPassword = process.env[adminRole.passwordEnv] ?? adminRole.defaultPassword;
    let adminCookie: string;
    try {
      adminCookie = await browserLoginAndSave(baseURL, adminRole.username, adminPassword, adminRole.storagePath);
    } catch (e) {
      throw new Error(`globalSetup: admin 登录失败，无法继续：${e instanceof Error ? e.message : e}`);
    }

    // 2. verified/usera/userb：先试登录，失败才注册
    for (const role of ROLES.slice(1)) {
      const password = process.env[role.passwordEnv] ?? role.defaultPassword;
      try {
        const loggedIn = await tryLogin(apiCtx, role.username, password);
        if (!loggedIn) {
          // 登录失败 → 注册（注册接口幂等，成功后下面的浏览器登录会再次校验凭据）
          if (role.needInvitation) {
            const code = await createInvitationCode(adminCookie, baseURL);
            await register(apiCtx, role.username, password, code);
          } else {
            await register(apiCtx, role.username, password);
          }
        }
        // 浏览器登录存 storageState（凭据错误会在此时大声失败）
        await browserLoginAndSave(baseURL, role.username, password, role.storagePath);
      } catch (e) {
        console.warn(`⚠ P0-004: 角色 ${role.name} 准备失败（${role.storagePath} 将缺，相关用例会 fail/skip）：${e instanceof Error ? e.message : e}`);
      }
    }

    // 3. 造 fixture 文章
    await createFixtureArticle();
  } finally {
    await apiCtx.dispose();
    await browser.close();
  }
}

export default globalSetup;
