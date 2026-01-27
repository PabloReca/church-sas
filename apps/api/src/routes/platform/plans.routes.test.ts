import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { plansRoutes } from '@/routes/platform/plans'
import { createTenantFixture, type TenantFixture } from '../../../tests/fixtures/tenant'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('plans routes', () => {
  let fixture: TenantFixture

  beforeAll(async () => {
    fixture = await createTenantFixture('plans')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('lists plans for admin', async () => {
    const response = await plansRoutes.handle(
      makeJsonRequest('/rpc/plans', fixture.adminToken)
    )
    expect(response.status).toBe(200)
    const plans = await readJson<Array<{ id: number }>>(response)
    expect(plans.some((plan) => plan.id === fixture.planId)).toBe(true)
  })

  test('creates, updates, and deletes a plan', async () => {
    const createResponse = await plansRoutes.handle(
      makeJsonRequest('/rpc/plans', fixture.adminToken, 'POST', {
        name: `Pro ${fixture.runId}`,
        price: 12,
        currency: 'USD',
        maxSeats: 7,
      })
    )
    expect(createResponse.status).toBe(200)
    const created = await readJson<{ id: number; name: string }>(createResponse)

    const updateResponse = await plansRoutes.handle(
      makeJsonRequest('/rpc/plans', fixture.adminToken, 'PATCH', {
        id: created.id,
        name: `Pro Plus ${fixture.runId}`,
        maxSeats: 9,
      })
    )
    expect(updateResponse.status).toBe(200)
    const updated = await readJson<{ name: string; maxSeats: number }>(updateResponse)
    expect(updated.name).toContain('Pro Plus')
    expect(updated.maxSeats).toBe(9)

    const deleteResponse = await plansRoutes.handle(
      makeJsonRequest('/rpc/plans', fixture.adminToken, 'DELETE', { id: created.id })
    )
    expect(deleteResponse.status).toBe(200)
    const deleted = await readJson<{ success: boolean }>(deleteResponse)
    expect(deleted.success).toBe(true)
  })

  test('returns errors for missing plan ids', async () => {
    const missingId = 999999

    const updateResponse = await plansRoutes.handle(
      makeJsonRequest('/rpc/plans', fixture.adminToken, 'PATCH', {
        id: missingId,
        name: 'Missing',
      })
    )
    expect(updateResponse.status).toBe(404)

    const deleteResponse = await plansRoutes.handle(
      makeJsonRequest('/rpc/plans', fixture.adminToken, 'DELETE', { id: missingId })
    )
    expect(deleteResponse.status).toBe(404)
  })
})
