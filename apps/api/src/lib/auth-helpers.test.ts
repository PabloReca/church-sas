import { describe, expect, test } from 'bun:test'
import type { UserPayload } from './jwt'
import {
  isAdmin,
  isTenantAdmin,
  canAccessPerson,
  canAccessTenant,
  requireAdmin,
  requireTenantAdmin,
  requirePersonAccess,
  requireTenantAccess,
  requireAdminOrTenantAdmin,
} from './auth-helpers'
import { ORPCError } from '@/rpc/orpc'

// Helper function to create test users
function createUser(overrides: Partial<UserPayload> = {}): UserPayload {
  return {
    userId: 1,
    email: 'test@example.com',
    name: 'Test User',
    tenantId: 1,
    isAdmin: false,
    isTenantAdmin: false,
    ...overrides,
  }
}

describe('isAdmin', () => {
  test('returns true for admin users', () => {
    const admin = createUser({ isAdmin: true })
    expect(isAdmin(admin)).toBe(true)
  })

  test('returns false for non-admin users', () => {
    const user = createUser({ isAdmin: false })
    expect(isAdmin(user)).toBe(false)
  })
})

describe('isTenantAdmin', () => {
  test('returns true for tenant admins without tenantId check', () => {
    const tenantAdmin = createUser({ isTenantAdmin: true, tenantId: 1 })
    expect(isTenantAdmin(tenantAdmin)).toBe(true)
  })

  test('returns false for non-tenant admins', () => {
    const user = createUser({ isTenantAdmin: false })
    expect(isTenantAdmin(user)).toBe(false)
  })

  test('returns true when tenantId matches', () => {
    const tenantAdmin = createUser({ isTenantAdmin: true, tenantId: 5 })
    expect(isTenantAdmin(tenantAdmin, 5)).toBe(true)
  })

  test('returns false when tenantId does not match', () => {
    const tenantAdmin = createUser({ isTenantAdmin: true, tenantId: 5 })
    expect(isTenantAdmin(tenantAdmin, 10)).toBe(false)
  })

  test('returns false when user is not tenant admin even with matching tenantId', () => {
    const user = createUser({ isTenantAdmin: false, tenantId: 5 })
    expect(isTenantAdmin(user, 5)).toBe(false)
  })
})

describe('canAccessPerson', () => {
  test('returns true when user accesses their own person', () => {
    const user = createUser({ userId: 42 })
    expect(canAccessPerson(user, 42)).toBe(true)
  })

  test('returns true when admin accesses any person', () => {
    const admin = createUser({ userId: 1, isAdmin: true })
    expect(canAccessPerson(admin, 999)).toBe(true)
  })

  test('returns false when non-admin accesses different person', () => {
    const user = createUser({ userId: 1, isAdmin: false })
    expect(canAccessPerson(user, 999)).toBe(false)
  })
})

describe('canAccessTenant', () => {
  test('returns true when user accesses their own tenant', () => {
    const user = createUser({ tenantId: 5 })
    expect(canAccessTenant(user, 5)).toBe(true)
  })

  test('returns true when admin accesses any tenant', () => {
    const admin = createUser({ tenantId: 1, isAdmin: true })
    expect(canAccessTenant(admin, 999)).toBe(true)
  })

  test('returns false when non-admin accesses different tenant', () => {
    const user = createUser({ tenantId: 1, isAdmin: false })
    expect(canAccessTenant(user, 999)).toBe(false)
  })
})

describe('requireAdmin', () => {
  test('does not throw for admin users', () => {
    const admin = createUser({ isAdmin: true })
    expect(() => requireAdmin(admin)).not.toThrow()
  })

  test('throws FORBIDDEN error for non-admin users', () => {
    const user = createUser({ isAdmin: false })
    expect(() => requireAdmin(user)).toThrow(ORPCError)

    try {
      requireAdmin(user)
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      if (error instanceof ORPCError) {
        expect(error.code).toBe('FORBIDDEN')
        expect(error.message).toBe('Admin access required')
      }
    }
  })
})

