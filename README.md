# Church SaaS

Multi-tenant church management platform.

## Stack

- **Runtime:** Bun
- **API:** Hono + tRPC + Better Auth
- **Web:** Svelte 5 + Vite
- **Database:** PostgreSQL (Drizzle ORM)
- **Deploy:** Vercel (configured by Pulumi)

## Structure
```
apps/
├── api/          # Hono backend
└── web/          # Svelte frontend
infrastructure/   # Pulumi IaC
```

## Dev
```bash
bun install
bun dev          # Start api + web
bun dev:api      # API only (:8000)
bun dev:web      # Web only (:5173)
```

## Setup projects on vercel
```bash
cd infrastructure
pulumi up
```

## Deploy source
- Preprod → on `main` branch
- Production → on `release`