# 广东省政府网来源采集质量优化设计

## Context

广东省政府网来源（`local_official`，C 级）通过率仅 64%：212 篇已评估文章里 77 篇被 AI 判无效。根因经数据核实：**采集栏目选型偏新闻动态**——现有 3 个栏目都在 `/gdywdt/`（广东要闻动态）路径下，天然多发事件/会议报道，AI 的 77 次拒绝全部判得对（ordinary_news 58、meeting_news 11、notice 7、case_practice 1）。

问题不在成本（DeepSeek-flash 极低，被拒后不重评），而在后台列表被占、素材库纯净度下降。本设计从源头解决：**把低质动态栏目换成高素材密度的政策文件栏目**。

## 已核实数据（2026-06-20）

### 栏目拒率

| 栏目 | 路径 | 采集量 | 拒绝 | 拒率 |
|---|---|---|---|---|
| 地市动态 | `/gdywdt/dsdt/` | 193 | 66 | 34.2% |
| 部门动态 | `/gdywdt/bmdt/` | 18 | 11 | **61.1%** |
| 执法监管 | `/gdywdt/zfjg/` | 1 | 0 | 0%（样本太小） |

### 拒绝体裁构成（77 篇）

| 体裁 | 数量 | 平均字数 | 特征 |
|---|---|---|---|
| ordinary_news | 58 | 745 | 纯事件/数据罗列 |
| meeting_news | 11 | 592 | 程序性会议报道 |
| notice | 7 | 1459 | 长但空，套话连篇（长度门控挡不住） |
| case_practice | 1 | 319 | 个案 |

### 广东政府网栏目实测（HTTP 200，可采）

- `/zwgk/wjk/qbwj/index.html` — 全部文件库（粤府红头文件正文）
- `/zwgk/zcjd/bmjd/index.html` — 政策解读·部门解读（对应 contentGenre `policy_interpretation`，历史通过率 60/60）
- `/gdywdt/*` — 现有动态栏目

### 配置机制

- `CollectionChannel` 已有 `isEnabled` / `maxPages` / `urlPattern` 旋钮，**纯配置层即可调整**。
- collector `guangdongOfficial.ts` 用通用 `extractLinksFromListPage` + urlPattern，新栏目无需改代码即可复用。
- content-filter.ts **无来源级配置机制**，本设计不引入。

## 方案

纯配置层调整 + 旧 reject 清理，**不写业务代码**（不动 collector / content-filter / schema / ai.ts）。

### 1. 栏目调整

| 动作 | 栏目 | 配置变更 |
|---|---|---|
| 停用 | 部门动态 `/gdywdt/bmdt/` | `isEnabled = false` |
| 降页数 | 地市动态 `/gdywdt/dsdt/` | `maxPages: 3 → 1` |
| 新增 | 政府文件库 | listUrl=`/zwgk/wjk/qbwj/index.html`，urlPattern=`content/post_\d+\.html`，maxPages=3 |
| 新增 | 政策解读 | listUrl=`/zwgk/zcjd/bmjd/index.html`，urlPattern=`content/post_\d+\.html`，maxPages=3 |
| 不动 | 执法监管 | 样本太小，保留现状 |

地市动态不全停：它通过数最多（127/193），降页数保留精华、砍掉旧的重复事件报道，比停用更合理。

### 2. 旧 77 篇 reject 物理删除

```sql
DELETE FROM "ContentItem"
WHERE "sourceId" = <广东源 id> AND "aiDecision" = 'reject';
```

- 删除前 `pg_dump` 备份
- dry-run 先 count + 抽样确认（应为 77 篇）
- 单事务 DELETE + 删后核对（reject 应为 0）
- 复用既有的 docker exec psql 事务流程，不新写脚本

### 3. seed 脚本同步（关键，防回退）

更新 `src/scripts/seed-channels.ts` 广东源段落，与线上 DB 配置一致。否则下次 `pnpm seed:channels` 会把停用栏目重新启回。改动限定在广东源范围内。

## 实施顺序

1. 备份 → DB 配置调整（停用/降页数/新增栏目）→ dry-run 验证配置
2. 手动触发一次广东源采集，验证 wjk/zcjd 新栏目能抓到正文（`effectiveTextLength>0`）
3. 备份 → 删除 77 篇 reject → 核对
4. 更新 seed-channels.ts
5. `pnpm harness:preflight` 回归

## 验证

- `SELECT name,"isEnabled","maxPages" FROM "CollectionChannel" WHERE "sourceId"=广东` → bmdt 禁用、dsdt=1、wjk+zcjd 启用
- 采集后新文章 `effectiveTextLength>0`
- 新栏目文章 AI 评估后 accept 率显著高于 64%
- 广东源 `aiDecision='reject'` 删除后为 0
- preflight 通过

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 新栏目列表页结构不同抓不到 | 通用 collector + urlPattern，实测首页有 post 正文链接；采集后立即验证，抓不到则回退 isEnabled |
| 删除不可逆 | pg_dump 备份可 pg_restore |
| seed 改动影响其他源 | diff 限定广东源段落；lint 守 |
| 地市动态降页后总量骤减 | 预期（砍量换质）；可回调 maxPages |

## 不做（YAGNI）

- 不写 content-filter 来源级规则代码
- 不动 collector / ai.ts / schema
- 不做套话密度算法
- 不清理其他源的 reject（仅广东）
