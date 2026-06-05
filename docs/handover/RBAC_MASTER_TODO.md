# RBAC 总 TODO

审计日期：2026-06-05

本文件是 RBAC-only TODO 切片。全项目总源以 `PROJECT_MASTER_TODO.md` 为准。

## P0

- [ ] P0｜数据库｜补齐 RBAC Prisma 迁移链
  - 涉及文件：`prisma/schema.prisma`，`prisma/migrations/**/migration.sql`
  - 当前问题：Schema 定义了 `User`、`Session`、owner 字段和关系，但迁移目录没有对应 DDL。
  - 验收标准：从空 SQLite 数据库执行迁移后，`User`、`Session`、`ownerUserId`、`visibility`、`ArticleAnnotation.userId`、`AsyncTask.userId`、`SyncRecord.userId` 均存在。
  - 推荐测试：新建临时数据库运行 Prisma migrate，再执行 `pnpm test`。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜RBAC｜修复批注单条更新越权
  - 涉及文件：`src/app/api/annotations/[id]/route.ts`
  - 当前问题：`PATCH` 只要求登录，不校验 `ArticleAnnotation.userId` 或关联 `ContentItem.ownerUserId`。
  - 验收标准：非管理员只能更新自己的批注；非 owner 返回 403。
  - 推荐测试：Vitest 覆盖用户 A 更新用户 B 批注返回 403。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜RBAC｜修复批注单条删除越权
  - 涉及文件：`src/app/api/annotations/[id]/route.ts`
  - 当前问题：`DELETE` 只要求登录，不校验批注归属。
  - 验收标准：非管理员只能删除自己的批注；非 owner 返回 403。
  - 推荐测试：Vitest 覆盖用户 A 删除用户 B 批注返回 403。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜RBAC｜修复文章批注列表未鉴权
  - 涉及文件：`src/app/api/content-items/[id]/annotations/route.ts`
  - 当前问题：`GET` 未调用认证守卫，直接返回文章批注。
  - 验收标准：未登录返回 401；非管理员只能读取可访问文章下允许可见的批注。
  - 推荐测试：未登录 GET 返回 401；用户 A 读取用户 B 私有文章批注返回 403 或 404。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜RBAC｜修复文章列表 API 未鉴权或明确公开策略
  - 涉及文件：`src/app/api/articles/route.ts`
  - 当前问题：`GET` 未鉴权且未应用 owner/visibility 过滤。
  - 验收标准：若定为登录接口则调用 `requireAuth` 并隔离；若定为公开接口则只返回明确 public 数据并记录策略。
  - 推荐测试：用户 A 不应看到用户 B private 文章。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜RBAC｜修复 ContentItem 搜索条件和隔离条件合并
  - 涉及文件：`src/app/api/content-items/route.ts`
  - 当前问题：业务 `where.OR` 和 `contentVisibilityWhere().OR` 通过对象展开合并，可能覆盖搜索或隔离语义。
  - 验收标准：搜索条件与隔离条件通过 `AND` 组合，二者同时生效。
  - 推荐测试：同一请求同时带 search 和普通用户身份，断言 Prisma where 包含两个条件组。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜RBAC｜修复 MaterialCard 搜索条件和隔离条件合并
  - 涉及文件：`src/app/api/search/route.ts`
  - 当前问题：搜索 `OR` 和 `ownerScopeWhere().OR` 通过对象展开合并。
  - 验收标准：关键词搜索和 owner 限制同时生效。
  - 推荐测试：用户 A 搜索不到用户 B 卡片，即使命中关键词。
  - 状态：TODO
  - 证据：代码审计

- [ ] P0｜测试｜新增 RBAC A/B 用户隔离测试夹具
  - 涉及文件：`src/app/api/**/__tests__`，`src/test/setup.ts`
  - 当前问题：现有 route tests 多数 mock guard，缺少真实用户 A/B 数据隔离测试模式。
  - 验收标准：测试可创建 admin、userA、userB，并模拟各自请求。
  - 推荐测试：至少一个内容读取和一个修改接口使用该夹具。
  - 状态：TODO
  - 证据：代码审计

## P1

- [ ] P1｜RBAC｜定义 `ownerUserId=null` legacy 数据访问策略
  - 涉及文件：`src/lib/data-isolation.ts`，`src/scripts/migrate-owner-userid.ts`
  - 当前问题：普通用户当前可见 null-owner 数据，生产前未明确这是公共数据还是迁移债。
  - 验收标准：文档和代码注释明确策略；必要时迁移 null-owner 历史数据。
  - 推荐测试：普通用户访问 null-owner 数据的行为有单测固定。
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜明确 `VERIFIED_USER` 能力矩阵
  - 涉及文件：`src/lib/auth.ts`，`src/lib/auth-context.tsx`，`docs/handover/RBAC_ARCHITECTURE.md`
  - 当前问题：角色存在，但 route 能力边界不清晰。
  - 验收标准：列出 `ADMIN`、`VERIFIED_USER`、`USER` 对每类 API 的访问权。
  - 推荐测试：针对至少一个 verified-only 接口补测试，或确认无 verified-only 接口。
  - 状态：TODO
  - 证据：规划推导

- [ ] P1｜RBAC｜补齐 MaterialCard 创建时 ContentItem 访问校验
  - 涉及文件：`src/app/api/material-cards/route.ts`
  - 当前问题：创建卡片时设置卡片 owner，但需要确认 source content 是否属于或可见于当前用户。
  - 验收标准：不能基于不可访问内容生成用户自己的卡片。
  - 推荐测试：用户 A 用用户 B 私有 `contentItemId` 创建卡片返回 403。
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜补齐 Review API 隔离回归测试
  - 涉及文件：`src/app/api/review/route.ts`
  - 当前问题：代码有 owner 过滤/校验，但无测试证明。
  - 验收标准：用户 A 的 review GET/POST 均不能操作用户 B 卡片。
  - 推荐测试：Vitest route test 覆盖 GET 和 POST。
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜补齐 SyncRecord 隔离回归测试
  - 涉及文件：`src/app/api/sync-records/route.ts`
  - 当前问题：使用 `ownerScopeWhere(user, "userId")`，但无 A/B 测试。
  - 验收标准：用户 A 不看到用户 B 同步记录。
  - 推荐测试：Vitest route test。
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜明确 AsyncTask 非管理员访问策略
  - 涉及文件：`src/app/api/admin/tasks/route.ts`，`src/app/api/admin/tasks/[id]/route.ts`
  - 当前问题：列表代码有 future-proof owner filter，但 guard 是 admin-only；详情无 owner filter。
  - 验收标准：确认任务接口仅 admin，或新增用户自己的任务接口。
  - 推荐测试：admin 可见全部；普通用户访问 admin tasks 返回 403。
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜测试｜补齐普通用户访问管理员接口 403 测试
  - 涉及文件：`src/app/api/admin/**/__tests__`，`e2e/admin-auth.spec.ts`
  - 当前问题：Playwright 只覆盖未登录和管理员登录，不覆盖普通用户访问后台。
  - 验收标准：普通用户访问 admin 页面跳转或禁止，访问 admin API 返回 403。
  - 推荐测试：Playwright + route tests。
  - 状态：TODO
  - 证据：代码审计
