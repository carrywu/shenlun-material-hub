# Auth / WeWeRSS / Admin Refactor Todolist

## Problem Summary

当前项目需要完成账号体系、邀请码升级、前后台登录拆分、WeWeRSS 生产配置、后台独立化、权限边界、配置缺失引导、文章详情页修复和完整测试验收。

## Current Behavior

- 前台登录、后台登录曾共用入口，未登录跳转和角色拦截容易混淆。
- 注册账号规则不完整，需要统一为用户手填字母数字账号。
- 注册流程缺少昵称字段和无邀请码普通用户注册路径。
- 普通用户高级功能入口和后端高级 API 权限边界需要逐项审计。
- WeWeRSS 生产环境曾存在 `localhost:4000` 静默 fallback 风险。
- AI / WeWeRSS 配置缺失时需要统一中文引导 Dialog，避免 raw error。
- 文章列表到详情页、空正文、外部原文链接行为需要保证一致。
- 后台用户管理和邀请码管理能力需要补全并覆盖最后管理员保护。

## Expected Behavior

- `/login` 只服务前台用户，`/admin/login` 只服务管理员登录。
- 注册页允许手填账号，账号只能包含数字和英文字母；昵称必填；密码 6-18 位。
- 无邀请码注册为 `USER`，有效邀请码注册为 `VERIFIED_USER`。
- 登录后全站优先展示昵称，没有昵称时展示账号。
- 设置页可以修改昵称，普通用户可以输入邀请码升级。
- `USER` 可浏览文章和已生成素材卡，但不能使用 AI、WeWeRSS、IMA 等高级功能。
- 高级入口前端隐藏，后端 API 仍必须做角色校验。
- `/admin/*` 只有 `ADMIN` 可访问，后台拥有独立布局和导航。
- WeWeRSS 后端使用 `WEWERSS_BASE_URL=http://wewerss:4000`，前端打开后台使用 `NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210/wewerss`。
- 生产环境缺少 WeWeRSS / AI 配置时显示中文 Dialog 并提供配置入口。
- `/articles/[id]` 可访问，正文为空显示“暂无正文内容”，外部原文只作为单独按钮。

## Suspected Root Cause

- 登录守卫和页面路由未按前后台边界拆分。
- 注册、登录、邀请码升级的校验规则分散，前后端没有统一约束。
- 权限控制偏依赖前端入口隐藏，部分高级 API 可能缺少后端角色检查。
- WeWeRSS 地址曾混用本地开发地址、后端内网地址和浏览器公网地址。
- 配置缺失错误没有统一错误码和 UI 处理链路。
- 后台管理功能缺少完整的用户角色/status 操作和最后管理员保护。

## Files To Inspect

- `src/proxy.ts`
- `src/lib/auth.ts`
- `src/app/login/page.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/RootNav.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/account/page.tsx`
- `src/app/api/auth/*`
- `src/app/api/settings/account/*`
- `src/app/api/admin/*`
- `src/app/admin/*`
- `src/components/admin/*`
- `src/components/integrations/WeweRssIntegrationPage.tsx`
- `src/app/api/integrations/wewe-rss/*`
- `src/app/api/collectors/wechat/sync/*`
- `src/components/articles/ArticlesPage.tsx`
- `src/app/articles/[id]/page.tsx`
- `prisma/schema.prisma`
- `e2e/*.spec.ts`

## Planned Changes

- 完成账号、昵称、密码、邀请码注册和登录规则的前后端统一。
- 完成前台登录页和后台登录页拆分，并修正路由守卫。
- 完成设置页昵称编辑和邀请码升级。
- 完成邀请码 schema additive migration、后台邀请码管理和使用记录展示。
- 补全后台用户管理：列表、搜索、角色、状态、最后管理员保护。
- 统一 WeWeRSS 后端内网地址和前端公网地址配置。
- 新增 `MissingConfigDialog` 或等价 hook，并接入 AI / WeWeRSS 缺失配置场景。
- 审计高级 API 权限，确保 `USER` 直接请求时返回中文 403。
- 修复文章详情页跳转、空正文和外部原文入口。
- 更新单测、集成测试、Playwright E2E、部署文档、权限文档、测试报告和交接文档。

## Tests To Add Or Update

