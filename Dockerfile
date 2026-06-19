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
# Prisma client 在构建时生成（output: src/generated/prisma，被 .gitignore 忽略，
# git pull 不会带它）。staging 是 x86_64 原生，generate 安全。
# 注意：--builder local（Apple Silicon QEMU 跨架构）下 prisma generate 可能 segfault，
# 该 fallback 场景请先在 Mac 本地 `pnpm db:generate` 预生成 src/generated/prisma 再构建。
RUN pnpm db:generate
RUN pnpm build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated

RUN mkdir -p /app/prisma /app/public/uploads /home/nextjs && \
    chown -R nextjs:nodejs /app /home/nextjs && \
    chown nextjs:nodejs /home/nextjs

USER nextjs
ENV HOME=/home/nextjs
EXPOSE 3000

CMD ["node", "server.js"]
