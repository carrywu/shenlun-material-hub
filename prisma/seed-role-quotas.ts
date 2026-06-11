import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  // ADMIN 不入库，代码里硬编码不限
  // USER 角色限额默认 100，VERIFIED_USER 默认 300
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
