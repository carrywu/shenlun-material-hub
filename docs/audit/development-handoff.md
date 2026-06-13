# Development Handoff

生成日期：2026-06-13  
状态：Batch 1 权限与数据安全开发完成  
适用：后续 agent 接手前恢复现场

## 1. 当前目标

Batch 1（权限与数据安全）5 个任务全部完成并通过验证。下一阶段进入 Batch 2（用户管理与后台稳定性）。

## 2. 已完成

### 文档体系（Stage 0）
- 旧 `docs/audit/*.md` 已归档到 `docs/archive/2026-06-13-audit-reset/`。
- 保留 `docs/audit/screenshots/` 历史证据目录。
- 当前有效主文档：`requirements-confirmation.md`、`project-assessment.md`、`development-plan.md`。
- 当前现场文档：`development-handoff.md`、`development-todolist.md`。

### 基础设施恢复
- `.env` 添加 `POSTGRES_PASSWORD="shenlun_dev"`。
- `src/lib/db.ts` 连接池加固：`connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`, `max: 20`。
- `src/scripts/seed-e2e-accounts.ts` 添加连接预检 + 超时。
- `e2e/global-setup.ts` 从浏览器表单登录改为 API 登录 + cookie 注入，4 角色全部成功。

### Batch 1 开发
- **T2-001 前台 /login**：新建 `src/app/login/page.tsx`，`proxy.ts` 双登录页分流，`/cards`/`/search`/`/review` 受保护。
- **T2-002 素材卡访问边界**：`material-cards/[id]` GET 非 owner 非 ADMIN 返回 404。
- **T2-003 reject 不删用户卡**：review route reject 仅删 `ownerUserId: null` 公共卡。
- **T2-004 IMA 禁止 env fallback**：`resolveImaConfig` 无配置抛错，前端显示配置引导。
- **T2-005 审计覆盖**：7 个路由补充 `auditLog()`，import 从 4 个增至 11 个。

### 验证基线
- `pnpm lint`：0 errors / 17 warnings（修复了 `forbiddenResponse` unused）。
- `pnpm test`：53 files / 371 tests 全部通过。
- `pnpm build`：通过，`/login` 路由可见，middleware 激活。
- Playwright：admin/cards/middleware specs 全部通过。

## 3. 进行中

当前没有业务代码开发进行中。下一步应进入 Batch 2（用户管理与后台稳定性）。

## 4. 下一步

1. Batch 2（Stage 3）：用户管理与后台稳定性
   - T3-001：Admin Users 创建后立即可见
   - T3-002：Admin Users malformed JSON 返回 400
   - T3-003：用户删除改禁用
   - T3-004：AdminLogs key warning
2. 参考 `docs/audit/development-plan.md` Batch 2 详细说明。

## 5. 关键决策

- **Next.js 16 中 `proxy.ts` 即 middleware**：不需要额外创建 `src/middleware.ts` re-export，创建会导致构建冲突。
- **双登录页架构**：前台 `/login`（蓝色主题）+ 后台 `/admin/login`（紫色主题），middleware 按路径分流。
- **global-setup API 登录**：用 `fetch()` + cookie 注入替代浏览器表单登录，避免 Playwright 对 Next.js client-side routing 的不可靠检测。
- UI 改进置后。
- 当前只维护三份主文档 + 两份现场文档。

## 6. 修改文件

### Batch 1 新增/修改

新建：
- `src/app/login/page.tsx`

修改：
- `.env`
- `src/lib/db.ts`
- `src/scripts/seed-e2e-accounts.ts`
- `src/proxy.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/content-items/review/route.ts`
- `src/app/api/admin/content-items/review/__tests__/route.test.ts`
- `src/app/api/material-cards/[id]/route.ts`
- `src/app/api/settings/ima-targets/route.ts`
- `src/app/api/sync/route.ts`
- `src/services/ima-sync.ts`
- `src/components/SyncToIma.tsx`
- `src/app/cards/[id]/page.tsx`
- `e2e/global-setup.ts`
- `e2e/helpers/auth.ts`
- `e2e/middleware.spec.ts`

### 文档更新
- `docs/audit/development-todolist.md`
- `docs/audit/development-handoff.md`

## 7. 测试结果

- `pnpm lint`：通过，0 errors / 17 warnings。
- `pnpm test`：通过，53 files / 371 tests。
- `pnpm build`：通过。
- `pnpm exec playwright test e2e/admin.spec.ts -g "创建用户成功" --project=admin`：通过（20.2s）。
- `pnpm exec playwright test e2e/cards.spec.ts -g "点击卡片跳转详情|素材卡详情" --project=admin`：6 个测试通过（31.2s）。
- `pnpm exec playwright test e2e/middleware.spec.ts --project=admin`：14 个测试通过（1.7m）。
- `pnpm seed:e2e-accounts`：幂等成功，3 个非 admin 账号同步。

## 8. 未验证风险

- Batch 2 中的 T3-003（用户删除改禁用）可能需要更新相关 E2E 断言。
- Batch 3+ 涉及 schema migration（学习状态私有化、素材卡归档箱），需先完成 migration 方案。
- 部分 E2E spec（如 `auth.spec.ts`、`data-isolation.spec.ts`）可能受双登录页变更影响，进入 Batch 2 前建议全量跑一次。

## 9. 注意事项

- 后续 agent 必须从 `requirements-confirmation.md` 开始读。
- 不要创建 `src/middleware.ts`（Next.js 16 的 `proxy.ts` 已是 middleware）。
- 不要把 UI 组件库改造提前到权限/数据安全之前。
- 不要对数据库做破坏性操作；需要清理/迁移时先 dry-run。
- 按 `development-plan.md` 和 `development-todolist.md` 执行后续 Batch。
