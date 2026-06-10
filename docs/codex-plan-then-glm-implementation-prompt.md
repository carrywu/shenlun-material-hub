# Codex 前置规划提示词：账号体系 / WeWeRSS / 后台管理 / 配置引导修复计划

> 使用对象：Codex / Claude Code / Gemini / GLM  
> 当前阶段：**只做代码阅读、问题定位、开发计划和修复文档产出，不要直接修改业务代码**  
> 目标：让 Codex 先完整审查项目现状，生成可交给 GLM 执行的开发计划与修复代码文档，并放入 `docs/` 目录。

---

## 一、任务背景

当前项目是 `shenlun-material-hub` 申论素材采集与学习系统。

本轮需求不是单点 bug 修复，而是围绕以下方向做一次系统性修复与重构规划：

1. WeWeRSS 同服务器部署适配；
2. AI / WeWeRSS 未配置时的友好弹窗引导；
3. `/articles/[id]` 文章详情页跳转与展示修复；
4. 前台 `/login` 与后台 `/admin/login` 登录路由拆分；
5. 注册功能、邀请码认证、字母数字账号体系；
6. 后台管理独立化；
7. 后台用户身份管理和邀请码管理；
8. 普通用户、认证用户、管理员的权限边界梳理；
9. Playwright / 单元测试 / 构建测试补齐；
10. 输出可交给 GLM 执行的修复代码实施文档。

---

## 二、已确认需求

### 2.1 WeWeRSS 部署方式

已确认：

```md
WeWeRSS 与申论项目部署在同一台服务器上。
优先按 Docker Compose 同机 / 同网络容器方案处理。
```

要求：

```md
- 线上不能写死 `http://localhost:4000`
- 本地开发可以默认使用 `http://localhost:4000`
- 生产环境必须通过环境变量配置
- 如果未配置 WeWeRSS，不能跳 localhost，应该显示中文配置缺失提示
- “打开 WeWe 后台”按钮必须使用可配置的公网/反代地址
```

建议环境变量设计：

```env
# 后端容器访问 WeWeRSS 的内网地址
WEWERSS_BASE_URL=http://wewerss:4000

# 浏览器打开 WeWeRSS 后台使用的公网/反代地址
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=/wewerss
# 或
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=https://your-domain.com/wewerss

# SQLite 只读兜底路径，如项目确实需要
WEWERSS_DB_PATH=/data/wewe-rss/wewe-rss.db
```

---

### 2.2 普通用户权限

已确认：

```md
普通用户可以看文章和已生成素材卡，但不能使用 AI 功能。
```

权限边界：

```md
USER 普通用户：
- 可以浏览文章列表
- 可以进入文章详情页
- 可以查看已生成素材卡
- 不可以 AI 评估
- 不可以 AI 生成素材卡
- 不可以批量生成素材卡
- 不可以同步 WeWeRSS
- 不可以进入后台管理

VERIFIED_USER 认证用户：
- 拥有普通用户能力
- 可以配置自己的 AI
- 可以使用 AI 评估 / 素材卡生成
- 可以使用允许开放给认证用户的采集 / 同步能力
- 如果未配置 AI / WeWeRSS，使用相关功能时弹 Dialog 引导

