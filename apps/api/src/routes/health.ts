import { Hono } from 'hono'
import { getDb } from '@/db/connection'
import { admins, tenantPlans } from '@/db/schema'
import { logger } from '@/lib/logger'

const health = new Hono()

health.get('/', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

health.get('/check', async (c) => {
  try {
    const db = getDb()

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
      return c.json({
        ok: false,
        issues,
      }, 503)
    }

    return c.json({
      ok: true,
      hasAdmin: true,
      hasPlans: true,
    })
  } catch (error) {
    logger.error({ err: error }, 'Health check failed')
    return c.json({
      ok: false,
      issues: ['Database error'],
    }, 503)
  }
})

health.get('/ready', async (c) => {
  try {
    const db = getDb()
    await db.execute('SELECT 1')

    return c.json({
      ready: true,
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' },
    })
  } catch (error) {
    logger.error({ err: error }, 'Readiness check failed')
    return c.json(
      {
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      503
    )
  }
})

export default health
