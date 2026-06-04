import { db } from "../src/lib/db";
import { cleanWechatHtml } from "../src/services/collectors/wechat/weRssNormalizer";
import { createHash } from "crypto";

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = args.includes("--dry-run") || !isApply;

  console.log(`=== WeChat Article Content Repair Tool ===`);
  console.log(`Mode: ${isDryRun ? "DRY-RUN (No changes will be written)" : "APPLY (Changes will be written to DB)"}`);

  // Fetch all potential dirty ContentItem records
  const items = await db.contentItem.findMany({
    where: {
      platform: "wechat",
      OR: [
        { fullText: { startsWith: "<!DOCTYPE html" } },
        { fullText: { contains: "<html" } },
        { fullText: { contains: "<head>" } },
        { fullText: { contains: "<script" } },
      ],
    },
    select: {
      id: true,
      title: true,
      fullText: true,
      qualityStatus: true,
    },
  });

  console.log(`Found ${items.length} suspect dirty WeChat articles.`);

  if (items.length === 0) {
    console.log("No dirty articles found. Done.");
    return;
  }

  let repairedCount = 0;

  for (const item of items) {
    if (!item.fullText) continue;

    try {
      const { fullText: cleanedText, rawHtml: cleanedHtml } = cleanWechatHtml(item.fullText);

      // Recalculate wordCount
      const effectiveTextLength = cleanedText.replace(/\s+/g, "").trim().length;

      // Recalculate contentHash
      const contentHash = cleanedText
        ? createHash("sha256").update(cleanedText).digest("hex").slice(0, 16)
        : null;

      // Extract new excerpt/summary
      const excerpt = cleanedText.slice(0, 200);

      console.log(`- [${item.id}] "${item.title}": length ${item.fullText.length} -> ${effectiveTextLength}`);

      if (!isDryRun) {
        await db.contentItem.update({
          where: { id: item.id },
          data: {
            fullText: cleanedText,
            rawHtml: cleanedHtml,
            effectiveTextLength,
            contentHash,
            excerpt,
            ...(effectiveTextLength >= 300 && item.qualityStatus === "filtered" ? {
              processingStatus: "fetched",
              qualityStatus: "candidate",
              filterReason: null,
            } : {}),
          },
        });
      }
      repairedCount++;
    } catch (err) {
      console.error(`Error repairing item ${item.id}:`, err);
    }
  }

  console.log(`\nSummary:`);
  console.log(`Processed: ${repairedCount}/${items.length} articles.`);
  console.log(`Status: ${isDryRun ? "Dry-run completed successfully. No DB writes." : "Database updated successfully."}`);
}

main()
  .catch((err) => {
    console.error("Fatal error during repair:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
