# Figma Code Map

Allowed status values: `未审查`, `已审查`, `待实现`, `实现中`, `已实现`, `已验证`, `有阻塞`.

| Figma 页面 / Frame | 路由 | 角色 | 断点 | 对应代码 | 当前状态 |
|---|---|---|---|---|---|
| `17:2` Foundations / Review Board | 全局 | 全部 | Light / Dark | `src/app/globals.css`, `components.json` | 已审查 |
| `17:89` Components / Inventory & Mapping | 全局 | 全部 | 全部 | `src/components/ui/**`, shared components | 已审查 |
| `8:2` Batch 1 / Frontend Shell / Desktop | 前台 Shell | USER / VERIFIED_USER / ADMIN | 1440 | `src/app/layout.tsx`, `src/components/RootNav.tsx` | 待实现 |
| `8:48` Batch 1 / Frontend Shell / Mobile | 前台 Shell | USER / VERIFIED_USER / ADMIN | 390 | `src/components/MobileBottomTab.tsx` | 待实现 |
| `12:19` Batch 1 / Admin Shell / Desktop | `/admin/*` except `/admin/login` | ADMIN | 1440 | `src/app/admin/layout.tsx`, `src/components/admin/AdminShell.tsx` | 待实现 |
| `12:162` Batch 1 / Admin Shell / Mobile | `/admin/*` except `/admin/login` | ADMIN | 390 | `src/components/admin/AdminShell.tsx` | 待实现 |
| No final auth frame found | `/login` | anonymous | 390 / 768 / 1440 | `src/app/login/page.tsx`, `src/components/layout/AuthShell.tsx` | 有阻塞 |
| No final auth frame found | `/register` | anonymous | 390 / 768 / 1440 | `src/app/register/page.tsx`, `src/components/layout/AuthShell.tsx` | 有阻塞 |
| No final auth frame found | `/admin/login` | anonymous | 390 / 768 / 1440 | `src/app/admin/login/page.tsx`, `src/components/layout/AuthShell.tsx` | 有阻塞 |
| No final home frame found | `/` | USER / VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/page.tsx` | 有阻塞 |
| No final article-list frame found | `/articles` | USER / VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/articles/page.tsx`, `src/components/articles/ArticlesPage.tsx` | 有阻塞 |
| `14:20` Batch 4 / Article Reader / Desktop / VERIFIED_USER | `/articles/[id]` | VERIFIED_USER baseline; USER/ADMIN via `15:20` | 1440 | `src/app/articles/[id]/page.tsx`, `ArticleContentRenderer`, `ArticleExportMenu` | 待实现 |
| `14:103` Batch 4 / Article Reader / Mobile / VERIFIED_USER | `/articles/[id]` | VERIFIED_USER baseline; USER/ADMIN via `15:20` | 390 | `src/app/articles/[id]/page.tsx`, `ArticleContentRenderer`, `ArticleExportMenu` | 待实现 |
| `15:20` Batch 4 / Reader Roles & States | `/articles/[id]` | USER / VERIFIED_USER / ADMIN | all | `src/app/articles/[id]/page.tsx` | 已审查 |
| No final cards frame found | `/cards` | VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/cards/page.tsx`, `MaterialCard` | 有阻塞 |
| No final card-detail frame found | `/cards/[id]` | VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/cards/[id]/page.tsx` | 有阻塞 |
| No final search frame found | `/search` | VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/search/page.tsx` | 有阻塞 |
| No final review frame found | `/review` | USER / VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/review/page.tsx`, `ReviewCard` | 有阻塞 |
| No final settings frame found | `/settings/**` | USER / VERIFIED_USER / ADMIN | 390 / 768 / 1440 | `src/app/settings/**/page.tsx` | 有阻塞 |
| `16:354` Prototype Destination / Admin Articles Desktop | `/admin/articles` | ADMIN | 1440 | `src/app/admin/articles/page.tsx`, `ArticlesPage managementMode` | 有阻塞 |
| No final admin page frames found | `/admin`, `/admin/sources`, `/admin/integrations/wechat-rss`, `/admin/sync-records`, `/admin/tasks` | ADMIN | 390 / 768 / 1440 | `src/app/admin/**/page.tsx` | 有阻塞 |
| No final admin system frames found | `/admin/logs`, `/admin/settings/ai`, `/admin/backup`, `/admin/clean`, `/admin/invitations`, `/admin/users` | ADMIN | 390 / 768 / 1440 | `src/app/admin/**/page.tsx` | 有阻塞 |
| `16:113` Dev Handoff / Figma to Code | 全局交接 | 全部 | n/a | this task docs | 已审查 |

