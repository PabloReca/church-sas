# Church API

REST API for church management.

## Features

- **Multi-Tenant Architecture** - Isolated data per church/organization
- **Google OAuth2 Authentication** - Seamless login with Google accounts
- **Role-Based Access Control** - Owner, admin, member roles with tenant isolation
- **Dynamic Custom Fields** - Tenants define custom fields for people data
- **File Storage** - Upload and manage files with S3-compatible storage
- **Health Monitoring** - Liveness and readiness probes for load balancers
- **Type-Safe APIs** - All endpoints are fully typed and auto-documented

## Technology Stack

- **Hono** - Ultra-fast web framework for edge computing
- **oRPC** - Type-safe RPC with auto-generated OpenAPI documentation
- **Drizzle ORM** - Type-safe database queries with schema migrations
- **PostgreSQL** - Primary database
- **JWT (jose)** - Session tokens stored in httpOnly cookies
- **Bun** - JavaScript runtime (bundler, test runner, package manager)
- **TypeScript** - Type safety throughout

## Commands

```bash
# Development
bun run dev              # Start with hot reload on localhost:8000

# Database
bun run db:generate      # Generate migrations from schema changes
bun run db:migrate       # Apply pending migrations
bun run db:push          # Generate + apply migrations in one step
bun run db:studio        # Open Drizzle Studio visual editor

# Build & Code Quality
bun run build            # Bundle to Bun executable
bun run build:types      # Generate TypeScript type definitions
bun run lint             # Check code with ESLint

# Database Setup
bun run seed             # Seed initial data (encryption keys, plans, admin user)
```

## API Documentation

Interactive API explorer at:
```
http://localhost:8000/api/reference
```
