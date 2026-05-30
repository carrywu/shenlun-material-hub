/**
 * 采集栏目种子脚本 — 为已有来源配置高价值栏目
 * 运行: pnpm seed:channels
 */
import { db } from "@/lib/db";

interface ChannelSeed {
  sourceName: string;
  name: string;
  listUrl: string;
  urlPattern?: string;
  paginationPattern?: string;
  maxPages?: number;
}

const CHANNEL_SEEDS: ChannelSeed[] = [
  // ─── 先锋文汇 ───
  {
    sourceName: "先锋文汇",
    name: "精华文章",
    listUrl: "https://tougao.12371.cn/wenhui.php",
    urlPattern: "gaojian\\.php\\?tid=\\d+",
    maxPages: 3,
  },

  // ─── 人民日报 ───
  {
    sourceName: "人民日报",
    name: "人民日报数字报",
    listUrl: "http://paper.people.com.cn/rmrb/html",
    urlPattern: "\\.htm$",
    maxPages: 1, // 按日期翻页，不是分页
  },

  // ─── 人民网观点 ───
  {
    sourceName: "人民网观点",
    name: "观点频道",
    listUrl: "http://opinion.people.com.cn/GB/8213/49160/index.html",
    urlPattern: "/n1/\\d{4}/\\d{4}/c\\d+-\\d+\\.html",
    maxPages: 3,
  },

  // ─── 广东省政府网 ───
  {
    sourceName: "广东省政府网",
    name: "政策解读",
    listUrl: "https://www.gd.gov.cn/zwgk/zcjd/index.html",
    urlPattern: "content/post_\\d+\\.html",
    maxPages: 3,
  },
  {
    sourceName: "广东省政府网",
    name: "政务专题",
    listUrl: "https://www.gd.gov.cn/gdywdt/zwzt/index.html",
    urlPattern: "content/post_\\d+\\.html",
    maxPages: 2,
  },

  // ─── 湖南省政府网 ───
  {
    sourceName: "湖南省政府网",
    name: "三湘解读",
    listUrl: "http://www.hunan.gov.cn/hnszf/xxgk/jd/index.html",
    urlPattern: "t\\d{8}_\\d+\\.html",
    maxPages: 3,
  },
  {
    sourceName: "湖南省政府网",
    name: "聊点政事",
    listUrl: "http://www.hunan.gov.cn/topic/ldzs/ldzs.html",
    urlPattern: "t\\d{8}_\\d+\\.html",
    maxPages: 2,
  },
];

async function main() {
  console.log(`开始导入 ${CHANNEL_SEEDS.length} 条栏目配置...`);

  let created = 0;
  let skipped = 0;

  for (const seed of CHANNEL_SEEDS) {
    // 查找对应来源
    const source = await db.source.findFirst({
      where: { name: seed.sourceName, platform: "website" },
    });

    if (!source) {
      console.log(`  跳过（来源不存在）: ${seed.sourceName} — 请先运行 pnpm seed:accounts`);
      skipped++;
      continue;
    }

    // 检查是否已存在
    const existing = await db.collectionChannel.findFirst({
      where: { sourceId: source.id, listUrl: seed.listUrl },
    });

    if (existing) {
      console.log(`  跳过（已存在）: ${seed.sourceName} / ${seed.name}`);
      skipped++;
      continue;
    }

    // 创建栏目
    await db.collectionChannel.create({
      data: {
        sourceId: source.id,
        name: seed.name,
        listUrl: seed.listUrl,
        urlPattern: seed.urlPattern ?? null,
        paginationPattern: seed.paginationPattern ?? null,
        maxPages: seed.maxPages ?? 3,
      },
    });

    console.log(`  创建: ${seed.sourceName} / ${seed.name} → ${seed.listUrl}`);
    created++;
  }

  console.log(`\n导入完成: 创建 ${created} 条, 跳过 ${skipped} 条`);
}

main()
  .catch((e) => {
    console.error("栏目种子脚本执行失败:", e);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
