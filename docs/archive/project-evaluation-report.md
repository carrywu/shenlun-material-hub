# 申论素材采集台 — 项目评估报告

> 评估时间：2026-06-04  
> 评估方式：代码阅读 + lint/test 运行 + 架构梳理（无代码修改）

---

## 1. 总体结论

项目整体处于 **"能用但不够稳"** 的状态。主链路（网站采集 → 文章管理 → AI 评估 → 素材卡生成）基本打通，数据库结构清晰，单元测试 **137 个全部通过**，lint 只有 warning 无 error。但存在以下突出问题：

1. **B站/小红书依赖外部 Python sidecar（MediaCrawler），本身无法独立运行**，前端入口保留但实际用户无法触达。
2. **评估结果核心字段（主题、金句、可用场景）存入数据库但从未展示**，AI 价值大量浪费。
3. **批量生成素材卡逻辑调错 API 接口**，文章列表页批量生成实际不执行 AI，功能破损。
4. **首页"今日推荐"与"探索区"目标区分模糊**，用户易混淆。
5. **旧版 5 维评分代码（`scoreContentItem`、`SCORING_SYSTEM_PROMPT`）是死代码**，仍残留在 `ai.ts`。
6. 导航栏"数据清洗"是系统维护功能，与一般用户操作混在同一导航，入口暴露不合理。

---

## 2. 当前项目核心链路

### 主链路（已完整打通）

```
用户配置来源 (/subscriptions) 
  → 采集文章 (CollectDialog / 来源管理页采集按钮)
  → 文章入库 (ContentItem)
  → 文章详情查看 (/articles/[id])
  → AI 评估 (/api/content-items/assess)
  → 素材卡生成 (/api/content-items/[id]/generate-card)
  → 素材卡展示/编辑 (/cards)
  → 确认后同步至 IMA (/sync-records)
```

### 支线链路（已打通但使用感受较差）

- 微信公众号采集：通过 WeWe RSS sidecar 接入，需要 Docker 服务配合
- 探索区 (`/explore`)：展示未通过核验的内容，但与"今日推荐"区分不明
- 复习模式 (`/review`)：按类型随机展示素材卡，逻辑简单但可用
- 批注功能：文章详情页支持手动/AI 自动批注，功能完整
- 数据搜索 (`/search`)：支持跨素材卡全文搜索

### 半断裂链路

- B站/小红书采集：代码存在，依赖 MediaCrawler Python sidecar，无独立实现
- 文章列表页"批量生成"：调错接口，不走 AI

---

## 3. 前端页面体验问题

### 首页 / 仪表盘 (`/`)

| 评估维度 | 状态 |
|---|---|
| 页面目标清晰度 | ✅ 有统计卡片和快捷入口，整体清晰 |
| 空状态处理 | ✅ 暂无内容时有提示 |
| 核心行动入口 | ⚠️ "采集按钮"弹出 CollectDialog，但 B站/小红书 入口在 dialog 里出现，容易让用户误以为可用 |
| 英文文案 | ✅ 无 |
| 布局 | ✅ 合理 |

问题：`CollectDialog` 内会展示 B站/小红书 来源，若已在 `subscriptions` 里添加，点击采集会走 MediaCrawler 接口，用户无 Python sidecar 时直接报 503 错误。

---

### 文章列表页 (`/articles`)

| 评估维度 | 状态 |
|---|---|
| 筛选功能 | ✅ 平台/状态/AI 状态筛选均可用 |
| 批量评估 | ✅ 可用 |
| 批量生成 | ❌ **调错接口**，`POST /api/material-cards` 是手动创建接口而非 AI 生成接口 |
| 英文文案 | ⚠️ ESLint 报 `CONTENT_GENRE_LABELS` 和 `GENRE_BADGE_COLORS` 定义后未使用 |
| 空状态 | ✅ 有空状态提示 |
| 采集进度 | ✅ 有 toast 提示 |

---

### 文章详情页 (`/articles/[id]`)

