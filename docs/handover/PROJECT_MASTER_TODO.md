# 项目总 TODO

审计日期：2026-06-05

本文件是全项目 TODO 总源，包含代码证据支持的问题，也包含从项目规划和长期维护目标推导出的任务。

## 统计

- 总任务数：80
- 已完成数量：8
- 未完成数量：72
- P0数量：2
- P1数量：28
- P2数量：34
- P3数量：8

## Top10最高优先级任务

1. ✅ P0｜数据库｜补齐 RBAC Prisma 迁移链
2. ✅ P0｜RBAC｜修复批注单条更新越权
3. ✅ P0｜RBAC｜修复批注单条删除越权
4. ✅ P0｜RBAC｜修复文章批注列表未鉴权
5. ✅ P0｜RBAC｜修复文章列表 API 未鉴权或明确公开策略
6. ✅ P0｜RBAC｜修复 ContentItem 搜索条件和隔离条件合并
7. ✅ P0｜RBAC｜修复 MaterialCard 搜索条件和隔离条件合并
8. ✅ P0｜测试｜新增 RBAC A/B 用户隔离测试夹具
9. P0｜部署｜建立空库迁移与首启验收脚本
10. P0｜安全｜生产禁用默认管理员密码路径

## P0阻断项

- [x] P0｜数据库｜补齐 RBAC Prisma 迁移链
  - 涉及文件：`prisma/schema.prisma`，`prisma/migrations/**/migration.sql`
  - 当前问题：Schema 定义了 `User`、`Session`、owner 字段和关系，但迁移目录没有对应 DDL。
  - 验收标准：空 SQLite 数据库执行迁移后，RBAC 表和 owner 字段均存在。
  - 推荐测试：临时数据库 migrate + `pnpm test`
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜RBAC｜修复批注单条更新越权
  - 涉及文件：`src/app/api/annotations/[id]/route.ts`
  - 当前问题：`PATCH` 只要求登录，不校验批注 owner。
  - 验收标准：用户 A 更新用户 B 批注返回 403。
  - 推荐测试：Vitest route test
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜RBAC｜修复批注单条删除越权
  - 涉及文件：`src/app/api/annotations/[id]/route.ts`
  - 当前问题：`DELETE` 只要求登录，不校验批注 owner。
  - 验收标准：用户 A 删除用户 B 批注返回 403。
  - 推荐测试：Vitest route test
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜RBAC｜修复文章批注列表未鉴权
  - 涉及文件：`src/app/api/content-items/[id]/annotations/route.ts`
  - 当前问题：`GET` 未鉴权，直接返回批注列表。
  - 验收标准：未登录返回 401；跨用户私有文章返回 403 或 404。
  - 推荐测试：Vitest route test
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜RBAC｜修复文章列表 API 未鉴权或明确公开策略
  - 涉及文件：`src/app/api/articles/route.ts`
  - 当前问题：文章列表未鉴权且未使用 owner/visibility 过滤。
  - 验收标准：公开策略明确；不会返回用户私有内容。
  - 推荐测试：用户 A/B article list isolation
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜RBAC｜修复 ContentItem 搜索条件和隔离条件合并
  - 涉及文件：`src/app/api/content-items/route.ts`
  - 当前问题：业务 `OR` 和隔离 `OR` 通过对象展开合并，可能覆盖语义。
  - 验收标准：使用 `AND` 同时组合搜索与隔离。
  - 推荐测试：带 search 的普通用户列表查询
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜RBAC｜修复 MaterialCard 搜索条件和隔离条件合并
  - 涉及文件：`src/app/api/search/route.ts`
  - 当前问题：关键词 `OR` 和 owner `OR` 通过对象展开合并。
  - 验收标准：关键词搜索和 owner 限制同时生效。
  - 推荐测试：用户 A 搜索不到用户 B 卡片
  - 状态：DONE
  - 证据：代码审计

