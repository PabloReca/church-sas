import { badRequest, notFound } from './http-errors'
import {
  type TenantId,
  type PersonId,
  type EmailId,
  asTenantId,
  asPersonId,
  asEmailId,
  isValidUuid,
} from '@church/shared'

/**
 * Parse a string parameter to a number (for internal IDs like teamId, skillId, etc.)
 * Throws if the value is not a valid positive integer.
 */
export function parseId(value: string): number {
  const id = parseInt(value, 10)
  if (!Number.isFinite(id) || id <= 0) {
    throw badRequest(`Invalid ID: ${value}`)
  }
  return id
}

/**
 * Parse and validate a UUID string, returning a branded TenantId.
 */
export function parseTenantId(value: string): TenantId {
  if (!isValidUuid(value)) {
    throw badRequest(`Invalid tenant ID: ${value}`)
  }
  return asTenantId(value)
}

/**
 * Parse and validate a UUID string, returning a branded PersonId.
 */
export function parsePersonId(value: string): PersonId {
  if (!isValidUuid(value)) {
    throw badRequest(`Invalid person ID: ${value}`)
  }
  return asPersonId(value)
}

/**
 * Parse and validate a UUID string, returning a branded EmailId.
 */
export function parseEmailId(value: string): EmailId {
  if (!isValidUuid(value)) {
    throw badRequest(`Invalid email ID: ${value}`)
  }
  return asEmailId(value)
}

/**
 * Returns the first element of an array, or throws notFound if empty.
 * Useful for Drizzle queries that return arrays.
 *
 * @example
 * const user = firstOrThrow(
 *   await db.select().from(users).where(eq(users.id, id)),
 *   'User not found'
 * )
 */
export function firstOrThrow<T>(results: T[], message: string): T {
  const first = results[0]
  if (!first) {
    throw notFound(message)
  }
  return first
}
