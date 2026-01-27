import { eq, and } from 'drizzle-orm'
import { tenantPeopleFields } from '@/db/schema'
import type { Database } from '@/db/connection'
import { z } from '@church/shared'
import { createFieldInput, updateFieldInput, deleteFieldInput } from '@church/shared'
import { badRequest, conflict, internalError, notFound } from '@/lib/http-errors'

export type CreateFieldInput = z.infer<typeof createFieldInput>
export type UpdateFieldInput = z.infer<typeof updateFieldInput>
export type DeleteFieldInput = z.infer<typeof deleteFieldInput>

/**
 * List all fields for a tenant
 */
export async function listFields(db: Database, tenantId: string) {
  return await db
    .select()
    .from(tenantPeopleFields)
    .where(eq(tenantPeopleFields.tenantId, tenantId))
    .orderBy(tenantPeopleFields.displayOrder)
}

/**
 * Create a new field for a tenant
 */
export async function createField(db: Database, input: CreateFieldInput) {
  // Check if field name already exists for this tenant
  const [existing] = await db
    .select()
    .from(tenantPeopleFields)
    .where(and(
      eq(tenantPeopleFields.tenantId, input.tenantId),
      eq(tenantPeopleFields.name, input.name)
    ))
    .limit(1)

  if (existing) {
    throw conflict('Field with this name already exists')
  }

  const [result] = await db
    .insert(tenantPeopleFields)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      displayName: input.displayName,
      fieldType: input.fieldType,
      isRequired: input.isRequired ?? false,
      displayOrder: input.displayOrder ?? 0,
      options: input.options,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create field')
  }

  return result
}

/**
 * Update a field
 */
export async function updateField(db: Database, input: UpdateFieldInput) {
  const updateData: Record<string, unknown> = {}
  if (input.displayName !== undefined) updateData.displayName = input.displayName
  if (input.fieldType !== undefined) updateData.fieldType = input.fieldType
  if (input.isRequired !== undefined) updateData.isRequired = input.isRequired
  if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder
  if (input.options !== undefined) updateData.options = input.options

  if (Object.keys(updateData).length === 0) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenantPeopleFields)
    .set(updateData)
    .where(and(
      eq(tenantPeopleFields.id, input.fieldId),
      eq(tenantPeopleFields.tenantId, input.tenantId)
    ))
    .returning()

  if (!result) {
    throw notFound('Field not found')
  }

  return result
}

/**
 * Delete a field (cascades to all values)
 */
export async function deleteField(db: Database, input: DeleteFieldInput) {
  const [result] = await db
    .delete(tenantPeopleFields)
    .where(and(
      eq(tenantPeopleFields.id, input.fieldId),
      eq(tenantPeopleFields.tenantId, input.tenantId)
    ))
    .returning()

  if (!result) {
    throw notFound('Field not found')
  }

  return { success: true }
}
