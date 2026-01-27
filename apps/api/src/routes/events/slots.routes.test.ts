import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { eventSlotsRoutes } from '@/routes/events/slots'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { createTeam, createTeamSkill } from '../../../tests/fixtures/teams'
import { createEvent } from '../../../tests/fixtures/events'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('event slots routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('event-slots')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates and lists event slots', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill ${fixture.runId}`
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event ${fixture.runId}`,
      new Date()
    )

    const slotResponse = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        teamId,
        skillId,
        quantity: 1,
      })
    )
    expect(slotResponse.status).toBe(200)
    const slot = await readJson<{ id: number }>(slotResponse)

    const listResponse = await eventSlotsRoutes.handle(
      makeJsonRequest(`/rpc/event-slots/${fixture.tenantId}/${eventId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const slots = await readJson<Array<{ id: number }>>(listResponse)
    expect(slots.some((item) => item.id === slot.id)).toBe(true)
  })

  test('updates and deletes event slots with expected errors', async () => {
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
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event Update ${fixture.runId}`,
      new Date()
    )

    const slotResponse = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        teamId,
        skillId,
        quantity: 1,
      })
    )
    expect(slotResponse.status).toBe(200)
    const slot = await readJson<{ id: number }>(slotResponse)

    const updateResponse = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
        quantity: 2,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ quantity: number }>(updateResponse)
    expect(updated.quantity).toBe(2)

    const emptyUpdate = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
      })
    )
    expect(emptyUpdate.status).toBe(400)

    const deleteResponse = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
      })
    )
    expect(deleteMissing.status).toBe(400)
  })

  test('rejects slot creation for non-existent event', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team NoEvent ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      teamId,
      `Skill NoEvent ${fixture.runId}`
    )

    const response = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId: 999999,
        teamId,
        skillId,
        quantity: 1,
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects slot creation for team from another tenant', async () => {
    const { teamId } = await createTeam(
      fixture.db,
      fixture.secondaryTenantId,
      `Team Other ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.secondaryTenantId,
      teamId,
      `Skill Other ${fixture.runId}`
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event CrossTeam ${fixture.runId}`,
      new Date()
    )

    const response = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        teamId,
        skillId,
        quantity: 1,
      })
    )
    expect(response.status).toBe(400)
  })

  test('rejects slot creation for skill from wrong team', async () => {
    const { teamId: team1Id } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team WrongSkill1 ${fixture.runId}`
    )
    const { teamId: team2Id } = await createTeam(
      fixture.db,
      fixture.tenantId,
      `Team WrongSkill2 ${fixture.runId}`
    )
    const { skillId } = await createTeamSkill(
      fixture.db,
      fixture.tenantId,
      team2Id,
      `Skill WrongTeam ${fixture.runId}`
    )
    const { eventId } = await createEvent(
      fixture.db,
      fixture.tenantId,
      `Event WrongSkill ${fixture.runId}`,
      new Date()
    )

    const response = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        eventId,
        teamId: team1Id,
        skillId,
        quantity: 1,
      })
    )
    expect(response.status).toBe(400)
  })

  test('update returns 400 for non-existent slot', async () => {
    const response = await eventSlotsRoutes.handle(
      makeJsonRequest('/rpc/event-slots', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        slotId: 999999,
        quantity: 5,
      })
    )
    expect(response.status).toBe(400)
  })
})
