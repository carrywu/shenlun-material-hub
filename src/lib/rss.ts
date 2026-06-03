import Parser from "rss-parser";

export interface CustomRssItem {
  id?: string;
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  pubDate?: string;
  creator?: string;
  categories?: string[];
  "content:encoded"?: string;
  guid?: string;
}

export interface CustomRssFeed {
  title?: string;
  description?: string;
  link?: string;
  feedUrl?: string;
  items: CustomRssItem[];
}

const parser = new Parser<CustomRssFeed, CustomRssItem>({
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["dc:creator", "creator"],
      ["description", "contentSnippet"],
    ],
  },
  timeout: 15000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/rss+xml,application/xml,application/atom+xml,text/xml,*/*;q=0.9",
  },
});

export async function parseRssUrl(url: string): Promise<CustomRssFeed> {
  try {
    const feed = await parser.parseURL(url);
    return feed as CustomRssFeed;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`解析 RSS 失败 (${url}): ${msg}`);
  }
}
