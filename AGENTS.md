# shenlun-material-hub Agent Rules (Codex)

> 通用 Codex 规范见全局规则（~/.codex/AGENTS.md）。本文件只记录当前项目特有约束。

## Project Context

申论素材采集与 AI 素材卡生成系统。
技术栈：Next.js 16 + Prisma 7 + SQLite + React 19 + Tailwind CSS + Vitest + Playwright

详细模块说明和边界规则见 `CLAUDE.md`（本目录），两文件内容保持同步。

## Key Constraints

1. WeWe RSS 是 sidecar，不嵌入本项目，不写其数据库。
2. 不做微信逆向，不绕登录/验证码/风控。
3. 手动来源和外部 WeRSS fallback 必须保留。
4. 文章内容清洗规则：fullText 干净、rawHtml 不当正文、summary 不来自 head/doctype。
5. 数据库破坏性操作必须有 dry-run。

## Validation Commands

```bash
pnpm lint
pnpm test
pnpm build
pnpm exec playwright test
```

## Critical Pages

浏览器验收覆盖：
- `/integrations/wewe-rss`
- `/subscriptions`
- `/articles/[id]`
- `/materials`
- `/sources`

## Sensitive Files

```
.env
*.db / *.sqlite / *.sqlite3
prisma/*.db
test-results/
playwright-report/
```
