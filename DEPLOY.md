# Production Deploy

## 1. Prepare environment

1. Copy `.env.example` to `.env`.
2. Set these values before any production start:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `JWT_SECRET`
   - `AI_CONFIG_ENCRYPTION_KEY`
3. Generate a password hash for the admin password. The current app expects a SHA-256 hex string:

```bash
printf '%s' 'your-admin-password' | shasum -a 256
```

4. Generate a JWT secret:

```bash
openssl rand -base64 32
```

## 2. Persistent data

The app keeps local state in:

- `prisma/dev.db`
- `public/uploads`

`docker-compose.yml` maps these to:

- `./data/prisma`
- `./data/uploads`

Create them before first boot:

```bash
mkdir -p data/prisma data/uploads
```

## 3. Build and run

```bash
docker compose build app
docker compose up -d app
```

Open `http://<server-ip>:3000/admin/login` after startup.

## 4. Optional WeWe RSS sidecar

If you need local WeWe RSS in the same host:

```bash
docker compose --profile wewe-rss up -d wewe-rss
```

Then set `WEWERSS_BASE_URL` in `.env`, for example:

```env
WEWERSS_BASE_URL="http://wewe-rss:4000"
```

This project must continue to treat WeWe RSS as a sidecar. Do not embed or write its database.

## 5. Verification

Run these checks before promotion:

```bash
pnpm lint
pnpm test
pnpm build
```

After deployment:

1. Visit `/admin/login` and verify login works with configured credentials.
2. Visit `/admin` and confirm dashboard metrics load.
3. Trigger one website collect, one WeWe RSS sync, one AI assess, and one card generation request.
4. Confirm `AsyncTask` rows and `SystemLog` rows are written.

## 6. Known limitations

- Prisma migration history and the local `prisma/dev.db` currently have drift in this workspace. If you need to rebuild the local dev database from migrations, Prisma will require a reset.
- Next.js still warns that `middleware.ts` should migrate to `proxy.ts`.
- The WeWe RSS SQLite fallback still causes Turbopack NFT tracing warnings during build, even though the build completes successfully.
