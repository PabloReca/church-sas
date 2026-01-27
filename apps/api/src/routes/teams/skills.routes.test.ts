import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { teamSkillsRoutes } from '@/routes/teams/skills'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { createTeam, createTeamMember, createTeamSkill } from '../../../tests/fixtures/teams'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('team skills routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('team-skills')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates and lists team skills', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team ${fixture.runId}`
    )

    const createResponse = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        teamId,
        name: `Skill ${fixture.runId}`,
      })
    )
    expect(createResponse.status).toBe(200)
    const createdSkill = await readJson<{ id: number }>(createResponse)

    const listResponse = await teamSkillsRoutes.handle(
      makeJsonRequest(`/rpc/team-skills/${fixture.tenantId}/${teamId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const skills = await readJson<Array<{ id: number }>>(listResponse)
    expect(skills.some((skill) => skill.id === createdSkill.id)).toBe(true)
  })

  test('updates and deletes team skills with expected errors', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Update ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill Update ${fixture.runId}`
    )

    const updateResponse = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        skillId,
        name: `Skill Updated ${fixture.runId}`,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ name: string }>(updateResponse)
    expect(updated.name).toContain('Updated')

    const updateMissing = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        skillId: 999999,
        name: 'Missing',
      })
    )
    expect(updateMissing.status).toBe(404)

    const deleteResponse = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills/skill', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        skillId,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills/skill', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        skillId,
      })
    )
    expect(deleteMissing.status).toBe(404)
  })

  test('assigns and removes member skills with expected errors', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Member ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill Member ${fixture.runId}`
    )
    const { teamMemberId } = await createTeamMember(
      fixture.db,
      fixture.tenantId,
      teamId,
      fixture.ownerPersonId
    )

    const assignResponse = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills/member-skill', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        teamMemberId,
        skillId,
      })
    )
    expect(assignResponse.status).toBe(200)
    const assigned = await readJson<{ skillId: number }>(assignResponse)
    expect(assigned.skillId).toBe(skillId)

    const listResponse = await teamSkillsRoutes.handle(
      makeJsonRequest(`/rpc/team-skills/member-skills/${fixture.tenantId}/${teamMemberId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const memberSkills = await readJson<Array<{ skillId: number }>>(listResponse)
    expect(memberSkills.some((item) => item.skillId === skillId)).toBe(true)

    const removeResponse = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills/member-skill', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        teamMemberId,
        skillId,
      })
    )
    expect(removeResponse.status).toBe(200)
    const removed = await readJson<{ success: boolean }>(removeResponse)
    expect(removed.success).toBe(true)

    const removeMissing = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills/member-skill', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        teamMemberId,
        skillId,
      })
    )
    expect(removeMissing.status).toBe(404)

    const assignMissingSkill = await teamSkillsRoutes.handle(
      makeJsonRequest('/rpc/team-skills/member-skill', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        teamMemberId,
        skillId: 999999,
      })
    )
    expect(assignMissingSkill.status).toBe(404)
  })

})
