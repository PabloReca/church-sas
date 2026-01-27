import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { adminRoutes } from '@/routes/platform/admin'
import { createTenantFixture, type TenantFixture } from '../../../tests/fixtures/tenant'
import { makeJsonRequest, readJson } from '../../../tests/http'
import { emails } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

describe('admin routes', () => {
  let fixture: TenantFixture
  const createdEmailIds: string[] = []

  beforeAll(async () => {
    fixture = await createTenantFixture('admin')
  })

  afterAll(async () => {
    if (createdEmailIds.length > 0) {
      await fixture.db.delete(emails).where(inArray(emails.id, createdEmailIds))
    }
    await fixture.cleanup()
  })

  test('lists admins for platform admin', async () => {
    const response = await adminRoutes.handle(
      makeJsonRequest('/rpc/admin', fixture.adminToken)
    )
    expect(response.status).toBe(200)
    const admins = await readJson<Array<{ id: number }>>(response)
    expect(admins.some((admin) => admin.id === fixture.adminId)).toBe(true)
  })

  test('adds and removes admins with expected failures', async () => {
    const newEmail = `route-admin-${fixture.runId}@test.com`
    const createResponse = await adminRoutes.handle(
      makeJsonRequest('/rpc/admin', fixture.adminToken, 'POST', {
        email: newEmail,
        name: 'Route',
        lastname: 'Admin',
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: string; email: string }>(createResponse)

    const emailRecord = await fixture.db
      .select()
      .from(emails)
      .where(eq(emails.email, newEmail))
      .limit(1)
    if (emailRecord[0]) {
      createdEmailIds.push(emailRecord[0].id)
    }

    const duplicateResponse = await adminRoutes.handle(
      makeJsonRequest('/rpc/admin', fixture.adminToken, 'POST', {
        email: newEmail,
        name: 'Route',
        lastname: 'Admin',
      })
    )
    expect(duplicateResponse.status).toBe(409)

    const deleteResponse = await adminRoutes.handle(
      makeJsonRequest('/rpc/admin', fixture.adminToken, 'DELETE', { id: created.id })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)

    const deleteMissing = await adminRoutes.handle(
      makeJsonRequest('/rpc/admin', fixture.adminToken, 'DELETE', { id: created.id })
    )
    expect(deleteMissing.status).toBe(404)
  })
})
