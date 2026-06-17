-- P1-1: 拆分 reject / downlist 为两个独立状态（需求 6）
--
-- 背景：此前 adminReviewStatus 只有 pending_ai / pending_admin / approved / rejected，
-- reject 同时承载「审核拒绝」与「已上线文章下架」两种语义。现新增 downlist 表示
-- 「曾上线后被下架」，与 reject（审核未通过/从未上线）分离。
--
-- adminReviewStatus 为 String 列（非 enum），新增值无需改列类型，无需 DDL。
-- 本迁移仅做历史数据回填：把「曾经上线过（publicVisibleAt 非空）的 rejected」
-- 重新归类为 downlist。从未上线的 rejected 保持 rejected。
--
-- 安全性：只 UPDATE，不删除任何行；幂等（WHERE 限定 rejected + publicVisibleAt 非空）。

UPDATE "ContentItem"
SET "adminReviewStatus" = 'downlist'
WHERE "adminReviewStatus" = 'rejected'
  AND "publicVisibleAt" IS NOT NULL;
