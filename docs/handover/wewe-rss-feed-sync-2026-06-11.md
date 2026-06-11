# 交接报告：WeWe RSS 公众号同步脚本

> 日期：2026-06-11
> 脚本：`scripts/deploy/sync-wewe-rss-feeds.sh`

---

## 功能

对比本地 WeWe RSS SQLite 数据库和线上 WeWe RSS 实例的公众号列表，输出差异和同步指南。

## 使用方法

```bash
# 预览（默认 dry-run）
SSH_PASS='服务器密码' bash scripts/deploy/sync-wewe-rss-feeds.sh

# 实际同步（当前 WeWe RSS 不支持 API 添加，--apply 仅输出指南）
SSH_PASS='服务器密码' bash scripts/deploy/sync-wewe-rss-feeds.sh --apply
```

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

## 线上添加步骤

1. 浏览器打开 `http://47.119.182.210:4000`（需安全组开放 4000 端口）
2. 输入 AUTH_CODE: `9171227871`
3. 在 WeWe RSS 管理界面搜索并添加上述公众号
4. 回到主项目 `/settings/integrations` 点击"测试连接"验证
5. 在 `/settings/subscriptions` 点击"同步公众号"拉取到主应用

## 技术限制

WeWe RSS (cooderl/wewe-rss-sqlite:v2.6.1) 不提供公开的添加 feed API。
添加公众号只能通过 WeWe RSS 管理界面的微信公众号搜索功能完成。
这是 WeWe RSS 的设计限制，不是本项目的限制。

## 数据源

- 本地数据库：`infra/wechat-rss/wewe-rss/data/wewe-rss.db` → `feeds` 表
- 线上 API：`http://47.119.182.210:4000/feeds/` → GET 返回 JSON feed 列表
