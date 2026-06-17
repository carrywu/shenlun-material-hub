# 项目审计修复 Todolist

> 创建日期：2026-06-07
> 基于：full-code-review-2026-06-07.md 审查报告
> 分支：fix/code-review-2026-06-07
> 旧版 todolist（2026-06-06 审计）已全部完成，归档于 git history

---

## 阶段 0：测试可信度修复（前置）

- [x] T0-1：修复 `e2e/admin.spec.ts` 永真断言 ✅ `397cb6c`
- [x] T0-2：修复 `e2e/we-mp-rss.spec.ts` 永真断言 ✅ `397cb6c`
- [x] T0-3：修复 `e2e/ai-config.spec.ts` 永真断言 ✅ `397cb6c`
- [x] T0-4：修复 `e2e/middleware.spec.ts` 受保护页面测试继承 admin cookie ✅ `397cb6c`
- [x] T0-5：修复 `e2e/api-security.spec.ts` 公开 API 断言不一致 ✅ `397cb6c`

## 阶段 1：P0 安全问题（部署前必须完成）

- [x] P0-1：登录暴力破解保护 ✅ `9953c63`
- [x] P0-2：移除硬编码 JWT Secret fallback ✅ `9953c63`
- [x] P0-3：添加 Next.js middleware 守卫 admin 路由 ✅ 已有 proxy.ts 覆盖（误报）
- [x] P0-4：Dashboard 服务端鉴权与数据隔离 ✅ `9953c63`
- [x] P0-5：`/api/health` 敏感信息分离 ✅ `9953c63`

## 阶段 2：P1 核心问题

- [x] P1-1：AI 调用重复发送内容 ✅ `6c39536`
- [x] P1-2：统一使用 parseAiJson ✅ `6c39536`
- [x] P1-3：ai-config/test 写入正确配置 ✅ `c05800f`
- [x] P1-4：getTemperature 读取用户配置 ✅ `6c39536`
- [x] P1-5：标注创建设置 userId ✅ `c05800f`
- [x] P1-6：`/api/explore` 添加认证 ✅ `c05800f`
- [x] P1-7：base.ts channelId 正确分配 ✅ `81a9c5b`
- [x] P1-8：MediaCrawler 添加质量门槛 ✅ `81a9c5b`
- [x] P1-9：MediaCrawler 轮询添加最大超时 ✅ `81a9c5b`
- [x] P1-10：文章详情页标注定位修复 ✅ `81a9c5b`
- [x] P1-11：POST content-items 数据完整性 ✅ `26dd196`
- [x] P1-12：POST content-items sourceId 校验 ✅ `26dd196`
- [x] P1-13：`/api/sync` POST 所有权检查 ✅ `26dd196`
- [x] P1-14：`/api/sync` GET 所有权检查 ✅ `26dd196`
- [x] P1-15：管理员数据库大小用 PostgreSQL 查询 ✅ `c05800f`
- [x] P1-16：导出路由类型映射更新 ✅ `c05800f`
- [x] P1-17：Session 过期清理机制 ✅ `c05800f`

## 阶段 3：P2 稳定性/体验/校验问题

- [x] P2-1：加密密钥长度校验 ✅ `84d4dd1`
- [x] P2-2：Docker 默认密码警告 ✅ `84d4dd1`
- [x] P2-3：env-validation ADMIN_PASSWORD vs ADMIN_PASSWORD_HASH ✅ `84d4dd1`
- [x] P2-4：originalUrl 空字符串处理 ✅ `84d4dd1`
- [x] P2-5：审计日志不记录明文邀请码 ✅ `84d4dd1`
- [x] P2-6：requireAuth 区分 401/403 ✅ `84d4dd1`
- [x] P2-7：管理员创建用户验证用户名 ✅ `84d4dd1`
- [x] P2-8：temperature 范围验证 ✅ `84d4dd1`
- [x] P2-9：采集器 HTTP 改 HTTPS ✅ `4cb885b`
- [x] P2-10：硬编码 HTTP scheme 修复 ✅ `4cb885b`
- [x] P2-11：日期提取限定到内容区域 ✅ `4cb885b`
- [x] P2-12：wechatParser 添加重试逻辑 ✅ `4cb885b`
- [x] P2-13：articles API parseInt NaN 防护 ✅ `56467f9`
- [x] P2-14：匿名用户 visibility:null 兼容 ✅ `56467f9`
- [x] P2-15：搜索标签假阳性修复 ✅ `56467f9`
- [x] P2-16：更新 fullText 重算派生字段 ✅ `56467f9`
- [x] P2-17：API Key 掩码减少泄露 ✅ `56467f9`
- [x] P2-18：卡片列表页非管理员按钮隐藏 ✅ `56467f9`
- [x] P2-19：发现页书签/已读状态持久化 ✅ `a7d956d`
- [x] P2-20：Dockerfile standalone pg 模块 ✅ `a7d956d`
- [x] P2-21：配置文件端口统一 ✅ 已验证非问题（dev config=3001, Docker PORT env=3000，互不影响）
- [x] P2-22：selectedText 长度限制 ✅ `a7d956d`

## 阶段 4：P3 代码质量

- [x] P3-1：修复 CSS 拼写 bg-amber-505 ✅ `6523417`
- [ ] P3-2：提取共享 CARD_TYPE_CONFIG（重构，风险较高，延后处理）
- [ ] P3-3：提取共享 renderContent/COLOR_THEMES（重构，风险较高，延后处理）
- [x] P3-4：修复 display-labels "背景背景" ✅ `6523417`
- [x] P3-5：RootNav 变量名修正 ✅ `6523417`
- [x] P3-6：WechatImportDialog alert→toast ✅ `6523417`
- [x] P3-7：ChannelManager alert→toast ✅ `6523417`
- [x] P3-8：backup.ts 避免重复解压 ✅ `6523417`
- [x] P3-9：SHA-256 比较消除长度泄露 ✅ `6523417`
- [x] P3-10：改密码保留当前会话 ✅ `6523417`
- [x] P3-11：永真断言修复（admin.spec.ts）✅ `397cb6c`（T0 已完成）
- [x] P3-12：永真断言修复（we-mp-rss.spec.ts）✅ `397cb6c`（T0 已完成）
- [x] P3-13：受保护页面测试继承 admin cookie ✅ `397cb6c`（T0 已完成）
- [x] P3-14：SyncToIma 权限扩展 VERIFIED_USER ✅ `6523417`
- [x] P3-15：注册页用 Input 组件 ✅ `6523417`
