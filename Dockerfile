# node:26-alpine del 2026-11-11. Para actualizarla, el digest nuevo y su fecha en el mismo PR.
FROM node:26-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS base
RUN apk upgrade --no-cache && apk add --no-cache libc6-compat

# python3, make y g++: npm invoca node-gyp al instalar better-sqlite3 aunque traiga binarios. Solo aquí.
FROM base AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Sin npm ni npx: la imagen no los usa y sus dependencias internas son las que acaban saliendo en Trivy.
RUN addgroup -S -g 1001 paneles \
 && adduser -S -u 1001 -G paneles -H paneles \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
 && mkdir /datos \
 && chown 1001:1001 /datos

# El código es de root: el proceso, como 1001, solo puede escribir en /datos y /tmp.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN node -e "new (require('better-sqlite3'))(':memory:').close()"

USER 1001:1001
VOLUME /datos
EXPOSE 3000

# Forma exec: en forma shell las comillas pasarían por /bin/sh antes de llegar a node.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
