import type { UserPayload } from './jwt'
import { ORPCError } from '@/rpc/orpc'

export function isAdmin(user: UserPayload): boolean {
  return user.isAdmin
}

export function isTenantAdmin(user: UserPayload, tenantId?: number): boolean {
  if (tenantId !== undefined) {
    return user.isTenantAdmin && user.tenantId === tenantId
  }
  return user.isTenantAdmin
}

export function canAccessPerson(user: UserPayload, personId: number): boolean {
  return user.userId === personId || user.isAdmin
}

export function canAccessTenant(user: UserPayload, tenantId: number): boolean {
  return user.tenantId === tenantId || user.isAdmin
}

export function requireAdmin(user: UserPayload): void {
  if (!user.isAdmin) {
    throw new ORPCError('FORBIDDEN', { message: 'Admin access required' })
  }
}

export function requireTenantAdmin(user: UserPayload, tenantId?: number): void {
  if (tenantId !== undefined) {
    if (!user.isTenantAdmin || user.tenantId !== tenantId) {
      throw new ORPCError('FORBIDDEN', { message: 'Tenant admin access required' })
    }
  } else {
    if (!user.isTenantAdmin) {
      throw new ORPCError('FORBIDDEN', { message: 'Tenant admin access required' })
    }
  }
}

export function requirePersonAccess(user: UserPayload, personId: number): void {
  if (!canAccessPerson(user, personId)) {
    throw new ORPCError('FORBIDDEN', { message: 'Access denied' })
  }
}

export function requireTenantAccess(user: UserPayload, tenantId: number): void {
  if (!canAccessTenant(user, tenantId)) {
    throw new ORPCError('FORBIDDEN', { message: 'Access denied' })
  }
}

export function requireAdminOrTenantAdmin(user: UserPayload, tenantId?: number): void {
  if (user.isAdmin) return

  if (tenantId !== undefined) {
    if (!user.isTenantAdmin || user.tenantId !== tenantId) {
      throw new ORPCError('FORBIDDEN', { message: 'Admin or tenant admin access required' })
    }
  } else {
    if (!user.isTenantAdmin) {
      throw new ORPCError('FORBIDDEN', { message: 'Admin or tenant admin access required' })
    }
  }
}
