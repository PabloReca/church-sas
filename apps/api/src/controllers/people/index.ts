import { eq, and } from 'drizzle-orm'
import {
  emails,
  people,
  tenantPeopleFields,
  tenantPeopleFieldValues,
  tenantHelpers,
  tenantUsers,
  tenantMembers,
  type TenantPeopleField
} from '@/db/schema'
import type { Database, DatabaseTransaction } from '@/db/connection'
import { z } from '@church/shared'
import { createPersonInput, updatePersonInput } from '@church/shared'
import { badRequest, conflict, internalError, notFound } from '@/lib/http-errors'

export type CreatePersonInput = z.infer<typeof createPersonInput>
export type UpdatePersonInput = z.infer<typeof updatePersonInput>

// Helper to get person with all field values
export async function getPersonWithFields(db: Database, personId: string) {
  const [person] = await db
    .select({
      id: people.id,
      tenantId: people.tenantId,
      emailId: people.emailId,
      role: people.role,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
    })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1)

  if (!person) return null

  // Get email
  const [emailRecord] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, person.emailId))
    .limit(1)
  const email = emailRecord?.email ?? null

  // Get field values with field info
  const fieldValuesRaw = await db
    .select({
      fieldName: tenantPeopleFields.name,
      displayName: tenantPeopleFields.displayName,
      fieldType: tenantPeopleFields.fieldType,
      value: tenantPeopleFieldValues.value,
    })
    .from(tenantPeopleFieldValues)
    .innerJoin(tenantPeopleFields, eq(tenantPeopleFieldValues.fieldId, tenantPeopleFields.id))
    .where(eq(tenantPeopleFieldValues.personId, personId))

  const fields: Record<string, string | null> = {}
  for (const fv of fieldValuesRaw) {
    fields[fv.fieldName] = fv.value
  }

  return {
    ...person,
    email,
    fields,
  }
}

export async function getPersonWithStatus(db: Database, personId: string) {
  const result = await getPersonWithFields(db, personId)

  if (!result) return null

  // Check if active user (can login)
  const [activeSeat] = await db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.personId, personId))
    .limit(1)

  // Check if church member
  const [memberRecord] = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.personId, personId))
    .limit(1)

  return {
    ...result,
    isActive: !!activeSeat,
    isMember: !!memberRecord,
  }
}

/**
 * Get a person by ID
 */
export async function getPerson(db: Database, personId: string) {
  const result = await getPersonWithStatus(db, personId)

  if (!result) {
    return null
  }

  return {
    ...result,
    isActive: result.isActive ? 1 : 0,
  }
}

/**
 * Create a new person
 */
export async function createPerson(db: Database, input: CreatePersonInput) {
  const normalizedEmail = input.email.toLowerCase()

  const [existingEmail] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (existingEmail) {
    throw conflict('Email already in use')
  }

  // Validate fields before creating anything in DB
  if (input.fields && Object.keys(input.fields).length > 0) {
    const tenantFields = await db
      .select()
      .from(tenantPeopleFields)
      .where(eq(tenantPeopleFields.tenantId, input.tenantId))

    const fieldMap = new Map<string, TenantPeopleField>(
      tenantFields.map((f: TenantPeopleField) => [f.name, f])
    )

    for (const fieldName of Object.keys(input.fields)) {
      const field = fieldMap.get(fieldName)
      if (!field) {
        throw badRequest(`Unknown field: ${fieldName}`)
      }
    }
  }

  // Use transaction to ensure atomicity
  const person = await db.transaction(async (tx: DatabaseTransaction) => {
    const [newEmail] = await tx
      .insert(emails)
      .values({ email: normalizedEmail })
      .returning()

    if (!newEmail) {
      throw internalError('Failed to create email')
    }

    // Create person
    const [newPerson] = await tx
      .insert(people)
      .values({
        tenantId: input.tenantId,
        emailId: newEmail.id,
        role: input.role ?? null,
      })
      .returning()

    if (!newPerson) {
      throw internalError('Failed to create person')
    }

    // Handle field values if provided
    if (input.fields && Object.keys(input.fields).length > 0) {
      const tenantFields = await tx
        .select()
        .from(tenantPeopleFields)
        .where(eq(tenantPeopleFields.tenantId, input.tenantId))

      const fieldMap = new Map<string, TenantPeopleField>(
        tenantFields.map((f: TenantPeopleField) => [f.name, f])
      )

      for (const [fieldName, value] of Object.entries(input.fields)) {
        const field = fieldMap.get(fieldName)

        if (!field) {
          throw badRequest(`Unknown field: ${fieldName}`)
        }

        await tx
          .insert(tenantPeopleFieldValues)
          .values({
            personId: newPerson.id,
            fieldId: field.id,
            value,
          })
      }
    }

    return newPerson
  })

  return await getPersonWithFields(db, person.id)
}

