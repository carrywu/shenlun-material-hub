/**
 * Debug script: check wechat ContentItem and Source state in local DB
 */
import { db } from "../src/lib/db";

async function main() {
  // 1. Check wechat ContentItems by status
  const items = await db.contentItem.findMany({
    where: { platform: "wechat" },
    select: {
      processingStatus: true,
      qualityStatus: true,
      filterReason: true,
      effectiveTextLength: true,
      originalUrl: true,
      title: true,
      sourceId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n=== Total wechat ContentItems: ${items.length} ===`);

  // Group by processing/quality status
  const byStatus: Record<string, number> = {};
  for (const item of items) {
    const key = `${item.processingStatus}/${item.qualityStatus}`;
    byStatus[key] = (byStatus[key] || 0) + 1;
  }
  console.log("\nBy status:");
  for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  // Group by filter reason
  const byReason: Record<string, number> = {};
  for (const item of items) {
    const reason = item.filterReason || "(none)";
    byReason[reason] = (byReason[reason] || 0) + 1;
  }
  console.log("\nBy filter reason:");
  for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  "${k}": ${v}`);
  }

  // 2. Check sources
  const sources = await db.source.findMany({
    where: {
      OR: [
        { platform: "wechat" },
        { name: { contains: "浙江" } },
        { name: { contains: "观潮" } },
      ],
    },
    select: {
      id: true,
      name: true,
      feedId: true,
      baseUrl: true,
      isEnabled: true,
      lastCollectedAt: true,
    },
    orderBy: { name: "asc" },
  });

  console.log("\n=== Wechat Sources ===");
  for (const s of sources) {
    console.log(
      `  ${s.name}: feedId=${s.feedId || "NULL"}, baseUrl=${s.baseUrl || "NULL"}, enabled=${s.isEnabled}, lastCollected=${s.lastCollectedAt || "NEVER"}`
    );
  }

  // 3. Show some recent items
  console.log("\n=== Recent wechat ContentItems (last 15) ===");
  const recent = items.slice(0, 15);
  for (const item of recent) {
    console.log(
      `  "${item.title?.slice(0, 35)}" proc=${item.processingStatus} quality=${item.qualityStatus} filterReason="${item.filterReason || "none"}" textLen=${item.effectiveTextLength} url=...${item.originalUrl?.slice(-50)}`
    );
  }

  // 4. Check CRAWLER logs
  const crawlerLogs = await db.systemLog.findMany({
    where: { category: "CRAWLER" },
    select: { message: true, detail: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log(`\n=== Recent CRAWLER logs (last ${crawlerLogs.length}) ===`);
  for (const log of crawlerLogs) {
    const detailStr = typeof log.detail === "string" ? log.detail : JSON.stringify(log.detail);
    let detailPreview = "";
    try {
      const d = JSON.parse(detailStr);
      detailPreview = d.title ? `title="${d.title?.slice(0, 30)}"` : d.source ? `source="${d.source}"` : "";
    } catch {
      detailPreview = detailStr?.slice(0, 50) || "";
    }
    console.log(`  [${log.createdAt?.toISOString().slice(0, 19)}] ${log.message} ${detailPreview}`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
