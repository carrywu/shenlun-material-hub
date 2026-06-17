# Interactive Components List

> Auto-generated inventory of all page routes, shared components, and API endpoints
> that require E2E / interactive testing coverage.
>
> Last updated: 2026-06-06

---

## Table 1: Page Routes (28 total)

| # | Route | File | Main Component | Interactive Elements | Status |
|---|-------|------|----------------|----------------------|--------|
| 1 | `/` | `src/app/page.tsx` | DashboardPage | Links to sub-pages, CollectButton (opens CollectDialog) | ❌ untested |
| 2 | `/articles` | `src/app/articles/page.tsx` | ArticlesPage (public) | Search input, 5 select filters, date pickers, data table, row checkboxes, pagination | ⚠️ partial |
| 3 | `/articles/[id]` | `src/app/articles/[id]/page.tsx` | ArticleDetailPage | Bookmark toggle, mark as read, AI assess button, annotation add/edit/delete, image preview | ⚠️ partial |
| 4 | `/cards` | `src/app/cards/page.tsx` | CardsPage | Search input, filter selects, tab switcher, batch select checkboxes, sync-to-IMA button, pagination | ❌ untested |
| 5 | `/cards/[id]` | `src/app/cards/[id]/page.tsx` | CardDetailPage | Edit card, regenerate card, confirm card, sync to IMA, delete card | ❌ untested |
| 6 | `/discover` | `src/app/discover/page.tsx` | DiscoverPage | Filter selects, bookmark toggle, mark as read, pagination | ❌ untested |
| 7 | `/explore` | `src/app/explore/page.tsx` | ExplorePage | Search input, filter selects, verify source, ignore source, pagination | ⚠️ partial |
| 8 | `/search` | `src/app/search/page.tsx` | SearchPage | Search input, filter selects, export button, pagination | ❌ untested |
| 9 | `/review` | `src/app/review/page.tsx` | ReviewPage | Mode select dropdown, card expand/collapse, mark as reviewed button | ❌ untested |
| 10 | `/register` | `src/app/register/page.tsx` | RegisterForm | Username input, password input, invitation code input, submit button | ❌ untested |
| 11 | `/settings` | `src/app/settings/page.tsx` | SettingsPage | Navigation links to sub-pages (account, AI, IMA) | ❌ untested |
| 12 | `/settings/account` | `src/app/settings/account/page.tsx` | AccountSettingsPage | Current password input, new password input, confirm password input, submit button | ❌ untested |
| 13 | `/settings/ai` | `src/app/settings/ai/page.tsx` | UserAiSettingsPage | AI provider select, API key input, model name input, save button | ❌ untested |
| 14 | `/settings/ima` | `src/app/settings/ima/page.tsx` | ImaSettingsPage | Add IMA target form, edit target, delete target, test connection | ❌ untested |
| 15 | `/admin/login` | `src/app/admin/login/page.tsx` | LoginForm | Username input, password input, submit button | ✅ tested |
| 16 | `/admin` | `src/app/admin/page.tsx` | AdminDashboardPage | Refresh metrics button, stat cards with links | ⚠️ partial |
| 17 | `/admin/articles` | `src/app/admin/articles/page.tsx` | ArticlesPage (management) | Same as `/articles` + debug toggle switch, batch actions | ⚠️ partial |
| 18 | `/admin/sources` | `src/app/admin/sources/page.tsx` | SubscriptionsPage | Search input, 5 filter selects, create source dialog, edit source, delete source (with confirm), channel manager, import dialog | ⚠️ partial |
| 19 | `/admin/integrations/we-mp-rss` | `src/app/admin/integrations/we-mp-rss/page.tsx` | WeweRssIntegrationPage | Config inputs (URL, token), test connection button, preview sync button, execute sync button, delete missing sources dialog | ⚠️ partial |
| 20 | `/admin/sync-records` | `src/app/admin/sync-records/page.tsx` | SyncRecordsPage | Filter selects, retry failed button, pagination | ❌ untested |
| 21 | `/admin/tasks` | `src/app/admin/tasks/page.tsx` | AdminTasksPage | Search input, status filter, type filter, expandable rows, pagination | ⚠️ partial |
| 22 | `/admin/logs` | `src/app/admin/logs/page.tsx` | AdminLogsPage | Level filter, category filter, date range, clear logs button | ❌ untested |
| 23 | `/admin/settings/ai` | `src/app/admin/settings/ai/page.tsx` | AiConfigPage | API provider/key/model inputs, temperature slider, save config, test connection, delete config, prompt template editor | ⚠️ partial |
| 24 | `/admin/backup` | `src/app/admin/backup/page.tsx` | AdminBackupPage | Export backup button, import backup (file upload), restore from backup | ❌ untested |
| 25 | `/admin/clean` | `src/app/admin/clean/page.tsx` | CleanPage | Clean rules configuration, execute clean button (with confirm) | ❌ untested |
| 26 | `/admin/users` | `src/app/admin/users/page.tsx` | UsersPage | Create user dialog, edit user, delete user (with confirm), reset password button | ⚠️ partial |
| 27 | `/integrations/we-mp-rss` | `src/app/integrations/we-mp-rss/page.tsx` | WeweRssIntegrationPage (public) | Same component as admin version (read-only view for regular users) | ❌ untested |
| 28 | `/subscriptions` | `src/app/subscriptions/page.tsx` | SubscriptionsPage (public) | Same component as admin version (read-only view for regular users) | ❌ untested |