ADMIN 管理员：
- 拥有认证用户能力
- 可以进入 `/admin/*`
- 可以管理用户身份
- 可以管理邀请码
- 可以管理全局配置
- 可以访问后台任务、来源、采集、系统维护等管理能力
```

---

### 2.3 字母数字账号

默认按以下规则规划：

```md
- 用户登录账号必须是数字和/或英文字母，例如 admin、testuser、abc123
- 数据库内部原有 `id` / cuid / uuid 不要强行改主键
- 字母数字账号建议继续使用 `username`，但必须确保唯一且只含字母和数字
- 注册时由用户自行输入字母数字账号
- 注册成功后明确提示用户保存账号
```

---

### 2.4 后台独立程度

默认按以下规则规划：

```md
当前阶段不拆成两个项目。
仍在同一个 Next.js 项目内实现 `/admin/*` 独立后台。
```

要求：

```md
- `/admin/*` 使用独立 AdminLayout
- 后台不要复用前台导航
- 后台登录页 `/admin/login` 与前台登录页 `/login` 分离
- 后台 API 使用 `/api/admin/*`
- 后台权限守卫只允许 ADMIN
- 普通用户 / 认证用户访问后台时显示无权限或跳转前台
```

---

### 2.5 邀请码规则

默认按以下规则规划：

```md
邀请码由管理员创建。
邀请码支持配置使用次数、过期时间、启用/禁用、备注。
```

注册和升级规则：

```md
- 无邀请码注册：创建 USER 普通用户
- 有有效邀请码注册：创建 VERIFIED_USER 认证用户，并记录邀请码使用记录
- 普通用户设置页可以输入邀请码升级为 VERIFIED_USER
- 无效邀请码 / 已过期邀请码 / 使用次数耗尽邀请码必须有中文提示
- 邀请码使用后需要记录使用人、使用时间、注册来源
```

---

## 三、已观察到的代码问题线索

Codex 需要继续验证，不要只相信下面线索。请通过代码阅读确认真实情况。

### 3.1 WeWeRSS localhost 写死

已观察到以下可疑点：

```ts
const baseUrl = process.env.WEWERSS_BASE_URL ?? "http://localhost:4000";
```

位置可能在：

```txt
src/app/api/integrations/wewe-rss/status/route.ts
```

还观察到前端集成页可能存在：

```ts
const [baseUrl, setBaseUrl] = useState("http://localhost:4000");
```

以及“打开 WeWe 后台”按钮可能直接写死：

```tsx
<a href="http://localhost:4000" target="_blank">
```

位置可能在：

```txt
src/components/integrations/WeweRssIntegrationPage.tsx
```

要求 Codex 检查所有 WeWeRSS 相关文件：

```txt
src/app/api/integrations/wewe-rss/**
src/components/integrations/**
src/app/settings/integrations/**
docs/local-wechat-rss.md
docker-compose*.yml
.env*
README.md
```

---

### 3.2 WeWeRSS 权限可能只允许管理员

已观察到 WeWeRSS 状态接口可能使用：

```ts
const user = await requireAdmin(request);
```

需要 Codex 判断是否合理。

本轮目标不是简单全部改成认证用户，而是要分清：

```md
- 后台全局管理接口：ADMIN
- 认证用户个人配置 / 使用接口：VERIFIED_USER 或 ADMIN
- 公开读取接口：按业务决定是否允许 USER
```

请输出权限矩阵。

---

### 3.3 RBAC 基础已存在

已观察到项目中可能已有：

```ts
export type UserRole = "ADMIN" | "VERIFIED_USER" | "USER";
export async function requireAdmin(...)
export async function requireVerifiedUser(...)
```

位置可能在：

```txt
src/lib/auth.ts
```

请 Codex 检查是否已有：

```md
- 登录 API
- 注册 API
- 会话 cookie
- 用户表
- 角色字段
- 用户状态字段
- 管理员初始化逻辑
- 防止最后一个管理员被禁用/降级的逻辑
```

---

### 3.4 文章详情页问题

用户反馈：

```txt
类似路由 http://47.119.182.210/articles/cmq7sciq700171cnzx5tqtydm
点击后应该跳转进文章详情页
```

Codex 需要检查：

```txt
src/app/articles/page.tsx
src/app/articles/[id]/page.tsx
src/app/api/content-items/[id]/**
src/components/ArticleDetail.tsx
src/components/**/*Article*.tsx
```

目标：

```md
- 文章列表点击标题/卡片进入站内 `/articles/[id]`
- `/articles/[id]` 能展示文章详情
- 不跳原站
- 外部原文入口单独保留为“查看原文”
- 详情页包含标题、来源、发布时间、采集时间、正文、图片、AI 评估、素材卡状态
- 文章不存在时显示中文 404 / 空状态
- 正文为空时显示“暂无全文内容”
```

---

### 3.5 AI 未配置错误提示生硬

用户反馈：

```md
认证用户没有配置 AI 时，应该提示未配置 AI。
不应该生硬地处理“缺乏数组”等内部错误。
```

Codex 需要检查：

```txt
src/app/api/**/*ai*
src/app/api/content-items/[id]/generate-card/**
src/lib/api-error*
src/services/ai/**
src/components/**/*
src/app/settings/ai/**
```

目标：

```md
- 后端返回结构化错误码，例如 `AI_CONFIG_MISSING`
- 前端识别错误码后弹 Dialog
- Dialog 文案中文友好
- 支持“取消”和“前往配置”
- 点击“前往配置”跳转 `/settings/ai`
```

---

## 四、Codex 当前阶段必须做的事

### 4.1 只读审查

请先完整阅读相关代码，不要立刻修改。

必须审查：

```txt
src/lib/auth.ts
src/middleware.ts
src/app/login/**
src/app/admin/login/**
src/app/admin/**
src/app/api/auth/**
src/app/api/admin/**
src/app/api/integrations/wewe-rss/**
src/components/integrations/**
src/app/settings/**
src/app/articles/**
src/components/ArticleDetail.tsx
src/app/api/content-items/**
prisma/schema.prisma
docker-compose*.yml
.env.example
README.md
e2e/**
tests/**
docs/**
```

如果某些文件不存在，必须在文档里明确写出：

```md
- 未找到：xxx
- 影响：xxx
- 建议新增：xxx
```

不要假装已经存在。

---

### 4.2 生成开发计划文档

请在 `docs/` 目录下新增文档：

```txt
docs/auth-wewerss-admin-refactor-plan.md
```

文档必须包含：

```md
# 账号体系 / WeWeRSS / 后台管理 / 配置引导修复开发计划

## 1. 当前代码现状
## 2. 已确认需求
## 3. 问题清单
## 4. 权限矩阵
## 5. 数据库改造计划
## 6. API 改造计划
## 7. 前端页面改造计划
## 8. 后台管理改造计划
## 9. WeWeRSS 部署改造计划
## 10. 错误提示和 Dialog 统一方案
## 11. 测试计划
## 12. 风险点和回滚方案
## 13. 开发任务 TodoList
```

TodoList 必须细到小颗粒度，例如：

```md
- [ ] 检查当前 User model 是否已有 role/status 字段
- [ ] 检查是否已有注册 API
- [ ] 设计 InvitationCode model
- [ ] 设计 InvitationCodeUseLog model
- [ ] 新增 `/register` 页面
- [ ] 新增 `/api/auth/register`
- [ ] 新增普通用户设置页邀请码升级入口
- [ ] 修复 WeWeRSS 后端 baseUrl 配置来源
- [ ] 修复 WeWeRSS 前端 publicUrl 打开后台地址
- [ ] 新增 MissingConfigDialog 组件
- [ ] 修复 `/articles/[id]` 页面
- [ ] 新增 Playwright 注册流程测试
```

---

### 4.3 生成 GLM 执行文档

请在 `docs/` 目录下新增第二份文档：

```txt
docs/glm-implementation-prompt-auth-wewerss-admin.md
```

这份文档是给 GLM 写代码用的，要求：

```md
- 不能只是计划，必须是可执行的编码指令
- 明确要修改哪些文件
- 明确新增哪些文件
- 明确数据库迁移怎么做
- 明确 API 返回格式
- 明确前端组件交互
- 明确权限判断
- 明确测试命令
- 明确验收标准
```

文档结构建议：

```md
# GLM 执行提示词：账号体系 / WeWeRSS / 后台管理 / 配置引导修复

## 任务目标
## 已确认用户需求
## 代码现状摘要
## 必须修改的文件
## 必须新增的文件
## 数据库 Schema 修改
## API 设计
## 前端页面设计
## 后台管理设计
## 配置缺失 Dialog 设计
## WeWeRSS Docker Compose / 环境变量设计
## 文章详情页修复要求
## 权限规则
## 测试要求
## 交付要求
## 禁止事项
```

---

### 4.4 更新交接文档

如果项目已有交接目录，例如：

```txt
tasks/
docs/handover/
docs/audit/
```

请新增或更新本轮交接文档：

```txt
tasks/YYYY-MM-DD-auth-wewerss-admin-refactor/handoff.md
tasks/YYYY-MM-DD-auth-wewerss-admin-refactor/todolist.md
```

如果项目没有类似目录，请只在 `docs/` 里记录，不要乱建无关目录。

---

## 五、后续 GLM 执行阶段要求

Codex 生成计划后，GLM 才开始写代码。

GLM 执行时必须遵守：

```md
1. 先读 Codex 生成的：
   - docs/auth-wewerss-admin-refactor-plan.md
   - docs/glm-implementation-prompt-auth-wewerss-admin.md

2. 按 TodoList 顺序开发。

3. 每完成一个小任务：
   - 更新 TodoList 勾选状态
   - 记录改动文件
   - 说明验证方式

4. 不允许大爆炸式重构。

5. 不允许删除已有功能，除非文档明确要求。

6. 不允许用英文错误提示面向用户。

7. 不允许将生产地址写死为 localhost。

8. 不允许普通用户调用 AI 生成 / 评估接口。

9. 不允许认证用户未配置 AI 时出现内部异常。

10. 不允许 `/admin/*` 与前台登录逻辑混在一起。
```

---

## 六、修复实施建议顺序

### P0：先修会影响线上使用的问题

```md
- [ ] WeWeRSS localhost 写死问题
- [ ] WeWeRSS 生产环境变量和 Docker Compose 同机部署方案
- [ ] `/articles/[id]` 详情页跳转和展示
- [ ] `/login` 与 `/admin/login` 分离
- [ ] AI 未配置时的结构化错误和中文提示
```

### P1：账号体系和邀请码

```md
- [ ] 注册页面
- [ ] 注册 API
- [ ] 字母数字账号生成
- [ ] 无邀请码注册普通用户
- [ ] 有邀请码注册认证用户
- [ ] 普通用户设置页输入邀请码升级
```

### P2：后台管理

```md
- [ ] AdminLayout 独立
- [ ] 用户管理页
- [ ] 修改用户身份
- [ ] 邀请码管理页
- [ ] 创建 / 禁用 / 设置次数 / 设置过期时间
- [ ] 防止最后一个管理员被降级或禁用
```

### P3：统一体验和测试

```md
- [ ] MissingConfigDialog
- [ ] 所有配置缺失统一弹窗
- [ ] 所有用户可见错误中文化
- [ ] Playwright 端到端测试
- [ ] 单元测试
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm build
```

---

## 七、验收标准

### 7.1 WeWeRSS

```md
- [ ] 线上页面不再跳转 `http://localhost:4000`
- [ ] 后端访问 WeWeRSS 使用 `WEWERSS_BASE_URL`
- [ ] 浏览器打开 WeWe 后台使用 `NEXT_PUBLIC_WEWERSS_PUBLIC_URL`
- [ ] 未配置时显示中文提示，不白屏、不 500
- [ ] Docker Compose 同机部署方案写入文档
```

### 7.2 AI 配置缺失

```md
- [ ] 认证用户未配置 AI 时，点击 AI 评估弹 Dialog
- [ ] 认证用户未配置 AI 时，点击生成素材卡弹 Dialog
- [ ] Dialog 有“取消”和“前往配置”
- [ ] 点击“前往配置”跳转 `/settings/ai`
- [ ] 不再出现“缺乏数组”这类内部错误
```

### 7.3 文章详情页

```md
- [ ] `/articles` 点击文章标题进入 `/articles/[id]`
- [ ] `/articles/[id]` 能正常渲染
- [ ] 不默认跳原站
- [ ] 外部原文入口单独显示
- [ ] 文章不存在显示中文 404 / 空状态
```

### 7.4 登录与注册

```md
- [ ] 默认登录入口是 `/login`
- [ ] 后台登录入口是 `/admin/login`
- [ ] 无邀请码注册为 USER
- [ ] 有邀请码注册为 VERIFIED_USER
- [ ] 注册账号为字母数字账号
- [ ] 普通用户可在设置页输入邀请码升级
```

### 7.5 后台管理

```md
- [ ] `/admin/*` 使用独立后台布局
- [ ] 非 ADMIN 不能进入后台
- [ ] 后台可以查看用户列表
- [ ] 后台可以修改用户身份
- [ ] 后台可以创建和管理邀请码
- [ ] 不能禁用或降级最后一个管理员
```

### 7.6 测试

必须通过：

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

如果项目实际命令不同，以 `package.json` 为准，但必须在文档里说明。

必须新增或更新测试：

```md
- [ ] 注册无邀请码 -> 普通用户
- [ ] 注册有邀请码 -> 认证用户
- [ ] 普通用户不能生成素材卡
- [ ] 认证用户未配置 AI -> 弹配置 Dialog
- [ ] `/articles/[id]` 正常访问
- [ ] `/login` 和 `/admin/login` 分离
- [ ] 普通用户访问 `/admin` 被拒绝
- [ ] 管理员可以进入邀请码管理
- [ ] WeWeRSS 未配置时显示中文提示
```

---

## 八、禁止事项

```md
- 禁止直接把线上地址写死进代码
- 禁止继续使用 `http://localhost:4000` 作为生产兜底
- 禁止普通用户调用 AI 评估 / AI 生成接口
- 禁止认证用户未配置 AI 时抛内部异常
- 禁止前台和后台登录逻辑混用
- 禁止删除已有数据模型而不写迁移和回滚方案
- 禁止跳过 Playwright 测试
- 禁止只改前端不改后端权限
- 禁止只改文案不改错误码
- 禁止假装测试通过
```

---

## 九、Codex 输出格式要求

完成本阶段后，请输出：

```md
# Codex 规划阶段完成报告

## 已阅读文件
- ...

## 发现的问题
- ...

## 已生成文档
- docs/auth-wewerss-admin-refactor-plan.md
- docs/glm-implementation-prompt-auth-wewerss-admin.md

## 建议 GLM 优先执行顺序
- ...

## 风险提醒
- ...

## 需要用户确认的问题
- ...
```

如果存在无法判断的问题，请明确写出，不要擅自假设。

---

## 十、给 GLM 的一句话目标

```md
请根据 Codex 生成的 `docs/auth-wewerss-admin-refactor-plan.md` 和 `docs/glm-implementation-prompt-auth-wewerss-admin.md`，按 TodoList 顺序完成账号体系、WeWeRSS 同服务器部署适配、AI/WeWeRSS 缺失配置弹窗、文章详情页、前后台登录拆分、注册邀请码、后台用户管理和邀请码管理的代码修复。每完成一项更新 TodoList，补充测试，最终确保 lint/test/build/Playwright 全部通过。
```
