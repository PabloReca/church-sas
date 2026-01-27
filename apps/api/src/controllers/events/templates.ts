import { eq, and } from 'drizzle-orm'
import type { Database } from '@/db/connection'
import { z } from "@church/shared"
import { tenantEventTemplates, tenantEventTemplateSlots } from '@/db/schema'
import {
  createEventTemplateInput,
  updateEventTemplateInput,
  deleteEventTemplateInput,
  createEventTemplateSlotInput,
  updateEventTemplateSlotInput,
  deleteEventTemplateSlotInput,
} from '@church/shared'
import { badRequest, internalError, notFound } from '@/lib/http-errors'

export type CreateEventTemplateInput = z.infer<typeof createEventTemplateInput>
export type UpdateEventTemplateInput = z.infer<typeof updateEventTemplateInput>
export type DeleteEventTemplateInput = z.infer<typeof deleteEventTemplateInput>
export type CreateEventTemplateSlotInput = z.infer<typeof createEventTemplateSlotInput>
export type UpdateEventTemplateSlotInput = z.infer<typeof updateEventTemplateSlotInput>
export type DeleteEventTemplateSlotInput = z.infer<typeof deleteEventTemplateSlotInput>

// Event Templates
export async function createEventTemplate(db: Database, input: CreateEventTemplateInput) {
  const [result] = await db
    .insert(tenantEventTemplates)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create template')
  }

  return result
}

export async function updateEventTemplate(db: Database, input: UpdateEventTemplateInput) {
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.description !== undefined) updates.description = input.description

  if (Object.keys(updates).length === 0) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenantEventTemplates)
    .set(updates)
    .where(
      and(
        eq(tenantEventTemplates.id, input.templateId),
        eq(tenantEventTemplates.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw notFound('Template not found')
  }

  return result
}

export async function deleteEventTemplate(db: Database, input: DeleteEventTemplateInput) {
  const [deleted] = await db
    .delete(tenantEventTemplates)
    .where(
      and(
        eq(tenantEventTemplates.id, input.templateId),
        eq(tenantEventTemplates.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!deleted) {
    throw notFound('Template not found')
  }

  return { success: true }
}

export async function getEventTemplate(db: Database, tenantId: string, templateId: number) {
  const [template] = await db
    .select()
    .from(tenantEventTemplates)
    .where(
      and(
        eq(tenantEventTemplates.id, templateId),
        eq(tenantEventTemplates.tenantId, tenantId)
      )
    )
    .limit(1)

  return template || null
}

export async function listEventTemplates(db: Database, tenantId: string) {
  return await db
    .select()
    .from(tenantEventTemplates)
    .where(eq(tenantEventTemplates.tenantId, tenantId))
}

// Template Slots
export async function createEventTemplateSlot(db: Database, input: CreateEventTemplateSlotInput) {
  const [result] = await db
    .insert(tenantEventTemplateSlots)
    .values({
      templateId: input.templateId,
      tenantId: input.tenantId,
      teamId: input.teamId,
      skillId: input.skillId,
      quantity: input.quantity,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create template slot')
  }

  return result
}

export async function updateEventTemplateSlot(db: Database, input: UpdateEventTemplateSlotInput) {
  if (input.quantity === undefined) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenantEventTemplateSlots)
    .set({ quantity: input.quantity })
    .where(
      and(
        eq(tenantEventTemplateSlots.id, input.slotId),
        eq(tenantEventTemplateSlots.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw notFound('Template slot not found')
  }

  return result
}

export async function deleteEventTemplateSlot(db: Database, input: DeleteEventTemplateSlotInput) {
  const [deleted] = await db
    .delete(tenantEventTemplateSlots)
    .where(
      and(
        eq(tenantEventTemplateSlots.id, input.slotId),
        eq(tenantEventTemplateSlots.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!deleted) {
    throw notFound('Template slot not found')
  }

  return { success: true }
}

export async function listEventTemplateSlots(db: Database, tenantId: string, templateId: number) {
  return await db
    .select()
    .from(tenantEventTemplateSlots)
    .where(
      and(
        eq(tenantEventTemplateSlots.templateId, templateId),
        eq(tenantEventTemplateSlots.tenantId, tenantId)
      )
    )
}
