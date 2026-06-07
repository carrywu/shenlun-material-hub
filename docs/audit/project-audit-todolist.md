# 项目审计修复 Todolist

> 创建日期：2026-06-07
> 基于：full-code-review-2026-06-07.md 审查报告
> 分支：fix/code-review-2026-06-07
> 旧版 todolist（2026-06-06 审计）已全部完成，归档于 git history

---

## 阶段 0：测试可信度修复（前置）

- [x] T0-1：修复 `e2e/admin.spec.ts` 永真断言 ✅ `397cb6c`
- [x] T0-2：修复 `e2e/wewe-rss.spec.ts` 永真断言 ✅ `397cb6c`
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

- [ ] P1-1：AI 调用重复发送内容
- [ ] P1-2：统一使用 parseAiJson
- [ ] P1-3：ai-config/test 写入正确配置
- [ ] P1-4：getTemperature 读取用户配置
- [ ] P1-5：标注创建设置 userId
- [ ] P1-6：`/api/explore` 添加认证
- [ ] P1-7：base.ts channelId 正确分配
- [ ] P1-8：MediaCrawler 添加质量门槛
- [ ] P1-9：MediaCrawler 轮询添加最大超时
- [ ] P1-10：文章详情页标注定位修复
- [ ] P1-11：POST content-items 数据完整性
- [ ] P1-12：POST content-items sourceId 校验
- [ ] P1-13：`/api/sync` POST 所有权检查
- [ ] P1-14：`/api/sync` GET 所有权检查
- [ ] P1-15：管理员数据库大小用 PostgreSQL 查询
- [ ] P1-16：导出路由类型映射更新
- [ ] P1-17：Session 过期清理机制

## 阶段 3：P2 稳定性/体验/校验问题

- [ ] P2-1：加密密钥长度校验
- [ ] P2-2：Docker 默认密码警告
- [ ] P2-3：env-validation ADMIN_PASSWORD vs ADMIN_PASSWORD_HASH
- [ ] P2-4：originalUrl 空字符串处理
- [ ] P2-5：审计日志不记录明文邀请码
- [ ] P2-6：requireAuth 区分 401/403
- [ ] P2-7：管理员创建用户验证用户名
- [ ] P2-8：temperature 范围验证
- [ ] P2-9：采集器 HTTP 改 HTTPS
- [ ] P2-10：API parseInt NaN 处理
- [ ] P2-11：匿名用户 visibility:null 兼容
- [ ] P2-12：搜索标签假阳性修复
- [ ] P2-13：更新 fullText 重算派生字段
- [ ] P2-14：API Key 掩码减少泄露
- [ ] P2-15：卡片列表页非管理员按钮隐藏
- [ ] P2-16：发现页书签/已读状态持久化
- [ ] P2-17：Dockerfile standalone pg 模块
- [ ] P2-18：配置文件端口统一
- [ ] P2-19：selectedText 长度限制
- [ ] P2-20：admin dashboard 双重 fetch
- [ ] P2-21：WechatImportDialog 用 toast 替换 alert
- [ ] P2-22：ChannelManager 用 toast 替换 alert

## 阶段 4：P3 代码质量

- [ ] P3-1：修复 CSS 拼写 bg-amber-505
- [ ] P3-2：提取共享 CARD_TYPE_CONFIG
- [ ] P3-3：提取共享 renderContent/COLOR_THEMES
- [ ] P3-4：修复 display-labels "背景背景"
- [ ] P3-5：RootNav 变量名修正
- [ ] P3-6：backup.ts 避免重复解压
- [ ] P3-7：改密码保留当前会话
- [ ] P3-8：SyncToIma 权限扩展 VERIFIED_USER
- [ ] P3-9：注册页用 Input 组件
