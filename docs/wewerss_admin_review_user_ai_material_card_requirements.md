# WeWe RSS 管理员采集 + AI 审核 + 用户私有素材卡需求文档

> 项目：申论素材采集与素材卡系统  
> 文档用途：交给 Codex / Claude Code / Gemini 等代码 Agent 进行需求评估、开发、测试与交付  
> 生成日期：2026-06-11  
> 当前结论：WeWe RSS 不再开放给普通用户，仅作为管理员后台采集工具；普通用户只对已审核放行文章生成自己的私有素材卡。

---

## 1. 背景

当前项目已引入 WeWe RSS，用于同步微信公众号来源并采集公众号文章。但由于 WeWe RSS 存在以下风险：

1. 可能触发微信侧风控、验证页、IP 异常或账号异常。
2. 多用户共用 WeWe RSS 配置不适合长期运营。
3. 普通用户直接配置 WeWe RSS 会扩大风控面。
4. 公众号文章质量参差不齐，不应采集后直接进入普通用户前台。
5. AI 调用成本应由实际使用者承担，不能让普通用户默认消耗管理员或系统 Key。

因此，本次需求将 WeWe RSS 定位调整为：

```text
管理员后台采集工具，而不是普通用户功能。
```

---

## 2. 最终产品原则

### 2.1 管理员负责文章准入

管理员负责：

1. 配置自己的 AI。
2. 管理 WeWe RSS。
3. 同步公众号来源。
4. 手动采集公众号文章。
5. 用管理员自己的 AI Key 对文章做 AI 评估。
6. 审核 AI 通过的文章是否允许进入前台。

### 2.2 普通用户负责自己的素材卡

普通用户负责：

1. 浏览管理员审核通过的文章。
2. 配置自己的 AI。
3. 用自己的 AI Key 生成自己的素材卡。
4. 管理、编辑、查看、导出自己的素材卡。

### 2.3 权限边界

```text
管理员：
- 可以使用 WeWe RSS。
- 可以采集公众号文章。
- 可以执行文章 AI 评估。
- 可以审核文章。
- 可以查看全部文章和全部素材卡。

普通用户：
- 不能看到 WeWe RSS 配置。
- 不能配置 WeWe RSS。
- 不能同步公众号。
- 不能采集公众号文章。
- 不能执行文章准入 AI 评估。
- 不能审核文章。
- 只能看到审核通过的文章。
- 可以对审核通过的文章生成自己的私有素材卡。
```

---

## 3. 已确认的关键需求

### 3.1 WeWe RSS 只给管理员使用

最终规则：

```text
WeWe RSS 仅保留在管理员后台。
普通用户不可见、不可配置、不可采集。
```

要求：

- [ ] `/admin/integrations/wewe-rss` 保留，仅 ADMIN 可访问。
- [ ] `/integrations/wewe-rss` 不应作为普通用户入口。
- [ ] 普通用户前台导航、设置页、学习页中不出现 WeWe RSS。
- [ ] 普通用户不能调用任何 WeWe RSS 同步、测试、刷新、采集接口。
- [ ] 用户级 WeWe RSS 配置接口必须禁用或改为 ADMIN-only。

重点检查：

```text
src/app/integrations/wewe-rss/page.tsx
src/app/admin/integrations/wewe-rss/page.tsx
src/components/integrations/WeweRssIntegrationPage.tsx
src/app/api/settings/integrations/wewe-rss/route.ts
src/app/api/integrations/wewe-rss/**
```

---

### 3.2 公众号文章必须经过 AI 评估 + 管理员审核

文章准入流程：

```text
WeWe RSS 采集入库
↓
pending_ai：待 AI 评估
↓
管理员触发 AI 评估
↓
AI accept：pending_admin，等待管理员审核
AI reject：rejected，仅后台保留
↓
管理员审核通过：approved，普通用户可见
管理员审核拒绝：rejected，普通用户不可见
```

最终规则：

```text
AI 通过 ≠ 普通用户可见
管理员审核通过 = 普通用户可见
```

---