- [x] P0｜测试｜新增 RBAC A/B 用户隔离测试夹具
  - 涉及文件：`src/test/setup.ts`，`src/app/api/**/__tests__`
  - 当前问题：现有 route tests 多 mock guard，不证明真实用户隔离。
  - 验收标准：可复用 userA/userB/admin 请求和数据夹具。
  - 推荐测试：至少内容读取和批注修改两个失败用例
  - 状态：DONE
  - 证据：代码审计

- [ ] P0｜部署｜建立空库迁移与首启验收脚本
  - 涉及文件：`package.json`，`prisma.config.ts`，`DEPLOY.md`
  - 当前问题：构建可过，但空库部署是否可迁移到当前 schema 未被验证。
  - 验收标准：一条命令可在临时 DB 完成 migrate、seed admin、health check。
  - 推荐测试：CI 或本地临时 SQLite 验收
  - 状态：TODO
  - 证据：规划推导

- [ ] P0｜安全｜生产禁用默认管理员密码路径
  - 涉及文件：`src/lib/auth.ts`，`src/scripts/seed-admin.ts`，`.env.example`
  - 当前问题：代码存在默认 `admin123` 初始化路径，生产环境需要强约束。
  - 验收标准：生产缺少显式安全密码配置时启动或 seed 失败。
  - 推荐测试：环境变量矩阵测试
  - 状态：TODO
  - 证据：代码审计

## RBAC与权限

- [ ] P1｜RBAC｜定义 `ownerUserId=null` legacy 数据访问策略
  - 涉及文件：`src/lib/data-isolation.ts`，`src/scripts/migrate-owner-userid.ts`
  - 当前问题：普通用户可见 null-owner legacy 数据。
  - 验收标准：策略写入文档并用测试固定。
  - 推荐测试：null-owner 数据访问单测
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜明确 `VERIFIED_USER` 能力矩阵
  - 涉及文件：`src/lib/auth.ts`，`src/lib/auth-context.tsx`
  - 当前问题：角色存在但能力边界未落到 API 矩阵。
  - 验收标准：每类 API 明确 ADMIN/VERIFIED_USER/USER 权限。
  - 推荐测试：能力矩阵相关 route test
  - 状态：TODO
  - 证据：规划推导

- [ ] P1｜RBAC｜补齐 MaterialCard 创建时 ContentItem 访问校验
  - 涉及文件：`src/app/api/material-cards/route.ts`
  - 当前问题：创建卡片前需校验内容是否可被当前用户访问。
  - 验收标准：不可访问 contentItem 不能生成卡片。
  - 推荐测试：用户 A 用用户 B 私有 contentItem 创建卡片返回 403
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜补齐 Review API 隔离回归测试
  - 涉及文件：`src/app/api/review/route.ts`
  - 当前问题：有隔离代码但缺少证明。
  - 验收标准：用户 A 无法 review 用户 B 卡片。
  - 推荐测试：GET/POST route tests
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜补齐 SyncRecord 隔离回归测试
  - 涉及文件：`src/app/api/sync-records/route.ts`
  - 当前问题：缺少跨用户同步记录隔离测试。
  - 验收标准：用户 A 不看到用户 B sync records。
  - 推荐测试：Vitest route test
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜RBAC｜明确 AsyncTask 非管理员访问策略
  - 涉及文件：`src/app/api/admin/tasks/route.ts`，`src/app/api/admin/tasks/[id]/route.ts`
  - 当前问题：列表代码有 owner filter 注释，但接口是 admin-only。
  - 验收标准：确认只 admin 或新增用户任务接口。
  - 推荐测试：普通用户访问 admin tasks 返回 403
  - 状态：TODO
  - 证据：代码审计

## 前端页面

