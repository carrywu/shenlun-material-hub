# 搜索架构设计

> P3-2: 搜索优化（pg_trgm / MeiliSearch）+ P3-8: 向量搜索评估
> 状态：规划中（当前使用 LIKE 查询，满足 MVP 需求）

## 现状

当前搜索实现在 `src/app/api/search/route.ts`，使用 Prisma `contains`（底层为 `LIKE '%query%'`）在以下字段中匹配：

```ts
where.OR = [
  { title: { contains: query } },
  { aiSummary: { contains: query } },
  { markdownContent: { contains: query } },
  { originalFacts: { contains: query } },
];
```

**问题**：
- `LIKE '%x%'` 无法利用 B-tree 索引，全表扫描
- 中文分词不支持（搜索"申论"无法匹配"申论考试"以外文本）
- 无相关性排序，仅按 `createdAt` 降序
- 随数据量增长性能线性退化

## 方案评估

### 方案 A：PostgreSQL pg_trgm GIN 索引（推荐第一阶段）

**原理**：三字符组（trigram）索引，支持 `LIKE`/`ILIKE` 加速和模糊匹配。

**优势**：
- 纯 PostgreSQL 扩展，无额外服务
- 对中文有一定效果（UTF-8 字节级别 trigram）
- GIN 索引支持前缀/子串/模糊搜索
- 返回 `<->` 距离分数，可做简单相关性排序

**限制**：
- 中文分词不如专用分词器（zhparser / jieba）
- GIN 索引占用空间约为原表 1-2 倍
- 相关性排序不如 BM25 精确

**实施步骤**：

```sql
-- 1. 启用扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 创建 GIN 索引
CREATE INDEX idx_material_card_title_trgm ON "MaterialCard" USING GIN (title gin_trgm_ops);
CREATE INDEX idx_material_card_ai_summary_trgm ON "MaterialCard" USING GIN ("aiSummary" gin_trgm_ops);

-- 3. 查询改写
SELECT *, similarity(title, '申论金句') AS s
FROM "MaterialCard"
WHERE title % '申论金句'
ORDER BY s DESC;
```

**Prisma 层**：使用 `$queryRaw` 或 `$queryRawUnsafe` 执行原生 SQL。

### 方案 B：MeiliSearch（推荐第二阶段）

**适用场景**：数据量 > 10 万条，需要亚秒级搜索、中文分词、typo 容错。

**优势**：
- 内置中文分词（基于 jieba）
- Typo 容错、同义词、停用词
- 增量索引，实时搜索
- 支持筛选、排序、分面

**成本**：
- 需要独立服务（Docker / Managed）
- 数据双写（PostgreSQL + MeiliSearch）
- 索引同步维护

**架构**：

```
写入流程:
  ContentItem/MaterialCard CRUD → PostgreSQL
                                → MeiliSearch (via webhook / queue)

搜索流程:
  前端 → /api/search → MeiliSearch SDK → 返回结果
```

### 方案 C：向量搜索（第三阶段 / 与 AI 功能集成）

**原理**：将文本转为 embedding 向量，通过余弦相似度搜索语义相关内容。

**适用场景**：
- "查找与这段素材相似的案例"
- 跨卡片类型语义搜索
- AI 推荐相关素材

**技术选型**：

| 选项 | 向量存储 | 嵌入模型 | 备注 |
|------|---------|---------|------|
| pgvector | PostgreSQL 扩展 | OpenAI / 本地模型 | 无需额外服务 |
| Qdrant | 独立向量数据库 | OpenAI / 本地模型 | 高性能，适合大规模 |
| Supabase pgvector | 托管 pgvector | Edge Functions | 简化运维 |

**Schema 扩展**：

```prisma
model MaterialCardEmbedding {
  id        String   @id @default(cuid())
  cardId    String   @unique
  embedding Unsupported("vector(1536)")?
  model     String?  // "text-embedding-3-small" 等
  updatedAt DateTime @updatedAt

  card MaterialCard @relation(fields: [cardId], references: [id])
}
```

**查询示例**：

```sql
SELECT mc.*, 1 - (e.embedding <=> $1::vector) AS similarity
FROM "MaterialCardEmbedding" e
JOIN "MaterialCard" mc ON mc.id = e."cardId"
ORDER BY e.embedding <=> $1::vector
LIMIT 20;
```

## 推荐路线

```
Phase 1 (当前 → 数据量 < 5 万):
  pg_trgm GIN 索引 + similarity() 排序
  改造 /api/search 使用原生 SQL
  预计工作量：2-3 天

Phase 2 (数据量 5-10 万):
  引入 MeiliSearch
  Webhook/队列同步索引
  前端搜索体验升级（搜索建议、高亮）
  预计工作量：5-7 天

Phase 3 (AI 功能成熟后):
  pgvector 向量搜索
  嵌入生成流水线（新卡片 / 定期全量）
  语义搜索 API
  预计工作量：5-7 天
```

## 决策标准

| 指标 | Phase 1 触发 | Phase 2 触发 | Phase 3 触发 |
|------|-------------|-------------|-------------|
| 卡片数量 | > 5,000 | > 50,000 | AI 功能需求 |
| 搜索延迟 | > 500ms | > 200ms | 语义搜索需求 |
| 用户反馈 | 搜不到 | 搜索不够智能 | 需要相似推荐 |

## 参考文件

- `src/app/api/search/route.ts` — 当前搜索实现
- `prisma/schema.prisma` — 数据模型
- `src/services/ai.ts` — AI 服务（嵌入模型集成点）
