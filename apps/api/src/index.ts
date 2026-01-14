// IMPORTANT: Initialize OpenTelemetry FIRST, before any other imports
// This ensures auto-instrumentation can properly hook into all modules
import { initializeOTel } from '@/lib/otel'
initializeOTel()

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { RPCHandler } from '@orpc/server/fetch'
import { onError } from '@orpc/server'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod'
import { config } from '@/config'
import { appRouter } from '@/rpc/routers'
import { createContext } from '@/rpc/context'
import auth from '@/routes/auth'
import upload from '@/routes/upload'
import health from '@/routes/health'
import { logger } from '@/lib/logger'
import { otelMiddleware } from '@/lib/otel-middleware'

const app = new Hono()

// Allowed origins
const allowedOrigins = ['http://localhost:3000', config.frontend.url].filter(Boolean)

// OpenTelemetry tracing middleware (must be first to trace all requests)
app.use('/*', otelMiddleware)

// CORS
app.use(
  '/*',
  cors({
    origin: (origin) => {
      return allowedOrigins.includes(origin) ? origin : null
    },
    credentials: true,
  })
)

// HTTP Request Logging
app.use('/*', async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path

  await next()

  const duration = Date.now() - start
  const status = c.res.status

  logger.info({
    method,
    path,
    status,
    duration,
  }, 'HTTP Request')
})

// CSRF protection: verify Origin header on mutations
app.use('/*', async (c, next) => {
  const method = c.req.method

  // Skip safe methods and health checks
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next()
  }

  // Skip auth callback (comes from Google redirect, not our frontend)
  if (c.req.path.startsWith('/auth/')) {
    return next()
  }

  // Skip RPC calls - they handle their own authentication/security
  if (c.req.path.startsWith('/rpc/')) {
    return next()
  }

  const origin = c.req.header('origin')

  // Require valid origin for mutations
  if (!origin || !allowedOrigins.includes(origin)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return next()
})

// Root
app.get('/', (c) => {
  return c.json({
    name: 'Church API',
    version: '2.0.0',
  })
})

// Routes
app.route('/health', health)
app.route('/auth', auth)
app.route('/upload', upload)

// ORPC Handler
const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      logger.error({ err: error }, 'ORPC Error')
    })
  ],
})

// Handle ORPC requests
app.all('/rpc/*', async (c, next) => {
  const context = await createContext(c)

  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: '/rpc',
    context,
  })

  if (matched) {
    return c.newResponse(response.body, response)
  }

  await next()
})

// OpenAPI Generator
const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

// OpenAPI JSON spec
app.get('/openapi.json', async (c) => {
  // Derive API URL from request origin
  const origin = c.req.header('origin') || `http://localhost:${config.port}`
  const apiUrl = origin.replace(/:\d+$/, `:${config.port}`)

  const spec = await openAPIGenerator.generate(appRouter, {
    info: {
      title: 'Church API',
      version: '2.0.0',
      description: 'API for Church SaaS application',
    },
    servers: [
      { url: apiUrl, description: 'API Server' },
    ],
    tags: [
      {
        name: 'Admin',
        description: 'Global administrator management endpoints',
      },
      {
        name: 'Tenants',
        description: 'Organization/tenant management endpoints',
      },
      {
        name: 'Plans',
        description: 'Subscription plan management endpoints',
      },
      {
        name: 'Access Management',
        description: 'Manage user roles, helpers, and active seats',
      },
      {
        name: 'People',
        description: 'People (members and helpers) management endpoints',
      },
      {
        name: 'Person Fields',
        description: 'Custom fields for people data',
      },
      {
        name: 'Teams',
        description: 'Team management endpoints',
      },
      {
        name: 'Team Members',
        description: 'Team member management',
      },
      {
        name: 'Team Skills',
        description: 'Team skills and incompatibility rules',
      },
      {
        name: 'Events',
        description: 'Event scheduling and management',
      },
      {
        name: 'Event Templates',
        description: 'Reusable event templates',
      },
      {
        name: 'Event Slots',
        description: 'Event slot management (team/skill requirements)',
      },
      {
        name: 'Event Assignments',
        description: 'Assign people to event slots',
      },
    ],
  })
  return c.json(spec)
})

// Scalar API Reference
app.get('/docs', (c) => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Church API - Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>
`
  return c.html(html)
})

export default {
  port: config.port,
  fetch: app.fetch,
}

export type { AppRouter } from '@/rpc/routers'
