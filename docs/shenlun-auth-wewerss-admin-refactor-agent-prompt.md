# 申论项目：账号体系、WeWeRSS 线上部署、后台独立化与配置引导修复任务

> 适用对象：Codex / Claude Code / Gemini / 其他代码 Agent  
> 项目：`shenlun-material-hub`  
> 任务类型：P0/P1 修复 + P2 功能开发 + 全量测试验收  
> 执行方式：先审查代码，再制定 Todolist，再逐项实现、测试、提交 Git、更新交接文档。

---

## 0. 背景说明

当前申论项目已经具备文章采集、文章列表、素材卡、AI 评估、后台管理、WeWeRSS 集成等基础能力，但线上部署和账号体系存在明显问题。

用户已确认以下关键需求：

1. **WeWeRSS 部署方式**：WeWeRSS 与申论主项目部署在同一台服务器上，优先使用 Docker Compose 同机/同网络容器方案。
2. **普通用户权限**：普通用户可以查看文章和已生成素材卡，但不能使用 AI 评估、AI 生成素材卡、批量生成、WeWeRSS 同步等高级功能。
3. **后台独立方式**：当前阶段不拆成独立项目，先在同一个 Next.js 项目内实现 `/admin/*` 独立后台，包括独立路由、布局、权限、API 和视觉风格。
4. **字母数字账号规则**：注册登录账号使用字母数字账号（数字和英文字母），例如 `admin`、`testuser`、`abc123`；数据库内部主键不要强行改成数字，仍可保留当前 `id/cuid/uuid`。
5. **邀请码规则**：邀请码由管理员在后台创建，可配置使用次数、过期时间、启用状态和备注。

---

## 1. 已知问题

### 1.1 WeWeRSS 线上配置失败

当前线上打开 WeWeRSS 后台会跳转到：

```txt
http://localhost:4000/
```

这是错误行为。线上环境不能跳转到浏览器本机的 localhost。

需要修复：

- 前端不能写死 `http://localhost:4000`。
- 后端不能在生产环境默认回退到 `http://localhost:4000`。
- “打开 WeWe 后台”按钮必须使用生产环境可访问的公网地址或反代地址。
- Docker Compose 同机部署时，后端访问 WeWeRSS 应使用容器内网地址，例如 `http://wewerss:4000`。
- 前端跳转 WeWeRSS 后台应使用公网地址，例如：

```env
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=https://你的域名/wewerss
```

后端服务访问地址建议：

```env
WEWERSS_BASE_URL=http://wewerss:4000
```

如使用 Nginx / Caddy / Traefik 反代，需补充部署说明。

---

### 1.2 AI 未配置时报错生硬

当前认证用户或管理员使用 AI 评估/生成素材卡时，如果 AI 未配置，不能出现类似：

```txt
缺少数组
Cannot read properties of undefined
AI config missing raw error
```

必须统一改成中文友好提示。

目标行为：

```txt
当前账号尚未配置 AI 服务，无法使用该功能。
是否前往配置页面？

[取消] [前往配置]
```

点击“前往配置”跳转到：

```txt
/settings/ai
```

点击“取消”关闭弹窗，不发生跳转。

---

### 1.3 文章详情页跳转失败

类似路由：

```txt
/articles/cmq7sciq700171cnzx5tqtydm
```

点击后应该进入站内文章详情页，而不是：

- 404
- 白屏
- 跳转原网站
- 没有正文
- 路由报错

目标行为：

- `/articles` 列表页点击文章标题、卡片、详情按钮，统一进入 `/articles/[id]`。
- `/articles/[id]` 正确展示文章标题、来源、发布时间、采集时间、正文、图片、AI 评估结果、素材卡状态。
- 如果文章不存在，显示中文 404/空状态。
- 如果正文为空，显示“暂无正文内容”，不能白屏。
- 外部原文链接保留为单独按钮，不应替代站内详情跳转。

---

### 1.4 前台登录和后台登录耦合

当前需要拆分：

| 页面 | 路由 | 用途 |
|---|---|---|
| 前台登录 | `/login` | 普通用户 / 认证用户登录 |
| 后台登录 | `/admin/login` | 管理员登录 |
| 默认登录入口 | `/login` | 未登录默认进前台登录 |
| 后台首页 | `/admin` 或 `/admin/dashboard` | 管理员后台 |

权限规则：

- 未登录用户访问前台保护页面：跳转 `/login`。
- 未登录用户访问后台页面：跳转 `/admin/login`。
- 普通用户/认证用户访问 `/admin/*`：显示无权限或跳回前台，不允许进入后台。
- 管理员访问 `/admin/login`：如果已登录，可跳转 `/admin/dashboard`。
- 管理员访问 `/login`：可以正常显示或跳转前台首页，但不能影响后台登录逻辑。

