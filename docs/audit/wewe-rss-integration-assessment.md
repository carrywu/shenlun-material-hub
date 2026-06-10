# WeWe RSS 集成评估报告

> 评估日期：2026-06-10
> 评估范围：shenlun-material-hub 全部 WeWe RSS 相关代码
> 评估依据：`docs/wewe-rss-integration-assessment-prompt.md`

---

## 1. 结论摘要

| 维度 | 结论 |
|---|---|
| 权限设计 | ⚠️ **有风险** — VERIFIED_USER 可看到/修改系统级配置字段 |
| 连接测试 | ⚠️ **有 Bug** — API 客户端未处理 HTML 响应，导致 JSON parse 报错 |
| 多账号能力 | ❌ **未实现** — 当前仅支持单 WeWe RSS 实例，无用户级账号隔离 |
| 数据隔离 | ⚠️ **共享模式** — WeWe RSS 采集的文章 `ownerUserId=null`，所有用户可见 |
| 推荐模式 | **模式 A：共享采集账号模式** — 当前代码完全符合此模式 |

**最高优先级修复：** 将系统级 WeWe RSS 配置从用户设置页移到管理员后台，修复 API 客户端的 HTML 响应处理。

---

## 2. 当前代码位置清单

### 前端页面

| 文件 | 用途 | 权限 |
|---|---|---|
| `src/app/settings/page.tsx` | 设置首页，含"外部集成"入口 | VERIFIED_USER+ 可见 |
| `src/app/settings/integrations/page.tsx` | 用户级 WeWe RSS 配置页 | VERIFIED_USER+ |
| `src/app/admin/integrations/wewe-rss/page.tsx` | 管理员 WeWe RSS 管理页 | ADMIN only |
| `src/components/integrations/WeweRssIntegrationPage.tsx` | WeWe RSS 管理组件 | 依赖父路由 |
| `src/app/integrations/wewe-rss/page.tsx` | 重定向到 admin 页 | 无权限检查 |

### API 路由

| 路由 | 用途 | 权限 |
|---|---|---|
| `src/app/api/settings/integrations/wewe-rss/route.ts` | 用户 CRUD 自己的 WeWe RSS 配置 | `requireVerifiedUser()` |
| `src/app/api/settings/integrations/wewe-rss/test/route.ts` | 用户测试连接 | `requireVerifiedUser()` |
| `src/app/api/integrations/wewe-rss/status/route.ts` | 系统级连接状态 | `requireAdmin()` |
| `src/app/api/integrations/wewe-rss/sync-sources/route.ts` | 同步来源 | `requireAdmin()` |
| `src/app/api/integrations/wewe-rss/preview-sync/route.ts` | 预览同步 | `requireAdmin()` |
| `src/app/api/integrations/wewe-rss/refresh-source/route.ts` | 刷新单个来源 | `requireAdmin()` |
| `src/app/api/integrations/wewe-rss/delete-missing-sources/route.ts` | 删除丢失来源 | `requireAdmin()` |
| `src/app/api/integrations/wewe-rss/test/route.ts` | 公共连接测试 | **无认证** |

### 服务层

| 文件 | 用途 |
|---|---|
| `src/services/integrations/wewe-rss-config.ts` | 环境变量读取 + 缺失配置响应 |
| `src/services/integrations/wewe-rss-api.ts` | WeWe RSS HTTP API 客户端 |
| `src/services/integrations/wewe-rss-sqlite.ts` | SQLite 兜底读取 |
| `src/services/integrations/wewe-rss.ts` | API > SQLite 自动选择 |
| `src/services/collectors/wechat/weRssNormalizer.ts` | 文章标准化 + 入库 |

### 数据模型

| 模型 | 说明 |
|---|---|
| `Source` (schema.prisma:52-97) | 信息源，含 `provider="wewe-rss"` 和 `feedId` 字段，无 userId |
| `UserIntegration` (schema.prisma:380-394) | 用户级集成配置，JSON 存储 baseUrl/dbPath |
| `ContentItem` (schema.prisma:121-203) | 文章，含 `ownerUserId`（nullable）和 `visibility` |

