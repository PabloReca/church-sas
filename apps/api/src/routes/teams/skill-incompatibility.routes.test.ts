import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { teamSkillIncompatibilityRoutes } from '@/routes/teams/skill-incompatibility'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { createTeam, createTeamSkill } from '../../../tests/fixtures/teams'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('team skill incompatibility routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('skill-incompatibility')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('adds and lists incompatibilities', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team ${fixture.runId}`
    )
    const { skillId: skillIdOne } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill ${fixture.runId}`
    )
    const { skillId: skillIdTwo } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill Two ${fixture.runId}`
    )

    const addResponse = await teamSkillIncompatibilityRoutes.handle(
      makeJsonRequest('/rpc/skill-incompatibility', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        skillId1: skillIdOne,
        skillId2: skillIdTwo,
      })
    )
    expect(addResponse.status).toBe(200)
    const incompatibility = await readJson<{ skillId1: number }>(addResponse)
    expect(incompatibility.skillId1).toBeDefined()

    const listResponse = await teamSkillIncompatibilityRoutes.handle(
      makeJsonRequest(`/rpc/skill-incompatibility/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const incompatibilities = await readJson<Array<{ skillId1: number }>>(listResponse)
    expect(incompatibilities.length).toBeGreaterThan(0)

    const deleteResponse = await teamSkillIncompatibilityRoutes.handle(
      makeJsonRequest('/rpc/skill-incompatibility', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        skillId1: skillIdOne,
        skillId2: skillIdTwo,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await teamSkillIncompatibilityRoutes.handle(
      makeJsonRequest('/rpc/skill-incompatibility', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        skillId1: skillIdOne,
        skillId2: skillIdTwo,
      })
    )
    expect(deleteMissing.status).toBe(404)
  })
})
