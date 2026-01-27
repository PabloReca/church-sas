import { eq, count } from 'drizzle-orm'
import {
  emails,
  tenants,
  people,
  tenantPlans,
  tenantUsers,
  tenantPeopleFields,
  tenantPeopleFieldValues,
  tenantHelpers,
} from '@/db/schema'
import type { Database, DatabaseTransaction } from '@/db/connection'
import { z } from "@church/shared"
import { createTenantInput, updateTenantInput, tenantIdInput } from '@church/shared'
import { badRequest, conflict, internalError, notFound } from '@/lib/http-errors'

export type CreateTenantInput = z.infer<typeof createTenantInput>
export type UpdateTenantInput = z.infer<typeof updateTenantInput>
export type TenantIdInput = z.infer<typeof tenantIdInput>

/**
 * List all tenants with their plan information
 */
export async function listTenants(db: Database) {
  return await db
    .select({
      id: tenants.id,
      name: tenants.name,
      planId: tenants.planId,
      createdAt: tenants.createdAt,
      planName: tenantPlans.name,
      maxSeats: tenantPlans.maxSeats,
      maxPeople: tenantPlans.maxPeople,
      price: tenantPlans.price,
      currency: tenantPlans.currency,
    })
    .from(tenants)
    .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
}

/**
 * Get people count for a tenant
 */
export async function getPeopleCount(db: Database, tenantId: string) {
  // Get tenant and plan info
  const [tenant] = await db
    .select({
      maxSeats: tenantPlans.maxSeats,
      maxPeople: tenantPlans.maxPeople,
    })
    .from(tenants)
    .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
    .where(eq(tenants.id, tenantId))
    .limit(1)

  if (!tenant) {
    throw notFound('Tenant not found')
  }

  // Count primary members
  const [primaryMembersResult] = await db
    .select({ count: count() })
    .from(people)
    .where(eq(people.tenantId, tenantId))

  // Count active seats
  const [tenantUsersResult] = await db
    .select({ count: count() })
    .from(tenantUsers)
    .innerJoin(people, eq(tenantUsers.personId, people.id))
    .where(eq(people.tenantId, tenantId))

  // Count helpers
  const [helperCountResult] = await db
    .select({ count: count() })
    .from(tenantHelpers)
    .where(eq(tenantHelpers.tenantId, tenantId))

  return {
    tenantUsers: tenantUsersResult?.count ?? 0,
    totalPeople: (primaryMembersResult?.count ?? 0) + (helperCountResult?.count ?? 0),
    maxSeats: tenant.maxSeats,
    maxPeople: tenant.maxPeople,
    primaryMembers: primaryMembersResult?.count ?? 0,
    helpers: helperCountResult?.count ?? 0,
  }
}

/**
 * Create a new tenant with owner
 */
export async function createTenant(db: Database, input: CreateTenantInput) {
  const normalizedEmail = input.adminEmail.toLowerCase()

  // Check if email exists
  const [existingEmail] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (existingEmail) {
    throw conflict('Email already in use')
  }

  // Create tenant + owner
  const result = await db.transaction(async (tx: DatabaseTransaction) => {
    // 1. Create email
    const [emailRecord] = await tx
      .insert(emails)
      .values({ email: normalizedEmail })
      .returning()

    if (!emailRecord) {
      throw internalError('Failed to create email record')
    }

    // 2. Create tenant
    const [tenant] = await tx
      .insert(tenants)
      .values({
        name: input.name,
        planId: input.planId,
      })
      .returning()

    if (!tenant) {
      throw internalError('Failed to create tenant')
    }

    // 3. Create owner
    const [ownerPerson] = await tx
      .insert(people)
      .values({
        tenantId: tenant.id,
        emailId: emailRecord.id,
        role: 'owner',
      })
      .returning()

    if (!ownerPerson) {
      throw internalError('Failed to create owner person')
    }

    // 4. Create default name field
    const [nameField] = await tx
      .insert(tenantPeopleFields)
      .values({
        tenantId: tenant.id,
        name: 'name',
        displayName: 'Name',
        fieldType: 'text',
        isRequired: true,
        displayOrder: 0,
      })
      .returning()

    if (nameField) {
      await tx.insert(tenantPeopleFieldValues).values({
        personId: ownerPerson.id,
        fieldId: nameField.id,
        value: input.adminName,
      })
    }

    // 5. Activate seat
    await tx.insert(tenantUsers).values({
      personId: ownerPerson.id,
    })

    return tenant
  })

  return result
}

/**
 * Update a tenant
 */
export async function updateTenant(db: Database, input: UpdateTenantInput) {
  const updates: Record<string, unknown> = {}

  if (input.name !== undefined) {
    updates.name = input.name
  }

  if (input.planId !== undefined) {
    updates.planId = input.planId
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenants)
    .set(updates)
    .where(eq(tenants.id, input.id))
    .returning()

  if (!result) {
    throw notFound('Tenant not found')
  }

  return result
}

/**
 * Delete a tenant
 */
export async function deleteTenant(db: Database, input: TenantIdInput) {
  const [deleted] = await db
    .delete(tenants)
    .where(eq(tenants.id, input.id))
    .returning()

  if (!deleted) {
    throw notFound('Tenant not found')
  }

  return { success: true }
}

/**
 * Get tenant by ID
 */
export async function getTenantById(db: Database, id: string) {
  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      planId: tenants.planId,
      createdAt: tenants.createdAt,
      planName: tenantPlans.name,
      maxSeats: tenantPlans.maxSeats,
      maxPeople: tenantPlans.maxPeople,
    })
    .from(tenants)
    .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
    .where(eq(tenants.id, id))
    .limit(1)

  return tenant || null
}
