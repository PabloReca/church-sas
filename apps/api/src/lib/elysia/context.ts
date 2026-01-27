import Elysia from 'elysia'
import { cookie } from '@elysiajs/cookie'
import { getDb } from '@/db/connection'
import { verifyJWT, type UserPayload } from '@/lib/auth/jwt'

/**
 * Context plugin that provides database and user to all routes
 *
 * Usage in routes:
 * ```ts
 * export const myRoutes = new Elysia()
 *   .use(contextPlugin)
 *   .get('/', ({ db, user }) => { ... })
 * ```
 */
export const contextPlugin = new Elysia({ name: 'context' })
  .use(cookie())
  .derive({ as: 'global' }, async ({ cookie }) => {
    const db = getDb()

    let user: UserPayload | null = null

    const token = cookie.auth_token?.value

    if (typeof token === 'string' && token.length > 0) {
      try {
        user = await verifyJWT(token)
      } catch {
        // Invalid token - user stays null
      }
    }

    return {
      db,
      user,
    }
  })
