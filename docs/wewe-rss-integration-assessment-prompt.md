# 任务：评估申论项目 WeWe RSS / 微信公众号采集集成方案

## 背景

当前项目是 `shenlun-material-hub`，定位为“申论素材采集台”。项目已经存在 WeWe RSS 集成入口，但当前页面和权限设计存在明显问题。

从现有页面截图可见：认证用户进入“设置 → 外部集成 → WeWe RSS”后，可以看到以下系统级配置项：

- WeWe RSS 服务地址
- SQLite 数据库路径
- 测试连接
- 启用 / 禁用
- 删除配置
- 连接状态

这类配置属于系统级集成配置，不应该暴露给普通认证用户或前台学习页。

用户侧期望是：

> 认证用户只需要进入 WeWe RSS / 公众号采集页面，配置自己的微信读书扫码信息、公众号订阅、同步状态等。

管理员侧期望是：

> WeWe RSS 的服务地址、API 地址、AUTH_CODE、数据库路径、反向代理路径等由管理员统一配置。

当前连接测试还出现错误：

```text
失败：无法连接 WeWe RSS: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

这通常说明系统请求 WeWe RSS 时，期望 JSON，但实际拿到了 HTML 页面。可能原因包括：

1. 把 WeWe RSS 前端页面 URL 当成 API URL 使用。
2. 反向代理路径 `/wewerss` 没有正确转发 API。
3. 请求缺少 AUTH_CODE / token。
4. 请求被重定向到登录页、错误页、Nginx 默认页。
5. 项目混用了“用户访问入口 URL”和“后端 API Base URL”。

---

## 重要澄清

请特别注意：

**方案一“申论项目做用户隔离，WeWe RSS 做采集引擎”，不等于所有用户共用管理员的微信读书账号。**

WeWe RSS 本身需要扫码登录微信读书账号。这里必须评估清楚当前项目和 WeWe RSS 的真实能力：

1. WeWe RSS 是否支持多个微信读书账号？
2. WeWe RSS 是否能通过 API 或数据库字段区分不同微信读书账号？
3. WeWe RSS 的公众号订阅源是否能稳定映射到某个微信读书账号？
4. WeWe RSS 的文章数据是否能映射到某个账号或订阅源？
5. 申论项目是否能把 `shenlun_user_id` 和 `wewe_account_id`、`wewe_feed_id`、`wewe_article_id` 绑定起来？
6. 如果不能做到真实绑定，是否只能实现“共享采集账号模式”？

禁止把“管理员扫码，所有用户共用管理员微信读书账号”的模式伪装成“多用户独立账号模式”。

---

## 本次任务目标

请先查看完整代码，不要直接改代码。目标是输出一份可信评估报告和实施建议。

评估重点：

1. 当前 WeWe RSS 集成代码在哪里。
2. 当前页面权限是否合理。
3. 当前普通认证用户是否能看到系统级配置。
4. 当前 API 是否存在权限绕过。
5. 当前 WeWe RSS 连接测试为什么返回 HTML 而不是 JSON。
6. 当前项目是否已经区分管理员配置和用户配置。
7. 当前项目是否支持每个用户独立 WeWe RSS 数据。
8. 当前项目是否只是共享一个 WeWe RSS 实例。
9. 当前项目是否已经有 userId 隔离。
10. 当前项目是否存在用户 A/B 数据串号风险。
11. 当前实现应选择“个人自用 / 共享采集账号模式”还是“多用户独立账号模式”。

---

## 请重点搜索这些关键词

请全局搜索并阅读相关代码：

```text
wewe
wewerss
WeWe RSS
wechat-rss
wechat rss
rss
external integration
external-integrations
integration
settings
admin settings
sqlite
AUTH_CODE
api base url
feed
subscription
wechat
weread
微信读书
公众号
订阅
同步
```

需要特别关注：

- 前端页面路由
- 设置页卡片跳转
- 管理员后台路由
- API route / server action
- 服务层 client
- 数据库 schema / migration
- 权限中间件
- RBAC / role 判断
- Playwright 测试
- 单元测试
- mock / fixture
- env 配置
- Docker / Nginx / 反向代理配置

---

## 需要回答的关键问题

### 一、当前权限设计

请回答：

1. 图一中的 WeWe RSS 服务地址、SQLite 路径、测试连接、禁用、删除配置目前在哪个页面？
2. 这个页面普通认证用户是否可以访问？
3. 这些字段是否通过前端隐藏，还是后端 API 也做了权限限制？
4. 非管理员直接访问相关 API 会返回什么？
5. 是否存在普通用户读取或修改系统级 WeWe RSS 配置的风险？

结论请明确标记：

```text
安全 / 有风险 / 未确认
```

---

### 二、当前 WeWe RSS URL 设计

请回答：

1. 当前保存的是 WeWe RSS 前端访问 URL，还是 API Base URL？
2. 当前测试连接请求了哪个具体路径？
3. 请求是否带 AUTH_CODE / token？
4. 请求是否校验 `content-type`？
5. 为什么会出现 `Unexpected token '<'`？
6. 是否存在把 HTML 页面当 JSON 解析的问题？
7. 当前错误信息是否对用户友好？
8. 是否可能泄露内部路径、token、服务地址？

请给出具体代码位置和原因。

---

### 三、WeWe RSS 多账号能力评估

请基于当前项目代码和 WeWe RSS 的实际功能评估：

1. WeWe RSS 是否支持多个微信读书账号？
2. 当前项目是否已经接入账号管理能力？
3. 当前项目是否支持用户自己扫码绑定微信读书账号？
4. 当前项目是否能把微信读书账号绑定到申论项目 userId？
5. 当前项目是否能把公众号订阅绑定到申论项目 userId？
6. 当前项目是否能把采集文章绑定到申论项目 userId？
7. 当前项目是否能保证用户 A 看不到用户 B 的订阅和文章？
8. 如果 WeWe RSS 底层不支持多租户，申论项目是否有足够的映射层？

请不要猜测。代码里没有证据就写“未实现 / 未确认”。

---

### 四、两种产品模式评估

请评估当前项目更适合哪种模式。

## 模式 A：个人自用 / 共享采集账号模式

定义：

```text
管理员配置一个 WeWe RSS 实例。
管理员扫码登录自己的微信读书账号。
所有公众号采集都走管理员这个微信读书账号。
认证用户只是在申论项目里管理逻辑订阅或查看文章。
```

适用场景：

```text
个人自用
小范围内部使用
不要求每个用户独立微信扫码
快速落地
```

风险：

```text
所有用户共用一个微信读书账号
风控风险集中在管理员账号
底层公众号源可能混在一起
用户隔离只能在申论项目侧做逻辑隔离
不能宣称是真多用户独立账号
```

请判断当前代码是否接近这个模式。

---

## 模式 B：多用户独立账号模式

定义：

```text
申论用户 A → 微信读书账号 A → 公众号订阅 A → 文章 A
申论用户 B → 微信读书账号 B → 公众号订阅 B → 文章 B
```

要求：

```text
每个用户可以自己扫码登录微信读书
每个用户有自己的 WeWe 账号状态
每个用户有自己的公众号订阅
每个用户有自己的同步任务
每个用户采集的文章带 userId
用户 A/B 数据不可见、不可串号
```

请判断当前代码是否已经支持这个模式。如果不支持，请说明缺哪些能力。

---

## 五、推荐重构方向

请基于代码评估，给出推荐方向。优先考虑稳妥落地。

### 推荐原则

1. 管理员配置系统级 WeWe RSS 服务。
2. 普通认证用户不允许看到系统级配置。
3. 当前如果只是个人项目，可以先明确实现“共享采集账号模式”。
4. 页面文案必须明确当前模式，不要伪装成多用户独立。
5. 代码结构要预留未来“多用户独立账号模式”。
6. 所有接口必须后端权限控制，不允许只靠前端隐藏。
7. WeWe RSS 请求必须区分前端 URL 和 API Base URL。
8. 连接测试必须处理 HTML 响应，不能裸 `JSON.parse`。

---

## 六、建议的数据模型评估

请检查当前数据库是否已经有类似表。如果没有，请评估是否需要新增。

### 系统级配置表

用于管理员配置：

```text
wewe_system_config 或 integration_configs
```

建议字段：

```text
id
provider = 'wewe-rss'
displayUrl
apiBaseUrl
authCodeEncrypted
databasePath
enabled
lastCheckAt
lastCheckStatus
lastCheckError
createdAt
updatedAt
```

### 用户级配置表

用于用户自己的 WeWe 状态：

```text
wewe_user_configs
```

建议字段：

```text
id
userId
enabled
mode
weweAccountId
loginStatus
lastLoginAt
lastSyncAt
lastError
createdAt
updatedAt
```

### 用户账号映射表

```text
wewe_accounts
```

建议字段：

```text
id
userId
externalAccountId
nickname
avatar
status
rawMetadata
createdAt
updatedAt
```

### 用户订阅表

```text
wewe_subscriptions
```

建议字段：

```text
id
userId
sourceId
accountId
mpName
mpBiz
mpAvatar
feedUrl
status
lastSyncAt
articleCount
rawMetadata
createdAt
updatedAt
```

### 同步任务表

```text
wewe_sync_jobs
```

建议字段：

```text
id
userId
status
startedAt
finishedAt
articleCount
errorMessage
rawResult
createdAt
updatedAt
```

请评估当前项目是否已有这些能力，哪些需要新增，哪些可以复用现有表。

---

## 七、页面改造建议

请评估并提出页面改造方案。

### 管理员页面

系统级配置应该移动到：

```text
/admin/settings/integrations/wewe-rss
```

管理员才能看到：

```text
WeWe RSS 服务展示地址
WeWe RSS API Base URL
AUTH_CODE / API Token
SQLite 数据库路径
是否启用
测试连接
保存配置
删除配置
最近一次连接测试结果
最近一次同步结果
```

### 用户页面

普通认证用户点击图二“外部集成”后，应该进入：

```text
/settings/integrations/wewe-rss
```

用户页面标题建议：

```text
公众号采集配置
```

副标题建议：

```text
绑定微信读书账号，管理你的公众号订阅源。
```

如果当前先做共享采集账号模式，文案必须改为：

```text
当前为系统共享采集账号模式，公众号采集使用管理员配置的 WeWe RSS 账号。
```

用户页面不能出现：

```text
服务地址
API Base URL
AUTH_CODE
SQLite
删除配置
禁用服务
```

用户页面可以出现：

```text
公众号订阅列表
添加公众号订阅
同步我的订阅
查看已采集文章
最近同步时间
同步失败原因
当前采集模式说明
```

如果未来支持多用户独立账号，则增加：

```text
扫码绑定微信读书
我的账号状态
重新扫码
解绑账号
```

---

## 八、测试评估要求

请检查当前测试覆盖，并给出需要新增的测试清单。

至少应包含：

### 权限测试

1. 普通认证用户不能访问管理员 WeWe RSS 配置 API。
2. 普通认证用户不能看到服务地址、AUTH_CODE、SQLite 路径。
3. 管理员可以访问系统配置页。
4. 管理员可以保存 WeWe RSS 系统配置。
5. 管理员测试连接时，如果返回 HTML，展示友好错误。
6. 用户只能看到自己的 WeWe RSS 用户配置。
7. 用户 A 不能读取用户 B 的订阅列表。
8. 用户 A 同步的文章必须带 userId。
9. 用户 B 看不到用户 A 的公众号订阅和文章。
10. 未配置 WeWe RSS 时，用户页面展示“管理员尚未启用”。

### Playwright E2E

管理员流程：

```text
管理员登录
进入管理员设置
打开 WeWe RSS 系统配置
输入错误 URL
点击测试连接
页面展示明确错误，不出现 JSON parse 原始异常
输入正确模拟 URL
保存成功
```

认证用户流程：

```text
普通用户登录
进入个人设置
点击外部集成
进入公众号采集配置页
页面不出现服务地址、API Base URL、AUTH_CODE、SQLite、删除配置、禁用服务
页面展示用户级配置区域
```

多用户隔离流程：

```text
用户 A 添加公众号订阅
用户 B 登录
用户 B 看不到用户 A 的公众号订阅
用户 B 添加自己的公众号订阅
用户 A 和用户 B 的数据互不污染
```

如果当前项目无法做到多用户独立账号，请把多用户独立账号测试列为后续阶段，不要标记已完成。

---

## 九、输出报告格式

请最终输出一份 Markdown 报告，建议路径：

```text
docs/audit/wewe-rss-integration-assessment.md
```

报告必须包含以下章节：

```text
# WeWe RSS 集成评估报告

