import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { peopleTenantsRoutes } from '@/routes/people/tenants'
import { createAccessFixture, type AccessFixture } from '../../../tests/fixtures/access'
import { makeJsonRequest, readJson } from '../../../tests/http'

describe('people tenants routes', () => {
  let fixture: AccessFixture

  beforeAll(async () => {
    fixture = await createAccessFixture('people-tenants')
  })

  afterAll(async () => {
    await fixture.cleanup()
  })

  test('lists current tenants and people', async () => {
    const myTenantsResponse = await peopleTenantsRoutes.handle(
      makeJsonRequest('/rpc/people-tenants/my-tenants', fixture.ownerToken)
    )
    expect(myTenantsResponse.status).toBe(200)
    const myTenants = await readJson<Array<{ tenantId: string }>>(myTenantsResponse)
    expect(myTenants.some((tenant) => tenant.tenantId === fixture.tenantId)).toBe(true)

    const listResponse = await peopleTenantsRoutes.handle(
      makeJsonRequest(`/rpc/people-tenants/list/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const peopleList = await readJson<Array<{ id: string }>>(listResponse)
    expect(peopleList.some((person) => person.id === fixture.ownerPersonId)).toBe(true)
  })
})
