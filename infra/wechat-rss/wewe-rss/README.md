# 本地 WeWe RSS 部署指南

## 这是什么

WeWe RSS 是一个开源的微信公众号 RSS 生成工具，通过微信读书获取公众号文章并生成标准 RSS/Atom/JSON 订阅源。

**GitHub**: [cooderl/wewe-rss](https://github.com/cooderl/wewe-rss) (9.5k stars)

## 和 shenlun-material-hub 的关系

WeWe RSS 是**独立部署的中间层服务**，不是 shenlun-material-hub 的内置功能。

部署后的工作流：

```
微信公众号 → WeWe RSS (本地 Docker) → 生成 RSS 地址
                                          ↓
shenlun-material-hub → 消费 RSS 地址 → 入库、去重、筛选、AI 评估
```

shenlun-material-hub 只消费你配置的 RSS 地址，不内置任何微信爬虫。

## 维护状态说明

WeWe RSS 仓库已于 2026-05-11 归档（变为只读），最后发布版本为 v2.6.1（2024-12-15）。

**为什么仍然适合作为短期 POC**：
- 9.5k stars，是同类项目中最成熟的
- Docker 镜像稳定可用
- 支持 RSS/Atom/JSON 标准输出
- 支持 SQLite 模式（无需额外 MySQL 容器）
- 使用 Prisma ORM，与 shenlun-material-hub 技术栈一致

**长期风险**：归档后不再更新，微信读书接口变化可能导致功能失效。长期备选方案见 `docs/local-wechat-rss.md`。

**镜像版本**：当前使用 `cooderl/wewe-rss-sqlite:v2.6.1`（2024-12-15 发布）。这是该项目的最后版本，`latest` 标签指向同一版本。

## 快速开始

### 1. 复制环境变量

```bash
cp .env.example .env
```

### 2. 修改 AUTH_CODE

编辑 `.env`，将 `AUTH_CODE` 改为你自己的强密码：

```env
AUTH_CODE=your_strong_password_here
```

### 3. 启动服务

```bash
docker compose up -d
```

### 4. 打开管理后台

浏览器访问：http://localhost:4000

输入你在 `.env` 中设置的 `AUTH_CODE`。

### 5. 登录

管理后台需要通过微信读书扫码登录。

**重要**：扫码时不要勾选"24 小时后自动退出"。

### 6. 添加公众号

在管理后台搜索你要订阅的微信公众号，点击添加。

### 7. 获取 RSS 地址

添加公众号后，管理后台会显示该公众号的 RSS 订阅地址，格式如：

```
http://localhost:4000/feeds/MP_WXS_xxx.rss      # RSS 2.0
http://localhost:4000/feeds/MP_WXS_xxx.atom      # Atom
http://localhost:4000/feeds/MP_WXS_xxx.json      # JSON Feed
http://localhost:4000/feeds/all.rss               # 所有订阅
```

### 8. 配置到 shenlun-material-hub

1. 启动 shenlun-material-hub（`pnpm dev`）
2. 打开 http://localhost:3001/subscriptions
3. 点击"新增来源"
4. 填写：
   - 名称：任意（如"人民日报公众号"）
   - 平台：wechat
   - 基础 URL：粘贴上面获取的 RSS 地址
5. 保存

### 9. 测试采集

在来源列表中点击"采集"按钮，确认文章入库。

## 常见问题

### Q: 扫码后显示登录失败

A: 确保使用微信读书 App（不是微信）扫码。如果微信读书账号未绑定公众号，可能需要先在微信读书中关注一些公众号。

### Q: RSS 地址无法访问

A: 检查 Docker 容器是否正常运行：

```bash
docker compose ps
docker compose logs --tail=50
```

### Q: 文章内容为空

A: 确保 `.env` 中设置了 `FEED_MODE=fulltext`。部分文章可能因微信读书限制无法获取全文。

### Q: 端口 4000 被占用

A: 修改 `.env` 中的 `Wewe_RSS_PORT` 和 `docker-compose.yml` 中的端口映射。

### Q: shenlun-material-hub 采集报错

A: 确保：
1. WeWe RSS 容器正在运行
2. RSS 地址以 `http://` 或 `https://` 开头
3. RSS 地址在浏览器中可以直接访问
4. shenlun-material-hub 和 WeWe RSS 在同一网络（如都是 localhost）

## 停止服务

```bash
docker compose down
```

## 清理数据

```bash
docker compose down -v
rm -rf ./data
```

## 数据持久化

SQLite 数据库文件存储在 `./data` 目录中。Docker 容器重启后数据不会丢失。

## 只读消费策略（重要）

shenlun-material-hub **只读消费** WeWe RSS 数据，遵循以下约束：

1. **SQLite 只读**：shenlun-material-hub 通过 `better-sqlite3` 只读访问 `./data/wewe-rss.db`，不会写入或修改 WeWe RSS 数据库
2. **API 只读**：通过 WeWe RSS HTTP API 获取订阅列表和文章，不触发写入操作
3. **数据流单向**：`WeWe RSS → shenlun-material-hub`，shenlun-material-hub 不会反向影响 WeWe RSS

### Docker 挂载配置

在 `docker-compose.yml` 中，WeWe RSS 的数据卷挂载为：

```yaml
volumes:
  - ./data:/app/data
```

如果 shenlun-material-hub 需要直接读取 SQLite 数据库（fallback 模式），确保：
- `./data/wewe-rss.db` 文件权限允许读取
- 两个服务在同一主机上运行，或通过共享卷访问

### 多容器部署注意

如果使用 Docker Compose 将两个服务部署在同一个 `docker-compose.yml` 中：

```yaml
# WeWe RSS sidecar — 只读挂载给 shenlun-material-hub
services:
  wewe-rss:
    image: cooderl/wewe-rss-sqlite:v2.6.1
    volumes:
      - wewe-rss-data:/app/data

  shenlun-material-hub:
    image: shenlun-material-hub:latest
    volumes:
      - wewe-rss-data:/app/wewe-rss-data:ro  # 注意 :ro 只读挂载
    environment:
      - WEWERSS_SQLITE_PATH=/app/wewe-rss-data/wewe-rss.db

volumes:
  wewe-rss-data:
```

**关键点**：shenlun-material-hub 的挂载使用 `:ro`（只读）标记，确保不会意外修改 WeWe RSS 数据。

## 相关文档

- [shenlun-material-hub 本地 RSS 接入说明](../../docs/local-wechat-rss.md)
- [WeWe RSS 官方文档](https://github.com/cooderl/wewe-rss)