---

## Table 2: Shared Components (23 total)

| # | Component | File | Interactive Elements | Used On Pages | Status |
|---|-----------|------|----------------------|---------------|--------|
| 1 | AdminShell | `src/components/admin/AdminShell.tsx` | Sidebar navigation (11 links), collapse/expand toggle, mobile hamburger menu, logout button | All `/admin/*` pages | ⚠️ partial |
| 2 | CollectButton | `src/components/CollectButton.tsx` | Button that opens CollectDialog | Dashboard (`/`) | ❌ untested |
| 3 | CollectDialog | `src/components/CollectDialog.tsx` | Source selection checkboxes, confirm collect button, cancel button | Dashboard (`/`) | ❌ untested |
| 4 | ArticlesPage | `src/components/articles/ArticlesPage.tsx` | Search input, 5 select dropdowns, date range pickers, debug toggle, data table with sortable columns, row checkboxes, select all checkbox, pagination | `/articles`, `/admin/articles` | ⚠️ partial |
| 5 | SubscriptionsPage | `src/components/subscriptions/SubscriptionsPage.tsx` | Search input, 5 filter selects, create source dialog, edit source dialog, delete source (with confirm dialog), channel manager, WeChat import dialog, article preview dialog | `/admin/sources`, `/subscriptions` | ⚠️ partial |
| 6 | ChannelManager | `src/components/ChannelManager.tsx` | Add channel form, edit channel, delete channel (with confirm), enable/disable toggle switch | SubscriptionsPage | ❌ untested |
| 7 | WechatImportDialog | `src/components/WechatImportDialog.tsx` | URL text input, import button, cancel button | SubscriptionsPage | ❌ untested |
| 8 | ArticlePreviewDialog | `src/components/ArticlePreviewDialog.tsx` | Article checkbox selection, select all, import selected button | SubscriptionsPage | ❌ untested |
| 9 | MaterialCardView | `src/components/MaterialCard.tsx` | Edit button, confirm button, delete button (with confirm) | `/cards`, `/search`, `/review` | ❌ untested |
| 10 | MaterialCardEditor | `src/components/MaterialCardEditor.tsx` | Tab switcher (preview/edit), title input, card type badge selector, 5 textarea fields (thesis, argument, evidence, countermeasure, extension), save button, cancel button | `/cards/[id]` | ❌ untested |
| 11 | ReviewCard | `src/components/ReviewCard.tsx` | 4 collapsible sections (thesis, argument, evidence, countermeasure), show all / hide all toggle, mark as reviewed checkbox | `/review` | ❌ untested |
| 12 | ArticleDetail | `src/components/ArticleDetail.tsx` | Card type select dropdown, generate card button, go-to-detail link | ArticlesPage | ❌ untested |
| 13 | BatchActions | `src/components/BatchActions.tsx` | Select all checkbox, batch generate cards button | ArticlesPage | ❌ untested |
| 14 | SyncToIma | `src/components/SyncToIma.tsx` | Sync to IMA button, retry sync button | `/cards/[id]` | ❌ untested |
| 15 | SyncRecordsPage | `src/components/sync/SyncRecordsPage.tsx` | Status filter, type filter, date range filter, retry failed button, pagination | `/admin/sync-records` | ❌ untested |
| 16 | AiConfigPage | `src/components/ai/AiConfigPage.tsx` | API provider input, API key input, model input, temperature slider, save button, test connection button, delete config button, prompt template list with add/edit/delete | `/admin/settings/ai` | ⚠️ partial |
| 17 | WeweRssIntegrationPage | `src/components/integrations/WeweRssIntegrationPage.tsx` | Config URL/token inputs, test connection button, preview sync button, execute sync button, delete missing sources dialog (with confirm) | `/admin/integrations/we-mp-rss`, `/integrations/we-mp-rss` | ⚠️ partial |
| 18 | Button | `src/components/ui/button.tsx` | Click handler, disabled state, loading state, variant styles | All pages | ✅ tested |
| 19 | Input | `src/components/ui/input.tsx` | Text entry, focus/blur, disabled state, placeholder | Forms across all pages | ✅ tested |
| 20 | Textarea | `src/components/ui/textarea.tsx` | Multi-line text entry, resize, disabled state | MaterialCardEditor, prompt templates | ❌ untested |
| 21 | Select | `src/components/ui/select.tsx` | Dropdown selection, option list, disabled state | ArticlesPage, SubscriptionsPage, AiConfigPage | ✅ tested |
| 22 | Checkbox | `src/components/ui/checkbox.tsx` | Check/uncheck toggle, disabled state, indeterminate state | ArticlesPage, CollectDialog, ReviewCard | ✅ tested |
| 23 | Dialog | `src/components/ui/dialog.tsx` | Open/close, overlay click to dismiss, escape key, confirm/cancel buttons | CollectDialog, WechatImportDialog, ArticlePreviewDialog, delete confirms | ✅ tested |

