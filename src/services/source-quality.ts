import { db } from "@/lib/db";

/**
 * 来源质量评分服务
 * 基于 ContentItem 的 processingStatus / qualityStatus / aiScore 聚合计算。
 */

const GRADE_THRESHOLDS: [number, string][] = [
  [0.8, "A"],
  [0.6, "B"],
  [0.4, "C"],
  [0.2, "D"],
  [0, "F"],
];

export function computeGrade(compositeScore: number): string {
  for (const [threshold, grade] of GRADE_THRESHOLDS) {
    if (compositeScore >= threshold) return grade;
  }
  return "F";
}

/**
 * 计算单个来源的质量指标并写入 Source 表。
 */
export async function refreshSourceMetrics(sourceId: string): Promise<void> {
  const total = await db.contentItem.count({ where: { sourceId } });
  if (total === 0) {
    await db.source.update({
      where: { id: sourceId },
      data: {
        hitRate: 0,
        filterRate: 0,
        effectiveRate: 0,
        avgAiScore: null,
        sourceGrade: null,
        metricsUpdatedAt: new Date(),
      },
    });
    return;
  }

  const [filtered, accepted, candidate, avgResult] = await Promise.all([
    db.contentItem.count({
      where: { sourceId, processingStatus: "filtered" },
    }),
    db.contentItem.count({
      where: { sourceId, qualityStatus: "accepted" },
    }),
    db.contentItem.count({
      where: { sourceId, qualityStatus: "candidate" },
    }),
    db.contentItem.aggregate({
      where: { sourceId, aiScore: { not: null } },
      _avg: { aiScore: true },
    }),
  ]);

  const hitRate = accepted / total;
  const filterRate = filtered / total;
  const effectiveRate = (accepted + candidate) / total;
  const avgAiScore = avgResult._avg.aiScore;

  // 综合分 = 命中率*0.4 + (1-过滤率)*0.2 + 归一化AI分*0.3 + 有效率*0.1
  const normalizedAi = avgAiScore ? (avgAiScore - 1) / 9 : 0;
  const composite =
    hitRate * 0.4 +
    (1 - filterRate) * 0.2 +
    normalizedAi * 0.3 +
    effectiveRate * 0.1;

  const sourceGrade = computeGrade(composite);

  await db.source.update({
    where: { id: sourceId },
    data: {
      hitRate,
      filterRate,
      effectiveRate,
      avgAiScore,
      sourceGrade,
      metricsUpdatedAt: new Date(),
    },
  });
}

/**
 * 批量刷新所有未归档来源的质量指标。
 */
export async function refreshAllSourceMetrics(): Promise<number> {
  const sources = await db.source.findMany({
    where: { archivedAt: null },
    select: { id: true },
  });

  for (const source of sources) {
    await refreshSourceMetrics(source.id);
  }

  return sources.length;
}
