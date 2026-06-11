# 交接报告：WeWe RSS 公众号同步脚本

> 日期：2026-06-11（更新）
> 脚本：`scripts/deploy/sync-wewe-rss-feeds.sh`

---

## 功能

对比本地 WeWe RSS SQLite 数据库和线上 WeWe RSS 实例的公众号列表，支持自动同步缺失的 feed。

## 使用方法

```bash
# 预览差异（dry-run，不执行同步）
bash scripts/deploy/sync-wewe-rss-feeds.sh

# 自动同步（通过 tRPC API 添加缺失的 feed）
AUTH_CODE='管理密码' bash scripts/deploy/sync-wewe-rss-feeds.sh --apply

# 通过 SSH 在远程服务器执行
AUTH_CODE='管理密码' SSH_PASS='服务器密码' bash scripts/deploy/sync-wewe-rss-feeds.sh --apply --remote
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AUTH_CODE` | WeWe RSS 管理密码（--apply 模式必须） | — |
| `REMOTE_HOST` | 线上 WeWe RSS 地址 | `47.119.182.210` |
| `REMOTE_PORT` | 线上 WeWe RSS 端口 | `4000` |
| `SSH_USER` | SSH 用户名 | `root` |
| `SSH_PASS` | SSH 密码（--remote 模式需要） | — |

## 当前本地公众号（9 个）

| ID | 名称 |
|----|------|
| MP_WXS_2397547378 | 观潮的螃蟹 |
| MP_WXS_3892777430 | 浙江宣传 |
| MP_WXS_2399587742 | 半月谈 |
| MP_WXS_3089222529 | 人民日报评论 |
| MP_WXS_2106247381 | 南方日报 |
| MP_WXS_3878251562 | 学习强国 |
| MP_WXS_3236953033 | 半月谈公考 |
| MP_WXS_3886164949 | 茂名社科 |
| MP_WXS_3280082932 | 隔壁班学习园地 |

## 同步状态

✅ 2026-06-11 已通过 tRPC API 成功将全部 9 个公众号同步到线上。

## tRPC API 参考

WeWe RSS v2.6.1 使用 tRPC 协议暴露 API（之前误以为无公开 API，实际可用）：

```
认证方式: Authorization: <authCode>  (直接传 authCode，不加 Bearer 前缀)

查询 feed 列表:
  GET /trpc/feed.list?input={}
  → result.data.items[]

添加 feed:
  POST /trpc/feed.add
  Body: {
    "id": "MP_WXS_XXXXXXXXX",
    "mpName": "公众号名称",
    "mpCover": "http://wx.qlogo.cn/...",
    "mpIntro": "公众号简介",
    "updateTime": 1234567890
  }
  → result.data
```

### API 发现过程

通过分析 WeWe RSS 前端 JS bundle（`/dash/assets/index-*.js`）发现：
- 前端使用 tRPC 客户端连接 `/trpc` 端点
- `authCode` 存储在 `localStorage`，通过 `Authorization` header 传递
- 暴露的 feed 操作：`feed.list`、`feed.add`、`feed.delete`、`feed.refresh`

## 数据源

- 本地数据库：`infra/wechat-rss/wewe-rss/data/wewe-rss.db` → `feeds` 表
- 线上 API：`http://47.119.182.210:4000/trpc/feed.list?input={}` → tRPC JSON

## 线上手动添加步骤（备用）

如果需要手动添加：

1. 浏览器打开 `http://47.119.182.210:4000`
2. 输入 AUTH_CODE 登录
3. 在 WeWe RSS 管理界面搜索并添加公众号
4. 回到主项目 `/settings/integrations` 点击"测试连接"验证
5. 在 `/settings/subscriptions` 点击"同步公众号"拉取到主应用