---

## Table 3: API Routes (65 total)

### Auth (5 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 1 | `/api/auth/login` | GET, POST | Submit login form with username + password | ✅ tested |
| 2 | `/api/auth/logout` | POST | Click logout button in admin sidebar | ✅ tested |
| 3 | `/api/auth/check` | GET | Session check on page load / middleware redirect | ✅ tested |
| 4 | `/api/auth/register` | POST | Submit registration form with username + password + invitation code | ❌ untested |
| 5 | `/api/auth/change-password` | POST | Submit password change form in account settings | ❌ untested |

### Admin (10 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 6 | `/api/admin/metrics` | GET | Admin dashboard loads / clicks refresh stats | ✅ tested |
| 7 | `/api/admin/tasks` | GET | Admin tasks page loads, list async tasks | ⚠️ partial |
| 8 | `/api/admin/tasks/[id]` | GET | Expand task row to view task detail | ⚠️ partial |
| 9 | `/api/admin/users` | GET, POST | List users / click create user and submit form | ⚠️ partial |
| 10 | `/api/admin/users/[id]` | GET, PUT, DELETE | View user detail / edit user role / delete user (with confirm) | ⚠️ partial |
| 11 | `/api/admin/invitations` | GET, POST | List invitation codes / generate new invitation code | ❌ untested |
| 12 | `/api/admin/logs` | GET, DELETE | View system logs with filters / click clear logs | ❌ untested |
| 13 | `/api/admin/backup/export` | GET | Click export backup button | ❌ untested |
| 14 | `/api/admin/backup/import` | POST | Upload backup file and click import | ❌ untested |
| 15 | `/api/admin/clean` | GET, POST | View clean rules / click execute clean (with confirm) | ❌ untested |