- [ ] P1｜前端页面｜文章详情页按角色隐藏批注编辑入口
  - 涉及文件：`src/app/articles/[id]/page.tsx`
  - 当前问题：页面有 admin-only 注释区，需要和后端权限保持一致。
  - 验收标准：普通用户看不到不能使用的批注编辑控件。
  - 推荐测试：Playwright 普通用户访问文章详情
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜前端页面｜文章列表增加 owner/visibility 调试列的开发态开关
  - 涉及文件：`src/components/articles/ArticlesPage.tsx`
  - 当前问题：多用户调试时难以看出数据归属。
  - 验收标准：开发态可显示 owner/visibility，生产默认隐藏。
  - 推荐测试：组件渲染测试
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜前端页面｜素材卡详情增加重新生成入口
  - 涉及文件：`src/app/cards/[id]/page.tsx`，`src/components/MaterialCardEditor.tsx`
  - 当前问题：生成失败或内容过期时缺少明确重生成流程。
  - 验收标准：有权限用户可触发重新生成并看到结果或错误。
  - 推荐测试：Playwright 素材卡重新生成流程
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜前端页面｜搜索页增加无结果状态
  - 涉及文件：`src/app/search/page.tsx`
  - 当前问题：搜索隔离后更容易出现无结果，需要清晰反馈。
  - 验收标准：无结果时显示中文空状态和清空筛选入口。
  - 推荐测试：Playwright 搜索无结果
  - 状态：TODO
  - 证据：规划推导

## 管理后台

- [ ] P1｜管理后台｜用户管理页增加禁用用户的会话撤销提示
  - 涉及文件：`src/app/admin/users/page.tsx`，`src/app/api/admin/users/[id]/route.ts`
  - 当前问题：禁用用户和 session revoke 的 UX/反馈需要明确。
  - 验收标准：禁用用户后提示已撤销会话或说明未撤销。
  - 推荐测试：用户管理 route + Playwright
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜管理后台｜侧边栏支持折叠
  - 涉及文件：`src/components/admin/AdminShell.tsx`
  - 当前问题：后台侧边栏固定 64 宽，窄屏效率低。
  - 验收标准：桌面可折叠，状态不遮挡内容。
  - 推荐测试：Playwright 桌面截图
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜管理后台｜移动端菜单适配
  - 涉及文件：`src/components/admin/AdminShell.tsx`
  - 当前问题：后台 shell 使用固定侧栏，移动端不友好。
  - 验收标准：小屏使用抽屉或顶部菜单，内容无重叠。
  - 推荐测试：Playwright mobile viewport
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜管理后台｜系统日志页增加按时间范围筛选
  - 涉及文件：`src/app/admin/logs/page.tsx`，`src/app/api/admin/logs/route.ts`
  - 当前问题：API 支持 level/category，缺少时间范围操作。
  - 验收标准：可按起止时间过滤日志。
  - 推荐测试：route test + Playwright
  - 状态：TODO
  - 证据：规划推导

## 网站采集

- [ ] P1｜网站采集｜采集任务写入 AsyncTask.userId
  - 涉及文件：`src/app/api/collectors/web/collect/route.ts`，`src/lib/async-task.ts`
  - 当前问题：Schema 有任务 userId，但采集任务链路需审计写入一致性。
  - 验收标准：手动触发采集的任务记录包含发起用户。
  - 推荐测试：route test 断言 createAsyncTask 参数
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜网站采集｜广东省政府采集增加异常日志
  - 涉及文件：`src/services/collectors/web/guangdongOfficial.ts`
  - 当前问题：采集异常需要进入统一日志和任务结果。
  - 验收标准：解析失败时记录 source、URL、错误摘要。
  - 推荐测试：collector fixture test
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜网站采集｜湖南省政府栏目解析适配补充 fixture
  - 涉及文件：`src/services/collectors/web/hunanOfficial.ts`，`src/services/collectors/__tests__/hunan-collector.test.ts`
  - 当前问题：已有湖南测试，但需要覆盖更多栏目结构。
  - 验收标准：至少两个栏目 HTML fixture 通过解析。
  - 推荐测试：Vitest collector test
  - 状态：TODO
  - 证据：规划推导

## 微信公众号

