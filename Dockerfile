# ==========================================================================
# ExamsKiTayari — multi-stage production Docker image (Next.js standalone).
# The same image runs the web server, the worker, and the scheduler — the
# process is chosen by the container command (see docker-compose.yml).
# ==========================================================================

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# openssl is required by Prisma at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# --- deps ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# --- builder ---
FROM base AS builder
ENV BUILD_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner ---
FROM base AS runner
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema + generated client + full node_modules (needed for workers/tsx).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

RUN mkdir -p /app/storage && chown -R nextjs:nodejs /app/storage
USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Default: web server. Override command for worker/scheduler.
CMD ["node", "server.js"]