- 注册：非字母数字账号、重复账号、昵称空/超长、密码过短/超长、无邀请码、有效邀请码、无效/禁用/过期/耗尽邀请码。
- 登录：非字母数字账号失败、字母数字账号登录成功、昵称 fallback。
- 设置：昵称更新、普通用户邀请码升级、重复使用邀请码失败。
- 权限：普通用户请求 AI / WeWeRSS / IMA 高级 API 返回中文 403。
- 后台：用户列表/搜索、角色修改、启用禁用、防止最后管理员被降级/禁用/删除。
- 配置：AI 缺失结构化错误、WeWeRSS 缺失 `WEWERSS_CONFIG_MISSING`。
- 文章：列表点击进入详情，空正文展示“暂无正文内容”。
- Playwright：前后台登录拆分、注册、升级、普通用户权限隐藏和后端拒绝、管理员邀请码/用户管理、配置缺失 Dialog。

## Validation Commands

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [ ] `pnpm exec playwright test`

## Risks / Rollback Plan

- 数据库迁移只允许 additive change；回滚时先停止服务并确认备份，不直接删除历史用户、文章、素材卡、来源。
- 不修改 `User.id`，字母数字账号只约束 `username`。
- 不删除手动来源和外部 WeRSS fallback。
- WeWeRSS 生产地址必须区分容器内网地址和浏览器公网地址，避免回退到 localhost。
- 权限变更需要以后端校验为准，前端隐藏只作为体验优化。
- Playwright 若失败，先按失败用例修正测试夹具和真实行为，不跳过关键路径。

## Confirmed Requirements

- 注册页允许用户手填账号。
- 账号只能包含数字和英文字母，前后端都校验。
- 昵称必填，trim 后 1-30 字符，内容不限。
- 密码 6-18 位，可包含数字、字母、符号。
- 登录使用账号 + 密码。
- 登录后优先显示昵称；历史账号未设置昵称时显示账号名。
- 设置页支持修改昵称。
- 无邀请码注册为 `USER`。
- 有有效邀请码注册为 `VERIFIED_USER`。
- 普通用户可浏览文章和已生成素材卡。
- 普通用户隐藏 AI / WeWeRSS / IMA 等高级入口。
- 普通用户直接请求高级 API 时后端必须拒绝。
- `/admin/*` 仅 `ADMIN` 可访问。
- WeWeRSS 后端地址：`WEWERSS_BASE_URL=http://wewerss:4000`。
- WeWeRSS 前端公网入口：`NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210/wewerss`。
- 生产环境不能 fallback 到 `localhost:4000`。
- 数据库迁移只做 additive change，不修改 `User.id`。

## P0 Current State Review

- [x] 审查注册、登录、登出、会话校验 API。
- [x] 审查 `proxy.ts` 前后台路由守卫。
- [x] 审查 `/login`、`/admin/login`、`/register` 当前页面状态。
- [x] 审查用户昵称展示位置。
- [x] 审查设置页账号信息编辑能力。
- [x] 审查邀请码模型、API、后台页面。
- [x] 审查 WeWeRSS 所有前后端调用点。
- [ ] 审查 AI 配置缺失报错链路。
- [ ] 审查文章列表到详情页跳转。
- [ ] 审查普通用户可绕过的高级 API。

## P0 Fixes

- [x] 新增或修复 `/login` 前台登录页。
- [x] 保留并独立化 `/admin/login` 后台登录页。
- [x] 修改未登录前台页面跳转到 `/login`。
- [x] 修改未登录后台页面跳转到 `/admin/login`。
- [x] 管理员访问 `/admin/login` 后跳 `/admin/dashboard`。
- [x] 普通用户/认证用户访问 `/admin/*` 时禁止进入。
- [x] 修复 `/articles/[id]` 详情页。
- [x] 文章正文为空时显示“暂无正文内容”。
- [x] 外部原文链接只保留为单独按钮。
- [x] 移除生产环境所有静默 `localhost:4000` fallback。
- [x] 后端 WeWeRSS 调用统一使用 `WEWERSS_BASE_URL`。
- [x] 前端打开 WeWeRSS 后台统一使用 `NEXT_PUBLIC_WEWERSS_PUBLIC_URL`。
- [x] 生产未配置 WeWeRSS 时返回 `WEWERSS_CONFIG_MISSING`。

