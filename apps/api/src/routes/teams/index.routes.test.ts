import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { teamsRoutes } from '@/routes/teams'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('teams routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('teams')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates and lists teams', async () => {
    const createResponse = await teamsRoutes.handle(
      makeJsonRequest('/rpc/teams', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Team ${fixture.runId}`,
        description: 'Test team',
      })
    )
    expect(createResponse.status).toBe(200)
    const createdTeam = await readJson<{ id: number }>(createResponse)

    const listResponse = await teamsRoutes.handle(
      makeJsonRequest(`/rpc/teams/list/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const teams = await readJson<Array<{ id: number }>>(listResponse)
    expect(teams.some((team) => team.id === createdTeam.id)).toBe(true)
  })

  test('gets, updates, and deletes teams with expected errors', async () => {
    const createResponse = await teamsRoutes.handle(
      makeJsonRequest('/rpc/teams', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Team Update ${fixture.runId}`,
        description: 'Update team',
      })
    )
    expect(createResponse.status).toBe(200)
    const createdTeam = await readJson<{ id: number }>(createResponse)

    const getResponse = await teamsRoutes.handle(
      makeJsonRequest(`/rpc/teams/${fixture.tenantId}/${createdTeam.id}`, fixture.ownerToken)
    )
    expect(getResponse.status).toBe(200)
    const fetched = await readJson<{ id: number } | null>(getResponse)
    expect(fetched?.id).toBe(createdTeam.id)

    const updateResponse = await teamsRoutes.handle(
      makeJsonRequest('/rpc/teams', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        teamId: createdTeam.id,
        name: `Team Updated ${fixture.runId}`,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ name: string }>(updateResponse)
    expect(updated.name).toContain('Updated')

    const emptyUpdate = await teamsRoutes.handle(
      makeJsonRequest('/rpc/teams', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        teamId: createdTeam.id,
      })
    )
    expect(emptyUpdate.status).toBe(400)

    const deleteResponse = await teamsRoutes.handle(
      makeJsonRequest('/rpc/teams', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        teamId: createdTeam.id,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await teamsRoutes.handle(
      makeJsonRequest('/rpc/teams', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        teamId: createdTeam.id,
      })
    )
    expect(deleteMissing.status).toBe(404)
  })

})
