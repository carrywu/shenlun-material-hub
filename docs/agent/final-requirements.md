# Final Requirements

## Core Flow

```text
采集文章
-> AI 评估
-> 管理员审核
-> 用户学习文章
-> VERIFIED_USER 生成私有素材卡
-> 复习
-> 同步个人 IMA
```

## Roles

### USER

Allowed:

- Register and login.
- View accessible approved articles.
- Read articles.
- Favorite articles.
- Review own favorited articles.

Forbidden:

- Cannot create material cards.
- Cannot generate material cards.
- Cannot configure personal AI.
- Cannot configure IMA.
- Cannot sync to IMA.
- Cannot access admin.

### VERIFIED_USER

Allowed:

- All USER capabilities.
- Configure own AI key.
- Create or generate own material cards.
- Review own material cards.
- Configure own IMA target.
- Sync own visible articles and own material cards to own IMA.

Forbidden:

- Cannot access admin.
- Cannot read other users' private material cards.
- Cannot sync other users' material cards.
- Cannot read other users' SyncRecords.

### ADMIN

Allowed:

- Access admin.
- Manage users, articles, sources, RSS, logs, tasks, configs.
- View global data for management.
- Review, approve, reject, downlist, and restore articles.
- Manage user private assets.

Restrictions:

- Cannot disable, downgrade, or delete the last ADMIN.
- Must configure own IMA target when using IMA.
- Can only sync own material cards to own IMA.
- Cannot use env fallback IMA config.

## API Articles

`/api/articles` must require login.

## Material Cards

- Material cards are private user assets.
- USER cannot create or generate material cards.
- Only VERIFIED_USER and ADMIN can create or generate own material cards.
- Non-owner access returns 404 except where ADMIN management access is explicitly required.
- Archived cards are excluded from default list, search, review, and IMA sync.

## AI / IMA

- Personal AI and IMA must not fallback to env or global config.
- USER has no AI or IMA entry.
- VERIFIED_USER and ADMIN must use own credentials.
- Sync scope is own visible articles plus own material cards.
- ADMIN can only sync own material cards to own IMA.

## reject / downlist

Keep both states:

- `reject`: review rejected, never entered public learning library.
- `downlist`: previously approved article removed by admin.

For both states:

- Only ADMIN can access.
- USER and VERIFIED_USER cannot access.
- Excluded from list, search, review, and IMA sync.
- New card generation is forbidden.
- Related private material cards are retained but hidden from non-admin users.
- Related cards are excluded from normal list, search, review, and IMA sync.

When restoring `downlist` to `approved`:

- Non-archived private material cards become visible again.
- Archived cards remain archived.
- Review state, sync records, and tags are preserved.

## Article Review State

Keep `ArticleReviewState` or an equivalent user-owned model for favorited article review state.

## Requirement Conflicts

If an older document says downlisted articles remain readable to favoriting users, treat that as a `Requirement Conflict`. The current requirement is stricter: after `reject` or `downlist`, non-admin users cannot access the article.