| 评估维度 | 状态 |
|---|---|
| 正文渲染 | ✅ 网站文章正常；微信文章有 HTML 清洗逻辑 |
| 图片展示 | ✅ 微信图片走代理链接，支持大图预览 |
| AI 评估结果展示 | ❌ **评估结果字段（`aiCategories`、`aiUsableFor`、`aiQuotes`、`aiSummary`）虽入库但未在 UI 展示** |
| AI 状态显示 | ✅ 侧边栏有"已接受/已拒绝/待评估"标签 |
| 体裁展示 | ❌ `contentGenre` 存入数据库，UI 中未展示 |
| 素材卡展示 | ✅ 已生成素材卡列表可见 |
| 批注功能 | ✅ 选中文本可手动/AI 批注 |
| 重评估按钮 | ✅ 有"重新评估"按钮（`/api/content-items/reassess`） |

---

### 素材卡页面 (`/cards`, `/cards/[id]`)

| 评估维度 | 状态 |
|---|---|
| 中文标签 | ✅ 卡片类型全部中文化 |
| JSON 字段渲染 | ✅ `AI_FIELD_LABELS` 映射确保字段中文化 |
| 编辑功能 | ✅ `MaterialCardEditor` 支持编辑 5 个核心字段 |
| 确认/同步功能 | ✅ 确认按钮可用，同步到 IMA 功能存在 |
| 追溯来源 | ✅ 有"来自：原文标题"引用 |
| 空状态 | ⚠️ 无素材卡时没有引导用户去生成卡片的指引 |

---

### 今日推荐 (`/discover`) vs 探索区 (`/explore`)

**严重体验问题**：这两个页面功能几乎重叠，目标区分非常模糊。

| 维度 | 今日推荐 | 探索区 |
|---|---|---|
| 数据范围 | 已核验来源的内容（`verificationStatus=verified`） | 待核验内容 |
| 功能 | 浏览文章、收藏、生成素材卡 | 浏览文章、忽略、生成素材卡 |
| 区别是否清晰 | ❌ 用户无法直观感知差异 | ❌ 用户无法直观感知差异 |
| 页面头部说明 | 无 | 无 |

建议：两者合并为一个页面，或在页面顶部加明确的说明文案。

---

### AI 配置页 (`/settings/ai`)

| 评估维度 | 状态 |
|---|---|
| 配置表单 | ✅ 完整，支持保存/测试/删除 |
| Prompt 模板管理 | ✅ 支持查看和自定义 11 个 Prompt 模板 |
| `data_fact` 废弃类型 | ✅ 已正确从 Prompt 列表中隐藏 |
| AI Key 安全 | ✅ 加密存储，UI 仅显示 masked key |

---

### 来源管理 (`/subscriptions`)

| 评估维度 | 状态 |
|---|---|
| 添加来源 | ✅ 支持全平台添加 |
| B站/小红书展示 | ⚠️ UI 存在 B站/小红书平台选项，但实际采集依赖外部 sidecar |
| 采集按钮 | ✅ 有，但 B站/小红书 会直接尝试连接 MediaCrawler |
| 栏目管理 | ✅ `ChannelManager` 组件支持配置子栏目 |
| 预览采集 | ✅ 微信来源有预览功能 |

---

### WeWe RSS 集成 (`/integrations/wewe-rss`)

> 注意：该页面**没有出现在导航栏**，用户只能通过直接访问 URL 打开。

| 评估维度 | 状态 |
|---|---|
| 功能完整性 | ✅ 完整，支持测试连接/同步公众号列表/删除失效来源 |
| 入口可达性 | ❌ **导航栏中没有此页面入口，用户无法发现** |
| 错误处理 | ✅ 连接失败有明确提示 |

---

### 复习模式 (`/review`)

| 评估维度 | 状态 |
|---|---|
| 核心功能 | ✅ 按类型随机展示素材卡，支持确认 |
| 筛选 | ✅ 可按卡片类型筛选 |
| ESLint warning | ⚠️ `CardHeader`、`CardTitle` 导入了但未使用 |
| 学习闭环引导 | ❌ 无"今日学习进度"或"已复习数量"等统计 |

---

### 同步记录 (`/sync-records`)

| 评估维度 | 状态 |
|---|---|
| 功能 | ✅ 展示历史同步记录 |
| 英文字段 | ⚠️ 导入了 `SyncStatus`、`DocumentRole` 但未使用（ESLint warning） |

