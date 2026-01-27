import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { teamMembersRoutes } from '@/routes/teams/members'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { createTeam } from '../../../tests/fixtures/teams'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('team members routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('team-members')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('adds and lists team members', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team ${fixture.runId}`
    )

    const addResponse = await teamMembersRoutes.handle(
      makeJsonRequest('/rpc/team-members', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        teamId,
        userId: fixture.ownerPersonId,
        role: 'leader',
      })
    )
    expect(addResponse.status).toBe(200)
    const addedMember = await readJson<{ id: number }>(addResponse)

    const listResponse = await teamMembersRoutes.handle(
      makeJsonRequest(`/rpc/team-members/${fixture.tenantId}/${teamId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const members = await readJson<Array<{ id: number }>>(listResponse)
    expect(members.some((member) => member.id === addedMember.id)).toBe(true)
  })

  test('updates and deletes team members with expected errors', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team Update ${fixture.runId}`
    )

    const addResponse = await teamMembersRoutes.handle(
      makeJsonRequest('/rpc/team-members', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        teamId,
        userId: fixture.ownerPersonId,
        role: 'member',
      })
    )
    expect(addResponse.status).toBe(200)
    await readJson<{ id: number }>(addResponse)

    const updateResponse = await teamMembersRoutes.handle(
      makeJsonRequest('/rpc/team-members', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        teamId,
        userId: fixture.ownerPersonId,
        role: 'leader',
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ role: string | null }>(updateResponse)
    expect(updated.role).toBe('leader')

    const emptyUpdate = await teamMembersRoutes.handle(
      makeJsonRequest('/rpc/team-members', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        teamId,
        userId: fixture.ownerPersonId,
      })
    )
    expect(emptyUpdate.status).toBe(400)

    const deleteResponse = await teamMembersRoutes.handle(
      makeJsonRequest('/rpc/team-members', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        teamId,
        userId: fixture.ownerPersonId,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await teamMembersRoutes.handle(
      makeJsonRequest('/rpc/team-members', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        teamId,
        userId: fixture.ownerPersonId,
      })
    )
    expect(deleteMissing.status).toBe(400)
  })

})