### Content Items (7 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 16 | `/api/content-items` | GET, POST | List articles with filters / manual add article | ⚠️ partial |
| 17 | `/api/content-items/[id]` | GET, PUT, DELETE | View article detail / toggle bookmark or read status / delete article | ⚠️ partial |
| 18 | `/api/content-items/[id]/score` | GET, POST | View AI score / click AI assess button | ⚠️ partial |
| 19 | `/api/content-items/[id]/generate-card` | POST | Click generate card button on article row | ❌ untested |
| 20 | `/api/content-items/[id]/annotations` | GET, POST, PUT | List annotations / add annotation / update annotation | ❌ untested |
| 21 | `/api/content-items/assess` | POST | Click batch AI assess button | ❌ untested |
| 22 | `/api/content-items/reassess` | POST | Click reassess button on already-scored article | ❌ untested |

### Material Cards (2 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 23 | `/api/material-cards` | GET, POST | List cards with filters / generate card (triggers from content item) | ❌ untested |
| 24 | `/api/material-cards/[id]` | GET, PUT, DELETE | View card detail / edit card fields / delete card (with confirm) | ❌ untested |

### Annotations (2 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 25 | `/api/annotations/[id]` | PATCH, DELETE | Edit annotation text / delete annotation | ❌ untested |
| 26 | `/api/content-items/[id]/annotations` | GET, POST, PUT | (Covered in Content Items #20 above) | ❌ untested |

### Sources (8 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 27 | `/api/sources` | GET, POST | List sources with filters / click create source and submit form | ⚠️ partial |
| 28 | `/api/sources/[id]` | GET, PUT, DELETE | View source detail / edit source fields / delete source (with confirm) | ⚠️ partial |
| 29 | `/api/sources/[id]/verify` | POST | Click verify source button on explore page | ❌ untested |
| 30 | `/api/sources/[id]/channels` | GET, POST | List channels for source / add new channel in ChannelManager | ❌ untested |
| 31 | `/api/sources/[id]/channels/[channelId]` | PUT, DELETE | Edit channel settings / delete channel (with confirm) | ❌ untested |
| 32 | `/api/sources/import` | POST | Click import source (OPML or WeChat URL) | ❌ untested |
| 33 | `/api/sources/quality` | POST | Trigger source quality check | ❌ untested |

### Collectors (9 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 34 | `/api/collectors/web/collect` | GET, POST | View collection status / click collect button in CollectDialog | ❌ untested |
| 35 | `/api/collectors/wechat/sources` | GET | Fetch WeChat source list from we-mp-rss | ⚠️ partial |
| 36 | `/api/collectors/wechat/articles` | GET | Fetch WeChat articles for a given source | ❌ untested |
| 37 | `/api/collectors/wechat/import` | POST | Click import button in ArticlePreviewDialog | ❌ untested |
| 38 | `/api/collectors/wechat/sync` | POST | Click sync button for WeChat sources | ❌ untested |
| 39 | `/api/collectors/wechat/sync/preview` | POST | Click preview sync to see what will change | ❌ untested |
| 40 | `/api/collectors/wechat/sync/confirm` | POST | Click confirm sync after preview | ❌ untested |
| 41 | `/api/collectors/mediacrawler/crawl` | GET, POST | View crawl status / start a new media crawl job | ❌ untested |
| 42 | `/api/collectors/mediacrawler/status/[runId]` | GET | Poll crawl job status | ❌ untested |

### Integrations - we-mp-rss (7 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 43 | `/api/integrations/we-mp-rss/status` | GET | we-mp-rss integration page loads, fetch connection status | ⚠️ partial |
| 44 | `/api/integrations/we-mp-rss/test` | POST | Click test connection button | ⚠️ partial |
| 45 | `/api/integrations/we-mp-rss/preview-sync` | POST | Click preview sync button to see pending changes | ❌ untested |
| 46 | `/api/integrations/we-mp-rss/sync-sources` | POST | Click execute sync button | ❌ untested |
| 47 | `/api/integrations/we-mp-rss/delete-missing-sources` | POST | Click delete missing sources (with confirm dialog) | ❌ untested |
| 48 | `/api/integrations/we-mp-rss/refresh-source` | POST | Click refresh individual source | ❌ untested |

### AI Config (3 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 49 | `/api/ai-config` | GET, POST, DELETE | Load AI config / save config changes / delete config | ⚠️ partial |
| 50 | `/api/ai-config/test` | POST | Click test connection button in AI settings | ⚠️ partial |
| 51 | `/api/ai-config/prompts` | GET, PUT, POST | List prompt templates / update template / create new template | ❌ untested |

### Settings (3 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 52 | `/api/settings/ai-config` | GET, POST, DELETE | User-level AI config load / save / delete | ❌ untested |
| 53 | `/api/settings/ima-targets` | GET, POST | List IMA targets / create new IMA target | ❌ untested |

### Other (12 routes)

| # | API Path | Methods | User Action | Status |
|---|----------|---------|-------------|--------|
| 54 | `/api/articles` | GET | Public articles page loads (alias for content-items) | ⚠️ partial |
| 55 | `/api/search` | GET | Submit search query on search page | ❌ untested |
| 56 | `/api/explore` | GET | Explore page loads with source discovery | ⚠️ partial |
| 57 | `/api/discover` | GET | Discover page loads with content recommendations | ❌ untested |
| 58 | `/api/review` | GET, POST | Review page loads / mark card as reviewed | ❌ untested |
| 59 | `/api/export` | GET | Click export button on search page | ❌ untested |
| 60 | `/api/sync` | GET, POST | View sync status / trigger IMA sync | ❌ untested |
| 61 | `/api/sync-records` | GET | Sync records page loads with filters | ❌ untested |
| 62 | `/api/proxy/image` | GET | Image proxy for external article images (auto-triggered) | ❌ untested |
| 63 | `/api/health` | GET | Health check endpoint (infrastructure) | ✅ tested |

---

## Summary

### Page Routes Coverage

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total page routes** | 28 | 100% |
| ✅ Tested | 1 | 4% |
| ⚠️ Partial | 10 | 36% |
| ❌ Untested | 17 | 61% |

### Shared Components Coverage

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total shared components** | 23 | 100% |
| ✅ Tested | 6 | 26% |
| ⚠️ Partial | 3 | 13% |
| ❌ Untested | 14 | 61% |

### API Routes Coverage

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total API endpoints** | 65 | 100% |
| ✅ Tested | 6 | 9% |
| ⚠️ Partial | 14 | 22% |
| ❌ Untested | 45 | 69% |

### Overall

| Metric | Count | Percentage |
|--------|-------|------------|
| **Total interactive elements** | 116 | 100% |
| ✅ Tested | 13 | 11% |
| ⚠️ Partial | 27 | 23% |
| ❌ Untested | 76 | 66% |

### Priority Recommendations

1. **High priority** -- Core user flows with zero coverage:
   - `/cards` and `/cards/[id]` -- Material card creation, editing, and deletion
   - `/review` -- Review workflow (mark as reviewed)
   - `/register` -- User registration flow
   - `/settings/account` -- Password change
   - `/admin/backup` -- Backup export and import
   - `/admin/clean` -- Data cleanup execution

2. **Medium priority** -- Partially tested flows that need completion:
   - `/articles` and `/articles/[id]` -- Complete article detail interactions (annotations, image preview)
   - `/admin/sources` -- Full CRUD cycle including channel management and import
   - `/admin/integrations/we-mp-rss` -- Complete sync preview and execution flow
   - `/admin/users` -- Complete user management cycle

3. **Low priority** -- Read-only pages and infrastructure:
   - `/settings` -- Navigation links only
   - `/api/health` -- Infrastructure endpoint
   - `/api/proxy/image` -- Auto-triggered, no direct user action
