import type { UserPayload } from './jwt'
import { forbidden, unauthorized } from '@/lib/http-errors'

export function isAdmin(user: UserPayload): boolean {
  return user.isAdmin
}

export function requireAdmin(user: UserPayload): void {
  if (!user.isAdmin) {
    throw forbidden('Admin access required')
  }
}

export function requirePlatformAdmin(user: UserPayload | null | undefined): void {
  if (!user) {
    throw unauthorized()
  }
  requireAdmin(user)
}