describe('requireTenantAdmin', () => {
  test('does not throw for tenant admin without tenantId check', () => {
    const tenantAdmin = createUser({ isTenantAdmin: true, tenantId: 1 })
    expect(() => requireTenantAdmin(tenantAdmin)).not.toThrow()
  })

  test('throws for non-tenant admin without tenantId check', () => {
    const user = createUser({ isTenantAdmin: false })
    expect(() => requireTenantAdmin(user)).toThrow(ORPCError)

    try {
      requireTenantAdmin(user)
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      if (error instanceof ORPCError) {
        expect(error.code).toBe('FORBIDDEN')
        expect(error.message).toBe('Tenant admin access required')
      }
    }
  })

  test('does not throw when tenant admin and tenantId matches', () => {
    const tenantAdmin = createUser({ isTenantAdmin: true, tenantId: 5 })
    expect(() => requireTenantAdmin(tenantAdmin, 5)).not.toThrow()
  })

  test('throws when tenant admin but tenantId does not match', () => {
    const tenantAdmin = createUser({ isTenantAdmin: true, tenantId: 5 })
    expect(() => requireTenantAdmin(tenantAdmin, 10)).toThrow(ORPCError)

    try {
      requireTenantAdmin(tenantAdmin, 10)
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      if (error instanceof ORPCError) {
        expect(error.code).toBe('FORBIDDEN')
      }
    }
  })

  test('throws when not tenant admin even with tenantId provided', () => {
    const user = createUser({ isTenantAdmin: false, tenantId: 5 })
    expect(() => requireTenantAdmin(user, 5)).toThrow(ORPCError)
  })
})

describe('requirePersonAccess', () => {
  test('does not throw when user accesses their own person', () => {
    const user = createUser({ userId: 42 })
    expect(() => requirePersonAccess(user, 42)).not.toThrow()
  })

  test('does not throw when admin accesses any person', () => {
    const admin = createUser({ userId: 1, isAdmin: true })
    expect(() => requirePersonAccess(admin, 999)).not.toThrow()
  })

  test('throws when non-admin accesses different person', () => {
    const user = createUser({ userId: 1, isAdmin: false })
    expect(() => requirePersonAccess(user, 999)).toThrow(ORPCError)

    try {
      requirePersonAccess(user, 999)
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      if (error instanceof ORPCError) {
        expect(error.code).toBe('FORBIDDEN')
        expect(error.message).toBe('Access denied')
      }
    }
  })
})

describe('requireTenantAccess', () => {
  test('does not throw when user accesses their own tenant', () => {
    const user = createUser({ tenantId: 5 })
    expect(() => requireTenantAccess(user, 5)).not.toThrow()
  })

  test('does not throw when admin accesses any tenant', () => {
    const admin = createUser({ tenantId: 1, isAdmin: true })
    expect(() => requireTenantAccess(admin, 999)).not.toThrow()
  })

  test('throws when non-admin accesses different tenant', () => {
    const user = createUser({ tenantId: 1, isAdmin: false })
    expect(() => requireTenantAccess(user, 999)).toThrow(ORPCError)

    try {
      requireTenantAccess(user, 999)
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      if (error instanceof ORPCError) {
        expect(error.code).toBe('FORBIDDEN')
        expect(error.message).toBe('Access denied')
      }
    }
  })
})

describe('requireAdminOrTenantAdmin', () => {
  test('does not throw for admin users (bypasses tenant check)', () => {
    const admin = createUser({ isAdmin: true, isTenantAdmin: false, tenantId: 1 })
    expect(() => requireAdminOrTenantAdmin(admin, 999)).not.toThrow()
  })

  test('does not throw for tenant admin without tenantId check', () => {
    const tenantAdmin = createUser({ isAdmin: false, isTenantAdmin: true, tenantId: 5 })
    expect(() => requireAdminOrTenantAdmin(tenantAdmin)).not.toThrow()
  })

  test('does not throw for tenant admin with matching tenantId', () => {
    const tenantAdmin = createUser({ isAdmin: false, isTenantAdmin: true, tenantId: 5 })
    expect(() => requireAdminOrTenantAdmin(tenantAdmin, 5)).not.toThrow()
  })

  test('throws for tenant admin with non-matching tenantId', () => {
    const tenantAdmin = createUser({ isAdmin: false, isTenantAdmin: true, tenantId: 5 })
    expect(() => requireAdminOrTenantAdmin(tenantAdmin, 10)).toThrow(ORPCError)

    try {
      requireAdminOrTenantAdmin(tenantAdmin, 10)
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError)
      if (error instanceof ORPCError) {
        expect(error.code).toBe('FORBIDDEN')
        expect(error.message).toBe('Admin or tenant admin access required')
      }
    }
  })

  test('throws for regular user without tenantId', () => {
    const user = createUser({ isAdmin: false, isTenantAdmin: false })
    expect(() => requireAdminOrTenantAdmin(user)).toThrow(ORPCError)
  })

  test('throws for regular user with tenantId', () => {
    const user = createUser({ isAdmin: false, isTenantAdmin: false, tenantId: 5 })
    expect(() => requireAdminOrTenantAdmin(user, 5)).toThrow(ORPCError)
  })
})
