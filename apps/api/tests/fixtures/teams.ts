import type { Database } from '@/db/connection'
import {
  tenantTeams,
  tenantTeamSkills,
  tenantTeamMembers,
  tenantTeamMemberSkills,
} from '@/db/schema'

export async function createTeam(
  db: Database,
  tenantId: string,
  name: string,
  description?: string
) {
  const [team] = await db.insert(tenantTeams).values({
    tenantId,
    name,
    description,
  }).returning()

  if (!team) {
    throw new Error('Failed to create team')
  }

  return { teamId: team.id }
}

export async function createTeamSkill(
  db: Database,
  tenantId: string,
  teamId: number,
  name: string
) {
  const [skill] = await db.insert(tenantTeamSkills).values({
    tenantId,
    teamId,
    name,
  }).returning()

  if (!skill) {
    throw new Error('Failed to create team skill')
  }

  return { skillId: skill.id }
}

export async function createTeamMember(
  db: Database,
  tenantId: string,
  teamId: number,
  userId: string,
  role?: string
) {
  const [member] = await db.insert(tenantTeamMembers).values({
    tenantId,
    teamId,
    userId,
    role: role ?? null,
  }).returning()

  if (!member) {
    throw new Error('Failed to create team member')
  }

  return { teamMemberId: member.id }
}

export async function assignTeamMemberSkill(
  db: Database,
  tenantId: string,
  teamMemberId: number,
  skillId: number
) {
  const [memberSkill] = await db.insert(tenantTeamMemberSkills).values({
    tenantId,
    teamMemberId,
    skillId,
  }).returning()

  if (!memberSkill) {
    throw new Error('Failed to assign team member skill')
  }

  return { memberSkillId: memberSkill.id }
}