---

### 1.5 注册与邀请码功能缺失

需要新增注册体系：

- 支持无邀请码注册为普通用户 `USER`。
- 支持有邀请码注册为认证用户 `VERIFIED_USER`。
- 普通用户可以在设置页输入邀请码升级为认证用户。
- 注册账号字段为字母数字账号，例如 `admin`、`abc123`。
- 数据库内部主键保留原实现，不要为了账号规则破坏已有关联关系。
- 密码必须哈希存储。
- 注册、登录、升级失败都要有中文提示。

建议字段：

```prisma
model User {
  id             String   @id @default(cuid())
  username       String   @unique // 字母数字账号，例如 admin、abc123
  displayName    String?
  passwordHash   String
  role           String   @default("USER") // USER / VERIFIED_USER / ADMIN
  status         String   @default("ACTIVE")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

如已有 User 表，请优先兼容现有 schema，不要重复造表。

---

### 1.6 后台管理需要独立化

后台不需要拆成单独项目，但必须在当前项目中独立出来。

要求：

- 路由独立：`/admin/*`
- 布局独立：`AdminLayout`
- 权限独立：`admin guard`
- API 独立：`/api/admin/*`
- 视觉独立：后台是管理控制台风格，不复用前台文章浏览布局
- 状态独立：后台用户态不能污染前台页面

后台第一版必须包含：

### 用户管理

- 用户列表
- 搜索用户
- 查看用户账号、昵称、角色、状态、注册时间、最后登录时间
- 修改用户角色：普通用户 / 认证用户 / 管理员
- 禁用 / 启用用户
- 防止最后一个管理员被降级或禁用

### 邀请码管理

- 创建邀请码
- 设置使用次数
- 设置过期时间
- 启用 / 禁用邀请码
- 查看已使用次数
- 查看绑定用户
- 备注字段

---

## 2. 权限设计

当前角色继续使用：

```ts
ADMIN | VERIFIED_USER | USER
```

权限矩阵：

| 功能 | USER 普通用户 | VERIFIED_USER 认证用户 | ADMIN 管理员 |
|---|---:|---:|---:|
| 浏览文章 | ✅ | ✅ | ✅ |
| 查看已生成素材卡 | ✅ | ✅ | ✅ |
| AI 评估文章 | ❌ | ✅ | ✅ |
| AI 生成素材卡 | ❌ | ✅ | ✅ |
| 批量生成素材卡 | ❌ | ✅ | ✅ |
| 配置个人 AI | ❌ 或只读 | ✅ | ✅ |
| 使用 WeWeRSS 同步 | ❌ | ✅ | ✅ |
| 后台用户管理 | ❌ | ❌ | ✅ |
| 邀请码管理 | ❌ | ❌ | ✅ |
| 系统级配置 | ❌ | ❌ | ✅ |

说明：

- 普通用户点击 AI/WeWeRSS 相关功能，应提示“该功能需要认证用户权限”。
- 认证用户点击 AI 功能但未配置 AI，应弹出配置引导 Dialog。
- 认证用户点击 WeWeRSS 功能但未配置 WeWeRSS，应弹出配置引导 Dialog。
- 管理员拥有所有权限。

---

## 3. 配置缺失 Dialog 统一方案

新增统一组件，例如：

```tsx
<MissingConfigDialog />
```

或者封装 hook：

```ts
useMissingConfigDialog()
```

触发场景：

| 功能 | 检查配置 |
|---|---|
| AI 评估 | AI 配置 |
| 生成素材卡 | AI 配置 |
| 批量生成素材卡 | AI 配置 |
| 同步公众号列表 | WeWeRSS 配置 |
| 打开 WeWeRSS 后台 | WeWeRSS 公网地址 |
| 刷新并采集公众号文章 | WeWeRSS 配置 |

AI 缺失文案：

```txt
当前功能需要先配置 AI 服务。

你尚未配置 AI Key 或模型参数，暂时无法使用该功能。
是否前往配置页面完成设置？

[取消] [前往配置]
```

WeWeRSS 缺失文案：

```txt
当前功能需要先配置 WeWeRSS 服务。

系统未检测到可用的 WeWeRSS 地址，无法同步公众号数据。
是否前往配置页面？

[取消] [前往配置]
```

权限不足文案：

```txt
当前功能仅认证用户可用。

你可以在设置页面输入邀请码升级为认证用户。

[取消] [去设置]
```

---

## 4. WeWeRSS 部署配置要求

### 4.1 环境变量设计

建议拆成后端内网地址和前端公网地址：

```env
# 后端服务访问 WeWeRSS，Docker Compose 同网络使用服务名
WEWERSS_BASE_URL=http://wewerss:4000

# 前端浏览器打开 WeWeRSS 后台，必须是公网可访问 URL 或反代路径
NEXT_PUBLIC_WEWERSS_PUBLIC_URL=https://your-domain.com/wewerss

# SQLite 兜底路径，按实际 Docker volume 配置
WEWERSS_SQLITE_PATH=/app/wewe-rss/data/wewe-rss.db
```

### 4.2 行为要求

- 本地开发可默认 `http://localhost:4000`。
- 生产环境不允许静默默认 localhost。
- 生产环境未配置时，接口返回明确 JSON：

```json
{
  "success": false,
  "code": "WEWERSS_CONFIG_MISSING",
  "message": "未配置 WeWeRSS 服务地址"
}
```

- 前端收到 `WEWERSS_CONFIG_MISSING` 后弹出 Dialog。
- “打开 WeWe 后台”按钮使用 `NEXT_PUBLIC_WEWERSS_PUBLIC_URL`。
- 如果公网地址未配置，按钮禁用或弹出配置引导。

---

## 5. 任务优先级

## P0：必须先修

- [ ] 审查当前 WeWeRSS 所有前后端调用点。
- [ ] 移除所有生产环境下的 `http://localhost:4000` 写死。
- [ ] 后端 WeWeRSS 地址改为 `WEWERSS_BASE_URL`。
- [ ] 前端打开后台地址改为 `NEXT_PUBLIC_WEWERSS_PUBLIC_URL`。
- [ ] 生产环境未配置 WeWeRSS 时返回结构化错误。
- [ ] 修复 AI 未配置时的生硬报错。
- [ ] 修复 `/articles/[id]` 文章详情页跳转和展示。
- [ ] 拆分 `/login` 和 `/admin/login`。
- [ ] 修复后台路由权限守卫。

## P1：账号体系

- [ ] 新增注册页。
- [ ] 无邀请码注册为普通用户。
- [ ] 有邀请码注册为认证用户。
- [ ] 普通用户设置页支持输入邀请码升级。
- [ ] 注册账号使用字母数字账号。
- [ ] 账号生成逻辑必须避免并发重复。
- [ ] 注册/登录/升级失败提示中文化。

## P2：后台管理

- [ ] 新增或完善 `/admin/dashboard`。
- [ ] 新增独立 `AdminLayout`。
- [ ] 新增用户管理页面。
- [ ] 支持修改用户身份。
- [ ] 支持禁用/启用用户。
- [ ] 防止最后一个管理员被降级或禁用。
- [ ] 新增邀请码管理页面。
- [ ] 支持创建邀请码。
- [ ] 支持配置邀请码使用次数、过期时间、启用状态、备注。
- [ ] 支持查看邀请码使用记录。

## P3：体验增强

- [ ] 实现统一 MissingConfigDialog。
- [ ] 普通用户点击高级功能时提示需要认证。
- [ ] 认证用户未配置 AI 时提示跳转 AI 配置页。
- [ ] 认证用户未配置 WeWeRSS 时提示跳转集成配置页。
- [ ] 所有错误提示中文化。
- [ ] 所有空状态中文化。
- [ ] 后台和前台导航入口清晰分离。

---

## 6. 测试要求

必须补充和运行测试，不允许只改代码不验收。

### 6.1 单元测试 / 集成测试

至少覆盖：

- 字母数字账号生成逻辑。
- 邀请码校验逻辑。
- 邀请码使用次数扣减逻辑。
- 邀请码过期逻辑。
- 用户角色升级逻辑。
- 防止最后一个管理员被降级/禁用。
- AI 配置缺失错误格式化。
- WeWeRSS 配置缺失错误格式化。

### 6.2 Playwright E2E

必须覆盖：

- [ ] 未登录访问 `/articles`，按现有产品规则处理。
- [ ] 未登录访问 `/admin`，跳转 `/admin/login`。
- [ ] 访问 `/login` 是前台登录页。
- [ ] 访问 `/admin/login` 是后台登录页。
- [ ] 普通用户注册成功。
- [ ] 普通用户可以浏览文章。
- [ ] 普通用户可以查看已生成素材卡。
- [ ] 普通用户点击 AI 生成时，提示需要认证用户权限。
- [ ] 普通用户在设置页输入邀请码后升级为认证用户。
- [ ] 认证用户未配置 AI 时点击生成素材卡，弹出配置引导 Dialog。
- [ ] 认证用户点击 Dialog 的“前往配置”后跳转 `/settings/ai`。
- [ ] 认证用户未配置 WeWeRSS 时点击同步，弹出配置引导 Dialog。
- [ ] 文章列表点击标题进入 `/articles/[id]`。
- [ ] `/articles/[id]` 展示正文和元信息。
- [ ] 管理员可以进入后台。
- [ ] 普通用户不能进入后台。
- [ ] 管理员可以创建邀请码。
- [ ] 管理员可以修改用户身份。

### 6.3 构建检查

必须运行：

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

如项目已有更具体命令，以项目实际 `package.json` 为准。

---

## 7. 文档与交接要求

实现过程中必须更新文档：

- [ ] 新建或更新任务 Todolist。
- [ ] 每完成一个小任务就在 Todolist 打勾。
- [ ] 更新部署文档，说明 WeWeRSS 同服务器 Docker Compose 配置。
- [ ] 更新账号体系文档，说明 USER / VERIFIED_USER / ADMIN 权限。
- [ ] 更新后台管理文档。
- [ ] 更新测试报告。
- [ ] 更新交接文档。

建议文件：

```txt
docs/deployment/wewerss-production-deploy.md
docs/auth/user-role-and-invitation-design.md
docs/admin/admin-console-design.md
docs/testing/auth-wewerss-admin-e2e-report.md
tasks/2026-06-10-auth-wewerss-admin-refactor/todolist.md
tasks/2026-06-10-auth-wewerss-admin-refactor/handoff.md
```

---

## 8. Git 提交要求

每完成一个阶段都提交 Git：

```bash
git status
git add .
git commit -m "fix: configure wewe rss production url"
git commit -m "fix: split frontend and admin login routes"
git commit -m "feat: add registration and invitation upgrade flow"
git commit -m "feat: add admin user and invitation management"
git commit -m "test: cover auth wewe rss and admin workflows"
```

不要把多个巨大改动混在一个提交里。

---

## 9. 验收标准

最终交付必须满足：

- [ ] 线上点击 WeWeRSS 后台不再跳转 `localhost:4000`。
- [ ] 同服务器 Docker Compose 部署下，后端可通过容器服务名访问 WeWeRSS。
- [ ] 生产环境缺少 WeWeRSS 配置时，前端显示中文 Dialog，不白屏、不报 raw error。
- [ ] AI 未配置时显示中文 Dialog，可跳转 AI 配置页。
- [ ] 普通用户可以看文章和素材卡。
- [ ] 普通用户不能使用 AI 评估/生成。
- [ ] 普通用户可以通过邀请码升级为认证用户。
- [ ] `/articles/[id]` 详情页可访问并展示内容。
- [ ] `/login` 和 `/admin/login` 完全分离。
- [ ] `/admin/*` 只有管理员可访问。
- [ ] 管理员可以管理用户身份和邀请码。
- [ ] 所有新增/修改功能都有 Playwright 覆盖。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm build` 通过。
- [ ] Playwright E2E 通过。
- [ ] Todolist、测试报告、交接文档已更新。

---

## 10. 注意事项

- 不要为了账号规则强行改数据库主键，避免破坏历史文章、素材卡、任务等关联数据。
- 不要把 WeWeRSS 公网访问地址和后端内网访问地址混用。
- 不要在生产环境默认使用 localhost。
- 不要只在前端隐藏按钮，后端 API 必须做权限校验。
- 不要让普通用户通过直接请求 API 绕过权限。
- 不要保留英文 raw error 给用户。
- 不要把后台页面继续塞进前台布局。
- 不要跳过测试。

---

## 11. 推荐实现顺序

1. 先读代码，列出所有涉及文件。
2. 建立 Todolist。
3. 修复 WeWeRSS 配置和线上跳转。
4. 修复文章详情页。
5. 拆分前后台登录和权限守卫。
6. 实现注册和字母数字账号。
7. 实现邀请码模型和升级流程。
8. 实现后台用户管理和邀请码管理。
9. 实现统一配置缺失 Dialog。
10. 补充单测和 E2E。
11. 跑全量测试。
12. 修复测试发现的问题。
13. 更新交接文档。
14. 分阶段提交 Git。

---

## 12. 最终回复格式要求

完成后请按以下格式回复用户：

```md
# 完成情况

## 已完成
- ...

## 修改文件
- ...

## 测试结果
- pnpm lint: ✅ / ❌
- pnpm test: ✅ / ❌
- pnpm build: ✅ / ❌
- Playwright E2E: ✅ / ❌

## Git 提交
- commit hash + message

## 剩余风险
- ...

## 交接文档
- ...
```

如果有测试失败，必须明确说明失败原因、已尝试修复内容、下一步建议，不能假装通过。
