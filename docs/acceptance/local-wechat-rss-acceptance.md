# 本地公众号 RSS 接入验收清单

## 1. 验收前准备

```bash
# 检查 Docker
docker --version        # 需要 Docker 20+
docker compose version  # 需要 Docker Compose v2

# 检查 Node / pnpm
node --version          # 需要 Node 18+
pnpm --version          # 需要 pnpm 8+

# 检查项目依赖
cd /path/to/shenlun-material-hub
pnpm install

# 检查端口
lsof -i :4000           # WeWe RSS 端口，应为空
lsof -i :3001           # shenlun-material-hub 端口，应为空
```

- [ ] Docker 已安装且可运行
- [ ] Node / pnpm 已安装
- [ ] 项目依赖已安装
- [ ] 端口 4000 空闲
- [ ] 端口 3001 空闲

---

## 2. 启动 WeWe RSS

```bash
cd infra/wechat-rss/wewe-rss

# 复制环境变量
cp .env.example .env

# 编辑 .env，修改 AUTH_CODE 为你自己的密码
# AUTH_CODE=your_strong_password

# 启动服务
docker compose up -d

# 确认容器运行
docker compose ps
```

预期输出：`wewe-rss` 容器状态为 `running`，端口映射 `0.0.0.0:4000->4000/tcp`。

- [ ] `.env` 已创建
- [ ] `AUTH_CODE` 已修改
- [ ] `docker compose up -d` 成功
- [ ] `docker compose ps` 显示 running

---

## 3. 登录 WeWe RSS

1. 浏览器打开 http://localhost:4000
2. 输入你在 `.env` 中设置的 `AUTH_CODE`
3. 按页面提示完成微信读书扫码登录
4. **重要**：扫码时不要勾选"24 小时后自动退出"

- [ ] 后台页面能打开
- [ ] AUTH_CODE 验证通过
- [ ] 微信读书扫码成功

---

## 4. 添加公众号

1. 在 WeWe RSS 后台搜索你要订阅的微信公众号
2. 点击添加/订阅
3. 等待文章同步（首次可能需要几分钟）
4. 在公众号详情页复制 RSS 地址

RSS 地址格式如：
```
http://localhost:4000/feeds/MP_WXS_xxx.rss
```

- [ ] 公众号搜索成功
- [ ] 公众号添加成功
- [ ] 文章已同步
- [ ] 已复制 RSS 地址

---

## 5. 启动 shenlun-material-hub

```bash
cd ../../..
pnpm dev
```

打开 http://localhost:3001

- [ ] `pnpm dev` 启动成功
- [ ] 页面能正常打开

---

## 6. 添加微信 RSS 来源

1. 打开 http://localhost:3001/subscriptions
2. 点击"新增来源"
3. 填写：
   - **名称**：任意（如"人民日报公众号"）
   - **平台**：wechat
   - **基础 URL**：粘贴 WeWe RSS 的 RSS 地址
4. 保存

填入 RSS 地址后，应能看到帮助文案提示"以 http(s):// 开头的地址走标准 RSS 解析"。

- [ ] 新增来源弹窗能打开
- [ ] 平台能选 wechat
- [ ] Base URL 能粘贴 RSS 地址
- [ ] 帮助文案可见
- [ ] 保存成功

---

## 7. 测试采集

1. 在来源列表中找到刚添加的来源
2. 点击"采集"按钮
3. 等待采集完成
4. 查看结果

- [ ] 点击采集不报错
- [ ] 显示 discoveredCount > 0
- [ ] 显示 importedCount >= 0
- [ ] 显示 skippedCount >= 0

---

## 8. 确认文章入库

1. 打开文章列表页面
2. 确认能看到刚采集的文章

验收标准：
- [ ] 文章能出现在列表中
- [ ] title 正确（与 WeWe RSS 后台显示一致）
- [ ] originalUrl 正确（指向 mp.weixin.qq.com）
- [ ] fullText 有正文内容（非空）
- [ ] coverUrl 如 RSS feed 提供则能保存
- [ ] platform 为 wechat

---

## 9. 测试重复采集

1. 再次点击同一来源的"采集"按钮
2. 等待采集完成

- [ ] 第二次采集不报错
- [ ] importedCount 为 0（无新文章入库）
- [ ] skippedCount > 0（重复文章被跳过）
- [ ] 文章列表中没有重复文章

---

## 10. 验收完成

所有上述检查项通过后，本地公众号 RSS 接入验收完成。

---

## 常见失败与处理

### 1. localhost:4000 打不开

```bash
docker compose ps                    # 检查容器状态
docker compose logs --tail=50        # 查看日志
docker compose restart               # 重启容器
```

常见原因：端口被占用、Docker 未启动、容器启动失败。

### 2. AUTH_CODE 不正确

确认 `.env` 中的 `AUTH_CODE` 和你在浏览器中输入的一致。修改后需要重启：

```bash
docker compose down
docker compose up -d
```

### 3. 微信读书扫码失败

- 确保使用**微信读书 App**（不是微信）扫码
- 确保微信读书账号正常
- 不要勾选"24 小时后自动退出"

