# RBAC Architecture

Audit date: 2026-06-05

## Data Model

Current `prisma/schema.prisma` defines the RBAC and ownership model:

- `User`
  - `username` unique login identity.
  - `passwordHash` stores bcrypt-compatible hashes.
  - `role`: `ADMIN`, `VERIFIED_USER`, `USER`.
  - `status`: `ACTIVE`, `DISABLED`.
  - Relations to sessions, owned content, owned cards, async tasks, sync records, annotations.
- `Session`
  - DB-backed `auth_token` session token.
  - `expiresAt` controls session expiry.
  - Cascade delete from user.
- Ownership fields:
  - `ContentItem.ownerUserId`, `ContentItem.visibility`.
  - `MaterialCard.ownerUserId`.
  - `ArticleAnnotation.userId`.
  - `AsyncTask.userId`.
  - `SyncRecord.userId`.
- Global/admin-only configuration:
  - `AiConfig` has no owner field and is treated as admin-controlled global state.
  - `AiPromptTemplate` has no owner field and is treated as admin-controlled global state.

## Server Auth Flow

Core file: `src/lib/auth.ts`.

- Password verification supports bcrypt and a legacy SHA-256 fallback.
- `createSession(userId)` creates a DB session with a high-entropy token.
- `validateSession(token)` resolves an active session and rejects expired or disabled users.
- `getUserFromRequest(request)` reads `auth_token` and supports legacy JWT compatibility.
- `requireAuth(request)` returns any active authenticated user.
- `requireAdmin(request)` returns only `ADMIN`.
- `requireVerifiedUser(request)` returns `ADMIN` or `VERIFIED_USER`.
- `unauthorizedResponse()` returns 401.
- `forbiddenResponse()` returns 403.

## Client Auth Flow

Core files:

- `src/app/layout.tsx`
- `src/lib/auth-context.tsx`
- `src/components/admin/AdminShell.tsx`

`RootLayout` reads the `auth_token` cookie server-side and provides `AuthProvider` to client components. `useAuth()` exposes:

- `user`
- `isAdmin`
- `isVerifiedUser`
- `isAuthenticated`

`AdminShell` checks `/api/auth/check` client-side and redirects to `/admin/login` when the session check fails. Server-side route guards remain the security boundary.

## Proxy / Middleware Policy

Core file: `src/proxy.ts`.

- Public paths:
  - `/admin/login`
  - `/api/auth/login`
  - `/api/auth/check`
  - `/api/auth/logout`
- Protected API prefixes in proxy:
  - `/api/admin`
  - `/api/collectors`
  - `/api/ai-config`
  - `/api/integrations`
  - selected AI task APIs under `/api/content-items`
  - non-GET `/api/sources`
- All page routes redirect to `/admin/login` when unauthenticated.

Important: proxy protection is incomplete as an authorization model. Each API route still needs explicit route-level auth and owner checks.

## Data Isolation Helpers

Core file: `src/lib/data-isolation.ts`.

- `contentVisibilityWhere(user)`
  - Admin sees all.
  - Non-admin sees public content, own content, and `ownerUserId=null` legacy content.
- `ownerScopeWhere(user, fieldName = "ownerUserId")`
  - Admin sees all.
  - Non-admin sees own rows and null-owner legacy rows.
- `canAccessResource(user, ownerId, visibility?)`
  - Admin sees all.
  - Owner sees own.
  - Null-owner rows are accessible.
  - `visibility="public"` is accessible.
- `canModifyResource(user, ownerId)`
  - Admin can modify all.
  - Only owner can modify own rows.
  - Null-owner rows are not modifiable by non-admin.

## Architecture Gaps

- Migration drift: schema contains RBAC tables and owner columns, but migration SQL does not contain `User`, `Session`, or ownership field DDL.
- Legacy null-owner access is not settled for multi-user production. It may be compatibility behavior, but it is a data exposure risk if private historical data exists.
- Some routes merge Prisma `OR` filters by object spread, which can overwrite either search filters or isolation filters.
- Annotation routes do not consistently bind operations to `ArticleAnnotation.userId` or `ContentItem.ownerUserId`.
- Route-local tests mock guards but do not provide enough real A/B user isolation coverage.