/**
 * Update a person's fields
 */
export async function updatePerson(
  db: Database,
  input: UpdatePersonInput,
  options?: { allowActiveChange?: boolean }
) {
  const allowActiveChange = options?.allowActiveChange ?? true

  // Get current person to know tenant
  const [currentPerson] = await db
    .select()
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1)

  if (!currentPerson) {
    throw notFound('Person not found')
  }

  // Handle field values update
  if (input.fields && Object.keys(input.fields).length > 0) {
    // Get field definitions for this tenant
    const tenantFields = await db
      .select()
      .from(tenantPeopleFields)
      .where(eq(tenantPeopleFields.tenantId, currentPerson.tenantId))

    const fieldMap = new Map<string, TenantPeopleField>(
      tenantFields.map((f: TenantPeopleField) => [f.name, f])
    )

    for (const [fieldName, value] of Object.entries(input.fields)) {
      const field = fieldMap.get(fieldName)
      if (!field) {
        throw badRequest(`Unknown field: ${fieldName}`)
      }

      // Upsert field value
      const [existing] = await db
        .select()
        .from(tenantPeopleFieldValues)
        .where(and(
          eq(tenantPeopleFieldValues.personId, input.personId),
          eq(tenantPeopleFieldValues.fieldId, field.id)
        ))
        .limit(1)

      if (existing) {
        await db
          .update(tenantPeopleFieldValues)
          .set({ value, updatedAt: new Date() })
          .where(eq(tenantPeopleFieldValues.id, existing.id))
      } else {
        await db
          .insert(tenantPeopleFieldValues)
          .values({
            personId: input.personId,
            fieldId: field.id,
            value,
          })
      }
    }

    // Update person timestamp
    await db
      .update(people)
      .set({ updatedAt: new Date() })
      .where(eq(people.id, input.personId))
  }

  // Handle isActive status if provided
  if (input.isActive !== undefined && allowActiveChange) {
    const [existing] = await db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.personId, input.personId))
      .limit(1)

    if (input.isActive === 1 && !existing) {
      await db.insert(tenantUsers).values({ personId: input.personId })
    } else if (input.isActive === 0 && existing) {
      await db.delete(tenantUsers).where(eq(tenantUsers.personId, input.personId))
    }
  }

  const hasChanges = (input.fields && Object.keys(input.fields).length > 0) ||
    input.isActive !== undefined

  if (!hasChanges) {
    throw badRequest('No fields to update')
  }

  return await getPersonWithStatus(db, input.personId)
}

export async function deletePerson(db: Database, personId: string) {
  await db.transaction(async (tx) => {
    // Delete field values
    await tx.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.personId, personId))

    // Delete tenant user (active seat)
    await tx.delete(tenantUsers).where(eq(tenantUsers.personId, personId))

    // Delete helpers
    await tx.delete(tenantHelpers).where(eq(tenantHelpers.personId, personId))

    // Get email ID before deleting person
    const [personRecord] = await tx
      .select()
      .from(people)
      .where(eq(people.id, personId))
      .limit(1)

    // Delete person
    await tx.delete(people).where(eq(people.id, personId))

    // Delete email
    if (personRecord) {
      await tx.delete(emails).where(eq(emails.id, personRecord.emailId))
    }
  })

  return { success: true }
}