### 4. 公众号无文章

部分公众号可能没有公开文章，或微信读书尚未同步。尝试添加一个活跃的公众号（如"人民日报"）。

### 5. RSS 地址为空

在 WeWe RSS 后台确认公众号已成功添加且有文章。RSS 地址在公众号详情页显示。

### 6. 主项目采集失败

```bash
# 检查 RSS 地址是否可访问
curl http://localhost:4000/feeds/MP_WXS_xxx.rss

# 检查 WeWe RSS 日志
cd infra/wechat-rss/wewe-rss
docker compose logs --tail=50
```

### 7. RSS XML 解析失败

确认 RSS 地址在浏览器中能正常打开并显示 XML 内容。如果是 Atom 格式，地址应以 `.atom` 结尾。

### 8. 文章重复入库

正常情况下不会发生。如果发生，检查：
- ContentItem 表中 originalUrl 是否有唯一约束
- contentHash 是否正确计算

### 9. 正文太短被过滤

shenlun-material-hub 对全文不足 300 字的文章标记为 `filtered`。这是正常行为，不是错误。确认 WeWe RSS 配置了 `FEED_MODE=fulltext`。

### 10. Docker 数据清理

```bash
# 停止并删除容器
docker compose down

# 停止、删除容器并清除数据
docker compose down -v
rm -rf ./data
```

---

## 11. 脏 HTML 修复脚本验收

### 背景

微信公众号文章通过 WeWe RSS 采集后，`fullText` 字段可能包含未清洗的 HTML（如 `<!DOCTYPE html>`、`<html>`、`<head>`、`<script>` 等标签）。`scripts/repair-wechat-content.ts` 脚本用于批量修复这些脏数据。

### 11.1 dry-run 使用方法

默认即为 dry-run 模式，不会修改数据库：

```bash
# dry-run 模式（默认，不加参数）
npx tsx scripts/repair-wechat-content.ts

# 显式指定 dry-run
npx tsx scripts/repair-wechat-content.ts --dry-run

# 实际写入数据库（需显式指定）
npx tsx scripts/repair-wechat-content.ts --apply
```

脚本会：
1. 查找 `platform=wechat` 且 `fullText` 包含 HTML 特征的 `ContentItem` 记录
2. 调用 `cleanWechatHtml` 清洗正文
3. 重新计算 `wordCount`、`contentHash`、`excerpt`
4. 若清洗后字数 >= 300 且原状态为 `filtered`，自动提升为 `candidate`

### 11.2 dry-run 输出示例描述

```
=== WeChat Article Content Repair Tool ===
Mode: DRY-RUN (No changes will be written)
Found 3 suspect dirty WeChat articles.
- [cm5abc123] "论新时代文化自信": length 15234 -> 3210
- [cm5def456] "加强基层治理体系建设": length 8976 -> 2105
- [cm5ghi789] "推动高质量发展": length 12345 -> 4567

Summary:
Processed: 3/3 articles.
Status: Dry-run completed successfully. No DB writes.
```

关键信息：

- `length 15234 -> 3210`：修复前后的字符长度对比。前者是原始 HTML 长度，后者是清洗后纯文本长度。
- `Found N suspect dirty WeChat articles`：匹配到包含 HTML 特征的文章数量。
- 最后一行明确标注 `No DB writes`，确认无数据写入。

### 11.3 回滚方式说明

该脚本**直接覆盖** `fullText`、`rawHtml`、`effectiveTextLength`、`contentHash`、`excerpt` 等字段，不保留原始值。因此：

1. **执行前务必先 dry-run**：确认输出符合预期后再加 `--apply`。

2. **数据库备份**：执行 `--apply` 前建议备份数据库。

   ```bash
   # PostgreSQL 备份
   pg_dump -h localhost -U postgres shenlun_material_hub > backup_before_repair_$(date +%Y%m%d).sql
   ```

3. **如果已执行 --apply 需要回滚**：

   ```bash
   # 从备份恢复
   psql -h localhost -U postgres shenlun_material_hub < backup_before_repair_20260606.sql
   ```

4. **部分回滚**（仅恢复单篇文章）：

   由于脚本会将原始 HTML 保存到 `rawHtml` 字段，如果需要恢复单篇文章的 `fullText`，可以从 `rawHtml` 重新提取。但需要注意 `rawHtml` 也已经被 `cleanWechatHtml` 处理过，可能无法完全还原。因此**全量数据库备份是最可靠的回滚方式**。

5. **质量状态回退**：脚本会将 `filtered` 状态提升为 `candidate`。如需恢复，可手动执行：

   ```sql
   -- 仅查看受影响的记录
   SELECT id, title, "qualityStatus" FROM "ContentItem"
   WHERE platform = 'wechat' AND "qualityStatus" = 'candidate';

   -- 回退特定记录（需确认 ID）
   -- UPDATE "ContentItem" SET "qualityStatus" = 'filtered', "filterReason" = 'reverted'
   -- WHERE id = '<specific-id>';
   ```
