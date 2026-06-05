/**
 * 管理员初始化脚本 — 幂等创建初始管理员用户
 * 运行: pnpm tsx src/scripts/seed-admin.ts
 *
 * 从环境变量读取管理员账号配置:
 * - ADMIN_USERNAME (默认: admin)
 * - ADMIN_PASSWORD (默认: admin123)
 *
 * 如果管理员用户已存在，跳过创建。
 */

// Use dynamic import to avoid TypeScript build issues with standalone scripts
async function main() {
  const { PrismaClient } = await import("../generated/prisma");
  const bcrypt = await import("bcryptjs");

  const prisma = new PrismaClient();

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  console.log(`检查管理员用户 "${username}"...`);

  const existing = await prisma.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`用户 "${username}" 已存在 (role: ${existing.role}, status: ${existing.status})`);

    if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", status: "ACTIVE" },
      });
      console.log(`已将用户 "${username}" 提升为管理员`);
    }
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      username,
      displayName: "管理员",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`管理员用户创建成功: ${user.username} (id: ${user.id})`);
  console.log(`  角色: ${user.role}`);
  console.log(`  状态: ${user.status}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("初始化失败:", e);
  process.exit(1);
});