## P1 Account / Invitation

- [x] 修改注册页字段：账号、昵称、密码、可选邀请码。
- [x] 前端校验账号只能包含数字和英文字母。
- [x] 后端校验账号只能包含数字和英文字母。
- [x] 后端校验账号唯一。
- [x] 前端校验昵称 trim 后 1-30 字符。
- [x] 后端校验昵称 trim 后 1-30 字符。
- [x] 前端校验密码长度 6-18 位。
- [x] 后端校验密码长度 6-18 位。
- [x] 无邀请码注册为 `USER`。
- [x] 有有效邀请码注册为 `VERIFIED_USER`。
- [x] 注册成功后自动登录或按现有产品逻辑跳转。
- [x] 登录失败、注册失败、升级失败提示中文化。
- [x] 设置页支持修改昵称。
- [x] 全站用户展示统一为昵称优先、账号兜底。
- [x] 设置页新增邀请码升级入口。
- [x] 普通用户升级成功后角色变为 `VERIFIED_USER`。
- [x] 邀请码增加 `isEnabled` 字段。
- [x] 邀请码增加 `note` 字段。
- [x] 邀请码增加 `updatedAt` 字段。
- [x] 邀请码校验覆盖不存在、禁用、过期、次数耗尽、重复使用。
- [x] 邀请码使用次数扣减和使用记录写入放在事务内。

## P2 Admin

- [x] 新增或完善 `/admin/dashboard`。
- [x] 后台使用独立 `AdminLayout` / `AdminShell`。
- [x] 后台导航与前台导航分离。
- [ ] 用户管理支持列表。
- [ ] 用户管理支持搜索。
- [ ] 用户管理展示账号、昵称、角色、状态、注册时间。
- [ ] 用户管理支持修改角色。
- [ ] 用户管理支持启用/禁用。
- [ ] 用户管理防止最后一个管理员被降级。
- [ ] 用户管理防止最后一个管理员被禁用。
- [ ] 用户管理防止最后一个管理员被删除。
- [x] 邀请码管理支持创建邀请码。
- [x] 邀请码管理支持设置使用次数。
- [x] 邀请码管理支持设置过期时间。
- [x] 邀请码管理支持启用/禁用。
- [x] 邀请码管理支持备注。
- [x] 邀请码管理展示已使用次数和剩余次数。
- [x] 邀请码管理展示使用记录和绑定用户。

## P3 UX / Dialog

- [ ] 新增统一 `MissingConfigDialog` 或等价 hook。
- [ ] AI 未配置时显示中文 Dialog。
- [ ] AI Dialog 点击“前往配置”跳 `/settings/ai`。
- [ ] WeWeRSS 未配置时显示中文 Dialog。
- [ ] WeWeRSS Dialog 点击“前往配置”跳 `/settings/integrations`。
- [ ] 权限不足时显示中文提示。
- [ ] 普通用户隐藏 AI / WeWeRSS / IMA 高级入口。
- [ ] 所有用户可见 raw error 替换为中文提示。
- [ ] 所有关键空状态中文化。

## API Permission Audit

- [ ] AI 评估 API 需要 `VERIFIED_USER` 或 `ADMIN`。
- [ ] AI 生成素材卡 API 需要 `VERIFIED_USER` 或 `ADMIN`。
- [ ] 批量生成 API 需要 `VERIFIED_USER` 或 `ADMIN`。
- [ ] WeWeRSS 同步 API 需要 `VERIFIED_USER` 或 `ADMIN`，后台系统管理类接口仍需 `ADMIN`。
- [ ] IMA 同步/API 需要 `VERIFIED_USER` 或 `ADMIN`。
- [ ] `/api/admin/*` 全部需要 `ADMIN`。
- [ ] 普通用户直接请求高级 API 返回中文 403。
- [ ] 未登录请求受保护 API 返回中文 401。

## Unit / Integration Tests

