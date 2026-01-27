import { eq, and } from 'drizzle-orm'
import type { Database } from '@/db/connection'
import { z } from "@church/shared"
import {
  tenantEventSlots,
  tenantEventAssignments,
  tenantSkillIncompatibility,
  tenantTeamMemberSkills,
  tenantTeamMembers,
  tenantUsers,
  people,
} from '@/db/schema'
import {
  createEventAssignmentInput,
  deleteEventAssignmentInput,
} from '@church/shared'
import { badRequest, internalError, notFound } from '@/lib/http-errors'

export type CreateEventAssignmentInput = z.infer<typeof createEventAssignmentInput>
export type DeleteEventAssignmentInput = z.infer<typeof deleteEventAssignmentInput>

/**
 * Create an event assignment
 * Validates that:
 * - The slot exists and belongs to the tenant
 * - The user exists, is active, and belongs to the tenant
 * - The user is a member of the required team
 * - The user has the required skill for the slot
 * - The user is only assigned to one team per event
 * - There are no skill incompatibilities with existing assignments
 */
export async function createAssignment(db: Database, input: CreateEventAssignmentInput) {
  // Get the slot to know the required skill
  const [slot] = await db
    .select()
    .from(tenantEventSlots)
    .where(
      and(
        eq(tenantEventSlots.id, input.slotId),
        eq(tenantEventSlots.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!slot) {
    throw badRequest('Event slot not found')
  }

  // Verify user exists and belongs to tenant
  const [userRecord] = await db
    .select()
    .from(tenantUsers)
    .innerJoin(people, eq(tenantUsers.personId, people.id))
    .where(
      and(
        eq(tenantUsers.personId, input.userId),
        eq(people.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!userRecord) {
    throw badRequest('Active user not found in this tenant')
  }

  // Verify user is member of the required team and has the required skill
  const [teamMember] = await db
    .select()
    .from(tenantTeamMembers)
    .where(
      and(
        eq(tenantTeamMembers.userId, input.userId),
        eq(tenantTeamMembers.teamId, slot.teamId),
        eq(tenantTeamMembers.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!teamMember) {
    throw badRequest('User is not a member of the required team')
  }

  const [memberSkill] = await db
    .select()
    .from(tenantTeamMemberSkills)
    .where(
      and(
        eq(tenantTeamMemberSkills.teamMemberId, teamMember.id),
        eq(tenantTeamMemberSkills.skillId, slot.skillId)
      )
    )
    .limit(1)

  if (!memberSkill) {
    throw badRequest('User does not have the required skill')
  }

  // Check existing assignments for this user in this event
  const existingAssignments = await db
    .select({
      skillId: tenantEventSlots.skillId,
      teamId: tenantEventSlots.teamId,
    })
    .from(tenantEventAssignments)
    .innerJoin(tenantEventSlots, eq(tenantEventAssignments.slotId, tenantEventSlots.id))
    .where(
      and(
        eq(tenantEventAssignments.eventId, input.eventId),
        eq(tenantEventAssignments.userId, input.userId)
      )
    )

  if (existingAssignments.length > 0) {
    // Check that user is only assigned to ONE team per event
    const existingTeamId = existingAssignments[0]!.teamId
      if (existingTeamId !== slot.teamId) {
        throw badRequest('User can only be assigned to one team per event')
      }

    // Check skill incompatibility (blacklist) - reject if pair is in the incompatibility table
    for (const existing of existingAssignments) {
      const [id1, id2] = existing.skillId < slot.skillId
        ? [existing.skillId, slot.skillId]
        : [slot.skillId, existing.skillId]

      const [incompatibility] = await db
        .select()
        .from(tenantSkillIncompatibility)
        .where(
          and(
            eq(tenantSkillIncompatibility.tenantId, input.tenantId),
            eq(tenantSkillIncompatibility.skillId1, id1),
            eq(tenantSkillIncompatibility.skillId2, id2)
          )
        )
        .limit(1)

      // If found in blacklist, reject
      if (incompatibility) {
        throw badRequest('These skills cannot be used simultaneously by the same person')
      }
    }
  }

  const [result] = await db
    .insert(tenantEventAssignments)
    .values({
      eventId: input.eventId,
      slotId: input.slotId,
      tenantId: input.tenantId,
      userId: input.userId,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create assignment')
  }

  return result
}

/**
 * Delete an event assignment
 */
export async function deleteAssignment(db: Database, input: DeleteEventAssignmentInput) {
  const [deleted] = await db
    .delete(tenantEventAssignments)
    .where(
      and(
        eq(tenantEventAssignments.id, input.assignmentId),
        eq(tenantEventAssignments.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!deleted) {
    throw notFound('Assignment not found')
  }

  return { success: true }
}

/**
 * List event assignments
 */
export async function listAssignments(db: Database, tenantId: string, eventId: number) {
  return await db
    .select()
    .from(tenantEventAssignments)
    .where(
      and(
        eq(tenantEventAssignments.eventId, eventId),
        eq(tenantEventAssignments.tenantId, tenantId)
      )
    )
}
