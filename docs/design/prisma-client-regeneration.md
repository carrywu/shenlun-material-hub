# Prisma Client 再生成工作流

> P3-4: 文档化 Prisma Client 生成流程
> 状态：文档化（`src/generated/prisma/` 已提交至仓库）

## 现状

Prisma Client 生成文件位于 `src/generated/prisma/`，已提交到 Git 仓库。

**当前配置**（`prisma/schema.prisma`）：

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

## 何时需要再生成

| 场景 | 触发条件 | 操作 |
|------|---------|------|
| Schema 变更 | 修改 `prisma/schema.prisma` 中的 model/field/enum | `pnpm db:generate` |
| Prisma 版本升级 | `pnpm update @prisma/client prisma` | `pnpm db:generate` |
| 数据库迁移 | `pnpm db:migrate` (开发) 或 `pnpm db:migrate deploy` (生产) | 自动触发 generate |
| CI/本地环境克隆 | `pnpm install` | 从 `src/generated/prisma/` 直接使用 |

## 标准工作流

### 开发环境：Schema 变更

```bash
# 1. 修改 schema
vim prisma/schema.prisma

# 2. 创建迁移（开发环境）
pnpm db:migrate dev --name describe_your_change

# 此命令会自动：
#   - 创建 SQL 迁移文件
#   - 应用迁移到开发数据库
#   - 重新生成 Prisma Client (等价于 pnpm db:generate)

# 3. 验证生成结果
pnpm build  # 确保类型检查通过
pnpm test   # 确保测试通过

# 4. 提交
git add prisma/schema.prisma prisma/migrations/ src/generated/prisma/
git commit -m "feat: describe your schema change"
```

### 生产环境：部署迁移

```bash
# 1. 应用待执行的迁移（不会重新 generate）
pnpm db:migrate deploy

# 2. 确保 Client 最新（部署流程中自动）
pnpm db:generate

# 3. 构建应用
pnpm build
```

### 仅重新生成（不改 Schema）

```bash
# 清理并重新生成
pnpm db:generate

# 等价于
pnpm exec prisma generate
```

## CI 检测

建议在 CI 中添加 stale 检测，防止忘记提交生成文件：

```yaml
# .github/workflows/ci.yml (建议添加)
- name: Check Prisma Client freshness
  run: |
    pnpm db:generate
    if ! git diff --quiet src/generated/prisma/; then
      echo "❌ Prisma Client is stale. Run 'pnpm db:generate' and commit the changes."
      git diff --stat src/generated/prisma/
      exit 1
    fi
```

## 常见问题

### Q: 为什么提交 `src/generated/prisma/`？

**A**: 避免每个开发者/CI 环境都需要运行 `prisma generate`。生成文件约 500KB，提交到仓库可确保：
- 所有环境使用完全相同的 Client 代码
- `pnpm install` 后立即可用，无需额外步骤
- CI 构建更快（跳过 generate 步骤）

### Q: 生成文件冲突怎么办？

**A**: 几乎不会发生。Prisma Client 生成是确定性的（相同 schema → 相同输出）。如果两人同时改 schema 并 generate，合并时以最新 schema 为准重新 generate 即可。

### Q: 如何确认本地 Client 是最新的？

```bash
# 方法 1：对比 git diff
pnpm db:generate && git diff --stat src/generated/prisma/

# 方法 2：检查 package.json 中的 prisma 版本
pnpm list @prisma/client prisma
```

## 参考文件

- `prisma/schema.prisma` — 数据模型定义
- `src/generated/prisma/` — 生成的 Client 代码
- `package.json` — `db:generate` / `db:migrate` 脚本
- `docs/DEPLOY.md` — 部署流程
