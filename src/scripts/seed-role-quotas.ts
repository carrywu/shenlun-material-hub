/**
 * 角色配额初始化脚本 — 幂等创建默认收藏上限
 * 运行: pnpm seed:role-quotas
 *
 * 必须在 P2 review_flow migration 应用到目标数据库之后运行。
 *
 * 默认配额:
 * - USER: 100 篇
 * - VERIFIED_USER: 300 篇
 * - ADMIN: 不入库（代码里硬编码为无限）
 */

// Use dynamic import to avoid TypeScript build issues with standalone scripts
async function main() {
  const { PrismaClient } = await import("../generated/prisma");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    // ADMIN 不入库，代码里硬编码不限
    await db.roleQuota.upsert({
      where: { role: "USER" },
      update: {},
      create: { role: "USER", favoriteLimit: 100 },
    });

    await db.roleQuota.upsert({
      where: { role: "VERIFIED_USER" },
      update: {},
      create: { role: "VERIFIED_USER", favoriteLimit: 300 },
    });

    console.log("RoleQuota seed done: USER=100, VERIFIED_USER=300");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