### 3.3 普通用户只看审核通过的文章

普通用户可见条件：

```text
adminReviewStatus = approved
visibility = public
```

非管理员用户访问列表和详情时必须过滤：

```text
pending_ai      不可见
pending_admin   不可见
rejected        不可见
blocked         不可见
filtered        不可见
approved        可见
```

管理员后台可查看全部状态。

---

### 3.4 每个用户调用 AI 必须用自己的 AI 配置

最终规则：

```text
管理员做文章 AI 评估：用管理员自己的 AI 配置。
普通用户生成素材卡：用普通用户自己的 AI 配置。
系统不使用管理员 Key 给普通用户生成素材卡。
系统不使用全局 Key 给普通用户兜底。
```

用户未配置 AI 时：

```text
可以看文章。
可以看系统公共素材卡。
不能生成自己的素材卡。
提示去「设置 → AI 配置」。
```

管理员未配置 AI 时：

```text
不能执行文章 AI 评估。
提示管理员先配置自己的 AI。
```

---

### 3.5 素材卡由用户自己生成

最终规则：

```text
普通用户可以对 approved 文章生成自己的私有素材卡。
```

要求：

- [ ] 普通用户素材卡生成必须使用当前用户自己的 AI 配置。
- [ ] 生成出的 `MaterialCard.ownerUserId = 当前用户 ID`。
- [ ] 用户 A 的素材卡默认不展示给用户 B。
- [ ] 管理员可在后台查看所有素材卡。
- [ ] 历史 `ownerUserId = null` 的素材卡保留为系统公共素材卡。
- [ ] 普通用户可以查看系统公共素材卡，但不算作自己的素材卡。
- [ ] 用户可以基于同一文章再生成自己的私有素材卡。

---

### 3.6 素材卡去重规则

当前需要改成用户维度去重：

```text
同一用户 + 同一文章 + 同一卡片类型，只能生成一张。
不同用户可以对同一文章生成各自的同类型素材卡。
```

错误示例：

```ts
where: {
  contentItemId: id,
  cardType,
}
```

正确示例：

```ts
where: {
  contentItemId: id,
  cardType,
  ownerUserId: user.id,
}
```

注意：历史公共素材卡 `ownerUserId = null` 不应阻止用户生成自己的私有素材卡。

---

### 3.7 第一版普通用户不开放批量生成

第一版只允许：

```text
文章详情页 → 生成素材卡
```

暂不允许：

```text
文章列表页批量生成素材卡
```

原因：

1. 降低 AI 成本失控风险。
2. 降低后台任务并发复杂度。
3. 先验证单篇生成链路稳定性。

---

### 3.8 第一版允许常用素材卡包

普通用户文章详情页支持两种模式：

#### 单类型生成

用户选择一个类型生成：

```text
申论金句
规范表达
案例素材
对策表达
问题表述
原因分析
政策表述
人物事迹
文章框架
```

#### 常用素材卡包

一键生成常用素材卡包：

```text
申论金句 + 规范表达 + 案例素材 + 对策表达
```

要求：

- [ ] 若某个类型已生成，则跳过该类型并提示“已存在”。
- [ ] 未生成的类型进入后台任务队列。
- [ ] 生成失败的类型允许用户重试。
- [ ] 不允许无限并发。

---

## 4. 推荐数据库改造

### 4.1 ContentItem 新增审核字段

建议在 `ContentItem` 增加：

```prisma
adminReviewStatus String  @default("pending_ai")
// pending_ai / pending_admin / approved / rejected

adminReviewedAt   DateTime?
adminReviewedBy   String?
adminReviewNote   String?
publicVisibleAt   DateTime?
```

字段含义：

| 字段 | 含义 |
|---|---|
| `adminReviewStatus` | 管理员审核状态 |
| `adminReviewedAt` | 管理员审核时间 |
| `adminReviewedBy` | 审核管理员 userId |
| `adminReviewNote` | 审核备注或拒绝原因 |
| `publicVisibleAt` | 正式进入前台可见的时间 |

