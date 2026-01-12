import { eq } from 'drizzle-orm'
import { people } from '@/db/schema'
import type { getDb } from '@/db/connection'

type DB = ReturnType<typeof getDb>

export async function canDeletePerson(db: DB, personId: number): Promise<{ canDelete: boolean; reason?: string }> {
  // Check if person is a tenant owner
  const [person] = await db
    .select()
    .from(people)
    .where(eq(people.id, personId))
    .limit(1)

  if (person?.role === 'owner') {
    return {
      canDelete: false,
      reason: 'Cannot delete account. You are the tenant owner. Transfer owner role first.',
    }
  }

  return { canDelete: true }
}

export async function requireCanDeletePerson(db: DB, personId: number): Promise<void> {
  const { canDelete, reason } = await canDeletePerson(db, personId)

  if (!canDelete) {
    throw new Error(reason)
  }
}
