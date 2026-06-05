# RBAC 交接报告

审计日期：2026-06-05

## 当前评估

RBAC 已部分实现，但仍不应直接开放多用户使用。

已有代码证据支持的完成项：

- `prisma/schema.prisma` 中存在 `User` 和 `Session` 模型。
- `src/lib/auth.ts` 中存在数据库 session auth。
- `src/lib/auth-context.tsx` 中存在客户端 auth context。
- `src/proxy.ts` 中存在全局页面跳转和部分 API 保护。
- 大部分 admin、collector、AI config、source mutation 和 integration routes 已有 admin-only route guard。
- `ContentItem`、`MaterialCard`、`ArticleAnnotation`、`AsyncTask`、`SyncRecord` 已有 owner 字段。
- `src/lib/data-isolation.ts` 中存在隔离 helper。

仍需关注的证据项：

- 需要用空库迁移验收脚本证明 RBAC DDL 与当前 schema 一致。
- 部分 API route 的多用户数据策略仍需 route tests 固定。
- 当前测试套件还没有覆盖所有真实用户 A/B 隔离场景。

## 完成度估算

- 认证基础：90%
- admin route guard 覆盖：85%
- owner-based 数据隔离：80%
- migration readiness：95%
- RBAC 回归测试覆盖：60%
- 多用户生产就绪度：65%

总体 RBAC 就绪度：约 75%。

## 多用户开放阻断项

1. ~~新环境缺少 RBAC migration SQL。~~ ✅ DONE
2. ~~批注 update/delete 缺少 owner 检查。~~ ✅ DONE
3. ~~批注列表未认证。~~ ✅ DONE
4. ~~`/api/articles` 无 auth 或 owner filtering。~~ ✅ DONE
5. ~~search/content list 的 `OR` 组合需要修复和测试。~~ ✅ DONE
6. `ownerUserId=null` legacy 数据策略未最终确定。
7. ~~缺少 A/B 用户隔离测试套件。~~ ✅ DONE

## 生产部署阻断项

1. ~~schema、generated client、migrations 之间存在 Prisma migration drift。~~ ✅ DONE
2. 默认管理员密码路径仍存在，需要生产运行约束。
3. 破坏性 admin API 需要 route tests 和 runbook。
4. public API surface 需要明确安全策略。
5. 生产监控、备份、恢复流程仍不完整。

## 角色语义

当前角色：

- `ADMIN`：运营所有者，可访问全部 admin API 和全部数据。
- `VERIFIED_USER`：已被 `useAuth` 和 `requireVerifiedUser` 识别，但尚未看到清晰 route capability matrix。
- `USER`：普通已认证用户，可访问使用 `requireAuth` 的用户侧 API。

下一步要求：在增加非 admin 协作功能前，为 route group 定义能力矩阵。

## 数据隔离语义

当前 helper 行为：

- Admin 可见全部数据。
- 非 admin 可见自己的数据。
- 非 admin 也可见 `ownerUserId=null` 的 legacy 数据。
- 公开 `ContentItem.visibility` 可覆盖严格 owner 隔离，用于读路径。

风险：null-owner 行为可能适合导入的公开语料，但如果历史用户创建数据中存在私有内容，就会带来数据暴露风险。

## 测试审计摘要

当前测试：

- 27 个 Vitest 文件。
- 177 个测试。
- 6 个 Playwright specs。
- 15 个 route-local API test 文件。

仍缺少的高价值测试：

- 未登录访问每组受保护 API。
- 已登录普通用户访问 admin API。
- 用户 A 读取用户 B 的 content/card/annotation/sync/task。
- 用户 A 修改或删除用户 B 的 content/card/annotation。
- Search 隔离。
- Review 隔离。
- AsyncTask 隔离。
- SyncRecord 隔离。

## 下一位 Agent 建议入口

从根目录 `AGENT_HANDOFF.md` 开始；需要 RBAC 细节时再读 `RBAC_RESUME_PROMPT.md`，然后按 `PROJECT_MASTER_TODO.md` 的 P0/P1 顺序继续。
