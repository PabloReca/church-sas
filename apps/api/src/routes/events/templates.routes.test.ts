import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { eventTemplatesRoutes } from '@/routes/events/templates'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { createTeam, createTeamSkill } from '../../../tests/fixtures/teams'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('event templates routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('event-templates')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates templates and slots', async () => {
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

    const templateResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Template ${fixture.runId}`,
        description: 'Test template',
      })
    )
    expect(templateResponse.status).toBe(200)
    const template = await readJson<{ id: number }>(templateResponse)

    const slotResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/slot', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        templateId: template.id,
        teamId,
        skillId,
        quantity: 1,
      })
    )
    expect(slotResponse.status).toBe(200)
    const slot = await readJson<{ templateId: number }>(slotResponse)
    expect(slot.templateId).toBe(template.id)

    const listResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest(`/rpc/event-templates/list/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const templates = await readJson<Array<{ id: number }>>(listResponse)
    expect(templates.some((item) => item.id === template.id)).toBe(true)

    const slotsResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest(`/rpc/event-templates/slots/${fixture.tenantId}/${template.id}`, fixture.ownerToken)
    )
    expect(slotsResponse.status).toBe(200)
    const slots = await readJson<Array<{ id: number }>>(slotsResponse)
    expect(slots.length).toBeGreaterThan(0)
  })

  test('updates and deletes templates and slots with expected errors', async () => {
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

    const templateResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: `Template Update ${fixture.runId}`,
        description: 'Update template',
      })
    )
    expect(templateResponse.status).toBe(200)
    const template = await readJson<{ id: number }>(templateResponse)

    const getResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest(`/rpc/event-templates/${fixture.tenantId}/${template.id}`, fixture.ownerToken)
    )
    expect(getResponse.status).toBe(200)
    const fetched = await readJson<{ id: number } | null>(getResponse)
    expect(fetched?.id).toBe(template.id)

    const updateResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        templateId: template.id,
        name: `Template Updated ${fixture.runId}`,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ name: string }>(updateResponse)
    expect(updated.name).toContain('Updated')

    const emptyUpdate = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        templateId: template.id,
      })
    )
    expect(emptyUpdate.status).toBe(400)

    const slotResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/slot', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        templateId: template.id,
        teamId,
        skillId,
        quantity: 1,
      })
    )
    expect(slotResponse.status).toBe(200)
    const slot = await readJson<{ id: number }>(slotResponse)

    const updateSlotResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/slot', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
        quantity: 2,
      })
    )
    expect(updateSlotResponse.status).toBe(200)
    const updatedSlot = await readJson<{ quantity: number }>(updateSlotResponse)
    expect(updatedSlot.quantity).toBe(2)

    const emptySlotUpdate = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/slot', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
      })
    )
    expect(emptySlotUpdate.status).toBe(400)

    const deleteSlotResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/slot', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
      })
    )
    expect(deleteSlotResponse.status).toBe(200)
    const deletedSlot = await readJson<{ success: boolean }>(deleteSlotResponse)
    expect(deletedSlot.success).toBe(true)

    const deleteSlotMissing = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/slot', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        slotId: slot.id,
      })
    )
    expect(deleteSlotMissing.status).toBe(404)

    const deleteTemplateResponse = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/template', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        templateId: template.id,
      })
    )
    expect(deleteTemplateResponse.status).toBe(200)
    const deletedTemplate = await readJson<{ success: boolean }>(deleteTemplateResponse)
    expect(deletedTemplate.success).toBe(true)

    const deleteTemplateMissing = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates/template', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        templateId: template.id,
      })
    )
    expect(deleteTemplateMissing.status).toBe(404)

    const updateMissing = await eventTemplatesRoutes.handle(
      makeJsonRequest('/rpc/event-templates', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        templateId: 999999,
        name: 'Missing',
      })
    )
    expect(updateMissing.status).toBe(404)
  })
})