---

### 数据清洗 (`/admin/clean`)

| 评估维度 | 状态 |
|---|---|
| 功能 | ✅ 四项清洗规则，有 dry-run preview |
| 入口位置 | ❌ **出现在主导航栏，与普通用户功能混在一起，容易误操作** |
| 危险操作保护 | ✅ 有二次确认 Dialog |

---

### 检索页 (`/search`)

| 评估维度 | 状态 |
|---|---|
| 功能 | ✅ 跨素材卡搜索 |
| ESLint | ⚠️ `useEffect`、`displayContent` 导入/赋值但未使用，可能是功能未完成的残留 |

---

### 404 / 错误页

- Next.js 默认 404 页，无自定义样式
- 无错误边界处理

---

## 4. 后端 API 与采集链路问题

### 主要 API 评估

| API | 用途 | 前端是否调用 | 当前问题 | 建议 |
|---|---|---|---|---|
| `POST /api/collectors/web/collect` | 网站采集 | ✅ 是 | 无 | 保留 |
| `POST /api/collectors/mediacrawler/crawl` | B站/小红书采集 | ✅ 是（被 subscriptions 调） | 依赖外部 Python sidecar | 隐藏入口或补充文档说明前置条件 |
| `POST /api/collectors/wechat/sync` | 微信文章同步 | ✅ 是 | 无 | 保留 |
| `POST /api/content-items/assess` | 批量 AI 评估 | ✅ 是 | 无 | 保留 |
| `POST /api/content-items/reassess` | 单篇重评估 | ✅ 是 | 无 | 保留 |
| `POST /api/content-items/[id]/generate-card` | 生成素材卡 | ✅ 是 | 无 | 保留 |
| `POST /api/material-cards` | 手动创建素材卡 | ⚠️ 被文章列表页"批量生成"错误调用 | **文章列表"批量生成"应调 `generate-card`，不是这个接口** | 修复调用逻辑 |
| `GET /api/explore` | 探索区数据 | ✅ 是 | 无 | 保留 |
| `GET /api/discover` | 今日推荐数据 | ✅ 是 | 无 | 保留 |
| `GET /api/search` | 检索 | ✅ 是 | 无 | 保留 |
| `GET/POST /api/ai-config` | AI 配置管理 | ✅ 是 | 无 | 保留 |
| `GET/POST /api/ai-config/prompts` | Prompt 模板 | ✅ 是 | 无 | 保留 |
| `POST /api/annotations/[id]` | 批注管理 | ✅ 是 | 无 | 保留 |
| `POST /api/integrations/wewe-rss/sync-sources` | 同步 WeWe RSS 公众号 | ✅ 是（集成页） | 集成页入口不在导航栏 | 加入导航 |
| `GET /api/proxy/image` | 微信图片代理 | ✅ 是 | 无 | 保留 |
| `GET/POST /api/admin/clean` | 数据清洗 | ✅ 是（admin 页） | admin 页在主导航 | 移至管理后台 |
| `GET /api/sources` | 来源列表 | ✅ 是 | 无 | 保留 |
| `GET /api/review` | 复习素材卡 | ✅ 是 | 无 | 保留 |
| `POST /api/export` | 数据导出 | ⚠️ 不确定是否有前端入口 | 未在代码中发现明确调用 | 需确认 |
| `GET /api/sync` | 同步相关 | ⚠️ 需确认 | 未在代码中发现明确调用 | 需确认 |

---

### 采集链路详细状态

**网站采集**（人民日报、人民网观点、广东省政府网、湖南省政府网、先锋文汇）：
- ✅ 5 个采集器均已实现（`src/services/collectors/web/`）
- ✅ 通过 `registry.ts` 按 source name 匹配
- ⚠️ 栏目（CollectionChannel）配置后，采集器内部是否真正按栏目 URL 分页采集需要实际测试

**微信采集**（WeWe RSS）：
- ✅ 完整打通，需要 WeWe RSS Docker 服务
- ✅ 有 fallback（WeRSS 外部服务）

**B站/小红书**（MediaCrawler）：
- ⚠️ 代码实现完整，但依赖 Python sidecar，前端有入口但实际失败会报 503

