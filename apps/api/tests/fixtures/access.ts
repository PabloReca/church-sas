import { generateJWT } from '@/lib/auth/jwt'
import { emails, people, tenantHelpers, tenants } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { createTenantFixture, type TenantFixture } from './tenant'

export interface AccessFixture extends TenantFixture {
  secondaryTenantId: string
  memberPersonId: string
  memberToken: string
  helperPersonId: string
  helperToken: string
  outsiderPersonId: string
  outsiderToken: string
}

export async function createAccessFixture(label = 'access'): Promise<AccessFixture> {
  const base = await createTenantFixture(label)
  const { db, runId } = base
  const makeEmail = (suffix: string) => `${label}-${suffix}-${runId}@test.com`

  const [secondaryTenant] = await db.insert(tenants).values({
    name: `${label} Tenant B ${runId}`,
    planId: base.planId,
  }).returning()
  if (!secondaryTenant) throw new Error('Failed to create secondary tenant')

  const [memberEmail] = await db.insert(emails).values({
    email: makeEmail('member'),
  }).returning()
  if (!memberEmail) throw new Error('Failed to create member email')

  const [memberPerson] = await db.insert(people).values({
    tenantId: base.tenantId,
    emailId: memberEmail.id,
    role: null,
  }).returning()
  if (!memberPerson) throw new Error('Failed to create member person')

  const [helperEmail] = await db.insert(emails).values({
    email: makeEmail('helper'),
  }).returning()
  if (!helperEmail) throw new Error('Failed to create helper email')

  const [helperPerson] = await db.insert(people).values({
    tenantId: base.tenantId,
    emailId: helperEmail.id,
    role: null,
  }).returning()
  if (!helperPerson) throw new Error('Failed to create helper person')

  await db.insert(tenantHelpers).values({
    tenantId: secondaryTenant.id,
    personId: helperPerson.id,
  })

  const [outsiderEmail] = await db.insert(emails).values({
    email: makeEmail('outsider'),
  }).returning()
  if (!outsiderEmail) throw new Error('Failed to create outsider email')

  const [outsiderPerson] = await db.insert(people).values({
    tenantId: secondaryTenant.id,
    emailId: outsiderEmail.id,
    role: null,
  }).returning()
  if (!outsiderPerson) throw new Error('Failed to create outsider person')

  const memberToken = await generateJWT({
    userId: memberPerson.id,
    email: memberEmail.email,
    name: 'Member',
    tenantId: base.tenantId,
    isAdmin: false,
    isTenantAdmin: false,
  })

  const helperToken = await generateJWT({
    userId: helperPerson.id,
    email: helperEmail.email,
    name: 'Helper',
    tenantId: base.tenantId,
    isAdmin: false,
    isTenantAdmin: false,
  })

  const outsiderToken = await generateJWT({
    userId: outsiderPerson.id,
    email: outsiderEmail.email,
    name: 'Outsider',
    tenantId: secondaryTenant.id,
    isAdmin: false,
    isTenantAdmin: false,
  })

  const cleanup = async () => {
    await db.delete(tenants).where(inArray(tenants.id, [secondaryTenant.id]))
    await base.cleanup()
    await db.delete(emails).where(inArray(emails.id, [
      memberEmail.id,
      helperEmail.id,
      outsiderEmail.id,
    ]))
  }

  return {
    ...base,
    secondaryTenantId: secondaryTenant.id,
    memberPersonId: memberPerson.id,
    memberToken,
    helperPersonId: helperPerson.id,
    helperToken,
    outsiderPersonId: outsiderPerson.id,
    outsiderToken,
    cleanup,
  }
}
