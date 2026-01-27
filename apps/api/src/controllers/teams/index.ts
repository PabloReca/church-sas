import { eq, and } from 'drizzle-orm'
import { tenantTeams } from '@/db/schema'
import type { Database } from '@/db/connection'
import { z } from '@church/shared'
import { createTeamInput, updateTeamInput } from '@church/shared'
import { badRequest, internalError } from '@/lib/http-errors'
import { firstOrThrow } from '@/lib/params'

export type CreateTeamInput = z.infer<typeof createTeamInput>
export type UpdateTeamInput = z.infer<typeof updateTeamInput>

/**
 * Create a new team
 */
export async function createTeam(db: Database, input: CreateTeamInput) {
  const [result] = await db
    .insert(tenantTeams)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create team')
  }

  return result
}

/**
 * List all teams for a tenant
 */
export async function listTeams(db: Database, tenantId: string) {
  return await db
    .select()
    .from(tenantTeams)
    .where(eq(tenantTeams.tenantId, tenantId))
}

/**
 * Get a specific team by ID
 */
export async function getTeam(db: Database, tenantId: string, teamId: number) {
  const [result] = await db
    .select()
    .from(tenantTeams)
    .where(
      and(
        eq(tenantTeams.id, teamId),
        eq(tenantTeams.tenantId, tenantId)
      )
    )
    .limit(1)

  return result || null
}

/**
 * Update a team
 */
export async function updateTeam(db: Database, input: UpdateTeamInput) {
  const updateData: Record<string, string | null> = {}
  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description ?? null

  if (Object.keys(updateData).length === 0) {
    throw badRequest('No fields to update')
  }

  return firstOrThrow(
    await db
      .update(tenantTeams)
      .set(updateData)
      .where(
        and(
          eq(tenantTeams.id, input.teamId),
          eq(tenantTeams.tenantId, input.tenantId)
        )
      )
      .returning(),
    'Team not found'
  )
}

/**
 * Delete a team
 */
export async function deleteTeam(db: Database, tenantId: string, teamId: number) {
  firstOrThrow(
    await db
      .delete(tenantTeams)
      .where(
        and(
          eq(tenantTeams.id, teamId),
          eq(tenantTeams.tenantId, tenantId)
        )
      )
      .returning(),
    'Team not found'
  )

  return { success: true }
}
