import { CollectResult, saveArticles } from "./collector";
import { peopleCollector } from "./sources/people";
import { opinionCollector } from "./sources/opinion";
import { banyuetanCollector } from "./sources/banyuetan";
import { govCollector } from "./sources/gov";

const collectors = [
  peopleCollector,
  opinionCollector,
  banyuetanCollector,
  govCollector,
];

// 顺序执行所有来源采集
export async function runCollectAll(): Promise<CollectResult[]> {
  const results: CollectResult[] = [];

  for (const collector of collectors) {
    const result: CollectResult = {
      source: collector.sourceName,
      collected: 0,
      saved: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const articles = await collector.collect();
      result.collected = articles.length;

      if (articles.length > 0) {
        const saveResult = await saveArticles(articles);
        result.saved = saveResult.saved;
        result.skipped = saveResult.skipped;
        result.errors.push(...saveResult.errors);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`采集失败: ${msg}`);
    }

    results.push(result);
  }

  return results;
}

// 执行单个来源采集
export async function runCollectSource(
  sourceName: string
): Promise<CollectResult> {
  const collector = collectors.find((c) => c.sourceName === sourceName);
  if (!collector) {
    return {
      source: sourceName,
      collected: 0,
      saved: 0,
      skipped: 0,
      errors: [`未知来源: ${sourceName}`],
    };
  }

  const result: CollectResult = {
    source: collector.sourceName,
    collected: 0,
    saved: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const articles = await collector.collect();
    result.collected = articles.length;

    if (articles.length > 0) {
      const saveResult = await saveArticles(articles);
      result.saved = saveResult.saved;
      result.skipped = saveResult.skipped;
      result.errors.push(...saveResult.errors);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`采集失败: ${msg}`);
  }

  return result;
}
