import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { peopleRoutes } from '@/routes/people'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { makeJsonRequest, readJson } from '../../../tests/http'
import { generateJWT } from '@/lib/auth/jwt'
import { tenantPeopleFields, tenantUsers } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('people routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('people')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('returns current person', async () => {
    const meResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people/me', fixture.ownerToken)
    )
    expect(meResponse.status).toBe(200)
    const meData = await readJson<{ id: string; email: string }>(meResponse)
    expect(meData.id).toBe(fixture.ownerPersonId)
    expect(meData.email).toBe(fixture.ownerEmail)
  })

  test('gets people by id and tenant with expected access', async () => {
    const ownResponse = await peopleRoutes.handle(
      makeJsonRequest(`/rpc/people/${fixture.memberPersonId}`, fixture.memberToken)
    )
    expect(ownResponse.status).toBe(200)
    const ownData = await readJson<{ id: string }>(ownResponse)
    expect(ownData.id).toBe(fixture.memberPersonId)

    const forbiddenResponse = await peopleRoutes.handle(
      makeJsonRequest(`/rpc/people/${fixture.memberPersonId}`, fixture.ownerToken)
    )
    expect(forbiddenResponse.status).toBe(403)

    const tenantResponse = await peopleRoutes.handle(
      makeJsonRequest(`/rpc/people/tenant/${fixture.tenantId}/${fixture.memberPersonId}`, fixture.ownerToken)
    )
    expect(tenantResponse.status).toBe(200)
    const tenantData = await readJson<{ id: string } | null>(tenantResponse)
    expect(tenantData?.id).toBe(fixture.memberPersonId)
  })

  test('updates people with expected errors', async () => {
    const [field] = await fixture.db
      .insert(tenantPeopleFields)
      .values({
        tenantId: fixture.tenantId,
        name: `note-${fixture.runId}`,
        displayName: 'Note',
        fieldType: 'text',
        isRequired: false,
        displayOrder: 0,
      })
      .returning()
    if (!field) throw new Error('Failed to create field')

    const updateResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.memberToken, 'PATCH', {
        personId: fixture.memberPersonId,
        fields: {
          [field.name]: 'Updated',
        },
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ fields: Record<string, string | null> }>(updateResponse)
    expect(updated.fields[field.name]).toBe('Updated')

    const forbiddenResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'PATCH', {
        personId: fixture.memberPersonId,
        fields: {
          [field.name]: 'Nope',
        },
      })
    )
    expect(forbiddenResponse.status).toBe(403)

    const emptyResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.memberToken, 'PATCH', {
        personId: fixture.memberPersonId,
      })
    )
    expect(emptyResponse.status).toBe(400)

    const unknownFieldResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.memberToken, 'PATCH', {
        personId: fixture.memberPersonId,
        fields: {
          unknown: 'value',
        },
      })
    )
    expect(unknownFieldResponse.status).toBe(400)
  })

  test('creates and deletes people with expected access', async () => {
    const createResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        email: `new-${fixture.runId}@test.com`,
        role: null,
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: string; email: string }>(createResponse)

    const deleteForbidden = await peopleRoutes.handle(
      makeJsonRequest(`/rpc/people/${fixture.memberPersonId}`, fixture.ownerToken, 'DELETE')
    )
    expect(deleteForbidden.status).toBe(403)

    const deleteToken = await generateJWT({
      userId: created.id,
      email: created.email,
      name: 'New',
      tenantId: fixture.tenantId,
      isAdmin: false,
      isTenantAdmin: false,
    })

    const deleteResponse = await peopleRoutes.handle(
      makeJsonRequest(`/rpc/people/${created.id}`, deleteToken, 'DELETE')
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)
  })

  test('creates person with fields', async () => {
    const [field] = await fixture.db
      .insert(tenantPeopleFields)
      .values({
        tenantId: fixture.tenantId,
        name: `create-field-${fixture.runId}`,
        displayName: 'Create Field',
        fieldType: 'text',
        isRequired: false,
        displayOrder: 0,
      })
      .returning()
    if (!field) throw new Error('Failed to create field')

    const createResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        email: `with-fields-${fixture.runId}@test.com`,
        role: null,
        fields: {
          [field.name]: 'Test Value',
        },
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: string; fields: Record<string, string> }>(createResponse)
    expect(created.fields[field.name]).toBe('Test Value')
  })

  test('rejects creation with duplicate email', async () => {
    const response = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        email: fixture.ownerEmail,
        role: null,
      })
    )
    expect(response.status).toBe(409)
  })

  test('rejects creation with unknown field', async () => {
    const response = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        email: `unknown-field-${fixture.runId}@test.com`,
        role: null,
        fields: {
          'nonexistent-field': 'value',
        },
      })
    )
    expect(response.status).toBe(400)
  })

  test('admin can update isActive status', async () => {
    // Create a person first
    const createResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        email: `active-test-${fixture.runId}@test.com`,
        role: null,
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: string }>(createResponse)

    // Admin updates isActive
    const updateResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.adminToken, 'PATCH', {
        personId: created.id,
        isActive: 1,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ isActive: boolean }>(updateResponse)
    expect(updated.isActive).toBe(true)

    // Verify in DB
    const [userRecord] = await fixture.db
      .select()
      .from(tenantUsers)
      .where(eq(tenantUsers.personId, created.id))
    expect(userRecord).toBeDefined()

    // Deactivate
    const deactivateResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.adminToken, 'PATCH', {
        personId: created.id,
        isActive: 0,
      })
    )
    expect(deactivateResponse.status).toBe(200)
    const deactivated = await readJson<{ isActive: boolean }>(deactivateResponse)
    expect(deactivated.isActive).toBe(false)
  })

  test('updates existing field value', async () => {
    const [field] = await fixture.db
      .insert(tenantPeopleFields)
      .values({
        tenantId: fixture.tenantId,
        name: `update-field-${fixture.runId}`,
        displayName: 'Update Field',
        fieldType: 'text',
        isRequired: false,
        displayOrder: 0,
      })
      .returning()
    if (!field) throw new Error('Failed to create field')

    // Create person with field
    const createResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.ownerToken, 'POST', {
        tenantId: fixture.tenantId,
        email: `update-existing-${fixture.runId}@test.com`,
        role: null,
        fields: {
          [field.name]: 'Initial',
        },
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: string }>(createResponse)

    // Create token for new person
    const personToken = await generateJWT({
      userId: created.id,
      email: `update-existing-${fixture.runId}@test.com`,
      name: 'Test',
      tenantId: fixture.tenantId,
      isAdmin: false,
      isTenantAdmin: false,
    })

    // Update existing field
    const updateResponse = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', personToken, 'PATCH', {
        personId: created.id,
        fields: {
          [field.name]: 'Updated Value',
        },
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ fields: Record<string, string> }>(updateResponse)
    expect(updated.fields[field.name]).toBe('Updated Value')
  })

  test('get returns 404 for non-existent person', async () => {
    const personToken = await generateJWT({
      userId: "550e8400-e29b-41d4-a716-446655999999",
      email: 'nonexistent@test.com',
      name: 'Ghost',
      tenantId: fixture.tenantId,
      isAdmin: false,
      isTenantAdmin: false,
    })

    const response = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people/me', personToken)
    )
    expect(response.status).toBe(404)
  })

  test('update returns 404 for non-existent person', async () => {
    const response = await peopleRoutes.handle(
      makeJsonRequest('/rpc/people', fixture.adminToken, 'PATCH', {
        personId: "550e8400-e29b-41d4-a716-446655999999",
        isActive: 1,
      })
    )
    expect(response.status).toBe(404)
  })
})
