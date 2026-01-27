import Elysia from 'elysia'
import { isAdmin } from '@/lib/auth/helpers'
import { contextPlugin } from './context'
import { findPersonInTenant, findHelperInTenant, isTenantManager } from '@/db/queries'
import type { UserPayload } from '@/lib/auth/jwt'
import type { Database } from '@/db/connection'
import { badRequest, forbidden, unauthorized } from '@/lib/http-errors'

type TenantIdContext = {
  params?: Record<string, string | undefined>
  body?: unknown
  query?: Record<string, string>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isValidUuid = (value: string): boolean => UUID_REGEX.test(value)

const getTenantId = (context: TenantIdContext): string | null => {
  // Try params first
  if (context.params?.tenantId && isValidUuid(context.params.tenantId)) {
    return context.params.tenantId
  }

  // Try body (if it's an object with tenantId)
  if (context.body && typeof context.body === 'object' && 'tenantId' in context.body) {
    const rawTenantId = (context.body as { tenantId: unknown }).tenantId
    if (typeof rawTenantId === 'string' && isValidUuid(rawTenantId)) {
      return rawTenantId
    }
  }

  // Try query
  if (context.query?.tenantId && isValidUuid(context.query.tenantId)) {
    return context.query.tenantId
  }

  return null
}

/**
 * Guard that requires authenticated user
 * Usage: .use(authGuard)
 * After using this guard, user is guaranteed to be non-null
 */
export const authGuard = new Elysia({ name: 'auth-guard' })
  .use(contextPlugin)
  .derive({ as: 'global' }, ({ user }) => {
    if (!user) {
      throw unauthorized()
    }
    return { user }
  })

/**
 * Guard that requires admin user
 * Usage: .use(adminGuard)
 */
export const adminGuard = new Elysia({ name: 'admin-guard' })
  .use(contextPlugin)
  .onBeforeHandle({ as: 'scoped' }, ({ user }) => {
    if (!user) {
      throw unauthorized()
    }

    if (!isAdmin(user)) {
      throw forbidden('Admin access required')
    }
  })

/**
 * Helper to check tenant access - call this in tenant procedures
 * Admins can access any tenant, otherwise user must be member or helper
 */
export async function requireTenantUser(
  db: Database,
  user: UserPayload,
  tenantId: string
): Promise<void> {
  if (isAdmin(user)) {
    return
  }

  const personId = user.userId

  // Check if it's their primary tenant
  const person = await findPersonInTenant(db, personId, tenantId)
  if (person) {
    return
  }

  // Check if they're a helper in this tenant
  const helper = await findHelperInTenant(db, personId, tenantId)
  if (!helper) {
    throw forbidden('Access denied to this tenant')
  }
}

/**
 * Helper to check tenant manager access (owner OR admin)
 */
export async function requireTenantManager(
  db: Database,
  user: UserPayload,
  tenantId: string
): Promise<void> {
  if (isAdmin(user)) {
    return
  }

  const isManager = await isTenantManager(db, user.userId, tenantId)
  if (!isManager) {
    throw forbidden('Only tenant owner or admin can perform this action')
  }
}

/**
 * Guard that requires tenant user access
 * Extracts tenantId from params.tenantId, body.tenantId, or query.tenantId (in that order)
 * Usage: .use(tenantUserGuard)
 */
export const tenantUserGuard = new Elysia({ name: 'tenant-user-guard' })
  .use(contextPlugin)
  .onBeforeHandle({ as: 'scoped' }, async (context) => {
    const { user, db } = context

    if (!user) {
      throw unauthorized()
    }

    const tenantId = getTenantId(context)

    if (!tenantId) {
      throw badRequest('tenantId is required')
    }

    await requireTenantUser(db, user, tenantId)
  })

/**
 * Guard that requires tenant manager access (owner/admin)
 * Extracts tenantId from params.tenantId, body.tenantId, or query.tenantId (in that order)
 * Usage: .use(tenantManagerGuard)
 */
export const tenantManagerGuard = new Elysia({ name: 'tenant-manager-guard' })
  .use(contextPlugin)
  .onBeforeHandle({ as: 'scoped' }, async (context) => {
    const { user, db } = context

    if (!user) {
      throw unauthorized()
    }

    const tenantId = getTenantId(context)

    if (!tenantId) {
      throw badRequest('tenantId is required')
    }

    await requireTenantManager(db, user, tenantId)
  })
