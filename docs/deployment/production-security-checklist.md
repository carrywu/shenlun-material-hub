# Production Security Checklist

Date: 2026-06-10

- [x] Real credentials are not committed; `.env.production` is ignored.
- [x] `.env.production.example` contains placeholders only.
- [x] PostgreSQL is not exposed to the public host network.
- [x] App port `3000` is not exposed to the public host network.
- [x] Public traffic enters through Caddy on `80/443`.
- [x] Production default admin password is blocked by `ADMIN_PASSWORD_HASH` validation.
- [x] Auth cookie includes `HttpOnly`, production `Secure`, `SameSite=Strict`, and max-age.
- [x] Login route has basic brute-force protection.
- [x] `/api/health` exposes only minimal status.
- [x] Backup files are ignored by git and written under `backups/`.
- [x] WeWe RSS remains external/sidecar; this app does not write its database.

## Manual Production Actions

- Rotate any API keys that were shared outside the server environment.
- Restrict Alibaba Cloud security group port `22` to your own IP.
- Keep ports `3000` and `5432` closed in the security group.
- Replace `CADDY_SITE_ADDRESS=:80` with a备案域名 after DNS and ICP filing are ready.
