# Church API

## Setup

```bash
bun install
cp .env.example .env  # Edit with your values
bun run db:push
bun run dev
```

## Create First Admin

```bash
curl -X POST http://localhost:8000/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

## Health Checks

- Liveness: `GET /health`
- Readiness: `GET /health/ready`

## Commands

```bash
bun run dev          # Development
bun run db:push      # Apply schema
bun run db:studio    # Visual DB editor
```