### 4.2 不建议复用 qualityStatus

不要用 `qualityStatus` 表示管理员审核状态。

原因：

```text
qualityStatus 已经承担内容质量、过滤、AI 评估前后状态。
管理员审核属于另一条业务链路，应使用独立字段。
```

### 4.3 推荐状态映射

| 阶段 | qualityStatus | aiDecision | adminReviewStatus | 普通用户可见 |
|---|---|---|---|---|
| 新采集候选文章 | candidate | null | pending_ai | 否 |
| AI 通过 | accepted | accept | pending_admin | 否 |
| AI 拒绝 | filtered | reject | rejected | 否 |
| 管理员通过 | accepted | accept | approved | 是 |
| 管理员拒绝 | accepted/filtered | accept/reject | rejected | 否 |
| 微信封禁页 | blocked | null | rejected | 否 |
| 内容过滤 | filtered | null | rejected | 否 |

---

## 5. 历史数据迁移规则

已有数据迁移建议：

```text
aiDecision = accept：
  adminReviewStatus = pending_admin
  不要自动 approved，避免未人工审核内容直接展示。

aiDecision = reject：
  adminReviewStatus = rejected

qualityStatus = blocked / filtered：
  adminReviewStatus = rejected

aiDecision = null 且 qualityStatus = candidate：
  adminReviewStatus = pending_ai

历史 ownerUserId = null 的素材卡：
  保留为系统公共素材卡。
```

注意：

```text
不要自动把历史 AI accept 文章设为 approved。
因为当前最终规则是：AI 后必须管理员审核。
```

---

## 6. 后端接口需求

### 6.1 禁用普通用户 WeWe RSS 配置接口

目标文件：

```text
src/app/api/settings/integrations/wewe-rss/route.ts
```

要求：

- [ ] 不允许 `VERIFIED_USER` 或普通用户配置 WeWe RSS。
- [ ] 可以选择直接返回 403。
- [ ] 或改为 `requireAdmin`。
- [ ] 前端普通用户设置页不再调用该接口。
- [ ] 测试覆盖非管理员访问返回 403。

---

### 6.2 文章列表接口增加审核过滤

目标文件：

```text
src/app/api/articles/route.ts
```

要求：

- [ ] 非管理员用户默认只返回 `adminReviewStatus = approved` 的文章。
- [ ] 管理员用户可以按审核状态筛选全部文章。
- [ ] 支持查询参数：

```text
adminReviewStatus=all
adminReviewStatus=pending_ai
adminReviewStatus=pending_admin
adminReviewStatus=approved
adminReviewStatus=rejected
```

非管理员访问时，即使传入 `adminReviewStatus=all`，也不能看到未审核文章。

---

### 6.3 文章详情接口增加审核过滤

目标文件：

```text
src/app/api/content-items/[id]/route.ts
```

要求：

- [ ] 管理员可访问所有文章详情。
- [ ] 普通用户只能访问 `adminReviewStatus = approved` 的文章详情。
- [ ] 普通用户访问未审核文章返回 403 或 404。
- [ ] 避免用户通过文章 ID 绕过列表过滤。

---

### 6.4 AI 评估接口状态流转

目标文件：

```text
src/app/api/content-items/assess/route.ts
```

要求：

- [ ] 管理员才可以触发文章准入 AI 评估。
- [ ] AI 评估必须使用当前管理员自己的 AI 配置。
- [ ] 管理员未配置 AI 时返回清晰错误。
- [ ] AI accept 后：

```text
aiDecision = accept
qualityStatus = accepted
adminReviewStatus = pending_admin
```

- [ ] AI reject 后：

```text
aiDecision = reject
qualityStatus = filtered
adminReviewStatus = rejected
filterReason = AI 拒绝原因
```

- [ ] AI error 后：

```text
adminReviewStatus = pending_ai
aiAssessmentError = 错误信息
```

---

### 6.5 新增管理员审核接口

建议新增：

```text
POST /api/admin/content-items/review
```

请求示例：