## 1. 结论摘要
## 2. 当前代码位置清单
## 3. 当前页面与权限分析
## 4. 当前连接测试异常原因
## 5. WeWe RSS 多账号 / 多用户能力评估
## 6. 当前实现属于哪种模式
## 7. 数据隔离风险
## 8. 推荐产品模式
## 9. 推荐技术方案
## 10. 数据库改造建议
## 11. API 改造建议
## 12. 前端页面改造建议
## 13. 测试补充建议
## 14. 分阶段实施计划
## 15. 风险与遗留问题
## 16. 需要我确认的问题
```

每个结论都要写清楚证据来源，例如：

```text
文件：src/xxx/xxx.ts
函数：xxx
现象：普通用户可调用 xxx
风险：系统级配置泄露
建议：移动到 admin-only API
```

---

## 十、分阶段实施建议

请把建议拆成阶段，不要一上来大改。

### P0：安全与权限修正

目标：系统级配置不再暴露给普通用户。

内容：

```text
系统配置移动到管理员后台
普通用户 API 返回 403
普通用户页面不展示系统字段
修复 HTML 当 JSON 解析的错误
增加基础权限测试
```

### P1：个人自用 / 共享采集账号模式落地

目标：先让项目稳定可用。

内容：

```text
管理员配置 WeWe RSS
管理员扫码登录微信读书
认证用户只管理公众号逻辑订阅或查看采集结果
页面明确说明当前为共享采集账号模式
同步文章写入当前用户 userId 或明确为系统共享文章
```

### P2：多用户独立账号模式评估与预留

目标：为未来 SaaS 化做准备。

内容：

```text
评估 WeWe RSS 是否支持多账号
设计 shenlun_user_id ↔ wewe_account_id 映射
设计 userId 级订阅和文章隔离
补充用户 A/B 隔离测试
```

### P3：真正多用户独立账号实现

目标：用户各自扫码、各自订阅、各自采集。

内容：

```text
用户扫码绑定自己的微信读书账号
用户订阅源独立
同步任务独立
文章归属独立
素材卡归属独立
完整多用户 E2E 通过
```

---

## 十一、验收标准

本次评估任务完成标准：

```text
已完整搜索并阅读 WeWe RSS 相关代码
已明确当前权限风险
已明确当前 JSON parse 报错原因
已明确当前是否支持多用户独立 WeWe 账号
已明确当前项目适合共享采集账号模式还是多用户独立账号模式
已输出 docs/audit/wewe-rss-integration-assessment.md
已给出 P0/P1/P2/P3 实施计划
已列出需要用户确认的问题
没有直接进行大规模代码修改
```

如果发现高风险问题，可以只做最小安全修复，但必须先在报告中说明。

---

## 十二、禁止事项

```text
禁止把管理员 WeWe RSS 服务地址暴露给普通用户
禁止把 AUTH_CODE 暴露给前端
禁止把 SQLite 路径暴露给普通用户
禁止只靠前端隐藏代替后端权限校验
禁止把共享采集账号模式伪装成多用户独立账号模式
禁止在没有代码证据时声称 WeWe RSS 已支持多用户独立账号
禁止吞掉 HTML 响应导致的 JSON parse 错误
禁止把用户 A 的公众号订阅或文章同步给用户 B
禁止破坏现有文章列表、素材卡、AI 评估、IMA 同步功能
```

---

## 十三、建议向用户确认的问题

评估完成后，请向用户确认：

1. 当前项目是否主要个人自用？
2. 是否允许第一阶段采用“管理员共享采集账号模式”？
3. 普通认证用户是否真的需要自己扫码微信读书？
4. 公众号文章是系统共享素材，还是用户私有素材？
5. 用户 A 订阅的公众号，用户 B 是否可以看到同一公众号采集到的文章？
6. 是否需要后续支持 SaaS 多用户独立账号？
7. WeWe RSS 是否部署在同一台服务器？
8. 是否使用 Nginx 反向代理 `/wewerss`？
9. 是否已经配置 AUTH_CODE？
10. 是否接受先 P0/P1 修复，再做 P2/P3 多用户独立？
