FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client is pre-generated locally (src/generated/prisma) to avoid segfault
# under QEMU/Rosetta amd64 emulation on Apple Silicon.
# If you need to regenerate, run `npx prisma generate` locally before building.
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# P2-20: ensure pg module is available for Prisma PostgreSQL driver
COPY --from=builder /app/node_modules/pg ./node_modules/pg

RUN mkdir -p /app/prisma /app/public/uploads
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

# Run migrations before starting the server
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
