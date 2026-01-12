FROM oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S bunuser && \
    adduser -S bunuser -u 1001

COPY --from=deps --chown=bunuser:bunuser /app/node_modules ./node_modules
COPY --chown=bunuser:bunuser package.json ./
COPY --chown=bunuser:bunuser tsconfig.json ./
COPY --chown=bunuser:bunuser src ./src
COPY --chown=bunuser:bunuser drizzle ./drizzle
COPY --chown=bunuser:bunuser drizzle.config.ts ./

USER bunuser

EXPOSE 8000

CMD ["bun", "run", "src/index.ts"]
