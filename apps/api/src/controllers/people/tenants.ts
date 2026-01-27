import { eq } from 'drizzle-orm'
import { emails, people, tenants, tenantHelpers, tenantPeopleFields, tenantPeopleFieldValues } from '@/db/schema'
import type { Database } from '@/db/connection'
import { notFound } from '@/lib/http-errors'
import { findHelperInTenant } from '@/db/queries'
import { getPersonWithStatus } from '@/controllers/people/index'

/**
 * Get all tenants for a person (primary + helper tenants)
 */
export async function myTenants(db: Database, personId: string) {
  // Get primary tenant
  const [primaryPerson] = await db
    .select({
      tenantId: people.tenantId,
      tenantName: tenants.name,
      planId: tenants.planId,
      createdAt: tenants.createdAt,
    })
    .from(people)
    .innerJoin(tenants, eq(people.tenantId, tenants.id))
    .where(eq(people.id, personId))
    .limit(1)

  // Get helper tenants
  const helperTenantsList = await db
    .select({
      tenantId: tenantHelpers.tenantId,
      tenantName: tenants.name,
      planId: tenants.planId,
      createdAt: tenants.createdAt,
    })
    .from(tenantHelpers)
    .innerJoin(tenants, eq(tenantHelpers.tenantId, tenants.id))
    .where(eq(tenantHelpers.personId, personId))

  const result = []

  if (primaryPerson) {
    result.push({ ...primaryPerson, isPrimary: true })
  }

  for (const helper of helperTenantsList) {
    result.push({ ...helper, isPrimary: false })
  }

  return result
}

/**
 * List all people in a tenant (primary members + helpers)
 */
export async function listTenantPeople(db: Database, tenantId: string) {
  // Get people whose primary tenant is this one
  const primaryPeopleRaw = await db
    .select({
      id: people.id,
      tenantId: people.tenantId,
      role: people.role,
      email: emails.email,
      createdAt: people.createdAt,
    })
    .from(people)
    .innerJoin(emails, eq(people.emailId, emails.id))
    .where(eq(people.tenantId, tenantId))

  // Get helpers in this tenant
  const helperPeopleRaw = await db
    .select({
      id: people.id,
      tenantId: people.tenantId,
      role: people.role,
      email: emails.email,
      createdAt: people.createdAt,
    })
    .from(tenantHelpers)
    .innerJoin(people, eq(tenantHelpers.personId, people.id))
    .innerJoin(emails, eq(people.emailId, emails.id))
    .where(eq(tenantHelpers.tenantId, tenantId))

  // Get all field values for these people
  const allPersonIds = [
    ...primaryPeopleRaw.map(p => p.id),
    ...helperPeopleRaw.map(p => p.id),
  ]

  const allFieldValues = allPersonIds.length > 0
    ? await db
        .select({
          personId: tenantPeopleFieldValues.personId,
          fieldName: tenantPeopleFields.name,
          value: tenantPeopleFieldValues.value,
        })
        .from(tenantPeopleFieldValues)
        .innerJoin(tenantPeopleFields, eq(tenantPeopleFieldValues.fieldId, tenantPeopleFields.id))
        .where(eq(tenantPeopleFields.tenantId, tenantId))
    : []

  // Group field values by person
  const fieldsByPerson = new Map<string, Record<string, string | null>>()
  for (const fv of allFieldValues) {
    if (!fieldsByPerson.has(fv.personId)) {
      fieldsByPerson.set(fv.personId, {})
    }
    fieldsByPerson.get(fv.personId)![fv.fieldName] = fv.value
  }

  const result = []

  for (const person of primaryPeopleRaw) {
    result.push({
      ...person,
      fields: fieldsByPerson.get(person.id) ?? {},
      isPrimary: true,
      isHelper: false,
    })
  }

  for (const person of helperPeopleRaw) {
    const existsAsPrimary = result.some(p => p.id === person.id)
    if (!existsAsPrimary) {
      result.push({
        ...person,
        fields: fieldsByPerson.get(person.id) ?? {},
        isPrimary: false,
        isHelper: true,
      })
    }
  }

  return result
}

/**
 * Get a specific person in a tenant (primary or helper)
 */
export async function getTenantPerson(db: Database, tenantId: string, personId: string) {
  const result = await getPersonWithStatus(db, personId)

  if (!result) {
    throw notFound('Person not found')
  }

  // Check if person belongs to this tenant (primary or helper)
  const isPrimary = result.tenantId === tenantId

  if (!isPrimary) {
    const helper = await findHelperInTenant(db, personId, tenantId)
    if (!helper) {
      throw notFound('Person not found in this tenant')
    }
  }

  return {
    ...result,
    isPrimary,
    isHelper: !isPrimary,
    isActive: result.isActive ? 1 : 0,
  }
}