- [ ] P1｜微信公众号｜导入文章绑定发起用户或明确公共导入策略
  - 涉及文件：`src/app/api/collectors/wechat/import/route.ts`
  - 当前问题：微信导入是 admin-only，但导入内容 owner/visibility 策略需明确。
  - 验收标准：导入后的 ContentItem owner/visibility 符合策略并有测试。
  - 推荐测试：微信导入 route test
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜微信公众号｜修复脏 HTML 脚本加入验收记录
  - 涉及文件：`scripts/repair-wechat-content.ts`，`docs/acceptance/local-wechat-rss-acceptance.md`
  - 当前问题：清洗脚本存在，需记录 dry-run/apply 验收。
  - 验收标准：文档列出 dry-run 输出示例和回滚方式。
  - 推荐测试：脚本 dry-run
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜微信公众号｜图片代理增加微信 CDN 回归测试
  - 涉及文件：`src/app/api/proxy/image/route.ts`
  - 当前问题：代理有白名单和私网拦截但无测试。
  - 验收标准：允许微信 CDN，拒绝非白名单和私网地址。
  - 推荐测试：Vitest route test
  - 状态：TODO
  - 证据：代码审计

## WeWe RSS

- [ ] P1｜WeWe RSS｜确认 sidecar SQLite fallback 只读约束
  - 涉及文件：`src/services/integrations/wewe-rss-sqlite.ts`
  - 当前问题：项目规则禁止写 WeWe RSS DB，需要用测试固定只读行为。
  - 验收标准：fallback 只执行只读查询，不修改 sidecar DB。
  - 推荐测试：sqlite integration test
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜WeWe RSS｜删除缺失来源流程增加二次确认 E2E
  - 涉及文件：`src/components/integrations/WeweRssIntegrationPage.tsx`
  - 当前问题：规则要求二次确认，需要浏览器测试固定。
  - 验收标准：未确认不能删除，确认后只删除 provider=wewe-rss 来源。
  - 推荐测试：Playwright
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜WeWe RSS｜外部 WeRSS fallback 增加配置诊断
  - 涉及文件：`src/services/integrations/wewe-rss.ts`，`src/app/api/integrations/wewe-rss/status/route.ts`
  - 当前问题：外部 fallback 必须保留，需在状态页可诊断。
  - 验收标准：状态 API 返回 API/OPML/SQLite/fallback 可用性。
  - 推荐测试：route test
  - 状态：TODO
  - 证据：规划推导

## AI评估

- [ ] P1｜AI评估｜AI 配置页增加保存成功提示
  - 涉及文件：`src/components/ai/AiConfigPage.tsx`
  - 当前问题：配置保存后需要明确反馈，避免重复提交。
  - 验收标准：保存成功显示 toast，失败显示安全错误信息。
  - 推荐测试：组件测试或 Playwright
  - 状态：TODO
  - 证据：规划推导

- [ ] P1｜AI评估｜AI reassess 任务绑定发起用户
  - 涉及文件：`src/app/api/content-items/reassess/route.ts`，`src/lib/async-task.ts`
  - 当前问题：异步任务有 `userId` 字段，需要确认 AI 任务写入。
  - 验收标准：任务记录含发起 admin/user id。
  - 推荐测试：route test
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜AI评估｜AI 评分错误进入 SystemLog
  - 涉及文件：`src/services/ai.ts`，`src/lib/logger.ts`
  - 当前问题：生产排障需要统一日志链路。
  - 验收标准：AI provider 错误记录 category=AI 且不泄露 key。
  - 推荐测试：AI runtime error test
  - 状态：TODO
  - 证据：规划推导

## 素材卡生成

