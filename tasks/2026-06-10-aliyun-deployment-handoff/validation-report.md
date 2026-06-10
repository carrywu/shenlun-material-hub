# Validation Report

Date: 2026-06-10

| Command | Result | Notes |
|---|---|---|
| `pnpm lint` | Passed | Exit 0; existing warnings only |
| `pnpm test` | Passed | 46 files, 297 tests |
| `pnpm build` | Passed | Next.js 16 production build generated 81 routes |
| `pnpm test src/app/api/health/__tests__/route.test.ts` | Passed | 2 health-check tests |
| `bash -n scripts/deploy/*.sh` | Passed | Deployment/backup/restore/log scripts parsed successfully |
| `docker compose -f docker-compose.prod.yml --env-file .env.production config --quiet` | Passed | Production compose config validated |
| `docker compose -f docker-compose.prod.yml --env-file .env.production build app` | Passed | Clean Docker build completed with Aliyun apt mirror, npmmirror pnpm registry, Prisma mirror, Next standalone output |
| ECS old deployment inspection/cleanup | Passed | Removed old `shenlun` compose containers/network; preserved old `shenlun_pgdata` volume |
| `curl -f http://47.119.182.210/api/health` | Pending | Run after ECS deployment |

## Manual Configuration Still Required

- Real `.env.production` must exist only on the ECS server.
- IMA sync requires a future `IMA_KNOWLEDGE_BASE_ID`.
- WeWe RSS requires a separately deployed sidecar and `WEWERSS_BASE_URL`.