- [x] 注册账号非字母数字失败。
- [x] 注册账号重复失败。
- [x] 注册昵称为空失败。
- [x] 注册昵称超过 30 字符失败。
- [x] 密码少于 6 位失败。
- [x] 密码超过 18 位失败。
- [x] 无邀请码注册为 `USER`。
- [x] 有邀请码注册为 `VERIFIED_USER`。
- [x] 无效邀请码失败。
- [x] 禁用邀请码失败。
- [x] 过期邀请码失败。
- [x] 次数耗尽邀请码失败。
- [x] 重复使用邀请码失败。
- [x] 普通用户邀请码升级成功。
- [x] 昵称更新成功。
- [x] 昵称展示 fallback 正确。
- [ ] 最后一个管理员不能降级。
- [ ] 最后一个管理员不能禁用。
- [ ] 最后一个管理员不能删除。
- [ ] AI 缺失配置返回结构化错误。
- [x] WeWeRSS 缺失配置返回 `WEWERSS_CONFIG_MISSING`。
- [ ] 普通用户请求高级 API 被拒绝。
- [ ] 文章详情空正文展示“暂无正文内容”。

## Playwright E2E

- [ ] 访问 `/login` 是前台登录页。
- [ ] 访问 `/admin/login` 是后台登录页。
- [ ] 未登录访问 `/admin` 跳 `/admin/login`。
- [ ] 未登录访问前台保护页面跳 `/login`。
- [ ] 普通用户注册成功。
- [ ] 非字母数字账号注册失败。
- [ ] 昵称为空注册失败。
- [ ] 密码少于 6 位注册失败。
- [ ] 密码超过 18 位注册失败。
- [ ] 普通用户登录后显示昵称。
- [ ] 设置页修改昵称后展示更新。
- [ ] 普通用户可以浏览文章。
- [ ] 普通用户可以查看已生成素材卡。
- [ ] 普通用户看不到高级入口。
- [ ] 普通用户直接访问后台失败。
- [ ] 普通用户用邀请码升级为认证用户。
- [ ] 认证用户未配置 AI 时显示配置引导 Dialog。
- [ ] AI Dialog 点击“前往配置”跳 `/settings/ai`。
- [ ] 认证用户未配置 WeWeRSS 时显示配置引导 Dialog。
- [ ] WeWeRSS Dialog 点击“前往配置”跳 `/settings/integrations`。
- [ ] 文章列表标题进入 `/articles/[id]`。
- [ ] `/articles/[id]` 展示正文和元信息。
- [ ] 管理员可以进入 `/admin/dashboard`。
- [ ] 管理员可以创建邀请码。
- [ ] 管理员可以修改用户身份。
- [ ] 管理员可以启用/禁用用户。

## Validation Commands

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [ ] `pnpm exec playwright test`

## Docs / Handoff

- [x] 新建 `tasks/2026-06-10-auth-wewerss-admin-refactor/todolist.md`。
- [x] 更新 `docs/deployment/wewerss-production-deploy.md`。
- [x] 更新 `docs/auth/user-role-and-invitation-design.md`。
- [x] 更新 `docs/admin/admin-console-design.md`。
- [x] 更新 `docs/testing/auth-wewerss-admin-e2e-report.md`。
- [x] 新建 `tasks/2026-06-10-auth-wewerss-admin-refactor/handoff.md`。
- [x] 文档说明 `WEWERSS_BASE_URL=http://wewerss:4000`。
- [x] 文档说明 `NEXT_PUBLIC_WEWERSS_PUBLIC_URL=http://47.119.182.210/wewerss`。
- [x] 文档说明普通用户、认证用户、管理员权限矩阵。
- [x] 文档记录测试结果和未覆盖风险。

## Git Checkpoints

- [ ] `fix: configure wewe rss production url`
- [ ] `fix: split frontend and admin login routes`
- [ ] `feat: add alphanumeric account registration and invitation upgrade`
- [ ] `feat: add admin user and invitation management`
- [ ] `test: cover auth wewe rss and admin workflows`
- [ ] 每个 commit 使用 Lore protocol trailers 记录验证情况。

## Rollback / Safety

- [ ] 迁移前确认只做 additive schema change。
- [ ] 不修改 `User.id`。
- [ ] 不删除历史用户。
- [ ] 不删除历史文章、素材卡、来源。
- [ ] 不删除手动来源。
- [ ] 保留外部 WeRSS fallback。
- [ ] 生产部署前确认 `.env.production` 包含 WeWeRSS 内网和公网地址。
- [ ] 数据库变更前准备备份或 dry-run 说明。
