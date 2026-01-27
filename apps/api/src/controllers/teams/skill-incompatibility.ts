import { eq, and, or } from 'drizzle-orm'
import { tenantSkillIncompatibility, tenantTeamSkills } from '@/db/schema'
import type { Database } from '@/db/connection'
import { badRequest, conflict, notFound } from '@/lib/http-errors'

export interface AddSkillIncompatibilityInput {
  tenantId: string
  skillId1: number
  skillId2: number
}

export interface RemoveSkillIncompatibilityInput {
  tenantId: string
  skillId1: number
  skillId2: number
}

/**
 * Add an incompatibility rule between two skills (they cannot be used simultaneously)
 */
export async function addSkillIncompatibility(db: Database, input: AddSkillIncompatibilityInput) {
  // Verify both skills belong to this tenant
  const skills = await db
    .select()
    .from(tenantTeamSkills)
    .where(
      and(
        eq(tenantTeamSkills.tenantId, input.tenantId),
        or(
          eq(tenantTeamSkills.id, input.skillId1),
          eq(tenantTeamSkills.id, input.skillId2)
        )
      )
    )

  if (skills.length !== 2) {
    throw badRequest('One or both skills do not belong to this tenant')
  }

  // Ensure skillId1 < skillId2 for consistency (bidirectional)
  const [id1, id2] = input.skillId1 < input.skillId2
    ? [input.skillId1, input.skillId2]
    : [input.skillId2, input.skillId1]

  const [result] = await db
    .insert(tenantSkillIncompatibility)
    .values({
      tenantId: input.tenantId,
      skillId1: id1,
      skillId2: id2,
    })
    .onConflictDoNothing()
    .returning()

  if (!result) {
    throw conflict('Skill incompatibility already exists')
  }

  return result
}

/**
 * Remove an incompatibility rule (allow skills to be used together again)
 */
export async function removeSkillIncompatibility(db: Database, input: RemoveSkillIncompatibilityInput) {
  const [id1, id2] = input.skillId1 < input.skillId2
    ? [input.skillId1, input.skillId2]
    : [input.skillId2, input.skillId1]

  const [deleted] = await db
    .delete(tenantSkillIncompatibility)
    .where(
      and(
        eq(tenantSkillIncompatibility.tenantId, input.tenantId),
        eq(tenantSkillIncompatibility.skillId1, id1),
        eq(tenantSkillIncompatibility.skillId2, id2)
      )
    )
    .returning()

  if (!deleted) {
    throw notFound('Skill incompatibility not found')
  }

  return { success: true }
}

/**
 * List all incompatibility rules for this tenant
 */
export async function listSkillIncompatibilities(db: Database, tenantId: string) {
  return await db
    .select({
      skillId1: tenantSkillIncompatibility.skillId1,
      skillId2: tenantSkillIncompatibility.skillId2,
      skill1Name: tenantTeamSkills.name,
    })
    .from(tenantSkillIncompatibility)
    .innerJoin(tenantTeamSkills, eq(tenantSkillIncompatibility.skillId1, tenantTeamSkills.id))
    .where(eq(tenantSkillIncompatibility.tenantId, tenantId))
}
