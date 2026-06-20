# 广东省政府网来源采集质量优化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把广东省政府网来源的低质新闻动态栏目换成高素材密度的政策文件栏目，删除该源 77 篇 AI reject 旧文章，同步 seed 脚本。

**Architecture:** 纯配置 + 数据操作，不写业务代码。线上 DB 配置走 `docker exec psql`（连库稳定，不走 SSH 隧道）。seed 脚本对已存在 channel 是"跳过不更新"，所以线上调整必须直接 UPDATE，seed 改动只为留档 + 停用机制。

**Tech Stack:** PostgreSQL（docker exec psql）、Prisma seed 脚本（`src/scripts/seed-channels.ts`）。

## Global Constraints

- 生产连库方式：`ssh root@47.119.182.210` → `docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub`。**禁止**本地 SSH 隧道跑长任务（ECONNRESET）。
- 生产服务器磁盘紧张（约 8.6G 可用），**禁止**在生产宿主机 pnpm install / 装 Node 工具链。
- 所有写库操作前 `pg_dump` 备份；破坏性操作（DELETE/UPDATE）走单事务，dry-run 先行。
- 广东源 sourceId = `cmpwg2e900006lxvy784oa3rz`（已核实）。
- SQL 里的列名是 camelCase（Prisma 默认无 @map），必须双引号：`"maxPages"`、`"isEnabled"`、`"aiDecision"`、`"sourceId"` 等。
- shell 多层转义会吞引号，复杂 SQL 写进 `.sql` 文件 `scp` 进容器再 `-f` 执行。
- 不动 collector（`guangdongOfficial.ts`）、content-filter、schema、ai.ts。

---

## File Structure

- Modify: `src/scripts/seed-channels.ts` — 广东源段落：bmdt 移入 DEPRECATED、dsdt maxPages 改 1、新增 wjk + zcjd 两条
- Data: 生产 DB `CollectionChannel`（停用/降页数/新增）+ `ContentItem`（删 77 篇 reject）
- 无新增源码文件

---

## Task 1: 备份生产库

**Files:** 无（纯运维）

**Interfaces:** Produces 备份文件路径，后续任务的回滚依赖它。

- [ ] **Step 1: 备份并校验**

```bash
ssh root@47.119.182.210 'TS=$(date +%Y%m%d-%H%M%S)
docker exec shenlun-material-hub-postgres-1 pg_dump -U shenlun -d shenlun_material_hub -Fc > /opt/backups/shenlun-gdquality-$TS.dump
ls -lh /opt/backups/shenlun-gdquality-$TS.dump
docker cp /opt/backups/shenlun-gdquality-$TS.dump shenlun-material-hub-postgres-1:/tmp/v.dump >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 pg_restore -l /tmp/v.dump >/dev/null 2>&1 && echo BACKUP_OK || echo BACKUP_BAD
docker exec shenlun-material-hub-postgres-1 rm -f /tmp/v.dump
echo "TS=$TS"'
```

Expected: `BACKUP_OK`，记下 TS 值。

- [ ] **Step 2: 记录备份路径**

把 `shenlun-gdquality-<TS>.dump` 写进本计划的回滚章节。

---

## Task 2: 调整线上 CollectionChannel 配置

**Files:** 无（DB UPDATE/INSERT）

**Interfaces:** Consumes Task 1 备份。Produces 线上栏目新配置。

- [ ] **Step 1: 写配置变更 SQL 到文件**

本地创建 `/tmp/gd-config.sql`：

