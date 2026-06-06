# 多用户协作数据模型设计

> P3-5: 多用户协作数据模型规划
> 状态：规划中（当前为单用户 + 管理员/普通用户 RBAC）

## 背景

当前数据模型已支持基本的多用户隔离：

```prisma
model User {
  id       String  @id @default(cuid())
  username String  @unique
  role     String  @default("user")  // "admin" | "user"
  status   String  @default("ACTIVE")
}

model ContentItem {
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id])
}

model MaterialCard {
  ownerId String?
  owner   User?   @relation(fields: [ownerId], references: [id])
}
```

**限制**：
- 无工作区概念 — 用户之间无法共享素材
- 无细粒度权限 — 只有 admin/user 两种角色
- 无协作审计 — 无法追踪谁修改了什么

## 目标场景

1. **个人空间**：用户独享素材，其他人不可见
2. **团队空间**：多位用户共享素材库，协作编辑
3. **混合模式**：同一用户可加入多个团队，素材可跨空间移动
4. **权限分级**：空间管理员、编辑者、只读者

## 数据模型

### 新增表

```prisma
/// 工作区
model Workspace {
  id          String   @id @default(cuid())
  name        String
  description String?
  icon        String?              // emoji or icon name
  visibility  String   @default("private")  // private | team | public
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  archivedAt  DateTime?

  members       WorkspaceMember[]
  contentItems  ContentItem[]
  materialCards MaterialCard[]
  sources       Source[]

  @@map("workspaces")
}

/// 工作区成员
model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        String   @default("viewer")  // owner | editor | viewer
  joinedAt    DateTime @default(now())
  invitedBy   String?                        // userId of inviter

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
  @@map("workspace_members")
}
```

### 现有表扩展

```prisma
model ContentItem {
  // ... existing fields
  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])
}

model MaterialCard {
  // ... existing fields
  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])
}

model Source {
  // ... existing fields
  workspaceId String?
  workspace   Workspace? @relation(fields: [workspaceId], references: [id])
}

model User {
  // ... existing fields
  workspaces WorkspaceMember[]
}
```

## 权限模型

### 工作区角色

| 角色 | 能力 |
|------|------|
| **owner** | 删除工作区、管理成员、所有编辑操作 |
| **editor** | 增删改素材卡/文章/来源、邀请 viewer |
| **viewer** | 查看素材、导出、复制到个人空间 |

### 可见性

| visibility | owner | editor | viewer | 非成员 | 匿名 |
|------------|-------|--------|--------|--------|------|
| private | ✅ | ✅ | ✅ | ❌ | ❌ |
| team | ✅ | ✅ | ✅ | ❌ | ❌ |
| public | ✅ | ✅ | ✅ | 只读 | 只读 |

## API 变更

### 新增路由

| 路由 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/workspaces` | GET | 列出我的工作区 | 登录用户 |
| `/api/workspaces` | POST | 创建工作区 | 登录用户 |
| `/api/workspaces/[id]` | GET/PATCH/DELETE | 工作区管理 | owner |
| `/api/workspaces/[id]/members` | GET/POST | 成员管理 | owner/editor |
| `/api/workspaces/[id]/members/[uid]` | PATCH/DELETE | 单成员管理 | owner |

### 现有路由变更

`ownerScopeWhere()` 函数需扩展：

```ts
// 当前：只看 owner 自己的数据
export function ownerScopeWhere(user: AuthUser) {
  return { ownerId: user.id };
}

// 扩展后：看自己私有 + 所属工作区的数据
export function ownerScopeWhere(user: AuthUser) {
  return {
    OR: [
      { ownerId: user.id, workspaceId: null },      // 个人空间
      { workspace: { members: { some: { userId: user.id } } } }, // 工作区
    ],
  };
}
```

## 迁移策略

### Phase 1：向后兼容（无破坏性变更）

1. 创建 Workspace / WorkspaceMember 表
2. 添加 workspaceId 字段（nullable，默认 null = 个人空间）
3. 现有数据 workspaceId = null → 保持个人空间行为
4. 新增工作区 API，不影响现有 API

### Phase 2：个人 → 工作区迁移

1. 添加 "创建工作区" UI 入口
2. 支持将个人素材批量移动到工作区
3. 邀请成员功能

### Phase 3：跨工作区操作

1. 素材卡跨空间复制/移动
2. 工作区模板
3. 协作审计日志

## 参考文件

- `prisma/schema.prisma` — 当前数据模型
- `src/lib/data-isolation.ts` — `ownerScopeWhere()` / `mergeWhere()`
- `docs/handover/RBAC_ARCHITECTURE.md` — 现有 RBAC 架构
- `src/lib/auth.ts` — 用户认证和角色检查
