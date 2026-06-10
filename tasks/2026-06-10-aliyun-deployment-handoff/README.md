# Aliyun Deployment Handoff

This handoff tracks the ECS deployment work for `shenlun-material-hub`.

- Target server: `47.119.182.210`
- Initial access mode: HTTP by IP
- Runtime: Docker Compose, PostgreSQL 16, Next.js standalone, Caddy
- China network: apt, Docker and npm/pnpm mirrors enabled by deployment assets

The initial admin password is generated on the server during deployment and stored in a root-only handoff file. Do not commit it.