```sql
\echo '=== 调整前 ==='
SELECT name, "maxPages", "isEnabled" FROM "CollectionChannel"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' ORDER BY name;

BEGIN;
-- 停用部门动态（拒率 61%）
UPDATE "CollectionChannel" SET "isEnabled"=false
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND name='部门动态';
-- 地市动态降页数 3→1
UPDATE "CollectionChannel" SET "maxPages"=1
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND name='地市动态';
-- 新增政府文件库
INSERT INTO "CollectionChannel" ("id","sourceId","name","listUrl","urlPattern","maxPages","isEnabled","collectedCount","createdAt","updatedAt")
VALUES (gen_random_uuid()::text, 'cmpwg2e900006lxvy784oa3rz', '政府文件库',
  'https://www.gd.gov.cn/zwgk/wjk/qbwj/index.html', 'content/post_\d+\.html', 3, true, 0, now(), now());
-- 新增政策解读
INSERT INTO "CollectionChannel" ("id","sourceId","name","listUrl","urlPattern","maxPages","isEnabled","collectedCount","createdAt","updatedAt")
VALUES (gen_random_uuid()::text, 'cmpwg2e900006lxvy784oa3rz', '政策解读',
  'https://www.gd.gov.cn/zwgk/zcjd/bmjd/index.html', 'content/post_\d+\.html', 3, true, 0, now(), now());

\echo '=== 调整后（事务内）==='
SELECT name, "maxPages", "isEnabled" FROM "CollectionChannel"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' ORDER BY name;

COMMIT;
```

注意：`gen_random_uuid()` 转 text 作 cuid 替代（CollectionChannel.id 是 String，非强校验 cuid 格式）。若 PG 无 `gen_random_uuid`，改用 `md5(random()::text)||clock_timestamp()::text` 截断。

- [ ] **Step 2: scp 进容器执行**

```bash
scp /tmp/gd-config.sql root@47.119.182.210:/tmp/gd-config.sql
ssh root@47.119.182.210 'docker cp /tmp/gd-config.sql shenlun-material-hub-postgres-1:/tmp/gd-config.sql >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -P pager=off -f /tmp/gd-config.sql
rm -f /tmp/gd-config.sql'
```

Expected: 调整后 5 行——部门动态 isEnabled=f、地市动态 maxPages=1、执法监管不变、政府文件库 + 政策解读 isEnabled=t。

- [ ] **Step 3: 独立复核**

```bash
cat > /tmp/verify-config.sql <<'SQL'
SELECT name, "maxPages", "isEnabled", "listUrl" FROM "CollectionChannel"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' ORDER BY name;
SQL
scp /tmp/verify-config.sql root@47.119.182.210:/tmp/v.sql
ssh root@47.119.182.210 'docker cp /tmp/v.sql shenlun-material-hub-postgres-1:/tmp/v.sql >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -P pager=off -f /tmp/v.sql
rm -f /tmp/v.sql'
```

Expected: 5 行，配置与 Step 2 一致。

---

## Task 3: 验证新栏目可采集

**Files:** 无（触发采集 + 只读核对）

**Interfaces:** Consumes Task 2 配置。Produces 采集验证结果。失败则回滚 Task 2。

- [ ] **Step 1: 触发广东源采集**

需要 admin token。若无现成 token，在 app 容器内用项目逻辑触发，或通过管理后台手动触发一次广东源采集。

记录采集开始时间。

- [ ] **Step 2: 核对新栏目是否抓到正文**

```bash
cat > /tmp/verify-collect.sql <<'SQL'
SELECT ch.name, COUNT(*) AS n,
  SUM(CASE WHEN c."effectiveTextLength" > 0 THEN 1 ELSE 0 END) AS has_text
FROM "ContentItem" c
JOIN "CollectionChannel" ch ON ch.id=c."channelId"
WHERE ch."sourceId"='cmpwg2e900006lxvy784oa3rz'
  AND ch.name IN ('政府文件库','政策解读')
GROUP BY ch.name;
SQL
scp /tmp/verify-collect.sql root@47.119.182.210:/tmp/vc.sql
ssh root@47.119.182.210 'docker cp /tmp/vc.sql shenlun-material-hub-postgres-1:/tmp/vc.sql >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -P pager=off -f /tmp/vc.sql
rm -f /tmp/vc.sql'
```

Expected: 两个新栏目各 `has_text > 0`（抓到有正文的文章）。