---

## 5. AI 评估与素材卡生成问题

（详见独立分析报告 [`ai_evaluation_analysis.md`](../ai_evaluation_analysis.md)）

### 核心问题摘要

| 问题 | 优先级 | 说明 |
|---|---|---|
| 评估结果字段（主题/金句/可用场景）存库不展示 | P1 | `aiCategories`、`aiUsableFor`、`aiQuotes`、`aiSummary` 有数据但无 UI 渲染 |
| 文章列表"批量生成"调错接口 | P0 | 实际调的是手动创建接口，无 AI 参与 |
| 生成无重试机制 | P2 | 评估有重试，生成没有 |
| 两次 AI 调用不复用结果 | P2 | 评估提炼的内容不传给生成 Prompt，浪费 token |
| 旧版 5 维评分（`scoreContentItem`）是死代码 | P3 | 仍在 `ai.ts` 中，无任何调用 |
| 素材卡按类型生成，需多次操作 | P2 | 每次只生成一种类型 |

---

## 6. B站 / 小红书功能现状评估

| 功能 | 当前状态 | 是否真实可用 | 相关文件 | 建议处理 | 风险 |
|---|---|---|---|---|---|
| B站采集 | 代码完整，依赖外部 sidecar | ❌ 用户无 sidecar 时直接失败（503） | `src/services/collectors/mediacrawler/bilibili.ts`、`src/app/api/collectors/mediacrawler/crawl/route.ts` | **暂时隐藏入口**（来源管理添加时隐藏 bilibili 平台选项，或加前置提示） | 中：数据库字段兼容，移除入口无数据损坏风险 |
| 小红书采集 | 代码完整，依赖外部 sidecar | ❌ 用户无 sidecar 时直接失败（503） | `src/services/collectors/mediacrawler/xiaohongshu.ts`、同上 crawl route | **暂时隐藏入口** | 中：同上 |

**详细判断**：

1. **有真实代码**：B站和小红书均有完整的采集服务实现，非空壳
2. **前提是 MediaCrawler sidecar 运行**：`client.ts` 在 `http://127.0.0.1:8002` 调用 Python 服务
3. **数据库兼容**：数据存在同一 `ContentItem` 表，`platform` 字段区分，无独立表
4. **影响文件**：`types/index.ts`（`PLATFORMS` 枚举）、`display-labels.ts`（`PLATFORM_LABELS`）、`CollectDialog.tsx`、`subscriptions/page.tsx`、`explore/page.tsx`、`discover/page.tsx`、`articles/page.tsx` 等
5. **是否可安全隐藏**：可以，不删代码，只在 `types/index.ts` 的 `PLATFORMS` 数组中移除 `bilibili` 和 `xiaohongshu`，同时调整所有 `PLATFORM_LABELS` 映射，相关 UI 自动不显示这两个选项
6. **无独立测试**：MediaCrawler 采集器无单元测试

---

## 7. 数据库与数据模型问题

### 模型完整性

| 模型 | 状态 | 问题 |
|---|---|---|
| `Source` | ✅ 完整 | `hitRate`、`filterRate`、`effectiveRate`、`avgAiScore`、`sourceGrade` 等来源质量指标字段是否有后台定期更新逻辑？未在代码中找到 |
| `ContentItem` | ✅ 完整 | `aiScore`（旧版 5 维评分）、`aiScoreDetail`、`aiScoredAt` 是历史字段，已标注"旧字段保留兼容" |
| `MaterialCard` | ✅ 完整 | schema 注释写"5 种"但实际支持 10 种类型 |
| `SyncRecord` | ✅ 完整 | 无 |
| `CollectorRun` | ✅ 完整 | `evidencePath` 字段含义不清，未见使用 |
| `AiConfig` | ✅ 完整 | 无 |
| `AiPromptTemplate` | ✅ 完整 | 无 |
| `ArticleAnnotation` | ✅ 完整 | 无 |
| `CollectionChannel` | ✅ 完整 | 无 |

### 字段命名不一致