---

## 3. 当前页面与权限分析

### 问题 3.1：VERIFIED_USER 可看到/修改系统级配置字段

**文件：** `src/app/api/settings/integrations/wewe-rss/route.ts`
**函数：** GET / POST handlers
**现象：** `requireVerifiedUser()` 允许任何认证用户创建/读取/修改/删除 WeWe RSS 配置，包括 `baseUrl`（服务地址）和 `dbPath`（SQLite 路径）。

```typescript
// 第 7 行
const user = await requireVerifiedUser(request);
// ...
// 第 37-38 行 — 返回 baseUrl 和 dbPath 给 VERIFIED_USER
return NextResponse.json({
  baseUrl: config.baseUrl ?? "",
  dbPath: config.dbPath ?? "",
});
```

**风险：** 普通认证用户可以看到 WeWe RSS 服务地址和 SQLite 数据库路径，并能修改或删除这些配置。虽然每个用户有独立的 `UserIntegration` 记录，但系统只有一个 WeWe RSS 实例，允许多用户各自配置不同地址会造成混乱。

**结论：** ⚠️ **有风险**

### 问题 3.2：前端暴露系统级配置 UI

**文件：** `src/app/settings/integrations/page.tsx`
**现象：** 用户级设置页面展示了 WeWe RSS 服务地址、SQLite 数据库路径、测试连接、启用/禁用、删除配置等系统级管理功能。

**结论：** ⚠️ **有风险** — 这些字段应在管理员后台，不应出现在用户设置页

### 问题 3.3：公共连接测试端点无认证

**文件：** `src/app/api/integrations/wewe-rss/test/route.ts`
**现象：** 无需任何认证即可调用此端点
**风险：** 可被外部扫描器利用探测内网服务

**结论：** ⚠️ **有风险**

---

## 4. 当前连接测试异常原因

**错误现象：**
```
失败：无法连接 WeWe RSS: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

**根因分析：**

**文件：** `src/services/integrations/wewe-rss-api.ts:61, 84`

```typescript
// 第 61 行 — checkHealth
const feeds: WeweRssFeed[] = await res.json();
// 如果 WeWe RSS 返回 HTML（如 Nginx 默认页、登录页），直接 JSON.parse 崩溃

