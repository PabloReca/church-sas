import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { tenantsRoutes } from '@/routes/tenants'
import { createTenantFixture, type TenantFixture } from '../../../tests/fixtures/tenant'
import { makeJsonRequest, readJson } from '../../../tests/http'
import { emails, tenants } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

describe('tenants routes', () => {
  let fixture: TenantFixture
  const createdTenantIds: string[] = []
  const createdEmailIds: string[] = []

  beforeAll(async () => {
    fixture = await createTenantFixture('tenants')
  })

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await fixture.db.delete(tenants).where(inArray(tenants.id, createdTenantIds))
    }

    if (createdEmailIds.length > 0) {
      await fixture.db.delete(emails).where(inArray(emails.id, createdEmailIds))
    }

    await fixture.cleanup()
  })

  test('lists tenants and returns people count', async () => {
    const listResponse = await tenantsRoutes.handle(
      makeJsonRequest('/rpc/tenants/list', fixture.adminToken)
    )
    expect(listResponse.status).toBe(200)
    const listData = await readJson<Array<{ id: string }>>(listResponse)
    expect(listData.some((tenant) => tenant.id === fixture.tenantId)).toBe(true)

    const peopleCountResponse = await tenantsRoutes.handle(
      makeJsonRequest(`/rpc/tenants/${fixture.tenantId}/people-count`, fixture.adminToken)
    )
    expect(peopleCountResponse.status).toBe(200)
    const peopleCount = await readJson<{ tenantUsers: number }>(peopleCountResponse)
    expect(peopleCount.tenantUsers).toBe(1)

    const tenantResponse = await tenantsRoutes.handle(
      makeJsonRequest(`/rpc/tenants/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(tenantResponse.status).toBe(200)
    const tenantData = await readJson<{ id: string } | null>(tenantResponse)
    expect(tenantData?.id).toBe(fixture.tenantId)
  })

  test('creates, updates, and deletes tenants', async () => {
    const adminEmail = `owner-${fixture.runId}@test.com`
    const createResponse = await tenantsRoutes.handle(
      makeJsonRequest('/rpc/tenants', fixture.adminToken, 'POST', {
        name: `Tenant ${fixture.runId}`,
        planId: fixture.planId,
        adminEmail,
        adminName: 'Owner Name',
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: string; name: string }>(createResponse)
    createdTenantIds.push(created.id)

    const emailRecord = await fixture.db
      .select()
      .from(emails)
      .where(eq(emails.email, adminEmail))
      .limit(1)
    if (emailRecord[0]) {
      createdEmailIds.push(emailRecord[0].id)
    }

    const updateResponse = await tenantsRoutes.handle(
      makeJsonRequest('/rpc/tenants', fixture.adminToken, 'PATCH', {
        id: created.id,
        name: `Tenant Updated ${fixture.runId}`,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ name: string }>(updateResponse)
    expect(updated.name).toContain('Updated')

    const deleteResponse = await tenantsRoutes.handle(
      makeJsonRequest('/rpc/tenants', fixture.adminToken, 'DELETE', { id: created.id })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)
  })

  test('returns expected errors on invalid updates and deletes', async () => {
    const updateResponse = await tenantsRoutes.handle(
      makeJsonRequest('/rpc/tenants', fixture.adminToken, 'PATCH', {
        id: fixture.tenantId,
      })
    )
    expect(updateResponse.status).toBe(400)

    const missingId = "550e8400-e29b-41d4-a716-446655999999"
    const deleteResponse = await tenantsRoutes.handle(
      makeJsonRequest('/rpc/tenants', fixture.adminToken, 'DELETE', { id: missingId })
    )
    expect(deleteResponse.status).toBe(404)
  })
})