- [ ] P1｜素材卡生成｜生成卡片时继承 ContentItem owner
  - 涉及文件：`src/app/api/content-items/[id]/generate-card/route.ts`
  - 当前问题：生成接口 admin-only，但 owner 继承策略需要固定。
  - 验收标准：生成的 MaterialCard owner 与策略一致。
  - 推荐测试：generate-card route test
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜素材卡生成｜素材卡支持重新生成按钮
  - 涉及文件：`src/app/cards/[id]/page.tsx`
  - 当前问题：用户无法从卡片详情直接重新生成。
  - 验收标准：按钮触发重新生成并保留旧版本或提示覆盖。
  - 推荐测试：Playwright
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜素材卡生成｜生成失败保留可重试错误状态
  - 涉及文件：`src/app/api/content-items/[id]/generate-card/route.ts`，`src/components/articles/ArticlesPage.tsx`
  - 当前问题：AI 生成失败后的前端恢复路径需要更明确。
  - 验收标准：失败原因可见，用户可重试。
  - 推荐测试：mock AI 失败 route/component test
  - 状态：TODO
  - 证据：规划推导

## IMA同步

- [ ] P1｜IMA同步｜同步前校验 MaterialCard owner
  - 涉及文件：`src/app/api/sync/route.ts`，`src/services/ima-sync.ts`
  - 当前问题：sync 是 admin-only，但同步记录和卡片 owner 关系需固定。
  - 验收标准：不能同步无权访问的卡片；SyncRecord 写入 userId。
  - 推荐测试：route test
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜IMA同步｜失败重试策略文档化
  - 涉及文件：`src/services/ima-sync.ts`，`docs/handover/PROJECT_MASTER_TODO.md`
  - 当前问题：远端上传失败后的重试/幂等策略需要明确。
  - 验收标准：记录 retry 次数、错误码、人工恢复步骤。
  - 推荐测试：mock IMA 失败单测
  - 状态：TODO
  - 证据：规划推导

- [ ] P3｜IMA同步｜同步记录页增加远端文档链接
  - 涉及文件：`src/components/sync/SyncRecordsPage.tsx`
  - 当前问题：有 `remoteDocumentId` 字段但前端可跳转性需增强。
  - 验收标准：成功记录显示可点击远端链接或复制 ID。
  - 推荐测试：组件测试
  - 状态：TODO
  - 证据：规划推导

## 数据库

- [ ] P1｜数据库｜为 owner 字段补齐索引
  - 涉及文件：`prisma/schema.prisma`
  - 当前问题：部分 owner/user 字段已建索引，但 `ContentItem.ownerUserId` 未见 index。
  - 验收标准：常用隔离字段均有索引。
  - 推荐测试：Prisma migration diff review
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜数据库｜历史 owner 迁移脚本增加审计输出文件
  - 涉及文件：`src/scripts/migrate-owner-userid.ts`
  - 当前问题：脚本 dry-run 输出在终端，缺少可归档报告。
  - 验收标准：dry-run 可输出 JSON/Markdown 审计文件。
  - 推荐测试：脚本 dry-run
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜数据库｜备份恢复流程加入 RBAC 表校验
  - 涉及文件：`src/lib/backup.ts`，`src/app/api/admin/backup/**`
  - 当前问题：备份恢复需覆盖 User/Session/owner 字段一致性。
  - 验收标准：恢复后 auth 和 owner 数据完整。
  - 推荐测试：backup unit test
  - 状态：TODO
  - 证据：规划推导

## 异步任务

- [ ] P1｜异步任务｜createAsyncTask 支持必填 userId 参数
  - 涉及文件：`src/lib/async-task.ts`
  - 当前问题：Schema 有 userId，但 helper test 只断言 type/status/params。
  - 验收标准：需要用户上下文的任务必须传入 userId。
  - 推荐测试：async-task unit test
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜异步任务｜任务详情增加 result JSON 安全解析
  - 涉及文件：`src/app/admin/tasks/page.tsx`
  - 当前问题：任务 result 为 JSON 字符串，前端需要稳定展示异常格式。
  - 验收标准：非法 JSON 不导致页面崩溃。
  - 推荐测试：component test
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜异步任务｜任务列表增加发起用户筛选
  - 涉及文件：`src/app/admin/tasks/page.tsx`，`src/app/api/admin/tasks/route.ts`
  - 当前问题：多用户后 admin 需要按用户排查任务。
  - 验收标准：admin 可按 username/userId 筛选任务。
  - 推荐测试：route test + Playwright
  - 状态：TODO
  - 证据：规划推导

