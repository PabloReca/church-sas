// IMPORTANT: OpenTelemetry MUST be imported first, before anything else
import '@/lib/otel-init'

import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { opentelemetry } from '@elysiajs/opentelemetry'
import { config } from '@/config'
import { contextPlugin } from '@/lib/elysia/context'
import { logger } from '@/lib/infra/logger'
import { handleHttpError } from '@/lib/http-errors'

// Base routes
import { authRoutes } from '@/routes/auth'
import { uploadRoutes } from '@/routes/upload'
import { healthRoutes } from '@/routes/health'

// Platform routes
import { adminRoutes } from '@/routes/platform/admin'
import { plansRoutes } from '@/routes/platform/plans'

// Tenants routes
import { tenantsRoutes } from '@/routes/tenants'
import { tenantUsersRoutes } from '@/routes/tenants/users'

// People routes
import { peopleRoutes } from '@/routes/people'
import { peopleTenantsRoutes } from '@/routes/people/tenants'
import { peopleFieldsRoutes } from '@/routes/people/fields'

// Teams routes
import { teamsRoutes } from '@/routes/teams'
import { teamMembersRoutes } from '@/routes/teams/members'
import { teamSkillsRoutes } from '@/routes/teams/skills'
import { teamSkillIncompatibilityRoutes } from '@/routes/teams/skill-incompatibility'

// Events routes
import { eventsRoutes } from '@/routes/events'
import { eventSlotsRoutes } from '@/routes/events/slots'
import { eventAssignmentsRoutes } from '@/routes/events/assignments'
import { eventTemplatesRoutes } from '@/routes/events/templates'

// Allowed origins for CORS
export const allowedOrigins = [
  'http://localhost:3000',
  config.frontend.url,
].filter(Boolean)

export const app = new Elysia()
  // OpenTelemetry auto-instrumentation (only if configured)
  .use(
    config.otel.endpoint
      ? opentelemetry({
          serviceName: config.otel.serviceName,
        })
      : new Elysia()
  )
  // CORS
  .use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  )
  // Swagger/OpenAPI docs
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Church API',
          version: '2.0.0',
          description: 'API for Church SaaS application',
        },
        tags: [
          { name: 'General', description: 'General API information endpoints' },
          { name: 'Auth', description: 'Authentication and session management endpoints' },
          { name: 'Upload', description: 'File upload endpoints' },
          { name: 'Health', description: 'Health check and readiness endpoints' },
          { name: 'Admin', description: 'Global administrator management endpoints' },
          { name: 'Tenants', description: 'Organization/tenant management endpoints' },
          { name: 'Plans', description: 'Subscription plan management endpoints' },
          {
            name: 'Access Management',
            description: 'Manage user roles, helpers, and active seats',
          },
          { name: 'People', description: 'People (members and helpers) management endpoints' },
          { name: 'Person Fields', description: 'Custom fields for people data' },
          { name: 'Teams', description: 'Team management endpoints' },
          { name: 'Team Members', description: 'Team member management' },
          { name: 'Team Skills', description: 'Team skills and incompatibility rules' },
          { name: 'Events', description: 'Event scheduling and management' },
          { name: 'Event Templates', description: 'Reusable event templates' },
          { name: 'Event Slots', description: 'Event slot management (team/skill requirements)' },
          {
            name: 'Event Assignments',
            description: 'Assign people to event slots',
          },
        ],
      },
    })
  )
  // Context plugin (db + user)
  .use(contextPlugin)
  // HTTP Request Logging
  .onRequest(({ request }) => {
    const start = Date.now()
    request.headers.set('x-request-start', start.toString())
  })
  .onAfterResponse(({ request, set }) => {
    const start = parseInt(request.headers.get('x-request-start') || '0')
    const duration = Date.now() - start
    const method = request.method
    const path = new URL(request.url).pathname
    const status = set.status || 200

    logger.info(
      {
        method,
        path,
        status,
        duration,
      },
      'HTTP Request'
    )
  })
  // CSRF protection middleware
  .onBeforeHandle(({ request, set }) => {
    const method = request.method
    const path = new URL(request.url).pathname

    // Skip safe methods and health checks
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return
    }

    // Skip auth callback (comes from Google redirect)
    if (path.startsWith('/auth/')) {
      return
    }

    // Skip RPC calls - they handle their own authentication
    if (path.startsWith('/rpc/')) {
      return
    }

    const origin = request.headers.get('origin')

    // Require valid origin for mutations
    if (!origin || !allowedOrigins.includes(origin)) {
      set.status = 403
      return { error: 'Forbidden' }
    }
  })
  // Error handling
  .onError(({ error, code, set }) => {
    logger.error({ err: error, code }, 'Request error')
    return handleHttpError({ error, code, set })
  })
  // Root endpoint
  .get('/', () => ({
    name: 'Church API',
    version: '2.0.0',
  }), {
    detail: {
      tags: ['General'],
      summary: 'API root endpoint'
    }
  })
  // Favicon (avoid 404 errors)
  .get('/favicon.ico', ({ set }) => {
    set.status = 204
    return
  })
  // Routes
  .use(healthRoutes)
  .use(authRoutes)
  .use(uploadRoutes)
  // RPC routes - Core
  .use(adminRoutes)
  .use(plansRoutes)
  .use(tenantsRoutes)
  .use(tenantUsersRoutes)
  // RPC routes - People
  .use(peopleRoutes)
  .use(peopleTenantsRoutes)
  .use(peopleFieldsRoutes)
  // RPC routes - Teams
  .use(teamsRoutes)
  .use(teamMembersRoutes)
  .use(teamSkillsRoutes)
  .use(teamSkillIncompatibilityRoutes)
  // RPC routes - Events
  .use(eventsRoutes)
  .use(eventSlotsRoutes)
  .use(eventAssignmentsRoutes)
  .use(eventTemplatesRoutes)

export type App = typeof app
