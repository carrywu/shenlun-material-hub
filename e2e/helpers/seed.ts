/**
 * 测试数据确保工具 —— 通过 API 确保测试数据存在。
 * 找不到数据就 throw，不允许 skip。
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3001';

export interface ArticleData {
  id: string;
  platform?: string;
  title?: string;
}

export interface CardData {
  id: string;
  type?: string;
  title?: string;
}

export interface SourceData {
  id: string;
  name?: string;
  platform?: string;
}

/**
 * 确保至少有一篇文章，返回第一篇文章 ID。
 * 找不到就 throw。
 */
export async function ensureArticleExists(): Promise<ArticleData> {
  const res = await fetch(`${BASE_URL}/api/explore?pageSize=1`);
  if (!res.ok) throw new Error(`探索 API 返回 ${res.status}`);
  const json = await res.json();
  if (!json.data?.length) {
    throw new Error('没有文章数据，请先运行 pnpm seed:channels 并采集文章');
  }
  return { id: json.data[0].id, platform: json.data[0].platform, title: json.data[0].title };
}

/**
 * 确保至少有一篇微信文章，返回第一篇。
 * 找不到就 throw。
 */
export async function ensureWechatArticleExists(): Promise<ArticleData> {
  // 先尝试从 content-items 接口找微信文章
  const res = await fetch(`${BASE_URL}/api/content-items?platform=wechat&pageSize=5`);
  if (!res.ok) throw new Error(`content-items API 返回 ${res.status}`);
  const json = await res.json();
  if (!json.data?.length) {
    throw new Error('没有微信文章数据，请先导入微信文章');
  }
  return { id: json.data[0].id, platform: 'wechat', title: json.data[0].title };
}

/**
 * 确保至少有一张素材卡，返回第一张。
 * 找不到就 throw。
 */
export async function ensureCardExists(): Promise<CardData> {
  const res = await fetch(`${BASE_URL}/api/material-cards?pageSize=5`);
  if (!res.ok) throw new Error(`素材卡 API 返回 ${res.status}`);
  const json = await res.json();
  if (!json.data?.length) {
    throw new Error('没有素材卡数据，请先生成素材卡');
  }
  return { id: json.data[0].id, type: json.data[0].type, title: json.data[0].title };
}

/**
 * 确保至少有一个来源，返回第一个。
 * 找不到就 throw。
 */
export async function ensureSourceExists(): Promise<SourceData> {
  const res = await fetch(`${BASE_URL}/api/sources?pageSize=5`);
  if (!res.ok) throw new Error(`来源 API 返回 ${res.status}`);
  const json = await res.json();
  if (!json.data?.length) {
    throw new Error('没有来源数据，请先运行 pnpm seed:channels');
  }
  return { id: json.data[0].id, name: json.data[0].name, platform: json.data[0].platform };
}
