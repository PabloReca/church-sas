import { eq, and } from 'drizzle-orm'
import {
  tenantTeamSkills,
  tenantTeamMemberSkills,
  tenantTeamMembers,
} from '@/db/schema'
import type { Database } from '@/db/connection'
import { z } from '@church/shared'
import {
  createTeamSkillInput,
  updateTeamSkillInput,
  assignMemberSkillInput,
} from '@church/shared'
import { internalError, notFound } from '@/lib/http-errors'

export type CreateTeamSkillInput = z.infer<typeof createTeamSkillInput>
export type UpdateTeamSkillInput = z.infer<typeof updateTeamSkillInput>
export type AssignMemberSkillInput = z.infer<typeof assignMemberSkillInput>

/**
 * Create a new team skill
 */
export async function createTeamSkill(db: Database, input: CreateTeamSkillInput) {
  const [result] = await db
    .insert(tenantTeamSkills)
    .values({
      teamId: input.teamId,
      tenantId: input.tenantId,
      name: input.name,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create skill')
  }

  return result
}

/**
 * List all skills for a team
 */
export async function listTeamSkills(db: Database, tenantId: string, teamId: number) {
  return await db
    .select()
    .from(tenantTeamSkills)
    .where(
      and(
        eq(tenantTeamSkills.teamId, teamId),
        eq(tenantTeamSkills.tenantId, tenantId)
      )
    )
}

/**
 * Update a team skill
 */
export async function updateTeamSkill(db: Database, input: UpdateTeamSkillInput) {
  const [result] = await db
    .update(tenantTeamSkills)
    .set({ name: input.name })
    .where(
      and(
        eq(tenantTeamSkills.id, input.skillId),
        eq(tenantTeamSkills.tenantId, input.tenantId)
      )
    )
    .returning()

  if (!result) {
    throw notFound('Skill not found')
  }

  return result
}

/**
 * Delete a team skill
 */
export async function deleteTeamSkill(db: Database, tenantId: string, skillId: number) {
  const [result] = await db
    .delete(tenantTeamSkills)
    .where(
      and(
        eq(tenantTeamSkills.id, skillId),
        eq(tenantTeamSkills.tenantId, tenantId)
      )
    )
    .returning()

  if (!result) {
    throw notFound('Skill not found')
  }

  return { success: true }
}

/**
 * Assign a skill to a team member
 */
export async function assignMemberSkill(db: Database, input: AssignMemberSkillInput) {
  // Verify that the skill belongs to the same tenant
  const [skill] = await db
    .select()
    .from(tenantTeamSkills)
    .where(
      and(
        eq(tenantTeamSkills.id, input.skillId),
        eq(tenantTeamSkills.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!skill) {
    throw notFound('Skill not found or does not belong to this tenant')
  }

  // Verify that the team member belongs to the same tenant
  const [member] = await db
    .select()
    .from(tenantTeamMembers)
    .where(
      and(
        eq(tenantTeamMembers.id, input.teamMemberId),
        eq(tenantTeamMembers.tenantId, input.tenantId)
      )
    )
    .limit(1)

  if (!member) {
    throw notFound('Team member not found or does not belong to this tenant')
  }

  const [result] = await db
    .insert(tenantTeamMemberSkills)
    .values({
      teamMemberId: input.teamMemberId,
      skillId: input.skillId,
      tenantId: input.tenantId,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to assign skill')
  }

  return result
}

/**
 * List all skills for a team member
 */
export async function listMemberSkills(db: Database, tenantId: string, teamMemberId: number) {
  return await db
    .select({
      id: tenantTeamMemberSkills.id,
      teamMemberId: tenantTeamMemberSkills.teamMemberId,
      skillId: tenantTeamMemberSkills.skillId,
      createdAt: tenantTeamMemberSkills.createdAt,
      skillName: tenantTeamSkills.name,
    })
    .from(tenantTeamMemberSkills)
    .innerJoin(tenantTeamSkills, eq(tenantTeamMemberSkills.skillId, tenantTeamSkills.id))
    .where(
      and(
        eq(tenantTeamMemberSkills.teamMemberId, teamMemberId),
        eq(tenantTeamMemberSkills.tenantId, tenantId)
      )
    )
}

/**
 * Remove a skill from a team member
 */
export async function removeMemberSkill(
  db: Database,
  tenantId: string,
  teamMemberId: number,
  skillId: number
) {
  const [result] = await db
    .delete(tenantTeamMemberSkills)
    .where(
      and(
        eq(tenantTeamMemberSkills.teamMemberId, teamMemberId),
        eq(tenantTeamMemberSkills.skillId, skillId),
        eq(tenantTeamMemberSkills.tenantId, tenantId)
      )
    )
    .returning()

  if (!result) {
    throw notFound('Member skill not found')
  }

  return { success: true }
}
