import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { peopleFieldsRoutes } from '@/routes/people/fields'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('people fields routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('people-fields')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('creates and lists fields', async () => {
    const fieldName = `field-${fixture.runId}`
    const createResponse = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: fieldName,
        displayName: 'Notes',
        fieldType: 'text',
        isRequired: false,
        displayOrder: 1,
      })
    )
    expect(createResponse.status).toBe(200)
    const createdField = await readJson<{ id: number; name: string }>(createResponse)
    expect(createdField.name).toBe(fieldName)

    const listResponse = await peopleFieldsRoutes.handle(
      makeJsonRequest(`/rpc/people-fields/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const fields = await readJson<Array<{ id: number }>>(listResponse)
    expect(fields.some((field) => field.id === createdField.id)).toBe(true)
  })

  test('updates and deletes fields with expected errors', async () => {
    const fieldName = `update-${fixture.runId}`
    const createResponse = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        name: fieldName,
        displayName: 'Original',
        fieldType: 'text',
        isRequired: false,
        displayOrder: 2,
      })
    )
    expect(createResponse.status).toBe(200)
    const createdField = await readJson<{ id: number; displayName: string }>(createResponse)

    const updateResponse = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        fieldId: createdField.id,
        displayName: 'Updated',
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ displayName: string }>(updateResponse)
    expect(updated.displayName).toBe('Updated')

    const emptyUpdate = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        fieldId: createdField.id,
      })
    )
    expect(emptyUpdate.status).toBe(400)

    const deleteResponse = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        fieldId: createdField.id,
      })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'DELETE', {
        tenantId: fixture.tenantId,
        fieldId: createdField.id,
      })
    )
    expect(deleteMissing.status).toBe(404)

    const updateMissing = await peopleFieldsRoutes.handle(
      makeJsonRequest('/rpc/people-fields', fixture.ownerToken, 'PATCH', {
        tenantId: fixture.tenantId,
        fieldId: 999999,
        displayName: 'Missing',
      })
    )
    expect(updateMissing.status).toBe(404)
  })
})