```json
{
  "ids": ["contentItemId1", "contentItemId2"],
  "action": "approve",
  "note": "适合申论素材学习"
}
```

或：

```json
{
  "ids": ["contentItemId1"],
  "action": "reject",
  "note": "素材价值不足"
}
```

要求：

- [ ] 仅 ADMIN 可调用。
- [ ] `approve` 时必须要求文章 `aiDecision = accept`。
- [ ] `approve` 后：

```text
adminReviewStatus = approved
adminReviewedAt = now
adminReviewedBy = 当前管理员 ID
adminReviewNote = note
publicVisibleAt = now
visibility = public
```

- [ ] `reject` 后：

```text
adminReviewStatus = rejected
adminReviewedAt = now
adminReviewedBy = 当前管理员 ID
adminReviewNote = note
```

- [ ] 记录审计日志。

---

### 6.6 素材卡生成接口改造

目标文件：

```text
src/app/api/content-items/[id]/generate-card/route.ts
```

要求：

- [ ] 允许 VERIFIED_USER 调用。
- [ ] 必须检查文章 `adminReviewStatus = approved`。
- [ ] 必须使用当前用户自己的 AI 配置。
- [ ] 用户未配置 AI 时返回清晰提示。
- [ ] `MaterialCard.ownerUserId = 当前用户 ID`。
- [ ] 查重必须包含 `ownerUserId = 当前用户 ID`。
- [ ] 历史公共卡 `ownerUserId = null` 不阻止用户生成私有卡。
- [ ] 支持单类型生成。
- [ ] 支持常用素材卡包生成。
- [ ] 第一版不开放普通用户批量生成列表文章。

---

## 7. 前端页面需求

### 7.1 管理员 WeWe RSS 页面

目标页面：

```text
/admin/integrations/wewe-rss
```

要求：

- [ ] 页面标题建议改为：`微信公众号采集（WeWe RSS）`
- [ ] 明确提示：该功能仅管理员可用。
- [ ] 显示连接状态。
- [ ] 显示同步公众号列表。
- [ ] 支持预览同步。
- [ ] 支持同步公众号来源。
- [ ] 支持手动采集单个公众号。
- [ ] 不默认开启定时采集。
- [ ] 显示风控提示：

```text
为降低微信侧风控风险，请避免高频刷新、全量历史采集和频繁重试。
```

---

### 7.2 管理员文章管理页

目标页面：

```text
/admin/articles
```

新增筛选：

```text
审核状态：
- 全部
- 待 AI 评估
- 待管理员审核
- 已通过
- 已拒绝
```

新增操作：

```text
单篇审核通过
单篇审核拒绝
批量审核通过
批量审核拒绝
填写审核备注
```

列表建议显示字段：

```text
标题
来源
来源类型
发布时间
采集时间
AI 状态
AI 理由
审核状态
审核人
审核时间
操作
```

---

### 7.3 普通用户文章列表页

目标页面：

```text
/articles
```

要求：

- [ ] 只显示审核通过的文章。
- [ ] 不显示 WeWe RSS 字样。
- [ ] 可以显示来源为“公众号”或具体公众号名称。
- [ ] 支持筛选来源类型：网站 / 公众号。
- [ ] 支持显示是否已生成“我的素材卡”。

---

### 7.4 普通用户文章详情页

目标页面：

```text
/articles/[id]
```

要求：

- [ ] 只允许访问审核通过文章。
- [ ] 显示文章正文。
- [ ] 显示系统公共素材卡。
- [ ] 显示“我的素材卡”。
- [ ] 用户未配置 AI 时，素材卡生成入口置灰，并提示去设置。
- [ ] 用户已配置 AI 时，可以生成自己的素材卡。
- [ ] 支持单类型生成。
- [ ] 支持常用素材卡包。
- [ ] 已生成类型显示“已生成”，避免重复点击。

---

### 7.5 普通用户 AI 配置页

目标页面：

```text
/settings/ai
```

要求：

- [ ] 普通用户可以配置自己的 AI。
- [ ] 配置项：

```text
baseUrl
apiKey
model
temperature
```