// 第 84 行 — listFeeds
return res.json();
// 同样的问题
```

**具体原因：**
1. 当 `baseUrl` 指向 WeWe RSS 前端页面（而非 API），或指向反向代理路径时，返回的是 HTML 页面
2. 当 Nginx/Caddy 反代配置不正确，`/feeds/` 请求被路由到默认页面
3. 当 WeWe RSS 服务未启动，端口被其他服务占用，返回 HTML 错误页
4. 代码只检查了 `res.ok`，没有检查 `content-type` 是否为 `application/json`

**修复建议：**
```typescript
const contentType = res.headers.get("content-type");
if (!contentType?.includes("application/json")) {
  return {
    reachable: false,
    message: "WeWe RSS 返回了非 JSON 响应，请检查服务地址是否正确",
  };
}
```

---

## 5. WeWe RSS 多账号 / 多用户能力评估

| 问题 | 回答 | 证据 |
|---|---|---|
| WeWe RSS 是否支持多微信读书账号？ | **未确认** | 项目代码无此能力，需查 WeWe RSS 官方文档 |
| 当前项目是否已接入账号管理？ | ❌ 未实现 | 无 `WeweAccount` 模型 |
| 用户能否扫码绑定微信读书？ | ❌ 未实现 | 无扫码/绑定代码 |
| 公众号订阅是否绑定 userId？ | ❌ 未实现 | Source 无 userId 字段 |
| 采集文章是否绑定 userId？ | ❌ 未实现 | WeWe RSS 文章 `ownerUserId=null` |
| 用户 A/B 数据是否隔离？ | ⚠️ 部分隔离 | `contentVisibilityWhere()` 过滤了私有数据，但公开数据所有人可见 |

---

## 6. 当前实现属于哪种模式

### 结论：**模式 A — 共享采集账号模式**

**证据：**

1. **Source 无用户归属** — `Source` 模型没有 `userId` 字段
2. **文章为公共数据** — WeWe RSS 同步的文章 `ownerUserId=null`，`visibility="public"`
3. **操作需管理员** — 所有同步/刷新/删除操作都要求 `requireAdmin()`
4. **用户可查看** — 通过 `contentVisibilityWhere()` 所有认证用户可查看公开文章
5. **UserIntegration 独立** — 每个用户可配置自己的 WeWe RSS 地址，但实际只应有一个实例

---

## 7. 数据隔离风险

| 风险 | 级别 | 说明 |
|---|---|---|
| 用户 A 看到用户 B 的公众号订阅 | ✅ 无风险 | 所有 WeWe RSS 来源为系统级，所有用户看到的是同一份列表 |
| 用户 A 看到用户 B 的采集文章 | ⚠️ 设计如此 | WeWe RSS 文章为公开素材，所有认证用户可见，这是"共享采集"模式的设计 |
| 用户修改系统级配置 | ⚠️ 有风险 | VERIFIED_USER 可通过 settings API 修改自己的 WeWe RSS 配置，可能与系统配置冲突 |

---

## 8. 推荐产品模式

### 推荐：**模式 A — 个人自用 / 共享采集账号模式**

**理由：**

1. 当前代码已经完全符合此模式
2. 项目定位为"申论素材采集台"，面向个人或小团队
3. WeWe RSS 是单实例单账号工具，不具备原生的多租户能力
4. 共享模式下，管理员采集的文章作为公共素材，所有认证用户可学习使用
5. 实现成本最低，风险最小

**文案必须明确：** 在用户页面标注"当前为系统共享采集账号模式"。

---

## 9. 推荐技术方案

### 核心原则

1. **系统级配置**（服务地址、SQLite 路径）→ 仅管理员可管理
2. **用户级页面** → 展示订阅列表、同步状态，不暴露系统配置
3. **数据模型** → 暂不增加用户隔离表，先明确共享模式

---

## 10. 数据库改造建议

### 当前阶段：无需新增表

现有模型已满足共享采集模式：

| 模型 | 现状 | 建议 |
|---|---|---|
| `Source` | 无 userId，provider 可标记 `wewe-rss` | 不变 |
| `UserIntegration` | 每个用户可存 JSON 配置 | **移除系统字段，仅保留用户偏好** |
| `ContentItem` | `ownerUserId` nullable | WeWe RSS 文章保持 `null`（公共） |

### 未来 P2/P3 阶段（如需多用户独立账号）：

- 新增 `WeweAccount` 模型
- 新增 `WeweSubscription` 模型
- 新增 `WeweSyncJob` 模型
- Source 增加 `ownerUserId` 字段

---

## 11. API 改造建议

### P0：权限修正

| 改造 | 说明 |
|---|---|
| `settings/integrations/wewe-rss` GET/POST | 移除 baseUrl/dbPath 字段，改为读取系统配置状态 |
| `settings/integrations/wewe-rss` DELETE | 禁止用户删除系统配置 |
| `settings/integrations/wewe-rss` PUT | 禁止用户禁用系统服务 |
| `integrations/wewe-rss/test` (公共) | 添加认证要求 |
| `wewe-rss-api.ts` checkHealth/listFeeds | 添加 content-type 检查，处理 HTML 响应 |
| 新增 `admin/settings/integrations/wewe-rss` API | 管理员专用配置管理 |

### P1：共享模式完善

| 改造 | 说明 |
|---|---|
| 用户页 API 仅返回"已配置/未配置"状态 | 不暴露具体地址 |
| 用户页 API 返回订阅列表和同步状态 | 只读展示 |

---

## 12. 前端页面改造建议

### 管理员页面

**路径：** `/admin/settings/integrations/wewe-rss`（新建或从现有 admin 页改造）

管理员可见：
- WeWe RSS 服务地址
- SQLite 数据库路径（只读展示）
- 测试连接按钮
- 启用/禁用
- 保存/删除配置
- 最近连接状态
- 订阅列表管理
- 同步操作

### 用户页面

**路径：** `/settings/integrations`（改造现有页）

用户可见：
- 标题："公众号采集配置"
- 副标题："当前为系统共享采集账号模式，公众号采集使用管理员配置的 WeWe RSS 账号。"
- 系统连接状态（已配置 ✓ / 未配置）
- 公众号订阅列表（只读）
- 已采集文章查看
- 最近同步时间

用户**不可见**：
- 服务地址输入框
- SQLite 路径
- 删除配置按钮
- 禁用服务开关

---

## 13. 测试补充建议

### 权限测试

| 测试 | 优先级 |
|---|---|
| VERIFIED_USER 不能修改系统级 WeWe RSS 配置 | P0 |
| VERIFIED_USER 不能看到服务地址和 SQLite 路径 | P0 |
| 管理员可以保存/删除系统配置 | P0 |
| 连接测试返回 HTML 时展示友好错误 | P0 |
| 公共测试端点需要认证 | P0 |
| VERIFIED_USER 可看到订阅列表和同步状态 | P1 |
| 未配置时用户页展示"管理员尚未启用" | P1 |

### E2E 测试

| 测试 | 优先级 |
|---|---|
| 管理员配置 WeWe RSS 系统设置 | P1 |
| 管理员测试连接失败显示友好错误 | P1 |
| 用户页不展示系统级配置字段 | P0 |
| 用户页显示"共享采集账号模式"说明 | P1 |

---

## 14. 分阶段实施计划

### P0：安全与权限修正（建议立即实施）

1. 将 `settings/integrations/wewe-rss` API 的系统级字段（baseUrl、dbPath）对 VERIFIED_USER 隐藏
2. 修复 `wewe-rss-api.ts` 的 HTML 响应处理
3. 给公共测试端点加认证
4. 用户设置页移除服务地址/SQLite 输入框

### P1：共享采集账号模式落地

1. 新建管理员配置页面 `/admin/settings/integrations/wewe-rss`
2. 改造用户设置页为只读展示 + 模式说明文案
3. 用户页展示订阅列表和同步状态
4. 补充权限测试和 E2E

### P2：多用户独立账号评估与预留（后续）

1. 调研 WeWe RSS 是否支持多微信读书账号
2. 设计 `WeweAccount` / `WeweSubscription` 数据模型
3. 设计 userId 级来源和文章隔离

### P3：真正多用户独立账号（未来 SaaS）

1. 用户扫码绑定微信读书
2. 用户独立订阅和同步
3. 文章和素材卡归属隔离

---

## 15. 风险与遗留问题

| 风险 | 级别 | 说明 |
|---|---|---|
| VERIFIED_USER 可修改 WeWe RSS 配置 | ⚠️ 中 | 可造成系统配置不一致 |
| HTML 响应导致 JSON parse 崩溃 | ⚠️ 中 | 用户体验差，但无安全风险 |
| 公共测试端点无认证 | ⚠️ 低 | 可探测内网，但需知道 URL |
| 共享模式伪装成多用户 | ❌ 不存在 | 当前代码未做此伪装 |

---

## 16. 需要用户确认的问题

1. **当前项目是否主要个人自用？**
否
2. **是否允许第一阶段采用"管理员共享采集账号模式"？**
否
3. **普通认证用户是否真的需要自己扫码微信读书？**（WeWe RSS 可能不支持）
否
4. **公众号文章是系统共享素材，还是用户私有素材？**
用户私有
5. **用户 A 订阅的公众号采集到的文章，用户 B 是否应该可以看到？**（当前：可以看到）
不可以
6. **是否需要后续支持 SaaS 多用户独立账号？**
现在就想支持
7. **WeWe RSS 是否已部署在同一台服务器（47.119.182.210）？**
应该部署了，但是和申论主项目还没打通
8. **是否使用 Caddy 反向代理 `/wewerss`？**（当前 Caddy 已部署）
不清楚，你看着办
9. **是否已经配置 WeWe RSS 的 AUTH_CODE？**
没有
10. **是否接受先做 P0/P1 修复，P2/P3 后续再评估？**
先评估，再一起修复
