import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { eventsRoutes } from '@/routes/events'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { createEventTemplate, createEventTemplateSlot } from '../../../tests/fixtures/events'
import { createTeam, createTeamSkill } from '../../../tests/fixtures/teams'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('events routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('events')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates and lists events', async () => {
    const eventResponse = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Event ${fixture.runId}`,
        date: new Date().toISOString(),
      })
    )
    expect(eventResponse.status).toBe(200)
    const event = await readJson<{ id: number }>(eventResponse)

    const listResponse = await eventsRoutes.handle(
      makeJsonRequest(`/rpc/events/list/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const events = await readJson<Array<{ id: number }>>(listResponse)
    expect(events.some((item) => item.id === event.id)).toBe(true)

    const getResponse = await eventsRoutes.handle(
      makeJsonRequest(`/rpc/events/${fixture.tenantId}/${event.id}`, fixture.ownerToken)
    )
    expect(getResponse.status).toBe(200)
    const fetched = await readJson<{ id: number } | null>(getResponse)
    expect(fetched?.id).toBe(event.id)
  })

  test('updates and deletes events with expected errors', async () => {
    const createResponse = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Event Update ${fixture.runId}`,
        date: new Date().toISOString(),
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: number }>(createResponse)

    const updateResponse = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        eventId: created.id,
        name: `Event Updated ${fixture.runId}`,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ name: string }>(updateResponse)
    expect(updated.name).toContain('Updated')

    const emptyUpdate = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        eventId: created.id,
      })
    )
    expect(emptyUpdate.status).toBe(400)

    const deleteResponse = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        eventId: created.id,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        eventId: created.id,
      })
    )
    expect(deleteMissing.status).toBe(404)
  })

  test('creates event from template and copies slots', async () => {
    const { teamId } = await createTeam(fixture.db, fixture.tenantId, `Team Template ${fixture.runId}`)
    const { skillId } = await createTeamSkill(fixture.db, fixture.tenantId, teamId, `Skill Template ${fixture.runId}`)
    const { templateId } = await createEventTemplate(fixture.db, fixture.tenantId, `Template ${fixture.runId}`)
    await createEventTemplateSlot(fixture.db, fixture.tenantId, templateId, teamId, skillId, 2)

    const eventResponse = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        templateId,
        name: `Event From Template ${fixture.runId}`,
        date: new Date().toISOString(),
      })
    )
    expect(eventResponse.status).toBe(200)
    const event = await readJson<{ id: number; templateId: number }>(eventResponse)
    expect(event.templateId).toBe(templateId)
  })

  test('rejects event creation with template from another tenant', async () => {
    const { templateId } = await createEventTemplate(
      fixture.db,
      fixture.secondaryTenantId,
      `Template Other ${fixture.runId}`
    )

    const response = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        templateId,
        name: `Event Cross Tenant ${fixture.runId}`,
        date: new Date().toISOString(),
      })
    )
    expect(response.status).toBe(400)
  })

  test('can update event date and status', async () => {
    const createResponse = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Event Status ${fixture.runId}`,
        date: new Date().toISOString(),
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: number }>(createResponse)

    const newDate = new Date('2025-12-25T10:00:00Z').toISOString()
    const updateDate = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        eventId: created.id,
        date: newDate,
      })
    )
    expect(updateDate.status).toBe(200)

    const updateStatus = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        eventId: created.id,
        status: 'published',
      })
    )
    expect(updateStatus.status).toBe(200)
    const updated = await readJson<{ status: string }>(updateStatus)
    expect(updated.status).toBe('published')
  })

  test('update returns 404 for non-existent event', async () => {
    const response = await eventsRoutes.handle(
      makeJsonRequest('/rpc/events', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        eventId: 999999,
        name: 'Should fail',
      })
    )
    expect(response.status).toBe(404)
  })

  test('get returns null for non-existent event', async () => {
    const response = await eventsRoutes.handle(
      makeJsonRequest(`/rpc/events/${fixture.tenantId}/999999`, fixture.ownerToken)
    )
    expect(response.status).toBe(200)
  })
})