- [ ] API Key 加密保存。
- [ ] 页面只显示脱敏 Key。
- [ ] 支持测试连接。
- [ ] 未配置 AI 时，文章详情页生成素材卡应引导用户到该页面。

---

## 8. 风控与稳定性需求

### 8.1 WeWe RSS 风控

要求：

- [ ] 禁止全量历史采集。
- [ ] 禁止高频轮询。
- [ ] 单个公众号每次最多采集最近 N 篇，建议默认 5-10 篇。
- [ ] 支持采集失败熔断。
- [ ] 发现微信封禁/验证页时，停止该来源当前采集。
- [ ] 不允许无限重试。
- [ ] 记录详细日志。

建议策略：

```text
同一时间最多 1 个 WeWe RSS 采集任务。
连续失败 3 次自动暂停该来源。
出现“环境异常 / 频繁访问 / 请先验证”等关键词时标记 blocked。
```

---

### 8.2 AI 调用风控

要求：

- [ ] 每个用户同一时间最多 1 个素材卡生成任务。
- [ ] 同一用户同一文章同一卡片类型去重。
- [ ] 生成失败允许重试。
- [ ] 不允许无限并发。
- [ ] AI 错误必须脱敏，不得暴露完整 API Key。
- [ ] 后台任务应记录发起用户。

---

## 9. 测试要求

### 9.1 单元测试

必须覆盖：

- [ ] WeWe RSS 普通用户配置接口被禁用。
- [ ] 非管理员不能调用 WeWe RSS 同步接口。
- [ ] AI accept 后进入 `pending_admin`。
- [ ] AI reject 后进入 `rejected`。
- [ ] 管理员审核通过后进入 `approved`。
- [ ] 普通用户文章列表只返回 `approved`。
- [ ] 普通用户详情不能访问未审核文章。
- [ ] 素材卡生成要求文章已 `approved`。
- [ ] 素材卡生成使用当前用户 AI 配置。
- [ ] 用户未配置 AI 时不能生成素材卡。
- [ ] 同一用户同一卡片类型去重。
- [ ] 不同用户可对同一文章生成同类型素材卡。
- [ ] 历史公共素材卡不阻止用户私有卡生成。

---

### 9.2 Playwright E2E 测试

必须覆盖：

#### 管理员链路

- [ ] 管理员登录后台。
- [ ] 管理员进入 WeWe RSS 页面。
- [ ] 管理员同步公众号列表。
- [ ] 管理员采集公众号文章。
- [ ] 管理员触发 AI 评估。
- [ ] AI accept 文章进入待审核。
- [ ] 管理员审核通过文章。
- [ ] 审核通过文章出现在普通用户文章列表。

#### 普通用户链路

- [ ] 普通用户看不到 WeWe RSS 入口。
- [ ] 普通用户无法访问 `/admin/integrations/wewe-rss`。
- [ ] 普通用户无法调用 WeWe RSS API。
- [ ] 普通用户只能看到 approved 文章。
- [ ] 普通用户不能访问 pending_admin 文章详情。
- [ ] 普通用户未配置 AI 时不能生成素材卡。
- [ ] 普通用户配置自己的 AI 后可以生成素材卡。
- [ ] 用户 A 生成素材卡后，用户 B 看不到用户 A 的私有素材卡。
- [ ] 用户 B 可以对同一文章生成自己的素材卡。

---

### 9.3 验收命令

完成后必须运行：

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

如果任何命令失败，必须继续修复直到通过。

---

## 10. 交付要求

Agent 完成开发后必须：

- [ ] 更新开发交接文档。
- [ ] 更新 todo list，每完成一项打勾。
- [ ] 说明数据库迁移内容。
- [ ] 说明历史数据迁移规则。
- [ ] 说明 WeWe RSS 权限边界。
- [ ] 说明 AI 配置和调用归属。
- [ ] 说明素材卡归属和去重规则。
- [ ] 提交 git commit。
- [ ] 附上测试结果。
- [ ] 如果 Playwright 有失败，必须附失败截图和原因分析。

