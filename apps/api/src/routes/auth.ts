import Elysia, { t } from 'elysia'
import { contextPlugin } from '@/lib/elysia/context'
import { redirect } from '@/lib/auth/oauth-helpers'
import { config } from '@/config'
import * as authController from '@/controllers/auth/index'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.isProduction, // true in production (HTTPS required), false in dev
  sameSite: config.isProduction ? ('none' as const) : ('lax' as const), // none for cross-domain in prod, lax for dev
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
}

export const authRoutes = new Elysia({ prefix: '/auth', tags: ['Auth'] })
  .use(contextPlugin)
  // Google OAuth redirect
  .get('/google', ({ set }) => {
    set.status = 302
    set.headers['Location'] = authController.getGoogleAuthUrl()
    return ''
  })
  // Google OAuth callback
  .get('/google/callback', async ({ query, db, cookie, set }) => {
    const code = query.code
    if (!code) return redirect(set, `${config.frontend.url}/login?error=no_code`)

    const result = await authController.processGoogleCallback(db, code)
    if (result.token) {
      cookie.auth_token!.set({
        value: result.token,
        ...COOKIE_OPTIONS,
      })
    }

    return redirect(set, result.redirectUrl)
  })
  // Get current session
  .get('/session', async ({ cookie }) => {
    return await authController.getSession(cookie.auth_token?.value as string | undefined)
  })
  // Logout
  .post('/logout', ({ cookie }) => {
    cookie.auth_token!.remove()
    return { success: true }
  })
  // Get pending user info
  .get('/pending', async ({ cookie }) => {
    return await authController.getPending(cookie.pending_token?.value as string | undefined)
  })
  // Cancel pending setup
  .post('/pending/cancel', ({ cookie }) => {
    cookie.pending_token!.remove()
    return { success: true }
  })
  // Create tenant (public endpoint)
  .post(
    '/create-tenant',
    async ({ body, db }) => {
      return await authController.createTenantWithOwner(db, body)
    },
    {
      body: t.Object({
        tenantName: t.String({ minLength: 1 }),
        ownerEmail: t.String({ format: 'email' }),
      }),
    }
  )
  // Setup tenant (legacy - from pending token)
  .post(
    '/setup-tenant',
    async ({ cookie, body, db }) => {
      const token = cookie.pending_token?.value as string | undefined

      let pendingUser
      try {
        pendingUser = await authController.requirePendingUser(token)
      } catch (error) {
        cookie.pending_token!.remove()
        throw error
      }

      const result = await authController.setupTenantFromPending(db, body, pendingUser)

      // Clear pending token and set auth token
      cookie.pending_token!.remove()
      cookie.auth_token!.set({
        value: result.authToken,
        ...COOKIE_OPTIONS,
      })

      return {
        success: true,
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
        },
      }
    },
    {
      body: t.Object({
        tenantName: t.String(),
        ownerName: t.String(),
      }),
    }
  )
