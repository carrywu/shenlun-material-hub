# Aliyun ECS Deployment Guide

## 1. Aliyun Preparation

- Minimum ECS: 2C2G for personal use.
- Recommended ECS: 2C4G or 4C8G.
- Disk: 40G+ system disk.
- OS: Ubuntu 22.04/24.04 LTS preferred.
- Security group:
  - `22`: only your own IP.
  - `80`: open.
  - `443`: open.
  - `3000`: closed.
  - `5432`: closed.

## 2. Domain and ICP Notes

This deployment initially uses `http://47.119.182.210` because no domain is configured. For HTTPS with Caddy, complete ICP filing when required, point the domain A record to the ECS IP, then set `CADDY_SITE_ADDRESS=your-domain.com` and `NEXT_PUBLIC_APP_URL=https://your-domain.com` in `.env.production`.

## 3. First Deployment

```bash
ssh root@47.119.182.210
bash /opt/shenlun-material-hub/scripts/deploy/aliyun-init.sh
git clone https://github.com/carrywu/shenlun-material-hub.git /opt/shenlun-material-hub
cd /opt/shenlun-material-hub
cp .env.production.example .env.production
nano .env.production
chmod +x scripts/deploy/*.sh
bash scripts/deploy/aliyun-deploy.sh
```

If the directory already exists, inspect and stop the old project containers first:

```bash
cd /opt/shenlun-material-hub
docker compose -f docker-compose.prod.yml down --remove-orphans
```

## 4. Required Environment Values

Set these on the server only:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`
- `AI_CONFIG_ENCRYPTION_KEY`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

IMA sync requires `IMA_KNOWLEDGE_BASE_ID`; leave IMA values blank until the target knowledge base exists. WeWe RSS is external/sidecar and can remain blank until separately deployed.

## 5. Database Initialization

The app container runs `pnpm db:migrate` before `node server.js`. Initial admin creation happens on first login and requires `ADMIN_PASSWORD_HASH`.

Generate a bcrypt hash:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD',12).then(console.log)"
```

## 6. Updates

```bash
cd /opt/shenlun-material-hub
bash scripts/deploy/aliyun-backup-db.sh
git pull --ff-only
bash scripts/deploy/aliyun-deploy.sh
```

## 7. Rollback

```bash
cd /opt/shenlun-material-hub
git log --oneline -5
git checkout <previous-commit>
bash scripts/deploy/aliyun-deploy.sh
```

Restore a database backup only when required:

```bash
bash scripts/deploy/aliyun-restore-db.sh backups/shenlun-material-hub-YYYYMMDD-HHMMSS.dump
```

## 8. Logs

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f postgres
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f caddy
```

## 9. Common Issues

- Cannot access site: check ECS security group and `docker compose ps`.
- Database connection failed: verify `POSTGRES_PASSWORD` matches `DATABASE_URL`.
- Prisma migrate failed: inspect app logs and migration SQL.
- Build failed in China network: confirm Docker daemon mirror and npm registry are configured.
- Caddy HTTPS failed: use `:80` until domain ICP/DNS is ready.
- Cannot log in: confirm `ADMIN_PASSWORD_HASH` is bcrypt and an admin user exists.
- WeWe RSS cannot connect: deploy sidecar separately and set `WEWERSS_BASE_URL`.
- AI failed: verify `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`.
- IMA sync failed: configure `IMA_KNOWLEDGE_BASE_ID` before syncing.