---

## 11. 建议优先修改文件

```text
prisma/schema.prisma

src/services/collectors/wechat/weRssNormalizer.ts
src/app/api/settings/integrations/wewe-rss/route.ts
src/app/api/integrations/wewe-rss/**
src/app/api/articles/route.ts
src/app/api/content-items/[id]/route.ts
src/app/api/content-items/assess/route.ts
src/app/api/content-items/[id]/generate-card/route.ts

src/components/integrations/WeweRssIntegrationPage.tsx
src/components/articles/ArticlesPage.tsx
src/components/ArticleDetail.tsx
src/app/articles/[id]/page.tsx
src/components/BatchActions.tsx
src/components/ai/AiConfigPage.tsx

e2e/wewe-rss.spec.ts
e2e/articles.spec.ts
src/app/api/content-items/[id]/generate-card/__tests__/route.test.ts
src/app/api/content-items/assess/__tests__/route.test.ts
```

---

## 12. 给 Agent 的执行提示词

```md
# 任务：重构 WeWe RSS 权限边界、文章审核流与用户私有素材卡生成

## 背景

申论素材项目当前已引入 WeWe RSS，但由于公众号采集存在 IP 风控和账号异常风险，WeWe RSS 不再开放给普通用户，只保留为管理员后台采集工具。

同时，公众号文章不能采集后直接展示给普通用户，必须经过：
WeWe RSS 采集 → 管理员 AI 评估 → 管理员人工审核 → 普通用户可见。

普通用户可以对审核通过的文章生成自己的素材卡，但 AI 调用必须使用普通用户自己的 AI 配置，不能使用管理员 Key 或系统全局 Key。

## 总目标

1. WeWe RSS 仅管理员可见、可配置、可采集。
2. 普通用户完全不能配置或调用 WeWe RSS。
3. 公众号文章 AI 评估通过后仍需管理员审核。
4. 普通用户只能看到审核通过的文章。
5. 普通用户对审核通过文章生成自己的私有素材卡。
6. 每个用户调用 AI 都必须使用自己的 AI 配置。
7. 历史公共素材卡保留为系统公共卡。
8. 完成数据库迁移、后端接口、前端页面、单测和 E2E 测试。

## 关键约束

- 不要把 AI accept 直接当成前台可见。
- 不要让普通用户消耗管理员 AI Key。
- 不要让历史公共素材卡阻止用户生成私有素材卡。
- 不要让普通用户通过文章 ID 绕过审核状态。
- 不要开放普通用户批量生成素材卡。
- 不要高频自动采集 WeWe RSS。

## 必须完成

- [ ] 新增 ContentItem 管理员审核字段。
- [ ] 增加历史数据迁移。
- [ ] 禁用普通用户 WeWe RSS 配置。
- [ ] 普通用户列表与详情只返回 approved 文章。
- [ ] AI accept 后进入 pending_admin。
- [ ] 新增管理员审核接口。
- [ ] 后台文章管理页增加审核筛选和审核按钮。
- [ ] 素材卡生成检查 adminReviewStatus=approved。
- [ ] 素材卡生成使用当前用户 AI 配置。
- [ ] 素材卡去重包含 ownerUserId。
- [ ] 普通用户文章详情页支持生成单类型素材卡和常用素材卡包。
- [ ] 未配置 AI 时引导用户去设置。
- [ ] 增加单元测试和 Playwright E2E 测试。
- [ ] 全部测试通过后提交 git。

## 验收命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

失败必须继续修复，不允许假装通过。
```

---

## 13. 最终验收标准

本需求完成后，必须满足：

```text
普通用户看不到 WeWe RSS。
普通用户不能采集公众号。
公众号文章不会因 AI accept 自动展示。
只有管理员审核 approved 后，普通用户才可见。
普通用户生成素材卡时用自己的 AI。
用户未配置 AI 时不能生成素材卡。
用户生成的素材卡归自己。
不同用户素材卡互不污染。
历史公共素材卡仍可查看。
全部测试通过。
```