- [ ] **Step 3: 失败则回滚 Task 2**

若新栏目 `has_text = 0`（抓不到），说明 collector 对 `/zwgk/` 列表页结构不兼容。回滚：

```bash
ssh root@47.119.182.210 'docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -c "
DELETE FROM \"CollectionChannel\" WHERE \"sourceId\"='\''cmpwg2e900006lxvy784oa3rz'\'' AND name IN ('\''政府文件库'\'','\''政策解读'\'');"'
```

并报告，停下重新设计（可能需给新栏目调 urlPattern 或 collector）。

---

## Task 4: 删除广东源 77 篇 AI reject

**Files:** 无（DB DELETE）

**Interfaces:** Consumes Task 1 备份。Produces 删除结果。

- [ ] **Step 1: dry-run 预览**

```bash
cat > /tmp/gd-delete.sql <<'SQL'
\echo '=== 待删除范围 ==='
SELECT "contentGenre", COUNT(*) n
FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND "aiDecision"='reject'
GROUP BY 1 ORDER BY n DESC;

SELECT COUNT(*) AS total_will_delete
FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND "aiDecision"='reject';
SQL
scp /tmp/gd-delete.sql root@47.119.182.210:/tmp/gd.sql
ssh root@47.119.182.210 'docker cp /tmp/gd.sql shenlun-material-hub-postgres-1:/tmp/gd.sql >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -P pager=off -f /tmp/gd.sql
rm -f /tmp/gd.sql'
```

Expected: `total_will_delete = 77`（体裁：ordinary_news 58 + meeting_news 11 + notice 7 + case_practice 1）。若不是 77，停下核对。

- [ ] **Step 2: 单事务删除 + 核对**

```bash
cat > /tmp/gd-delete-exec.sql <<'SQL'
BEGIN;
SELECT COUNT(*)::int AS before FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND "aiDecision"='reject';

DELETE FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND "aiDecision"='reject';

SELECT COUNT(*)::int AS after FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' AND "aiDecision"='reject';
SELECT COUNT(*)::int AS total FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz';
COMMIT;
SQL
scp /tmp/gd-delete-exec.sql root@47.119.182.210:/tmp/gde.sql
ssh root@47.119.182.210 'docker cp /tmp/gde.sql shenlun-material-hub-postgres-1:/tmp/gde.sql >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -P pager=off -f /tmp/gde.sql
rm -f /tmp/gde.sql'
```

Expected: before=77, DELETE 77, after=0, total 减少 77。

---

## Task 5: 同步 seed-channels.ts

**Files:**
- Modify: `src/scripts/seed-channels.ts:44-65`（广东源 CHANNEL_SEEDS 段落）
- Modify: `src/scripts/seed-channels.ts:93`（DEPRECATED 数组）

**Interfaces:** Consumes Task 2 线上配置（作为留档基准）。Produces seed 脚本一致性。

注意：seed 对已存在 channel 跳过不更新（line 138-142），所以本任务**不依赖重跑 seed 生效**，只是留档 + 防止以后误用旧配置新建。

- [ ] **Step 1: 改 CHANNEL_SEEDS 广东段落**

把 `src/scripts/seed-channels.ts:44-65` 替换为：

```typescript
  // ─── 广东省政府网（2026-06-20 优化：停用低质动态栏目，新增政策类高质栏目）───
  // 部门动态已停用（拒率 61%），不在此 seed；地市动态降为 1 页
  {
    sourceName: "广东省政府网",
    name: "地市动态",
    listUrl: "https://www.gd.gov.cn/gdywdt/dsdt/index.html",
    urlPattern: "content/post_\\d+\\.html",
    maxPages: 1,
  },
  {
    sourceName: "广东省政府网",
    name: "执法监管",
    listUrl: "https://www.gd.gov.cn/gdywdt/zfjg/index.html",
    urlPattern: "content/post_\\d+\\.html",
    maxPages: 3,
  },
  {
    sourceName: "广东省政府网",
    name: "政府文件库",
    listUrl: "https://www.gd.gov.cn/zwgk/wjk/qbwj/index.html",
    urlPattern: "content/post_\\d+\\.html",
    maxPages: 3,
  },
  {
    sourceName: "广东省政府网",
    name: "政策解读",
    listUrl: "https://www.gd.gov.cn/zwgk/zcjd/bmjd/index.html",
    urlPattern: "content/post_\\d+\\.html",
    maxPages: 3,
  },
```

