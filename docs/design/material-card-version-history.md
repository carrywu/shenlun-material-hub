# 素材卡版本历史设计

> P3-6: MaterialCard 版本历史数据模型
> 状态：规划中（当前无版本追踪）

## 背景

素材卡（MaterialCard）内容可能被多次修改：

- AI 初次生成（`editorType: AI`）
- 用户手动编辑标题/摘要/正文
- AI 重新生成覆盖部分字段
- 用户确认（confirmed）
- 复查时微调

当前无历史记录，修改后旧内容永久丢失。用户无法：
- 查看修改历史
- 回滚到之前版本
- 对比 AI 生成与人工编辑的差异

## 数据模型

### 新增表

```prisma
/// 素材卡版本快照
model MaterialCardVersion {
  id            String   @id @default(cuid())
  cardId        String
  version       Int                           // 单调递增版本号
  title         String?
  cardType      String?
  aiSummary     String?                       // @db.Text
  markdownContent String?                     // @db.Text
  originalFacts String?                       // @db.Text
  highlightSuggestions String?                // @db.Text
  transferSuggestions String?                 // @db.Text
  sourceSnapshot String?                      // @db.Text
  editorType    String                        // AI | USER | SYSTEM
  editNote      String?                       // 编辑备注（可选）
  createdAt     DateTime @default(now())

  card MaterialCard @relation(fields: [cardId], references: [id], onDelete: Cascade)

  @@unique([cardId, version])
  @@index([cardId, createdAt])
  @@map("material_card_versions")
}
```

### 现有表扩展

```prisma
model MaterialCard {
  // ... existing fields
  currentVersion Int?      @default(1)
  versions       MaterialCardVersion[]
}
```

## 版本创建触发点

| 事件 | editorType | 说明 |
|------|-----------|------|
| AI 首次生成卡片 | `AI` | `POST /api/content-items/[id]/generate-card` |
| AI 重新生成 | `AI` | 同上（覆盖现有卡片内容前先存版本） |
| 用户编辑并保存 | `USER` | `PATCH /api/material-cards/[id]` |
| 用户确认卡片 | `USER` | `POST /api/material-cards/[id]/confirm` |
| 批量操作修改 | `SYSTEM` | 批量评分、批量标签等 |

## 版本创建逻辑

```ts
// src/services/material-card-version.ts

export async function createVersion(
  cardId: string,
  editorType: "AI" | "USER" | "SYSTEM",
  editNote?: string
): Promise<void> {
  // 1. 读取当前卡片内容
  const card = await db.materialCard.findUnique({ where: { id: cardId } });
  if (!card) return;

  // 2. 计算下一个版本号
  const lastVersion = await db.materialCardVersion.findFirst({
    where: { cardId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  // 3. 创建版本快照
  await db.materialCardVersion.create({
    data: {
      cardId,
      version: nextVersion,
      title: card.title,
      cardType: card.cardType,
      aiSummary: card.aiSummary,
      markdownContent: card.markdownContent,
      originalFacts: card.originalFacts,
      highlightSuggestions: card.highlightSuggestions,
      transferSuggestions: card.transferSuggestions,
      sourceSnapshot: card.sourceSnapshot,
      editorType,
      editNote,
    },
  });

  // 4. 更新卡片当前版本号
  await db.materialCard.update({
    where: { id: cardId },
    data: { currentVersion: nextVersion },
  });
}
```

## API 设计

### 查看版本历史

```
GET /api/material-cards/[id]/versions

Response:
{
  "data": [
    {
      "id": "v1_id",
      "version": 1,
      "editorType": "AI",
      "title": "...",
      "createdAt": "2026-01-15T10:00:00Z",
      "editNote": null
    },
    {
      "id": "v2_id",
      "version": 2,
      "editorType": "USER",
      "title": "...",
      "createdAt": "2026-01-16T14:30:00Z",
      "editNote": "优化摘要表述"
    }
  ]
}
```

### 查看单个版本

```
GET /api/material-cards/[id]/versions/[version]

Response: 完整的版本快照内容
```

### 版本对比

```
GET /api/material-cards/[id]/versions/compare?from=1&to=3

Response:
{
  "from": { ... version 1 content },
  "to": { ... version 3 content },
  "diff": {
    "title": { "changed": true, "from": "...", "to": "..." },
    "aiSummary": { "changed": true, "from": "...", "to": "..." }
  }
}
```

### 回滚到指定版本

```
POST /api/material-cards/[id]/versions/[version]/rollback

Request: { "editNote": "回滚到 AI 原始版本" }

Response: 更新后的卡片内容
```

## UI 设计建议

### 文章详情页 — 素材卡版本标签

在素材卡详情区域添加"历史"标签：

```
[概要] [原文] [历史]

版本历史：
┌────────────────────────────────────────────┐
│ v3  👤 用户编辑  2026-01-16 14:30  [查看]  │
│ v2  🤖 AI 重新生成  2026-01-16 10:00  [查看] │
│ v1  🤖 AI 首次生成  2026-01-15 10:00  [查看] │
└────────────────────────────────────────────┘
```

点击 [查看] → 展示该版本完整内容 + 对比当前版本的 diff。

## 存储估算

假设平均每张卡片 2KB 文本内容，每次编辑存完整快照：

| 卡片数 | 平均版本数 | 存储占用 |
|--------|-----------|---------|
| 1,000 | 3 | ~6 MB |
| 10,000 | 3 | ~60 MB |
| 100,000 | 3 | ~600 MB |

对于 PostgreSQL，这个量级完全可接受。如果未来需要优化，可考虑：
- 仅存 diff（节省 ~50% 空间）
- 超过 N 个版本后归档旧版本

## 参考文件

- `prisma/schema.prisma` — MaterialCard 当前字段
- `src/app/api/content-items/[id]/generate-card/route.ts` — AI 生成入口
- `src/app/api/content-items/[id]/score/route.ts` — AI 评分入口
- `src/components/ReviewCard.tsx` — 复习卡组件（版本展示 UI 入口）
