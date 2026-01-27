# Church API

REST API for church management.

## Technology Stack

- **Elysia** - Fast web framework with TypeScript support
- **Drizzle ORM** - Type-safe database queries with schema migrations
- **PostgreSQL** - Primary database
- **JWT (jose)** - Session tokens stored in httpOnly cookies
- **OpenTelemetry** - Auto-instrumentation for traces and metrics
- **Pino** - Structured logging
- **pnpm** - Package manager

## Commands

```bash
# Development
npm run dev                # Start with hot reload on localhost:8000

# Database
npm run db:generate        # Generate migrations from schema changes
npm run db:migrate         # Apply pending migrations
npm run db:push            # Generate + apply migrations in one step
npm run db:studio          # Open Drizzle Studio visual editor

# Build & Code Quality
npm run build              # Type check
npm run lint               # Check code with ESLint
npm run test               # Run tests with Vitest

# Database Setup
npm run seed               # Seed initial data (encryption keys, plans, admin user)
```

## API Documentation

Interactive API explorer at:
```
http://localhost:8000/docs
```

## Observability

### OpenTelemetry Auto-Instrumentation

El API tiene **autoinstrumentación completa** con OpenTelemetry. No necesitas crear spans manualmente - todos los requests HTTP, queries a la base de datos, y llamadas DNS son trazados automáticamente.

**Variables de entorno:**
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces  # Grafana Alloy collector
OTEL_SERVICE_NAME=church-api
OTEL_SERVICE_VERSION=2.0.0
```

**Para habilitar OpenTelemetry:**
1. Asegúrate que las variables de entorno estén configuradas (ver `.env.example`)
2. Inicia el stack de observabilidad: `docker compose up -d alloy tempo loki grafana`
3. El API automáticamente enviará traces al collector

**Instrumentación automática incluye:**
- HTTP requests/responses (método, path, status, duración)
- PostgreSQL queries (con enhanced reporting)
- DNS lookups
- Network connections

**Dashboards:**
- Grafana UI: http://localhost:3001
- Alloy UI: http://localhost:12345
- Tempo direct: http://localhost:3200

**Para desactivar:** Simplemente no configures `OTEL_EXPORTER_OTLP_ENDPOINT`
