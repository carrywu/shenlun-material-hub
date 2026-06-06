# IMA 同步失败重试策略与故障恢复指南

## 概述

IMA 同步功能将已确认的素材卡导出到腾讯 IMA 知识库。核心代码位于 `src/services/ima-sync.ts`。

---

## 1. 重试策略

### 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 最大重试次数 | 3 次 | 常量 `MAX_RETRIES` |
| 基础重试间隔 | 1000 ms | 常量 `RETRY_DELAY_MS` |
| 退避策略 | 指数退避 | 每次重试间隔翻倍 |

### 退避时间表

| 尝试次数 | 等待时间 |
|---------|---------|
| 第 1 次失败 | 等待 1000 ms (1s) |
| 第 2 次失败 | 等待 2000 ms (2s) |
| 第 3 次失败 | 不再等待，直接抛出异常 |

公式：`RETRY_DELAY_MS * 2^attempt`，其中 attempt 从 0 开始。

### 重试范围

- 仅对 `uploadDocument`（向 IMA API 发起 POST 请求）进行重试。
- 数据库查询、素材卡格式化等操作不在重试范围内。
- 3 次全部失败后，错误信息写入 `SyncRecord.errorMessage`，状态标记为 `failed`。

---

## 2. 可能的错误码与原因

IMA API 调用失败时，错误消息格式为：

```
ima API error (<HTTP状态码>): <响应正文>
```

### 常见 HTTP 状态码

| 状态码 | 含义 | 可能原因 | 建议处理 |
|--------|------|---------|---------|
| 400 | Bad Request | 请求体格式错误、缺少必填字段 | 检查素材卡内容是否合法 |
| 401 | Unauthorized | `IMA_API_KEY` 无效或过期 | 检查 `.env` 中的 `IMA_API_KEY` |
| 403 | Forbidden | `IMA_CLIENT_ID` 无权限访问该知识库 | 检查 `IMA_CLIENT_ID` 和 `IMA_KNOWLEDGE_BASE_ID` 配置 |
| 404 | Not Found | 知识库 ID 不存在 | 确认 `IMA_KNOWLEDGE_BASE_ID` 正确 |
| 429 | Too Many Requests | API 调用频率超限 | 降低并发数，等待后重试 |
| 500 | Internal Server Error | IMA 服务端异常 | 稍后重试，若持续出现则联系 IMA 平台 |
| 502 / 503 | Gateway / Service Unavailable | IMA 服务不可用 | 稍后重试 |

### 业务层错误

| 错误消息 | 原因 | 处理方式 |
|---------|------|---------|
| "素材卡不存在" | 传入的 cardId 在数据库中找不到 | 确认素材卡 ID 正确 |
| "素材卡尚未确认，请先确认后再同步" | 素材卡 `confirmed` 字段为 false | 先在前端确认素材卡 |
| "同步失败" | 重试 3 次后仍失败 | 按下方人工恢复步骤处理 |

---

## 3. 同步记录状态流转

```
pending -> success  (同步成功)
pending -> failed   (同步失败)
```

`SyncRecord` 关键字段：

- `status`: `pending` / `success` / `failed`
- `errorMessage`: 失败时的错误信息
- `errorCode`: 预留的错误码字段（当前未写入）
- `remoteDocumentId`: 成功后 IMA 返回的文档 ID
- `targetRemoteId`: 知识库 ID

---

## 4. 批量同步

`syncBatchToIma` 支持批量同步，默认并发数为 3。每批素材卡并行执行，批次之间串行。

- 每张素材卡独立重试，互不影响。
- 单张失败不影响其他素材卡。
- 返回结果包含 `total`、`success`、`failed` 计数及每张卡的详细状态。

---

## 5. 人工恢复步骤

### 5.1 查询失败记录

```sql
-- 查询最近失败的同步记录
SELECT id, "materialCardId", status, "errorMessage", "syncedAt"
FROM "SyncRecord"
WHERE status = 'failed'
ORDER BY "syncedAt" DESC
LIMIT 20;
```

或通过 API 查询：

```
GET /api/sync-records?status=failed
```

### 5.2 分析错误原因

1. 查看失败记录的 `errorMessage` 字段
2. 根据上方"可能的错误码"表格定位原因
3. 排查环境变量配置（`IMA_API_BASE`、`IMA_CLIENT_ID`、`IMA_API_KEY`、`IMA_KNOWLEDGE_BASE_ID`）

### 5.3 检查环境变量

```bash
# 确认环境变量已正确配置
grep IMA_ .env
```

应包含：

```
IMA_API_BASE=https://api.ima.qq.com
IMA_CLIENT_ID=<your-client-id>
IMA_API_KEY=<your-api-key>
IMA_KNOWLEDGE_BASE_ID=<your-kb-id>
```

### 5.4 手动重试同步

通过前端 UI 重新触发同步，或调用 API：

```
POST /api/sync
Body: { "cardId": "<失败素材卡的ID>" }
```

系统会创建一条新的 `SyncRecord`（不会复用旧记录），重新执行同步流程（含 3 次重试）。

### 5.5 网络连通性排查

```bash
# 测试 IMA API 可达性
curl -I https://api.ima.qq.com

# 测试带认证的请求
curl -H "Authorization: Bearer $IMA_API_KEY" \
     -H "X-Client-Id: $IMA_CLIENT_ID" \
     https://api.ima.qq.com/v1/knowledge_bases/$IMA_KNOWLEDGE_BASE_ID
```

### 5.6 清理脏数据

如果因为 bug 产生了大量 `pending` 或 `failed` 的脏记录，可在确认问题修复后清理：

```sql
-- 仅查看，不执行
SELECT count(*) FROM "SyncRecord" WHERE status = 'failed';

-- 确认后删除失败记录（谨慎操作）
-- DELETE FROM "SyncRecord" WHERE status = 'failed' AND "syncedAt" < '2026-01-01';
```

**注意**：删除 SyncRecord 不会影响 IMA 侧已上传的文档。如需删除 IMA 侧文档，需通过 IMA API 或管理后台操作。

---

## 6. 环境变量参考

| 变量名 | 默认值 | 说明 |
|--------|-------|------|
| `IMA_API_BASE` | `https://api.ima.qq.com` | IMA API 基础地址 |
| `IMA_CLIENT_ID` | 空（必填） | 客户端 ID |
| `IMA_API_KEY` | 空（必填） | API 密钥 |
| `IMA_KNOWLEDGE_BASE_ID` | 空（必填） | 目标知识库 ID |

---

## 7. 相关文件

- `src/services/ima-sync.ts` — 同步核心逻辑
- `src/app/api/sync/route.ts` — 单卡同步 API（批量同步使用同一端点，传入 cardIds 数组）
- `src/app/api/sync-records/route.ts` — 同步记录查询 API
- `prisma/schema.prisma` — `SyncRecord` 模型定义

---

## 失败重试策略

### 单卡同步失败
- 前端显示错误信息，用户可手动重试
- 服务端不自动重试（避免重复同步）

### 批量同步失败
- 使用 Promise.allSettled 并发同步，单个失败不影响其他卡片
- 失败的卡片会记录到 SyncRecord（status=FAILED）
- 用户可在同步记录页查看失败原因并重试

### 幂等性
- 同步前检查 SyncRecord 是否已存在成功记录
- 同一卡片重复同步会返回已有记录，不会重复上传
