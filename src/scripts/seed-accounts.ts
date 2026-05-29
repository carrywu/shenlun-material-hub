/**
 * 账号池种子脚本 — 批量导入来源数据
 * 运行: pnpm seed:accounts
 */
import { db } from "@/lib/db";

interface SeedSource {
  name: string;
  platform: string;
  contentType: string;
  trustLevel: string;
  priority: string;
  externalId?: string;
  baseUrl?: string;
  profileUrl?: string;
  regionScopes: string[];
  verificationStatus: string;
  keywords?: string[];
  collectionMode?: string;
}

// ─── 官方核心 (website) ───
const officialCore: SeedSource[] = [
  {
    name: "人民日报",
    platform: "website",
    contentType: "official_primary",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "人民网观点",
    platform: "website",
    contentType: "official_primary",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "先锋文汇",
    platform: "website",
    contentType: "official_case",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "新华社",
    platform: "website",
    contentType: "official_primary",
    trustLevel: "high",
    priority: "P1",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "光明日报",
    platform: "website",
    contentType: "official_primary",
    trustLevel: "high",
    priority: "P1",
    verificationStatus: "verified",
    regionScopes: [],
  },
];

// ─── 政府政策 (website) ───
const governmentPolicy: SeedSource[] = [
  {
    name: "中国政府网",
    platform: "website",
    contentType: "government_policy",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "广东省政府网",
    platform: "website",
    contentType: "local_official",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: ["广东"],
  },
  {
    name: "湖南省政府网",
    platform: "website",
    contentType: "local_official",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: ["湖南"],
  },
];

// ─── 公众号 (wechat) ───
const wechatSources: SeedSource[] = [
  {
    name: "人民日报评论",
    platform: "wechat",
    contentType: "wechat_official",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "半月谈",
    platform: "wechat",
    contentType: "wechat_official",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "新华每日电讯",
    platform: "wechat",
    contentType: "wechat_official",
    trustLevel: "high",
    priority: "P1",
    verificationStatus: "verified",
    regionScopes: [],
  },
  {
    name: "广东发布",
    platform: "wechat",
    contentType: "wechat_official",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: ["广东"],
  },
  {
    name: "湖南日报",
    platform: "wechat",
    contentType: "wechat_official",
    trustLevel: "high",
    priority: "P0",
    verificationStatus: "verified",
    regionScopes: ["湖南"],
  },
];

// ─── B站 (bilibili) ───
const bilibiliSources: SeedSource[] = [
  {
    name: "公考隔壁班王老师",
    platform: "bilibili",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    externalId: "497178825",
    profileUrl: "https://space.bilibili.com/497178825",
    verificationStatus: "pending",
    regionScopes: [],
  },
  {
    name: "笔杆子养成",
    platform: "bilibili",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    externalId: "1017375487",
    profileUrl: "https://space.bilibili.com/1017375487",
    verificationStatus: "pending",
    regionScopes: [],
  },
  {
    name: "好想吃西瓜瓜瓜瓜",
    platform: "bilibili",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    externalId: "394663982",
    profileUrl: "https://space.bilibili.com/394663982",
    verificationStatus: "pending",
    regionScopes: [],
  },
  {
    name: "公考章晓铭",
    platform: "bilibili",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    externalId: "488609381",
    profileUrl: "https://space.bilibili.com/488609381",
    verificationStatus: "pending",
    regionScopes: [],
  },
  {
    name: "王开心上岸啦",
    platform: "bilibili",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    externalId: "1526197189",
    profileUrl: "https://space.bilibili.com/1526197189",
    verificationStatus: "pending",
    regionScopes: [],
  },
];

// ─── 小红书 (xiaohongshu) ───
const xiaohongshuSources: SeedSource[] = [
  {
    name: "公考陈鲁",
    platform: "xiaohongshu",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    verificationStatus: "pending",
    regionScopes: [],
  },
  {
    name: "申论日记本",
    platform: "xiaohongshu",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    verificationStatus: "pending",
    regionScopes: [],
  },
  {
    name: "蝴蝶梦境",
    platform: "xiaohongshu",
    contentType: "creator_content",
    trustLevel: "standard",
    priority: "P0",
    verificationStatus: "pending",
    regionScopes: [],
  },
];

const ALL_SOURCES: SeedSource[] = [
  ...officialCore,
  ...governmentPolicy,
  ...wechatSources,
  ...bilibiliSources,
  ...xiaohongshuSources,
];

async function main() {
  console.log(`开始导入 ${ALL_SOURCES.length} 条来源记录...`);

  let created = 0;
  let skipped = 0;

  for (const src of ALL_SOURCES) {
    // 按 externalId+platform 去重
    const existing = src.externalId
      ? await db.source.findFirst({
          where: {
            externalId: src.externalId,
            platform: src.platform,
          },
        })
      : await db.source.findFirst({
          where: {
            name: src.name,
            platform: src.platform,
          },
        });

    if (existing) {
      console.log(`  跳过（已存在）: ${src.name} [${src.platform}]`);
      skipped++;
      continue;
    }

    await db.source.create({
      data: {
        name: src.name,
        externalId: src.externalId ?? null,
        platform: src.platform,
        contentType: src.contentType,
        trustLevel: src.trustLevel,
        priority: src.priority,
        regionScopes: JSON.stringify(src.regionScopes),
        verificationStatus: src.verificationStatus,
        baseUrl: src.baseUrl ?? null,
        profileUrl: src.profileUrl ?? null,
        keywords: JSON.stringify(src.keywords ?? []),
        collectionMode: src.collectionMode ?? null,
      },
    });

    console.log(`  创建: ${src.name} [${src.platform}]`);
    created++;
  }

  console.log(`\n导入完成: 创建 ${created} 条, 跳过 ${skipped} 条`);
}

main()
  .catch((e) => {
    console.error("种子脚本执行失败:", e);
    process.exit(1);
  })
  .finally(() => {
    db.$disconnect();
  });