- `MaterialCard.cardType` schema 注释写"5 种"，实际系统支持 10 种类型
- `ContentItem.aiScore` 和 `aiScoreDetail` 是旧版 5 维评分字段，目前评估不再使用但仍在表中
- `Source.sourceGrade`（A/B/C/D/F 评级）在代码中无任何读取/写入逻辑

### 删除 B站/小红书 的数据库影响

- **无需删除任何表**：数据共享 `ContentItem` 表
- **只需确认**：现有数据库中是否有 `platform='bilibili'` 或 `platform='xiaohongshu'` 的记录
- **若有**：文章仍可正常展示，只是无法再采集，无数据损坏风险

---

## 8. 废弃代码与半成功能清单

| 类型 | 文件/位置 | 问题 | 建议 | 优先级 |
|---|---|---|---|---|
| 死代码 | `src/services/ai.ts` - `scoreContentItem()` 函数 | 旧版 5 维评分，无任何调用 | 删除或标记 `@deprecated` | P3 |
| 死代码 | `src/services/ai.ts` - `SCORING_SYSTEM_PROMPT` | 同上 | 删除 | P3 |
| 未使用变量 | `src/app/articles/page.tsx` L86 `CONTENT_GENRE_LABELS`、L96 `GENRE_BADGE_COLORS` | 定义了但未渲染 | 删除定义，或真正使用它来展示体裁标签 | P2 |
| 未使用变量 | `src/app/search/page.tsx` L3 `useEffect`、L310 `displayContent` | 定义后未使用 | 删除或补完逻辑 | P2 |
| 未使用变量 | `src/components/MaterialCardEditor.tsx` | 导入了 `Card`、`CardContent`、`CardHeader`、`CardTitle` 但未使用 | 清理导入 | P3 |
| 未使用变量 | `src/components/SyncToIma.tsx` L37 `cardTitle` | 定义后未使用 | 删除 | P3 |
| 未使用变量 | `src/components/ChannelManager.tsx` L15 `ExternalLink` | 导入未使用 | 删除 | P3 |
| 未使用变量 | `src/app/review/page.tsx` | `CardHeader`、`CardTitle` 导入未使用 | 清理 | P3 |
| 半成功能 | `src/app/search/page.tsx` | `displayContent` 变量赋值但未渲染，功能可能未完成 | 确认是否需要补完 | P2 |
| 历史兼容字段 | `prisma/schema.prisma` - `aiScore`、`aiScoreDetail`、`aiScoredAt` | 旧版评分字段，注释已标"旧字段保留兼容" | 后续可清理 migration | P3 |
| 历史兼容字段 | `prisma/schema.prisma` - `Source.sourceGrade`、`hitRate`、`filterRate`、`effectiveRate` | 来源质量指标，代码中无更新逻辑 | 确认是否有计划实现，否则移除 | P3 |
| 数据库注释不一致 | `prisma/schema.prisma` L163 | `MaterialCard.cardType` 注释写"5 种"，实际支持 10 种 | 更新注释 | P3 |
| 配置字段空接口 | `export/route.ts`、`sync/route.ts` | 是否有前端调用？未找到明确入口 | 需确认是否废弃 | P2 |
| 隐藏页面 | `/integrations/wewe-rss` | 功能完整但导航栏无入口，用户无法发现 | 加入导航或在来源管理页提供入口 | P1 |

---

## 9. 测试覆盖情况

### 运行结果

```
pnpm lint    → 20 warnings (全部 warning，无 error)   ✅ 通过
pnpm test    → 20 test files, 137 tests 全部通过       ✅ 通过
pnpm build   → 未在本次评估中运行（上次 build 通过）
E2E tests    → 3 spec files（ui-chinese-integrity、article-detail-content、subscriptions-wewe-rss）
```

### 当前测试覆盖

| 覆盖范围 | 状态 |
|---|---|
| 微信采集解析 (`wechatParser`) | ✅ 11 个测试 |
| WeWe RSS 集成 | ✅ 10 个测试 |
| WeWe RSS SQLite 接入 | ✅ 3 个测试 |
| WeRSS 同步路由 | ✅ 13 个测试 |
| 微信导入路由 | ✅ 10 个测试 |
| AI 配置路由 | ✅ 2 个测试 |
| CollectDialog 组件 | ✅ 7 个测试 |
| display-labels 工具 | ✅ 3 个测试 |
| AI Annotation | ✅ 2 个测试 |
| BaseCollector RSS | ✅ 7 个测试 |
| 工具函数 | ✅ 5 个测试 |
| api-error 工具 | ✅ 1 个测试 |

