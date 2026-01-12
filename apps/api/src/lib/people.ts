import { emails, people, tenantUsers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { getDb } from '@/db/connection'

type DB = ReturnType<typeof getDb>

/**
 * Find person by email and tenant
 * @param db Database connection
 * @param email Email address
 * @param tenantId Tenant ID
 * @returns Person or null
 */
export async function findPersonByEmailAndTenant(
  db: DB,
  email: string,
  tenantId: number
) {
  const normalizedEmail = email.toLowerCase()

  // First find the email record
  const [emailRecord] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (!emailRecord) {
    return null
  }

  const [person] = await db
    .select()
    .from(people)
    .where(
      and(
        eq(people.emailId, emailRecord.id),
        eq(people.tenantId, tenantId)
      )
    )
    .limit(1)

  return person || null
}

/**
 * Find person by ID
 * @param db Database connection
 * @param id Person ID
 * @returns Person or null
 */
export async function findPersonById(db: DB, id: number) {
  const [person] = await db
    .select()
    .from(people)
    .where(eq(people.id, id))
    .limit(1)

  return person || null
}

/**
 * Create a new person (minimal - just email link)
 * Field values should be set separately via tenantPeopleFieldValues
 * @param db Database connection
 * @param data Person data
 * @returns Created person
 */
export async function createPerson(
  db: DB,
  data: {
    tenantId: number
    email: string
    isActive?: boolean
  }
) {
  const normalizedEmail = data.email.toLowerCase()

  // Check if email already exists
  let [emailRecord] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (emailRecord) {
    throw new Error('Email already in use')
  }

  // Create email record
  [emailRecord] = await db
    .insert(emails)
    .values({ email: normalizedEmail })
    .returning()

  const [person] = await db
    .insert(people)
    .values({
      tenantId: data.tenantId,
      emailId: emailRecord!.id,
    })
    .returning()

  // If isActive is true (default for login), add to active_seats table
  if (data.isActive) {
    await db.insert(tenantUsers).values({
      personId: person!.id,
    })
  }

  return person!
}