## API

- [ ] P1｜API｜为所有 admin route 增加 401/403 route tests
  - 涉及文件：`src/app/api/admin/**/__tests__`
  - 当前问题：大量 admin route 无测试。
  - 验收标准：未登录 401，普通用户 403。
  - 推荐测试：Vitest table-driven route tests
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜API｜明确公开 GET API 清单
  - 涉及文件：`src/proxy.ts`，`docs/handover/RBAC_API_AUDIT.md`
  - 当前问题：proxy 和 route guard 对公开 GET 的策略不完全显式。
  - 验收标准：公开 API 清单、返回字段、数据范围写入文档并测试。
  - 推荐测试：public API snapshot tests
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜API｜统一 401/403 判断逻辑
  - 涉及文件：`src/lib/auth.ts`，`src/app/api/**/route.ts`
  - 当前问题：多个 route 手写 cookie 判断 401/403。
  - 验收标准：使用统一 helper，行为一致。
  - 推荐测试：auth helper unit test
  - 状态：TODO
  - 证据：代码审计

## 测试体系

- [ ] P1｜测试体系｜新增权限矩阵测试文档
  - 涉及文件：`docs/testing/**`，`docs/handover/RBAC_MASTER_TODO.md`
  - 当前问题：缺少系统化 RBAC 测试矩阵。
  - 验收标准：列出每个角色对关键 API 的预期状态码。
  - 推荐测试：文档驱动 route tests
  - 状态：TODO
  - 证据：规划推导

- [ ] P1｜测试体系｜将 route guard mock 测试补充为真实 guard 测试
  - 涉及文件：`src/app/api/**/__tests__/route.test.ts`
  - 当前问题：mock guard 不证明 cookie/session 提取链路。
  - 验收标准：关键接口至少有真实 session cookie 测试。
  - 推荐测试：Vitest + test DB
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜测试体系｜测试命令加入 CI 文档
  - 涉及文件：`README.md`，`DEPLOY.md`
  - 当前问题：项目有 lint/test/build/playwright 命令，但 CI 契约不完整。
  - 验收标准：文档列出本地和 CI 验证顺序。
  - 推荐测试：人工文档检查
  - 状态：TODO
  - 证据：规划推导

## Playwright

- [ ] P1｜Playwright｜覆盖普通用户访问管理员页面
  - 涉及文件：`e2e/admin-auth.spec.ts`
  - 当前问题：只覆盖未登录和管理员登录。
  - 验收标准：普通用户访问 `/admin` 被拒绝或重定向。
  - 推荐测试：Playwright
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜Playwright｜覆盖素材卡生成流程
  - 涉及文件：`e2e/**`
  - 当前问题：缺少端到端素材卡生成验收。
  - 验收标准：从文章触发生成，到卡片列表/详情可见。
  - 推荐测试：Playwright mock AI 或测试配置
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜Playwright｜覆盖 WeWe RSS 删除缺失来源确认
  - 涉及文件：`e2e/subscriptions-wewe-rss.spec.ts`
  - 当前问题：已有页面加载测试，缺少删除确认流程。
  - 验收标准：取消不删除，确认后执行。
  - 推荐测试：Playwright
  - 状态：TODO
  - 证据：规划推导

## 部署

- [ ] P1｜部署｜补齐生产环境变量检查
  - 涉及文件：`.env.example`，`src/lib/crypto.ts`，`src/services/ai.ts`
  - 当前问题：AI、加密、数据库、管理员凭据需要启动前校验。
  - 验收标准：缺少必需 env 时给出明确错误。
  - 推荐测试：env validation unit test
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜部署｜部署文档增加迁移回滚步骤
  - 涉及文件：`DEPLOY.md`
  - 当前问题：数据库迁移失败时的回滚流程不明确。
  - 验收标准：文档包含备份、迁移、验证、回滚步骤。
  - 推荐测试：人工演练
  - 状态：TODO
  - 证据：规划推导

