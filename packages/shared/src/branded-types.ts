// =============================================================================
// Branded Types for UUIDs
// =============================================================================
// These types provide compile-time safety to prevent mixing up different ID types.
// At runtime, they're just strings (UUIDs), but TypeScript treats them as distinct.

declare const __brand: unique symbol

type Brand<T, B> = T & { [__brand]: B }

// Core entity IDs - these are UUIDs exposed in API responses
export type TenantId = Brand<string, 'TenantId'>
export type PersonId = Brand<string, 'PersonId'>
export type EmailId = Brand<string, 'EmailId'>

// Type guards and creators
export const asTenantId = (id: string): TenantId => id as TenantId
export const asPersonId = (id: string): PersonId => id as PersonId
export const asEmailId = (id: string): EmailId => id as EmailId

// Validation helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

export function parseUuid<T extends string>(value: string, cast: (id: string) => T): T {
  if (!isValidUuid(value)) {
    throw new Error(`Invalid UUID: ${value}`)
  }
  return cast(value)
}

export const parseTenantId = (value: string): TenantId => parseUuid(value, asTenantId)
export const parsePersonId = (value: string): PersonId => parseUuid(value, asPersonId)
export const parseEmailId = (value: string): EmailId => parseUuid(value, asEmailId)
