import type { Database } from '@/db/connection'
import {
  tenantEventTemplates,
  tenantEventTemplateSlots,
  tenantEvents,
  tenantEventSlots,
} from '@/db/schema'

export async function createEventTemplate(
  db: Database,
  tenantId: string,
  name: string,
  description?: string
) {
  const [template] = await db.insert(tenantEventTemplates).values({
    tenantId,
    name,
    description,
  }).returning()

  if (!template) {
    throw new Error('Failed to create event template')
  }

  return { templateId: template.id }
}

export async function createEventTemplateSlot(
  db: Database,
  tenantId: string,
  templateId: number,
  teamId: number,
  skillId: number,
  quantity = 1
) {
  const [slot] = await db.insert(tenantEventTemplateSlots).values({
    tenantId,
    templateId,
    teamId,
    skillId,
    quantity,
  }).returning()

  if (!slot) {
    throw new Error('Failed to create event template slot')
  }

  return { slotId: slot.id }
}

export async function createEvent(
  db: Database,
  tenantId: string,
  name: string,
  date: Date,
  templateId?: number
) {
  const [event] = await db.insert(tenantEvents).values({
    tenantId,
    templateId: templateId ?? null,
    name,
    date,
  }).returning()

  if (!event) {
    throw new Error('Failed to create event')
  }

  return { eventId: event.id }
}

export async function createEventSlot(
  db: Database,
  tenantId: string,
  eventId: number,
  teamId: number,
  skillId: number,
  quantity = 1
) {
  const [slot] = await db.insert(tenantEventSlots).values({
    tenantId,
    eventId,
    teamId,
    skillId,
    quantity,
  }).returning()

  if (!slot) {
    throw new Error('Failed to create event slot')
  }

  return { slotId: slot.id }
}
