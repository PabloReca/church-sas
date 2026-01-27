import Elysia from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { admins, tenantPlans } from '@/db/schema'
import { logger } from '@/lib/infra/logger'

export const healthRoutes = new Elysia({ prefix: '/health', tags: ['Health'] })
  .use(contextPlugin)
  .get('/', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))
  .get('/check', async ({ db }) => {
    try {
      const [adminsList, plansList] = await Promise.all([
        db.select().from(admins).limit(1),
        db.select().from(tenantPlans).limit(1),
      ])

      const issues: string[] = []

      if (adminsList.length === 0) {
        issues.push('No admin exists. Run: bun run scripts/create-first-admin.ts')
      }
      if (plansList.length === 0) {
        issues.push('No plans exist. Run: bun run scripts/create-plans.ts')
      }

      if (issues.length > 0) {
        return new Response(
          JSON.stringify({ ok: false, issues }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return {
        ok: true,
        hasAdmin: true,
        hasPlans: true,
      }
    } catch (error) {
      logger.error({ err: error }, 'Health check failed')
      return new Response(
        JSON.stringify({ ok: false, issues: ['Database error'] }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
  })
  .get('/ready', async ({ db }) => {
    try {
      await db.execute('SELECT 1')

      return {
        ready: true,
        timestamp: new Date().toISOString(),
        checks: { database: 'ok' },
      }
    } catch (error) {
      logger.error({ err: error }, 'Readiness check failed')
      return new Response(
        JSON.stringify({
          ready: false,
          timestamp: new Date().toISOString(),
          error: 'Database connection failed',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }
  })
