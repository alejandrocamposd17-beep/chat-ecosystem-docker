# syntax=docker/dockerfile:1
# ===========================================================
# Frontend Next.js 16 (App Router), build standalone
# Requiere output: "standalone" en next.config.ts
# ===========================================================

# -----------------------------------------------------------
# Etapa 1: Dependencias
# Solo se copian los manifiestos, asi esta capa se reutiliza
# mientras package.json y el lockfile no cambien.
# -----------------------------------------------------------
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; \
    elif [ -f yarn.lock ]; then corepack enable && yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
    else echo "Lockfile no encontrado." && exit 1; \
    fi

# -----------------------------------------------------------
# Etapa 2: Builder
# Las variables NEXT_PUBLIC_* se incrustan en el bundle durante
# el build, por eso entran como ARG y no en runtime.
# -----------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN \
    if [ -f yarn.lock ]; then corepack enable && yarn build; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
    else npm run build; \
    fi

# -----------------------------------------------------------
# Etapa 3: Runner (imagen final de produccion)
# Sin node_modules completos, sin codigo fuente, sin devDependencies.
# -----------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios, creado en una sola capa
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Archivos estaticos: propiedad de root, solo lectura para la app
COPY --from=builder /app/public ./public

# Servidor standalone y assets; .next debe ser escribible (cache ISR)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