## Docker

- [ ] P2｜Docker｜docker-compose 增加健康检查
  - 涉及文件：`docker-compose.yml`
  - 当前问题：服务健康状态未被容器编排显式检查。
  - 验收标准：healthcheck 调用 `/api/health` 或等价命令。
  - 推荐测试：docker compose config
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜Docker｜WeWe RSS sidecar 文档标明只读挂载策略
  - 涉及文件：`infra/wechat-rss/wewe-rss/docker-compose.yml`，`infra/wechat-rss/wewe-rss/README.md`
  - 当前问题：规则要求不写 sidecar DB，需要部署层说明。
  - 验收标准：文档说明本项目只读消费 sidecar 数据。
  - 推荐测试：配置审查
  - 状态：TODO
  - 证据：规划推导

## 监控告警

- [ ] P2｜监控告警｜SystemLog 增加错误等级仪表盘
  - 涉及文件：`src/app/admin/logs/page.tsx`
  - 当前问题：日志可查询，但缺少错误趋势和告警视图。
  - 验收标准：admin 可看到最近 24h ERROR/WARN 数量。
  - 推荐测试：route + component test
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜监控告警｜AsyncTask 失败率监控
  - 涉及文件：`src/app/admin/page.tsx`，`src/app/api/admin/metrics/route.ts`
  - 当前问题：任务失败需要进入运营视图。
  - 验收标准：后台首页展示失败任务计数和入口。
  - 推荐测试：metrics route test
  - 状态：TODO
  - 证据：规划推导

## 安全

- [ ] P1｜安全｜图片代理 SSRF 测试
  - 涉及文件：`src/app/api/proxy/image/route.ts`
  - 当前问题：有 allowlist，但缺少回归测试。
  - 验收标准：拒绝 http、localhost、私网、非白名单域名。
  - 推荐测试：Vitest route test
  - 状态：TODO
  - 证据：代码审计

- [ ] P1｜安全｜AI key 脱敏日志审计
  - 涉及文件：`src/services/ai.ts`，`src/lib/logger.ts`
  - 当前问题：已有部分安全诊断测试，需全链路确认不泄露 key。
  - 验收标准：错误响应和日志只显示后缀或不显示 key。
  - 推荐测试：AI runtime tests
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜安全｜备份导入增加文件大小限制
  - 涉及文件：`src/app/api/admin/backup/import/route.ts`
  - 当前问题：备份导入是高风险入口，需要大小和类型限制。
  - 验收标准：超限文件返回 413 或 400。
  - 推荐测试：route test
  - 状态：TODO
  - 证据：规划推导

## 性能

- [ ] P2｜性能｜ContentItem owner 查询增加索引验证
  - 涉及文件：`prisma/schema.prisma`
  - 当前问题：多用户列表查询会频繁使用 owner/visibility。
  - 验收标准：常用过滤字段有索引并通过 explain 或查询审查。
  - 推荐测试：migration review
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜性能｜文章列表分页增加稳定排序兜底
  - 涉及文件：`src/app/api/articles/route.ts`，`src/app/api/content-items/route.ts`
  - 当前问题：仅按时间排序时同时间记录分页可能不稳定。
  - 验收标准：排序包含 `id` 兜底或明确稳定排序策略。
  - 推荐测试：route test
  - 状态：TODO
  - 证据：规划推导

- [ ] P3｜性能｜搜索接口规划全文索引替代 contains
  - 涉及文件：`src/app/api/search/route.ts`
  - 当前问题：SQLite contains 查询随数据增长会变慢。
  - 验收标准：形成 FTS 或外部索引方案。
  - 推荐测试：性能基准
  - 状态：TODO
  - 证据：规划推导

## 文档