### 核心链路未覆盖测试

| 未覆盖链路 | 建议 |
|---|---|
| AI 评估接口（`/api/content-items/assess`） | 需新增单元测试 |
| AI 素材卡生成接口（`/generate-card`）测试覆盖不完整 | 现有测试只覆盖边界情况 |
| 网站采集器（人民日报、广东政府等）核心功能 | 需集成测试 |
| 文章列表页批量操作 | 需 E2E |
| 素材卡创建完整流程 | 需 E2E |

### E2E 测试现状

`e2e/ui-chinese-integrity.spec.ts` 覆盖：
- ✅ 探索区筛选器中文化验证
- ✅ 文章详情下拉选择框中文化
- ✅ 微信图片代理渲染
- ✅ 素材卡 JSON 字段中文化
- ✅ AI 配置页废弃类型不显示

需补充的 E2E：
- 完整采集流程（输入 URL → 文章入库）
- AI 评估完整流程（评估 → 状态更新）
- 素材卡生成完整流程
- 来源添加/删除

---

## 10. 风险清单

| 风险 | 等级 | 说明 |
|---|---|---|
| 批量生成调错接口 | 🔴 高 | 用户以为生成了素材卡，实际没有执行 AI，无任何提示 |
| B站/小红书入口无前置提示 | 🔴 高 | 用户点击采集直接收到 503 错误，体验极差 |
| 评估结果大量字段从未展示 | 🟡 中 | 浪费 AI 调用，用户无法看到评估细节 |
| WeWe RSS 集成页无导航入口 | 🟡 中 | 功能存在但用户无法发现 |
| 来源质量指标字段无更新逻辑 | 🟡 中 | `hitRate`、`sourceGrade` 等字段永远是默认值 |
| 旧版评分死代码 | 🟢 低 | 不影响功能，但增加维护成本 |
| `data_fact` 废弃类型残留在多处注释和映射 | 🟢 低 | 已有向后兼容映射（`data_fact → 案例素材`），不影响功能 |
| `MaterialCard.cardType` 注释"5 种"与实际"10 种"不符 | 🟢 低 | 文档误导 |

---

## 11. 优先级排序

### P0：必须先修（影响核心链路可用性）

1. **修复文章列表页"批量生成"逻辑**：改为调用 `POST /api/content-items/[id]/generate-card` 逐篇生成，或新增批量生成接口
2. **B站/小红书入口加前置提示或隐藏**：在来源管理页添加 B站/小红书 时显示明确说明，或暂时从 PLATFORMS 枚举中移除

### P1：优先修（影响主要使用体验）

3. **文章详情页展示 AI 评估结果**：在侧边栏展示 `aiCategories`（主题标签）、`aiUsableFor`（可用场景）、`aiQuotes`（金句预览）——字段已有，只需加 JSX
4. **WeWe RSS 集成页加入导航栏**：在 `layout.tsx` 的 `navItems` 中增加"微信集成"入口
5. **今日推荐/探索区区分说明**：给两个页面加页面级别说明文案，帮助用户理解区别

### P2：继续优化（提升体验）

6. **文章列表页 `CONTENT_GENRE_LABELS` 实际渲染**：体裁标签已在评估时存库，在文章列表行里展示体裁 badge
7. **文章详情页展示 `contentGenre`**：侧边栏元数据区域展示 AI 判断的体裁
8. **数据清洗入口从主导航移除**：改为在设置页或来源管理页提供隐蔽入口
9. **搜索页 `displayContent` 逻辑补完或清理**：确认搜索结果的内容字段展示是否有缺失
10. **素材卡空状态引导**：`/cards` 空数据时增加"去文章库生成素材卡"的引导链接

### P3：后续增强

11. 删除 `scoreContentItem` 死代码
12. 清理各文件的 unused imports
13. 更新 schema 注释（`MaterialCard.cardType` 从"5 种"改为"10 种"）
14. 为 AI 评估/生成接口补充单元测试
15. 实现来源质量指标（`hitRate`、`sourceGrade`）计算逻辑，或在 schema 移除这些字段

