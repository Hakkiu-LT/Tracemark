# Customer app (TanStack Start, built for the Cloudflare Workers runtime).
#
# We DON'T deploy to Cloudflare here — we self-host on the server by running the
# built worker under Cloudflare's own `workerd` runtime via `wrangler dev --local`.
# A local test confirmed this serves full SSR HTML (HTTP 200) from the built output.
#
# Build context is the repo ROOT (see docker-compose: context: .), so COPY paths
# are relative to the repo root.
#
# VITE_* vars are inlined at BUILD time (they end up baked into the JS bundle), so
# they MUST be passed as build args — docker-compose provides them from the root .env.
# glibc base (NOT alpine): the workerd binary shipped with wrangler needs glibc.

# ── Stage 1: build the worker bundle ───────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-fund

COPY . .

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_HCAPTCHA_SITE_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_HCAPTCHA_SITE_KEY=$VITE_HCAPTCHA_SITE_KEY

# Produces dist/client (static assets) + dist/server (the workerd worker + wrangler.json).
RUN npm run build

# ── Stage 2: runtime — serve the built worker under workerd ─────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    WRANGLER_SEND_METRICS=false \
    CI=1

# Non-root user created before COPY so --chown can be used instantly without a slow recursive chown layer
RUN useradd --create-home --shell /usr/sbin/nologin appuser

# The built worker + its assets, plus node_modules (wrangler + the workerd binary live here).
COPY --chown=appuser:appuser --from=build /app/dist ./dist
COPY --chown=appuser:appuser --from=build /app/node_modules ./node_modules
COPY --chown=appuser:appuser --from=build /app/package.json ./package.json

USER appuser

# wrangler reads dist/server/wrangler.json (main: index.js, assets: ../client).
WORKDIR /app/dist/server

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:8080/',r=>process.exit(r.statusCode<400?0:1)).on('error',()=>process.exit(1))"

# npx resolves wrangler from /app/node_modules/.bin (npm walks up from this cwd).
# --local runs the real workerd runtime offline (no Cloudflare login/network needed).
# --log-level warn: the HEALTHCHECK above hits / every 30s and wrangler logs every
# request at info ("[wrangler:info] GET / 200 OK"), which is pure noise here —
# Caddy already keeps the real access log in front of this container.
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8080", "--local", "--log-level", "warn"]
