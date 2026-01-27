import { eq, and } from 'drizzle-orm'
import type { Database, DatabaseTransaction } from '@/db/connection'
import { z } from "@church/shared"
import {
  tenantEventTemplates,
  tenantEventTemplateSlots,
  tenantEvents,
  tenantEventSlots,
} from '@/db/schema'
import {
  createEventInput,
  updateEventInput,
  deleteEventInput,
} from '@church/shared'
import { badRequest, internalError, notFound } from '@/lib/http-errors'

export type CreateEventInput = z.infer<typeof createEventInput>
export type UpdateEventInput = z.infer<typeof updateEventInput>
export type DeleteEventInput = z.infer<typeof deleteEventInput>

export async function createEvent(db: Database, input: CreateEventInput) {
  // If template provided, verify it belongs to this tenant
  if (input.templateId) {
    const [template] = await db
      .select()
      .from(tenantEventTemplates)
      .where(
        and(
          eq(tenantEventTemplates.id, input.templateId),
          eq(tenantEventTemplates.tenantId, input.tenantId)
        )
      )
      .limit(1)

    if (!template) {
      throw badRequest('Template not found in this tenant')
    }
  }

  const result = await db.transaction(async (tx: DatabaseTransaction) => {
    // Create the event
    const [event] = await tx
      .insert(tenantEvents)
      .values({
        tenantId: input.tenantId,
        templateId: input.templateId || null,
        name: input.name,
        date: new Date(input.date),
        status: 'draft',
      })
      .returning()

    if (!event) {
      throw internalError('Failed to create event')
    }

    // If template provided, copy slots from template
    if (input.templateId) {
      const templateSlots = await tx
        .select()
        .from(tenantEventTemplateSlots)
        .where(
          and(
            eq(tenantEventTemplateSlots.templateId, input.templateId),
            eq(tenantEventTemplateSlots.tenantId, input.tenantId)
          )
        )

      if (templateSlots.length > 0) {
        await tx.insert(tenantEventSlots).values(
          templateSlots.map((slot: typeof tenantEventTemplateSlots.$inferSelect) => ({
            eventId: event.id,
            tenantId: input.tenantId,
            teamId: slot.teamId,
            skillId: slot.skillId,
            quantity: slot.quantity,
          }))
        )
      }
    }

    return event
  })

  return result
}

export async function updateEvent(db: Database, input: UpdateEventInput) {
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.date !== undefined) updates.date = new Date(input.date)
  if (input.status !== undefined) updates.status = input.status

  if (Object.keys(updates).length === 0) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenantEvents)
    .set(updates)
    .where(
      and(
        eq(tenantEvents.id, input.eventId),
        eq(tenantEvents.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw notFound('Event not found')
  }

  return result
}

export async function deleteEvent(db: Database, input: DeleteEventInput) {
  const [deleted] = await db
    .delete(tenantEvents)
    .where(
      and(
        eq(tenantEvents.id, input.eventId),
        eq(tenantEvents.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!deleted) {
    throw notFound('Event not found')
  }

  return { success: true }
}

export async function getEvent(db: Database, tenantId: string, eventId: number) {
  const [event] = await db
    .select()
    .from(tenantEvents)
    .where(
      and(
        eq(tenantEvents.id, eventId),
        eq(tenantEvents.tenantId, tenantId)
      )
    )
    .limit(1)

  return event || null
}

export async function listEvents(db: Database, tenantId: string) {
  return await db
    .select()
    .from(tenantEvents)
    .where(eq(tenantEvents.tenantId, tenantId))
}
