# Aliyun Deployment Audit

Date: 2026-06-10

## Current Application Shape

- App: Next.js 16 with React 19, built with `pnpm build` and started by `pnpm start`.
- Production build: `next.config.ts` already enables `output: "standalone"`.
- Database: PostgreSQL via Prisma 7 and `@prisma/adapter-pg`; schema datasource is PostgreSQL.
- Prisma Client: generated into `src/generated/prisma`, which is ignored locally and must be generated during Docker build.
- Runtime port: app listens on `3000`; production public traffic should enter through Caddy on `80/443`.
- Migrations: `pnpm db:migrate` maps to `prisma migrate deploy`.
- Health endpoint: `/api/health` checks database with `SELECT 1`.

## Runtime Dependencies

- Persistent directories:
  - PostgreSQL volume: `pgdata`.
  - Uploads/backup UI files: `./data/uploads` mounted to `/app/public/uploads`.
  - Operational backups: `./backups`.
- Background work: async tasks are stored in PostgreSQL; no separate worker service is required by current scripts.
- Long requests: collectors, AI generation, backup import/export and sync may run longer than normal API calls; reverse proxy timeout is set to 300 seconds.
- WeWe RSS: sidecar/external service only; it is not embedded in this compose stack.
- MediaCrawler: optional external service; disabled by default.

## Security Findings

- Login has in-memory brute-force protection: 5 failures then 15-minute lockout per forwarded IP.
- Auth cookie is `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- Production admin creation refuses default credentials unless a bcrypt `ADMIN_PASSWORD_HASH` is set.
- Existing production compose exposed PostgreSQL `5432` and app `3000` to the host; fixed by routing public traffic only through Caddy.
- `.env.production` is ignored by `.gitignore`; `.env.production.example` is explicitly allowed.

## Recommended Topology

Use one ECS host with Docker Compose:

- `caddy`: public `80/443`.
- `app`: private app service on internal Docker network.
- `postgres`: private PostgreSQL 16 service on internal Docker network.
- Volumes/directories for database, uploads, Caddy cert state, and backups.