- [ ] P1｜文档｜将 RBAC API 审计纳入维护流程
  - 涉及文件：`docs/handover/RBAC_API_AUDIT.md`
  - 当前问题：API 权限表需要随 route 变更更新。
  - 验收标准：新增 route 的 PR 必须更新审计表或说明无需更新。
  - 推荐测试：PR checklist
  - 状态：TODO
  - 证据：规划推导

- [ ] P2｜文档｜README 增加完整本地启动流程
  - 涉及文件：`README.md`
  - 当前问题：README 目前非常简短。
  - 验收标准：包含安装、env、迁移、seed、dev、test。
  - 推荐测试：新环境手动演练
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜文档｜CLAUDE.md 和 AGENTS.md 保持同步检查
  - 涉及文件：`CLAUDE.md`，`AGENTS.md`
  - 当前问题：两份规则需长期同步。
  - 验收标准：关键约束一致，差异有说明。
  - 推荐测试：文档审查
  - 状态：TODO
  - 证据：规划推导

## 技术债

- [ ] P2｜技术债｜统一 API where 条件构造 helper
  - 涉及文件：`src/lib/data-isolation.ts`，`src/app/api/**/route.ts`
  - 当前问题：多个 route 手写 where merge，容易产生 OR 覆盖。
  - 验收标准：提供 `andWhere()` 或等价 helper 并迁移高风险 route。
  - 推荐测试：helper unit test
  - 状态：TODO
  - 证据：代码审计

- [ ] P2｜技术债｜统一 API 错误响应格式
  - 涉及文件：`src/lib/api-error.ts`，`src/app/api/**/route.ts`
  - 当前问题：部分 route 手写 `{ error }` 和状态码。
  - 验收标准：错误响应结构和中文提示一致。
  - 推荐测试：api-error unit test
  - 状态：TODO
  - 证据：规划推导

- [ ] P3｜技术债｜移除或封存 legacy JWT 支持
  - 涉及文件：`src/lib/auth.ts`
  - 当前问题：legacy JWT 兼容增加认证复杂度。
  - 验收标准：确认无旧 token 依赖后删除或加过期计划。
  - 推荐测试：auth tests
  - 状态：TODO
  - 证据：代码审计

- [ ] P3｜技术债｜整理 generated Prisma client 提交流程
  - 涉及文件：`src/generated/prisma/**`
  - 当前问题：生成产物已提交，需明确何时更新。
  - 验收标准：文档说明 schema 改动后如何 regenerate 和 review。
  - 推荐测试：build
  - 状态：TODO
  - 证据：规划推导

## 长期规划

- [ ] P3｜长期规划｜定义多用户协作模式
  - 涉及文件：`docs/handover/RBAC_ARCHITECTURE.md`
  - 当前问题：当前模型偏个人 owner，协作/共享空间未设计。
  - 验收标准：明确个人、公共、团队空间的数据模型方向。
  - 推荐测试：架构评审
  - 状态：TODO
  - 证据：规划推导

- [ ] P3｜长期规划｜规划素材卡版本历史
  - 涉及文件：`prisma/schema.prisma`，`src/components/MaterialCardEditor.tsx`
  - 当前问题：重新生成和人工编辑需要版本策略。
  - 验收标准：形成版本表或快照方案。
  - 推荐测试：设计评审
  - 状态：TODO
  - 证据：规划推导

- [ ] P3｜长期规划｜规划采集源质量自动降权
  - 涉及文件：`src/services/source-quality.ts`
  - 当前问题：已有质量指标，长期可用于自动降权。
  - 验收标准：定义降权阈值、人工复核和恢复机制。
  - 推荐测试：source-quality unit test
  - 状态：TODO
  - 证据：规划推导

- [ ] P3｜长期规划｜规划外部搜索/向量检索
  - 涉及文件：`src/app/api/search/route.ts`
  - 当前问题：当前搜索以数据库 contains 为主，长期扩展有限。
  - 验收标准：形成 FTS/向量/外部服务选型文档。
  - 推荐测试：搜索质量评估集
  - 状态：TODO
  - 证据：规划推导
