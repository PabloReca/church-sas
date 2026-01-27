import { eq, count, and } from 'drizzle-orm'
import { people, tenantHelpers, tenantUsers } from '@/db/schema'
import type { Database } from '@/db/connection'
import { z } from "@church/shared"
import {
  setPersonRoleInput,
  getPersonRoleInput,
  addHelperInput,
  removeHelperInput,
  listHelpersInput,
  addTenantUserInput,
  removeTenantUserInput,
  countTenantUsersInput,
} from '@church/shared'
import { badRequest, conflict, internalError, notFound } from '@/lib/http-errors'
import { findPersonById, findTenantOwner, findTenantWithPlan } from '@/db/queries'

export type SetPersonRoleInput = z.infer<typeof setPersonRoleInput>
export type GetPersonRoleInput = z.infer<typeof getPersonRoleInput>
export type AddHelperInput = z.infer<typeof addHelperInput>
export type RemoveHelperInput = z.infer<typeof removeHelperInput>
export type ListHelpersInput = z.infer<typeof listHelpersInput>
export type AddTenantUserInput = z.infer<typeof addTenantUserInput>
export type RemoveTenantUserInput = z.infer<typeof removeTenantUserInput>
export type CountTenantUsersInput = z.infer<typeof countTenantUsersInput>

/**
 * Get person's role (owner/admin/null)
 */
export async function getPersonRole(db: Database, input: GetPersonRoleInput) {
  const [person] = await db
    .select({ role: people.role })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1)

  return { role: person?.role ?? null }
}

/**
 * Set person's role (owner/admin/null)
 */
export async function setPersonRole(db: Database, input: SetPersonRoleInput) {
  // Get current person
  const person = await findPersonById(db, input.personId)

  if (!person) {
    throw notFound('Person not found')
  }

  // If setting to owner, check there isn't already an owner in this tenant
  if (input.role === 'owner') {
    const existingOwner = await findTenantOwner(db, person.tenantId)

    if (existingOwner && existingOwner.id !== input.personId) {
      throw conflict('Tenant already has an owner')
    }
  }

  // Cannot remove owner role (must transfer first)
  if (person.role === 'owner' && input.role !== 'owner') {
    throw badRequest('Cannot remove owner role. Transfer ownership first.')
  }

  const [result] = await db
    .update(people)
    .set({ role: input.role, updatedAt: new Date() })
    .where(eq(people.id, input.personId))
    .returning()

  if (!result) {
    throw internalError('Failed to update person role')
  }

  return result
}

/**
 * Add a person as helper to a tenant
 */
export async function addHelper(db: Database, input: AddHelperInput) {
  // Check if person exists
  const person = await findPersonById(db, input.personId)

  if (!person) {
    throw notFound('Person not found')
  }

  // Person cannot be helper of their own tenant
  if (person.tenantId === input.tenantId) {
    throw badRequest('Person cannot be a helper in their own tenant')
  }

  const [result] = await db
    .insert(tenantHelpers)
    .values({
      tenantId: input.tenantId,
      personId: input.personId,
    })
    .onConflictDoNothing()
    .returning()

  if (!result) {
    throw conflict('Person is already a helper for this tenant')
  }

  return result
}

/**
 * Remove a helper from a tenant
 */
export async function removeHelper(db: Database, input: RemoveHelperInput) {
  const [deleted] = await db
    .delete(tenantHelpers)
    .where(and(eq(tenantHelpers.tenantId, input.tenantId), eq(tenantHelpers.personId, input.personId)))
    .returning()

  if (!deleted) {
    throw notFound('Helper not found')
  }

  return { success: true }
}

/**
 * List all helpers for a tenant
 */
export async function listHelpers(db: Database, input: ListHelpersInput) {
  return await db
    .select({
      personId: tenantHelpers.personId,
      createdAt: tenantHelpers.createdAt,
    })
    .from(tenantHelpers)
    .where(eq(tenantHelpers.tenantId, input.tenantId))
}

/**
 * Add a tenant user (enable login)
 */
export async function addTenantUser(db: Database, input: AddTenantUserInput) {
  // Check if person exists
  const person = await findPersonById(db, input.personId)

  if (!person) {
    throw notFound('Person not found')
  }

  // Check seat limit
  const tenantWithPlan = await findTenantWithPlan(db, person.tenantId)

  if (!tenantWithPlan) {
    throw notFound('Tenant not found')
  }

  const [currentUsers] = await db
    .select({ count: count() })
    .from(tenantUsers)
    .innerJoin(people, eq(tenantUsers.personId, people.id))
    .where(eq(people.tenantId, person.tenantId))

  if ((currentUsers?.count ?? 0) >= tenantWithPlan.maxSeats) {
    throw badRequest('User limit reached for this plan')
  }

  const [result] = await db
    .insert(tenantUsers)
    .values({ personId: input.personId })
    .onConflictDoNothing()
    .returning()

  if (!result) {
    throw conflict('User already active')
  }

  return result
}

/**
 * Remove a tenant user (disable login)
 */
export async function removeTenantUser(db: Database, input: RemoveTenantUserInput) {
  const [deleted] = await db
    .delete(tenantUsers)
    .where(eq(tenantUsers.personId, input.personId))
    .returning()

  if (!deleted) {
    throw notFound('Tenant user not found')
  }

  return { success: true }
}

/**
 * Count tenant users
 */
export async function countTenantUsers(db: Database, input: CountTenantUsersInput) {
  const [result] = await db
    .select({ count: count() })
    .from(tenantUsers)
    .innerJoin(people, eq(tenantUsers.personId, people.id))
    .where(eq(people.tenantId, input.tenantId))

  // Get plan limit
  const tenantWithPlan = await findTenantWithPlan(db, input.tenantId)

  return {
    tenantUsers: result?.count ?? 0,
    maxSeats: tenantWithPlan?.maxSeats ?? 0,
  }
}
