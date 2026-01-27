import { eq, and } from 'drizzle-orm'
import type { Database } from '@/db/connection'
import { z } from "@church/shared"
import {
  tenantEventSlots,
  tenantTeams,
  tenantTeamSkills,
  tenantEvents,
} from '@/db/schema'
import {
  createEventSlotInput,
  updateEventSlotInput,
  deleteEventSlotInput,
} from '@church/shared'
import { badRequest, internalError } from '@/lib/http-errors'

export type CreateEventSlotInput = z.infer<typeof createEventSlotInput>
export type UpdateEventSlotInput = z.infer<typeof updateEventSlotInput>
export type DeleteEventSlotInput = z.infer<typeof deleteEventSlotInput>

export async function createEventSlot(db: Database, input: CreateEventSlotInput) {
  // Verify event belongs to this tenant
  const [event] = await db
    .select()
    .from(tenantEvents)
    .where(
      and(
        eq(tenantEvents.id, input.eventId),
        eq(tenantEvents.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!event) {
    throw badRequest('Event not found in this tenant')
  }

  // Verify team belongs to this tenant
  const [team] = await db
    .select()
    .from(tenantTeams)
    .where(
      and(
        eq(tenantTeams.id, input.teamId),
        eq(tenantTeams.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!team) {
    throw badRequest('Team not found in this tenant')
  }

  // Verify skill belongs to this tenant and to this team
  const [skill] = await db
    .select()
    .from(tenantTeamSkills)
    .where(
      and(
        eq(tenantTeamSkills.id, input.skillId),
        eq(tenantTeamSkills.tenantId, input.tenantId),
        eq(tenantTeamSkills.teamId, input.teamId)
      )
    )
    .limit(1)

  if (!skill) {
    throw badRequest('Skill not found in this team')
  }

  const [result] = await db
    .insert(tenantEventSlots)
    .values({
      eventId: input.eventId,
      tenantId: input.tenantId,
      teamId: input.teamId,
      skillId: input.skillId,
      quantity: input.quantity,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create event slot')
  }

  return result
}

export async function updateEventSlot(db: Database, input: UpdateEventSlotInput) {
  if (input.quantity === undefined) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenantEventSlots)
    .set({ quantity: input.quantity })
    .where(
      and(
        eq(tenantEventSlots.id, input.slotId),
        eq(tenantEventSlots.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw badRequest('Event slot not found')
  }

  return result
}

export async function deleteEventSlot(db: Database, input: DeleteEventSlotInput) {
  const [deleted] = await db
    .delete(tenantEventSlots)
    .where(
      and(
        eq(tenantEventSlots.id, input.slotId),
        eq(tenantEventSlots.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!deleted) {
    throw badRequest('Event slot not found')
  }

  return { success: true }
}

export async function getEventSlot(db: Database, tenantId: string, slotId: number) {
  const [slot] = await db
    .select()
    .from(tenantEventSlots)
    .where(
      and(
        eq(tenantEventSlots.id, slotId),
        eq(tenantEventSlots.tenantId, tenantId)
      )
    )
    .limit(1)

  return slot || null
}

export async function listEventSlots(db: Database, tenantId: string, eventId: number) {
  return await db
    .select()
    .from(tenantEventSlots)
    .where(
      and(
        eq(tenantEventSlots.eventId, eventId),
        eq(tenantEventSlots.tenantId, tenantId)
      )
    )
}