- [ ] **Step 2: 改 DEPRECATED 数组**

把 `src/scripts/seed-channels.ts:93`：

```typescript
const DEPRECATED_GUANGDONG_CHANNELS = ["政策解读", "政务专题"];
```

改为：

```typescript
const DEPRECATED_GUANGDONG_CHANNELS = ["政策解读", "政务专题", "部门动态"];
```

注意："政策解读"在 DEPRECATED 里是旧的同名旧栏目（listUrl 不同）。新 seed 会创建新的"政策解读"（listUrl=/zwgk/zcjd/）。若担心命名冲突，把新栏目改名为"政策解读·部门"避免 DEPRECATED 误伤——但 DEPRECATED 逻辑按 name 停用，新 seed 先于 DEPRECATED 执行需确认顺序。**保守做法**：新栏目命名为 `政策解读（部门）` 区分。

- [ ] **Step 3: lint 验证**

```bash
pnpm lint
```

Expected: 通过，无新增报错。

- [ ] **Step 4: preflight 回归**

```bash
pnpm harness:preflight
```

Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add src/scripts/seed-channels.ts
git commit -m "chore(seed): 优化广东源栏目配置——停用部门动态、地市动态降页、新增政策类栏目"
```

---

## Task 6: 最终核对 + 清理临时文件

**Files:** 无

- [ ] **Step 1: 最终配置核对**

```bash
cat > /tmp/final.sql <<'SQL'
\echo '=== 广东源栏目终态 ==='
SELECT name, "maxPages", "isEnabled", "collectedCount" FROM "CollectionChannel"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' ORDER BY name;
\echo '=== 广东源 aiDecision 分布 ==='
SELECT "aiDecision", COUNT(*) FROM "ContentItem"
WHERE "sourceId"='cmpwg2e900006lxvy784oa3rz' GROUP BY 1;
SQL
scp /tmp/final.sql root@47.119.182.210:/tmp/f.sql
ssh root@47.119.182.210 'docker cp /tmp/f.sql shenlun-material-hub-postgres-1:/tmp/f.sql >/dev/null 2>&1
docker exec shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub -P pager=off -f /tmp/f.sql
rm -f /tmp/f.sql'
```

Expected: bmdt isEnabled=f，dsdt maxPages=1，wjk+zcjd 启用；reject=0。

- [ ] **Step 2: 清理本地临时 SQL**

```bash
rm -f /tmp/gd-*.sql /tmp/verify-*.sql /tmp/final.sql /tmp/v.sql /tmp/vc.sql
```

- [ ] **Step 3: 更新 handoff 文档**

按项目规则更新 `docs/audit/development-handoff.md`，记录本次广东源优化。

---

## 回滚

- 备份：`/opt/backups/shenlun-gdquality-<TS>.dump`（Task 1 产出）
- 全库恢复（慎用，会覆盖后续所有变更）：
  ```bash
  docker exec -i shenlun-material-hub-postgres-1 pg_restore -U shenlun -d shenlun_material_hub -c < /opt/backups/shenlun-gdquality-<TS>.dump
  ```
- 配置局部回滚（不动数据）：把 channel isEnabled/maxPages 改回，删掉新增两条。
- 删除不可逆，靠备份恢复。

## 不做（YAGNI）

- 不写 content-filter 来源级规则代码
- 不动 collector / ai.ts / schema
- 不做套话密度算法
- 不清理其他源的 reject