---

## 12. 建议的下一阶段开发路线

### 第一阶段（1-2 天）：修复关键 P0/P1 问题

```
1. 修复文章列表"批量生成"逻辑（调正确接口）
2. B站/小红书添加前置说明 banner 或暂时隐藏
3. 文章详情侧边栏展示 aiCategories、aiUsableFor、aiQuotes
4. 导航栏增加"微信集成"入口（指向 /integrations/wewe-rss）
```

### 第二阶段（3-5 天）：体验打磨

```
1. 今日推荐/探索区页面头部加说明文案（或合并两页）
2. 文章列表和详情页展示 contentGenre 体裁标签
3. 数据清洗入口从主导航移除
4. 搜索页清理或补完 displayContent 逻辑
5. 素材卡空状态增加引导
```

### 第三阶段（学习产品视角增强）

```
1. 仪表盘增加"今日采集/待评估/待生成/已入库"状态进度卡
2. 文章详情页"AI 评估完整结果"卡片（含主题/金句/可用场景）
3. 复习模式增加学习进度统计（今日已复习/总进度）
4. 新增"学习工作台"入口（素材卡收藏夹/已确认清单）
5. 导出功能（已确认素材卡 → Markdown 文件）
```

---

## 13. 需要用户确认的问题

1. **B站/小红书功能取舍**：
   - 方案 A：暂时隐藏入口，保留代码（用户未来想接 MediaCrawler 时可启用）
   - 方案 B：完整移除（从 PLATFORMS 枚举删除 bilibili/xiaohongshu，清理相关 UI）
   - **建议**：方案 A（暂时隐藏入口）

2. **"今日推荐"和"探索区"是否保留两个页面？**
   - 建议合并为一个页面，或明确区分为"精选（已核验）"和"待探索（未核验）"两个 Tab

3. **来源质量指标字段（`hitRate`、`sourceGrade` 等）是否有计划实现更新逻辑？**
   - 若无计划，建议从 schema 移除以保持整洁

4. **数据清洗页面是否需要保留在主导航？**
   - 建议移至"设置"子页或去掉导航栏入口

5. **`/export` 和 `/sync` API 是否还在使用？**
   - 未在代码中找到明确前端调用，需要确认是否可以移除

6. **是否有计划实现"一次性生成全部 10 种素材卡"功能？**
   - 若有，建议后端新增批量生成接口，前端加"全量生成"按钮

---

## 14. 本次评估执行的命令与结果

```bash
# lint 检查
pnpm lint
→ 20 warnings（全部 no-unused-vars / exhaustive-deps 类），无 error

# 单元测试
pnpm test
→ 20 test files, 137 tests passed (0 failed)
→ 运行时间：13.49s

# build
→ 未在本次重新运行（上次评估结论 pnpm build 通过）
```

### lint warnings 汇总（按文件）

| 文件 | Warning 内容 |
|---|---|
| `articles/[id]/page.tsx` | 用 `<img>` 而非 `<Image />`（Next.js） |
| `articles/page.tsx` | `CONTENT_GENRE_LABELS`、`GENRE_BADGE_COLORS` 定义未使用 |
| `review/page.tsx` | `CardHeader`、`CardTitle` 导入未使用 |
| `search/page.tsx` | `useEffect`、`displayContent` 未使用 |
| `sync-records/page.tsx` | `SyncStatus`、`DocumentRole` 导入未使用 |
| `ChannelManager.tsx` | `ExternalLink` 导入未使用；`fetchChannels` 缺 exhaustive-deps |
| `MaterialCardEditor.tsx` | `Card`、`CardContent`、`CardHeader`、`CardTitle` 导入未使用 |
| `SyncToIma.tsx` | `cardTitle` 定义未使用 |
| `collectors/web/*.ts` | `source` 参数定义未使用（多个采集器） |
| `sync-sources/route.ts` | `message` 变量赋值未使用 |
| `wewe-rss.test.ts` | `urlWithQuery` 赋值未使用 |

---

*报告生成：2026-06-04，申论素材采集台项目体检*
