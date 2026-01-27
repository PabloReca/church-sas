import { randomUUID } from 'node:crypto'
import { getDb, type Database } from '@/db/connection'
import { generateJWT } from '@/lib/auth/jwt'
import { admins, emails, people, tenantPlans, tenantUsers, tenants } from '@/db/schema'
import { inArray } from 'drizzle-orm'

const uniqueNumericIds = (ids: number[]) => Array.from(new Set(ids))
const uniqueStringIds = (ids: string[]) => Array.from(new Set(ids))

export interface TenantFixture {
  db: Database
  runId: string
  planId: number
  tenantId: string
  ownerPersonId: string
  ownerEmail: string
  adminId: number
  ownerToken: string
  adminToken: string
  cleanup: () => Promise<void>
}

export async function createTenantFixture(label = 'test'): Promise<TenantFixture> {
  const db = getDb()
  const runId = randomUUID()
  const makeEmail = (suffix: string) => `${label}-${suffix}-${runId}@test.com`

  const [plan] = await db.insert(tenantPlans).values({
    name: `${label} Plan ${runId}`,
    price: '0',
    currency: 'USD',
    maxSeats: 5,
    maxPeople: 50,
  }).returning()
  if (!plan) throw new Error('Failed to create plan')

  const [tenant] = await db.insert(tenants).values({
    name: `${label} Tenant ${runId}`,
    planId: plan.id,
  }).returning()
  if (!tenant) throw new Error('Failed to create tenant')

  const [ownerEmailRow] = await db.insert(emails).values({
    email: makeEmail('owner'),
  }).returning()
  if (!ownerEmailRow) throw new Error('Failed to create owner email')

  const [ownerPerson] = await db.insert(people).values({
    tenantId: tenant.id,
    emailId: ownerEmailRow.id,
    role: 'owner',
  }).returning()
  if (!ownerPerson) throw new Error('Failed to create owner person')

  await db.insert(tenantUsers).values({ personId: ownerPerson.id })

  const [adminEmailRow] = await db.insert(emails).values({
    email: makeEmail('admin'),
  }).returning()
  if (!adminEmailRow) throw new Error('Failed to create admin email')

  const [admin] = await db.insert(admins).values({
    emailId: adminEmailRow.id,
    name: 'Test',
    lastname: 'Admin',
  }).returning()
  if (!admin) throw new Error('Failed to create admin')

  const ownerToken = await generateJWT({
    userId: ownerPerson.id,
    email: ownerEmailRow.email,
    name: 'Owner',
    tenantId: tenant.id,
    isAdmin: false,
    isTenantAdmin: true,
  })

  const adminToken = await generateJWT({
    userId: ownerPerson.id, // admins use a dummy userId for JWT
    email: adminEmailRow.email,
    name: 'Admin',
    tenantId: '00000000-0000-0000-0000-000000000000', // Platform admin has no tenant
    isAdmin: true,
    isTenantAdmin: false,
  })

  const cleanup = async () => {
    const adminIds = uniqueNumericIds([admin.id])
    if (adminIds.length > 0) {
      await db.delete(admins).where(inArray(admins.id, adminIds))
    }

    const tenantIds = uniqueStringIds([tenant.id])
    if (tenantIds.length > 0) {
      await db.delete(tenants).where(inArray(tenants.id, tenantIds))
    }

    const planIds = uniqueNumericIds([plan.id])
    if (planIds.length > 0) {
      await db.delete(tenantPlans).where(inArray(tenantPlans.id, planIds))
    }

    const emailIds = uniqueStringIds([ownerEmailRow.id, adminEmailRow.id])
    if (emailIds.length > 0) {
      await db.delete(emails).where(inArray(emails.id, emailIds))
    }
  }

  return {
    db,
    runId,
    planId: plan.id,
    tenantId: tenant.id,
    ownerPersonId: ownerPerson.id,
    ownerEmail: ownerEmailRow.email,
    adminId: admin.id,
    ownerToken,
    adminToken,
    cleanup,
  }
}
