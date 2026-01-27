# Church SaaS

Multi-tenant church management platform.

## Stack

- **Runtime:** Node.js + pnpm
- **API:** Elysia
- **Web:** SvelteKit
- **Database:** PostgreSQL (Drizzle ORM)
- **Observability:** OpenTelemetry + Grafana (Alloy + Loki + Tempo)
- **Storage:** MinIO

## Structure

```
apps/
├── api/    # Elysia backend
└── web/    # SvelteKit frontend
```

## Dev

```bash
pnpm install
pnpm dev          # Start all
pnpm dev -F api   # API only (:8000)
pnpm dev -F web   # Web only (:5173)
```

## Observability

Services running on Docker:
- **Grafana:** http://localhost:3001
- **Alloy:** http://localhost:12345
- **PostgreSQL:** localhost:5432
- **MinIO:** http://localhost:9000

Auto-instrumentation enabled via OpenTelemetry SDK - traces and metrics sent automatically to Tempo/Loki.
