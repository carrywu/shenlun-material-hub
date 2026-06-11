# 采集噪音历史数据清理

> 配套脚本：`cleanup-collector-noise.sql`

## 什么时候需要跑

- 后台"文章管理"里看到大量 `processingStatus=filtered`、`filterReason=全文过短（26 字）` 且正文是微信验证页（"环境异常 / 完成验证后即可继续访问"）的记录。
- 这些是 wewe-rss 被微信风控期间、`detectWechatBlockPage` 关键词修复前（commit `36012c7`，2026-06-11）写入的误判数据。

## 为什么不能靠代码自动修复

`ContentItem.originalUrl` 有 `@unique` 约束。这些验证页记录的 URL 已存在，下次采集时 `findUnique(originalUrl)` 会直接命中返回，**根本走不到 `detectWechatBlockPage`**，所以历史记录永远不会被自动重判。必须人工迁移。

## 执行步骤

### 1. 备份（必做）

```bash
ssh root@47.119.182.210
cd /opt/shenlun-material-hub
TS=$(date +%Y%m%d-%H%M%S)
docker exec shenlun-material-hub-postgres-1 \
  pg_dump -U shenlun -d shenlun_material_hub \
  > /opt/backups/shenlun-${TS}.sql
ls -lh /opt/backups/shenlun-${TS}.sql   # 确认非空
```

### 2. DRY-RUN（看影响行数，不写库）

把 `cleanup-collector-noise.sql` 里 **DRY-RUN** 区块的三个 `SELECT` 复制到 psql 跑：

```bash
# 把 SQL 文件传进容器
docker cp scripts/ops/cleanup-collector-noise.sql shenlun-material-hub-postgres-1:/tmp/cleanup.sql
docker exec -it shenlun-material-hub-postgres-1 psql -U shenlun -d shenlun_material_hub
# 在 psql 里粘贴 DRY-RUN 的 SELECT
```

预期：
- `will_relabel_to_blocked` ≈ 10（浙江宣传那批）。
- Step 2 的 `will_delete` 是重复验证页数量。

### 3. 执行（确认 DRY-RUN 无误后）

在 psql 里：
1. 取消 `cleanup-collector-noise.sql` 里 **实际执行** 区块的注释（`BEGIN` / 两个写操作 / `COMMIT`）。
2. 先只取消 `BEGIN` + Step 1 + Step 2 注释，**保留 `COMMIT`/`ROLLBACK` 注释**。
3. 执行 `BEGIN` + Step 1 + Step 2。
4. 跑 **执行后验证** 区块的两个 SELECT 核对结果。
5. 满意 → `\commit`（或取消 `COMMIT` 注释执行）；不满意 → `\rollback`。

### 4. 回滚（万一）

事务未 COMMIT 前：`\rollback` 即可全部撤销。
已 COMMIT：用第 1 步的 pg_dump 恢复：

```bash
docker exec -i shenlun-material-hub-postgres-1 \
  psql -U shenlun -d shenlun_material_hub < /opt/backups/shenlun-<TS>.sql
```

## 影响范围

- 只动 `processingStatus IN ('blocked', 'filtered')` 的记录，**不碰 pending/fetched/completed 的正常文章**。
- Step 1 把验证页从 filtered 改为 blocked（语义更准确，便于在后台筛选排查）。
- Step 2 删除同 `contentHash` + 同 `title` 的重复验证页，每组只留最早一条。

## 不解决的问题

- 验证页对应的 URL 被 wewe-rss 风控时抓不到正文，本脚本不能补回正文。
- 要补正文：等微信对 wewe-rss 服务器 IP 解除风控 → 在 wewe-rss 后台对该公众号触发刷新 → 删掉这些 blocked 记录 → 重新采集。
