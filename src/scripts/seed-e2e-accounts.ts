/**
 * E2E 测试账号种子脚本 — 幂等创建 e2e 测试用的多角色账号
 * 运行: pnpm seed:e2e-accounts
 *
 * 解决问题（P0-004）：
 * - global-setup 不能直接 import Prisma（Playwright loader 不转换 .ts 动态 import）
 * - /api/admin/invitations 有 pre-existing DB drift bug（schema 与 DB 不一致，P1-005）
 *   导致通过邀请码注册 VERIFIED_USER 失败
 *
 * 所以改用本脚本（tsx 运行，Prisma 正常）在 e2e 前直接确保账号存在 + 角色正确。
 * global-setup 只负责登录存 storageState。
 *
 * 账号：
 * - e2e_verified / verified123  (VERIFIED_USER)
 * - e2e_usera    / usera123     (USER)
 * - e2e_userb    / userb123     (USER)
 *
 * 幂等：已存在则更新密码 + 角色（保证一致）。
 */
// 加载 .env（tsx 不自动加载；其他 seed 脚本依赖外部已设 DATABASE_URL）
import "dotenv/config";

async function main() {
  // 用显式 client 入口（src/lib/db.ts 同款），避免目录 import 在 tsx 下找 index.json 失败（P1-004）
  const { PrismaClient } = await import("../generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const bcrypt = await import("bcryptjs");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  // 先做最小连接验证，避免后续操作在 DB 不可用时挂起
  try {
    await pool.query("SELECT 1");
  } catch (connErr) {
    console.error("数据库连接失败，请检查 PostgreSQL 服务状态:", (connErr as Error).message);
    await pool.end();
    process.exit(1);
  }
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const accounts = [
    {
      username: process.env.E2E_VERIFIED_USERNAME ?? "e2e_verified",
      password: process.env.E2E_VERIFIED_PASSWORD ?? "verified123",
      role: "VERIFIED_USER",
    },
    {
      username: process.env.E2E_USERA_USERNAME ?? "e2e_usera",
      password: process.env.E2E_USERA_PASSWORD ?? "usera123",
      role: "USER",
    },
    {
      username: process.env.E2E_USERB_USERNAME ?? "e2e_userb",
      password: process.env.E2E_USERB_PASSWORD ?? "userb123",
      role: "USER",
    },
  ];

  try {
    for (const acc of accounts) {
      const passwordHash = await bcrypt.default.hash(acc.password, 12);
      const existing = await prisma.user.findUnique({
        where: { username: acc.username },
      });
      if (existing) {
        // 保证密码 + 角色一致（避免上次跑留下的旧密码/旧角色）
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, role: acc.role, status: "ACTIVE" },
        });
        console.log(`  ✓ ${acc.username} 已存在，已同步密码/角色 → ${acc.role}`);
      } else {
        await prisma.user.create({
          data: {
            username: acc.username,
            displayName: acc.username,
            passwordHash,
            role: acc.role,
            status: "ACTIVE",
          },
        });
        console.log(`  ✓ ${acc.username} 创建 → ${acc.role}`);
      }
    }
    console.log("e2e accounts seed done");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("e2e accounts seed failed:", e);
  process.exit(1);
});
