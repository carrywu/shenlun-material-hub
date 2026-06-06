# 来源质量自动降权设计

> P3-7: 来源质量评分 → 自动降权阈值
> 状态：规划中（已有 A-F 评分，缺自动处置逻辑）

## 背景

`src/services/source-quality.ts` 已实现来源质量评分系统：

**综合分公式**：
```
composite = hitRate × 0.4 + (1 - filterRate) × 0.2 + normalizedAiScore × 0.3 + effectiveRate × 0.1
```

**等级映射**：

| 等级 | 综合分范围 | 含义 |
|------|-----------|------|
| A | ≥ 0.8 | 优质来源 |
| B | 0.6 – 0.8 | 良好来源 |
| C | 0.4 – 0.6 | 一般来源 |
| D | 0.2 – 0.4 | 低质量来源 |
| F | < 0.2 | 无效来源 |

**当前指标字段**（Source 表）：
- `hitRate` — 命中率（accepted / total）
- `filterRate` — 过滤率（filtered / total）
- `effectiveRate` — 有效率（(accepted + candidate) / total）
- `avgAiScore` — 平均 AI 分
- `sourceGrade` — A-F 等级
- `metricsUpdatedAt` — 指标更新时间

## 问题

1. **F 级来源持续消耗资源**：采集、入库、AI 评分，但产出为 0
2. **D 级来源缺乏干预**：大量低质量内容进入审核队列
3. **无自动处置**：所有来源永远活跃，依赖管理员手动归档

## 自动降权策略

### 阈值与动作

| 等级 | 持续时长 | 自动动作 | 通知 |
|------|---------|---------|------|
| **F** | ≥ 30 天 | 自动归档（`archivedAt = now()`） | 邮件/站内通知管理员 |
| **F** | ≥ 7 天 | 标记为"待归档"（前端显示警告） | 站内通知 |
| **D** | ≥ 60 天 | 降权（采集频率降低 50%） | 站内通知 |
| **D** | ≥ 30 天 | 标记为"待审查"（加入审查队列） | — |
| **C** | ≥ 90 天 | 提醒管理员审查 | — |
| **B** | — | 无动作 | — |
| **A** | — | 可提高采集频率 | — |

### 保护机制

为避免误判，设置以下保护条件：

1. **最少样本量**：来源必须至少有 20 篇文章才参与自动降权
2. **宽限期**：新来源前 14 天不参与降权评估
3. **人工覆写**：管理员可标记来源为 `protected: true`，豁免自动归档
4. **回升机制**：归档来源如恢复采集，重新计算指标后可自动解除归档

## Schema 扩展

```prisma
model Source {
  // ... existing fields

  /// 自动降权保护：管理员手动标记
  protected         Boolean    @default(false)

  /// 降权状态跟踪
  downweightStatus  String?    // pending_review | pending_archive | archived_auto
  downweightSince   DateTime?  // 首次进入 D/F 级别的时间
  autoArchivedAt    DateTime?  // 自动归档时间

  /// 采集频率（分钟），null = 使用全局默认
  collectIntervalMinutes Int?
}
```

## 自动评估服务

### 定时任务

建议通过 cron job 或 Next.js API Route + 外部调度器（如 `node-cron`）每日运行：

```ts
// src/services/source-downweight.ts

export async function evaluateDownweight(): Promise<{
  reviewed: number;
  pendingReview: number;
  archived: number;
}> {
  const sources = await db.source.findMany({
    where: {
      archivedAt: null,
      protected: false,
      createdAt: { lt: addDays(new Date(), -14) }, // 宽限期
    },
  });

  let pendingReview = 0;
  let archived = 0;

  for (const source of sources) {
    const itemCount = await db.contentItem.count({
      where: { sourceId: source.id },
    });

    // 最少样本量检查
    if (itemCount < 20) continue;

    const grade = source.sourceGrade;
    if (!grade) continue;

    const daysSinceDownweight = source.downweightSince
      ? daysBetween(source.downweightSince, new Date())
      : 0;

    // F 级处理
    if (grade === "F") {
      if (!source.downweightSince) {
        await db.source.update({
          where: { id: source.id },
          data: { downweightSince: new Date(), downweightStatus: "pending_archive" },
        });
        pendingReview++;
      } else if (daysSinceDownweight >= 30) {
        await db.source.update({
          where: { id: source.id },
          data: { archivedAt: new Date(), downweightStatus: "archived_auto", autoArchivedAt: new Date() },
        });
        archived++;
      } else if (daysSinceDownweight >= 7) {
        await db.source.update({
          where: { id: source.id },
          data: { downweightStatus: "pending_archive" },
        });
        pendingReview++;
      }
    }

    // D 级处理
    if (grade === "D") {
      if (!source.downweightSince) {
        await db.source.update({
          where: { id: source.id },
          data: { downweightSince: new Date(), downweightStatus: "pending_review" },
        });
        pendingReview++;
      } else if (daysSinceDownweight >= 60) {
        // 降权：将采集频率翻倍
        const currentInterval = source.collectIntervalMinutes ?? 60;
        await db.source.update({
          where: { id: source.id },
          data: { collectIntervalMinutes: currentInterval * 2 },
        });
      }
    }

    // 回升：等级恢复到 C 及以上时清除降权状态
    if (["A", "B", "C"].includes(grade) && source.downweightSince) {
      await db.source.update({
        where: { id: source.id },
        data: { downweightSince: null, downweightStatus: null },
      });
    }
  }

  return { reviewed: sources.length, pendingReview, archived };
}
```

### API 路由

```
POST /api/admin/source-downweight/evaluate

Response:
{
  "reviewed": 45,
  "pendingReview": 3,
  "archived": 1
}
```

管理员可手动触发评估，也可设置每日自动运行。

## 管理员 UI

### 来源管理页增强

在 `/sources` 页面增加降权状态显示：

| 列 | 说明 |
|----|------|
| 等级 | A-F 标签（颜色编码） |
| 降权状态 | 待审查 / 待归档 / 已自动归档 |
| 保护 | 🛡️ 图标（protected 来源） |

### 操作按钮

- **标记保护**：设置 `protected = true`，豁免自动降权
- **取消保护**：恢复自动降权评估
- **立即评估**：手动触发单来源评估
- **恢复归档**：清除 `archivedAt`，重新激活来源

## 参考文件

- `src/services/source-quality.ts` — 现有评分系统（`refreshSourceMetrics` / `refreshAllSourceMetrics` / `computeGrade`）
- `prisma/schema.prisma` — Source 表当前字段
- `src/app/admin/page.tsx` — 管理员仪表盘（展示来源统计的入口）
