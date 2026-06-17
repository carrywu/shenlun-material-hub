# 本地公众号 RSS 接入说明

## 三种公众号来源模式

| 模式 | 是否本地 | 是否需要 Key | 说明 |
|---|---|---|---|
| 外部 WeRSS JSON API | 否 | 需要 `WERSS_ACCESS_KEY` / `WERSS_SECRET_KEY` | 兼容已有外部 WeRSS 服务 |
| 本地 we-mp-rss | 是 | RSS 本身不需要 Key | 推荐短期 POC |
| 本地 we-mp-rss | 是 | 视部署而定 | 长期备选，详见下方 |
| 微信单篇链接导入 | 不需要服务 | 不需要 Key | 手动导入单篇文章 |

## 本地 we-mp-rss（推荐）

### 部署

详见 [`infra/wechat-rss/we-mp-rss/README.md`](../infra/wechat-rss/we-mp-rss/README.md)。

### 接入方式

1. 启动 we-mp-rss 后，获取公众号的 RSS 地址
2. 在 shenlun-material-hub 的 `/subscriptions` 页面新增来源
3. 平台选 `wechat`，Base URL 填 RSS 地址
4. 点击采集

### RSS 地址格式

```
http://localhost:8001/feeds/MP_WXS_xxx.rss      # RSS 2.0
http://localhost:8001/feeds/MP_WXS_xxx.atom      # Atom
http://localhost:8001/feeds/MP_WXS_xxx.json      # JSON Feed
http://localhost:8001/feeds/all.rss               # 所有订阅
```

### 路由逻辑

当 Base URL 以 `http://` 或 `https://` 开头时，shenlun-material-hub 自动走标准 RSS XML 解析，**不需要** `WERSS_ACCESS_KEY` 或 `WERSS_SECRET_KEY`。

只有当 Base URL 是短 ID（如 `wxid_abc123`）时，才会走外部 WeRSS JSON API。

## 外部 WeRSS 服务（兼容保留）

如果你已有外部 WeRSS 服务，配置以下环境变量即可：

```env
WERSS_BASE_URL=https://your-werss-service.example.com
WERSS_ACCESS_KEY=your_access_key
WERSS_SECRET_KEY=your_secret_key
```

在来源管理中，如果 Base URL 为空且设置了 `WERSS_BASE_URL`，系统会使用外部 WeRSS JSON API。

## 长期备选：we-mp-rss

**GitHub**: [rachelos/we-mp-rss](https://github.com/rachelos/we-mp-rss) (3.3k stars)

### 项目概况

| 维度 | 说明 |
|---|---|
| Stars | 3.3k |
| 最新版本 | v1.5.2 (2026-04-16) |
| 技术栈 | Go |
| Docker | ✅ 支持 |
| 端口 | 8001（可配置） |
| RSS 输出 | ✅ 支持，可配置全文/摘要 |
| API | ✅ REST API |
| Webhook | ✅ 钉钉/企业微信/飞书/自定义 |
| 登录方式 | 扫码授权 |

### 与 we-mp-rss 对比

| 维度 | we-mp-rss | we-mp-rss |
|---|---|---|
| 维护状态 | 已归档 (2026-05) | 活跃维护 |
| Stars | 9.5k | 3.3k |
| 登录方式 | 微信读书扫码 | 微信扫码 |
| 数据库 | MySQL / SQLite | SQLite |
| Docker 镜像 | `cooderl/we-mp-rss-sqlite` | `ghcr.io/rachelos/we-mp-rss` |
| 默认端口 | 4000 | 8001 |
| RSS 格式 | RSS/Atom/JSON | RSS |
| 全文支持 | ✅ `FEED_MODE=fulltext` | ✅ `RSS_FULL_CONTEXT` |
| Webhook | ❌ | ✅ |
| API | 有限 | ✅ REST API |

### 后续建议

如果 we-mp-rss 因归档导致功能失效，we-mp-rss 是最合适的替代方案。后续可添加 `infra/wechat-rss/we-mp-rss/` 部署示例。

## 微信单篇链接导入

不需要任何外部服务。在 `/subscriptions` 页面，微信来源行有"导入文章"按钮，可直接粘贴 `mp.weixin.qq.com` 链接导入。

## 验收清单

使用本地 we-mp-rss 时，按以下步骤验收：

- [ ] 复制 `.env.example` 为 `.env`
- [ ] 修改 `AUTH_CODE`
- [ ] `docker compose up -d`
- [ ] 打开 http://localhost:8001
- [ ] 输入 `AUTH_CODE`
- [ ] 微信读书扫码登录
- [ ] 添加公众号
- [ ] 复制 RSS 地址
- [ ] 启动 shenlun-material-hub
- [ ] 打开 /subscriptions
- [ ] 新增微信 RSS 来源
- [ ] Base URL 粘贴 RSS 地址
- [ ] 点击采集
- [ ] 到文章列表确认入库
- [ ] 再采集一次确认不会重复入库
- [ ] 确认 skippedCount 增加
