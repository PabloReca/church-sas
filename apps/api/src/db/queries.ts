/**
 * Common database query helpers to reduce repetition and improve DRY
 */
import { eq, and } from 'drizzle-orm'
import { emails, people, tenantHelpers, tenantUsers, tenantPlans, tenants } from '@/db/schema'
import type { Database, DatabaseTransaction } from '@/db/connection'

type DbOrTx = Database | DatabaseTransaction

// =============================================================================
// Email queries
// =============================================================================

export async function findEmailByAddress(db: DbOrTx, email: string) {
  const [result] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, email.toLowerCase()))
    .limit(1)
  return result ?? null
}

export async function findEmailById(db: DbOrTx, emailId: string) {
  const [result] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, emailId))
    .limit(1)
  return result ?? null
}

// =============================================================================
// Person queries
// =============================================================================

export async function findPersonById(db: DbOrTx, personId: string) {
  const [result] = await db
    .select()
    .from(people)
    .where(eq(people.id, personId))
    .limit(1)
  return result ?? null
}

export async function findPersonInTenant(db: DbOrTx, personId: string, tenantId: string) {
  const [result] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

export async function findPersonByEmailId(db: DbOrTx, emailId: string) {
  const [result] = await db
    .select()
    .from(people)
    .where(eq(people.emailId, emailId))
    .limit(1)
  return result ?? null
}

// =============================================================================
// Tenant helper queries
// =============================================================================

export async function findHelperInTenant(db: DbOrTx, personId: string, tenantId: string) {
  const [result] = await db
    .select()
    .from(tenantHelpers)
    .where(and(eq(tenantHelpers.personId, personId), eq(tenantHelpers.tenantId, tenantId)))
    .limit(1)
  return result ?? null
}

export async function isHelperInTenant(db: DbOrTx, personId: string, tenantId: string): Promise<boolean> {
  const helper = await findHelperInTenant(db, personId, tenantId)
  return helper !== null
}

// =============================================================================
// Tenant user (active login) queries
// =============================================================================

export async function findTenantUser(db: DbOrTx, personId: string) {
  const [result] = await db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.personId, personId))
    .limit(1)
  return result ?? null
}

export async function isActiveTenantUser(db: DbOrTx, personId: string): Promise<boolean> {
  const user = await findTenantUser(db, personId)
  return user !== null
}

// =============================================================================
// Tenant queries
// =============================================================================

export async function findTenantById(db: DbOrTx, tenantId: string) {
  const [result] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)
  return result ?? null
}

export async function findTenantOwner(db: DbOrTx, tenantId: string) {
  const [result] = await db
    .select()
    .from(people)
    .where(and(eq(people.tenantId, tenantId), eq(people.role, 'owner')))
    .limit(1)
  return result ?? null
}

// =============================================================================
// Plan queries
// =============================================================================

export async function findDefaultPlan(db: DbOrTx) {
  const [result] = await db.select().from(tenantPlans).limit(1)
  return result ?? null
}

export async function findTenantWithPlan(db: DbOrTx, tenantId: string) {
  const [result] = await db
    .select({
      tenant: tenants,
      maxSeats: tenantPlans.maxSeats,
    })
    .from(tenants)
    .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
    .where(eq(tenants.id, tenantId))
    .limit(1)
  return result ?? null
}

// =============================================================================
// Access check helpers (composite queries)
// =============================================================================

/**
 * Check if a person has access to a tenant (either as primary member or helper)
 */
export async function hasAccessToTenant(
  db: DbOrTx,
  personId: string,
  tenantId: string
): Promise<boolean> {
  // Check primary tenant
  const person = await findPersonInTenant(db, personId, tenantId)
  if (person) return true

  // Check helper access
  return isHelperInTenant(db, personId, tenantId)
}

/**
 * Check if a person is a manager (owner or admin) of a tenant
 */
export async function isTenantManager(
  db: DbOrTx,
  personId: string,
  tenantId: string
): Promise<boolean> {
  const person = await findPersonInTenant(db, personId, tenantId)
  if (!person) return false
  return person.role === 'owner' || person.role === 'admin'
}
