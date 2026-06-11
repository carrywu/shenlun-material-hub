-- 采集噪音历史数据清理脚本
-- 用途：清理 wewe-rss 被微信风控期间产生的"全文过短"验证页误判数据，
--       以及同 contentHash 的重复验证页。
--
-- ⚠️ 安全说明：
--   1. 执行前必须先 pg_dump 备份（见配套 cleanup-collector-noise.md）。
--   2. 本脚本默认所有写操作都被注释。先跑 DRY-RUN 的 SELECT 看影响行数，
--      确认无误后手动取消注释执行。
--   3. 整个清理在单个事务里（BEGIN/COMMIT），出问题可 ROLLBACK。
--
-- 背景：2026-06-10 19:41 UTC wewe-rss 被微信风控，"浙江宣传" 等 wechat 源
--       拉到的全是验证页 HTML（"环境异常 / 完成验证后即可继续访问"）。
--       当时代码的 detectWechatBlockPage 还没加"环境异常"关键词，
--       被误判为"全文过短（26 字）"写入 filtered。
--       commit 36012c7 (2026-06-11) 已修复识别逻辑，但历史数据需手动迁移。

-- ════════════════════════════════════════════════════════════════
-- DRY-RUN：先看会改多少行（直接跑下面这些 SELECT，不需要取消注释）
-- ════════════════════════════════════════════════════════════════

-- Step 1 预检：将被改为 blocked 的"全文过短+环境异常"记录数（预期 10）
SELECT COUNT(*) AS will_relabel_to_blocked
FROM "ContentItem"
WHERE "filterReason" LIKE '全文过短%（26 字）%'
  AND "fullText" LIKE '%环境异常%';

-- Step 1 明细：列出这些记录的标题/URL/源，人工核对
SELECT
  s.name AS source,
  ci.title,
  ci."originalUrl",
  ci."effectiveTextLength",
  ci."processingStatus",
  ci."filterReason"
FROM "ContentItem" ci
JOIN "Source" s ON s.id = ci."sourceId"
WHERE ci."filterReason" LIKE '全文过短%（26 字）%'
  AND ci."fullText" LIKE '%环境异常%'
ORDER BY ci."createdAt";

-- Step 2 预检：将被删除的同 hash 重复验证页记录数
SELECT
  "contentHash",
  COUNT(*) AS dup_count,
  COUNT(*) - 1 AS will_delete
FROM "ContentItem"
WHERE "processingStatus" IN ('blocked', 'filtered')
  AND "contentHash" IS NOT NULL
GROUP BY "contentHash"
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;


-- ════════════════════════════════════════════════════════════════
-- 实际执行：确认 DRY-RUN 行数无误后，取消下面注释、整段执行
-- ════════════════════════════════════════════════════════════════

-- BEGIN;

-- -- Step 1: 历史"全文过短"的验证页 → 改为 blocked（语义更准确，便于排查）
-- UPDATE "ContentItem"
-- SET "processingStatus" = 'blocked',
--     "filterReason" = '微信封禁/验证页面（历史数据迁移，原误判为全文过短）',
--     "qualityStatus" = 'blocked'
-- WHERE "filterReason" LIKE '全文过短%（26 字）%'
--   AND "fullText" LIKE '%环境异常%';

-- -- Step 2: 同 contentHash 的重复验证页，每组保留最早一条（最小 createdAt 对应的 id）
-- --         注意：必须在 Step 1 之后跑（此时验证页已是 blocked，会被纳入查重）
-- DELETE FROM "ContentItem"
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT
--       id,
--       ROW_NUMBER() OVER (
--         PARTITION BY "contentHash", title
--         ORDER BY "createdAt" ASC
--       ) AS rn
--     FROM "ContentItem"
--     WHERE "processingStatus" = 'blocked'
--       AND "contentHash" IS NOT NULL
--   ) t
--   WHERE rn > 1
-- );

-- -- 确认结果后再 COMMIT；不满意则 ROLLBACK
-- -- COMMIT;
-- -- ROLLBACK;


-- ════════════════════════════════════════════════════════════════
-- 执行后验证
-- ════════════════════════════════════════════════════════════════

-- 验证 1：浙江宣传应不再有 filtered 的"全文过短（26 字）"
-- SELECT "processingStatus", "filterReason", COUNT(*) FROM "ContentItem"
-- WHERE "sourceId" IN (SELECT id FROM "Source" WHERE name = '浙江宣传')
-- GROUP BY "processingStatus", "filterReason";

-- 验证 2：blocked 中不应再有同 contentHash 重复
-- SELECT "contentHash", COUNT(*) FROM "ContentItem"
-- WHERE "processingStatus" = 'blocked' AND "contentHash" IS NOT NULL
-- GROUP BY "contentHash" HAVING COUNT(*) > 1;
