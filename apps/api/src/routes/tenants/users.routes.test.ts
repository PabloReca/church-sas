import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { tenantUsersRoutes } from '@/routes/tenants/users'
import { createTenantFixture, type TenantFixture } from '../../../tests/fixtures/tenant'
import { makeJsonRequest, readJson } from '../../../tests/http'
import { emails, people, tenants } from '@/db/schema'
import { inArray } from 'drizzle-orm'

describe('tenant users routes', () => {
  let fixture: TenantFixture
  let memberPersonId: string
  let helperPersonId: string
  const createdEmailIds: string[] = []
  const createdTenantIds: string[] = []

  beforeAll(async () => {
    fixture = await createTenantFixture('tenant-users')

    const [memberEmail] = await fixture.db
      .insert(emails)
      .values({ email: `member-${fixture.runId}@test.com` })
      .returning()
    if (!memberEmail) throw new Error('Failed to create member email')
    createdEmailIds.push(memberEmail.id)

    const [memberPerson] = await fixture.db
      .insert(people)
      .values({
        tenantId: fixture.tenantId,
        emailId: memberEmail.id,
        role: null,
      })
      .returning()
    if (!memberPerson) throw new Error('Failed to create member person')
    memberPersonId = memberPerson.id

    const [helperTenant] = await fixture.db
      .insert(tenants)
      .values({
        name: `Helper Tenant ${fixture.runId}`,
        planId: fixture.planId,
      })
      .returning()
    if (!helperTenant) throw new Error('Failed to create helper tenant')
    createdTenantIds.push(helperTenant.id)

    const [helperEmail] = await fixture.db
      .insert(emails)
      .values({ email: `helper-${fixture.runId}@test.com` })
      .returning()
    if (!helperEmail) throw new Error('Failed to create helper email')
    createdEmailIds.push(helperEmail.id)

    const [helperPerson] = await fixture.db
      .insert(people)
      .values({
        tenantId: helperTenant.id,
        emailId: helperEmail.id,
        role: null,
      })
      .returning()
    if (!helperPerson) throw new Error('Failed to create helper person')
    helperPersonId = helperPerson.id
  })

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await fixture.db.delete(tenants).where(inArray(tenants.id, createdTenantIds))
    }

    await fixture.cleanup()

    if (createdEmailIds.length > 0) {
      await fixture.db.delete(emails).where(inArray(emails.id, createdEmailIds))
    }
  })

  test('counts tenant users', async () => {
    const response = await tenantUsersRoutes.handle(
      makeJsonRequest(`/rpc/tenant-users/count/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(response.status).toBe(200)
    const data = await readJson<{ tenantUsers: number }>(response)
    expect(data.tenantUsers).toBe(1)
  })

  test('sets and reads person roles with expected errors', async () => {
    const setResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users/person-role', fixture.adminToken, 'POST', {
        personId: memberPersonId,
        role: 'admin',
      })
    )
    expect(setResponse.status).toBe(200)
    const updated = await readJson<{ role: string | null }>(setResponse)
    expect(updated.role).toBe('admin')

    const getResponse = await tenantUsersRoutes.handle(
      makeJsonRequest(`/rpc/tenant-users/person-role/${memberPersonId}`, fixture.ownerToken)
    )
    expect(getResponse.status).toBe(200)
    const roleData = await readJson<{ role: string | null }>(getResponse)
    expect(roleData.role).toBe('admin')

    const ownerResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users/person-role', fixture.adminToken, 'POST', {
        personId: memberPersonId,
        role: 'owner',
      })
    )
    expect(ownerResponse.status).toBe(409)
  })

  test('manages helpers with expected failures', async () => {
    const invalidHelperResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users/helpers', fixture.adminToken, 'POST', {
        tenantId: fixture.tenantId,
        personId: fixture.ownerPersonId,
      })
    )
    expect(invalidHelperResponse.status).toBe(400)

    const addResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users/helpers', fixture.adminToken, 'POST', {
        tenantId: fixture.tenantId,
        personId: helperPersonId,
      })
    )
    expect(addResponse.status).toBe(200)

    const listResponse = await tenantUsersRoutes.handle(
      makeJsonRequest(`/rpc/tenant-users/helpers/${fixture.tenantId}`, fixture.ownerToken)
    )
    expect(listResponse.status).toBe(200)
    const helpers = await readJson<Array<{ personId: string }>>(listResponse)
    expect(helpers.some((helper) => helper.personId === helperPersonId)).toBe(true)

    const removeResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users/helpers', fixture.adminToken, 'DELETE', {
        tenantId: fixture.tenantId,
        personId: helperPersonId,
      })
    )
    expect(removeResponse.status).toBe(200)
    const removed = await readJson<{ success: boolean }>(removeResponse)
    expect(removed.success).toBe(true)

    const removeMissing = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users/helpers', fixture.adminToken, 'DELETE', {
        tenantId: fixture.tenantId,
        personId: helperPersonId,
      })
    )
    expect(removeMissing.status).toBe(404)
  })

  test('adds and removes tenant users with expected failures', async () => {
    const addResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users', fixture.adminToken, 'POST', {
        personId: memberPersonId,
      })
    )
    expect(addResponse.status).toBe(200)

    const duplicateResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users', fixture.adminToken, 'POST', {
        personId: memberPersonId,
      })
    )
    expect(duplicateResponse.status).toBe(409)

    const removeResponse = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users', fixture.adminToken, 'DELETE', {
        personId: memberPersonId,
      })
    )
    expect(removeResponse.status).toBe(200)
    const removed = await readJson<{ success: boolean }>(removeResponse)
    expect(removed.success).toBe(true)

    const removeMissing = await tenantUsersRoutes.handle(
      makeJsonRequest('/rpc/tenant-users', fixture.adminToken, 'DELETE', {
        personId: memberPersonId,
      })
    )
    expect(removeMissing.status).toBe(404)
  })
})
