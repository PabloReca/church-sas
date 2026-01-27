import { eq, and } from 'drizzle-orm'
import {
  emails,
  tenantTeamMembers,
  tenantUsers,
  people,
} from '@/db/schema'
import type { Database } from '@/db/connection'
import { z } from "@church/shared"
import {
  addTeamMemberInput,
  updateTeamMemberInput,
  removeTeamMemberInput,
} from '@church/shared'
import { badRequest } from '@/lib/http-errors'

export type AddTeamMemberInput = z.infer<typeof addTeamMemberInput>
export type UpdateTeamMemberInput = z.infer<typeof updateTeamMemberInput>
export type RemoveTeamMemberInput = z.infer<typeof removeTeamMemberInput>

/**
 * Add a member to a team
 */
export async function addTeamMember(db: Database, input: AddTeamMemberInput) {
  // Verify user exists (must be an active user, not just a person)
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
    throw badRequest('Active user not found or does not belong to this tenant')
  }

  const [result] = await db
    .insert(tenantTeamMembers)
    .values({
      teamId: input.teamId,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role ?? null,
    })
    .returning()

  if (!result) {
    throw badRequest('Failed to add team member')
  }

  return result
}

/**
 * List members of a team
 */
export async function listTeamMembers(db: Database, tenantId: string, teamId: number) {
  const members = await db
    .select({
      id: tenantTeamMembers.id,
      teamId: tenantTeamMembers.teamId,
      userId: tenantTeamMembers.userId,
      role: tenantTeamMembers.role,
      createdAt: tenantTeamMembers.createdAt,
      email: emails.email,
    })
    .from(tenantTeamMembers)
    .innerJoin(people, eq(tenantTeamMembers.userId, people.id))
    .leftJoin(emails, eq(people.emailId, emails.id))
    .where(
      and(
        eq(tenantTeamMembers.teamId, teamId),
        eq(tenantTeamMembers.tenantId, tenantId)
      )
    )

  return members
}

/**
 * Update a team member
 */
export async function updateTeamMember(db: Database, input: UpdateTeamMemberInput) {
  const updateData: Record<string, string | null | undefined> = {}
  if (input.role !== undefined) updateData.role = input.role

  if (Object.keys(updateData).length === 0) {
    throw badRequest('No fields to update')
  }

  const [result] = await db
    .update(tenantTeamMembers)
    .set(updateData)
    .where(
      and(
        eq(tenantTeamMembers.teamId, input.teamId),
        eq(tenantTeamMembers.userId, input.userId),
        eq(tenantTeamMembers.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw badRequest('Team member not found')
  }

  return result
}

/**
 * Remove a member from a team
 */
export async function removeTeamMember(db: Database, input: RemoveTeamMemberInput) {
  const [result] = await db
    .delete(tenantTeamMembers)
    .where(
      and(
        eq(tenantTeamMembers.teamId, input.teamId),
        eq(tenantTeamMembers.userId, input.userId),
        eq(tenantTeamMembers.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw badRequest('Team member not found')
  }

  return { success: true }
}
