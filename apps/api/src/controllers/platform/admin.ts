import { eq } from 'drizzle-orm'
import { emails, admins } from '@/db/schema'
import type { Database, DatabaseTransaction } from '@/db/connection'
import { z } from "@church/shared"
import { addAdminInput, removeAdminInput } from '@church/shared'
import { conflict, internalError, notFound } from '@/lib/http-errors'

export type AddAdminInput = z.infer<typeof addAdminInput>
export type RemoveAdminInput = z.infer<typeof removeAdminInput>

/**
 * List all global administrators
 */
export async function listAdmins(db: Database) {
  const result = await db
    .select({
      id: admins.id,
      email: emails.email,
      name: admins.name,
      lastname: admins.lastname,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt,
    })
    .from(admins)
    .innerJoin(emails, eq(admins.emailId, emails.id))

  return result
}

/**
 * Add a global administrator
 */
export async function addAdmin(db: Database, input: AddAdminInput) {
  const normalizedEmail = input.email.toLowerCase()

  // Check if email already exists
  const [existingEmail] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1)

  if (existingEmail) {
    // Check if already an admin
    const [existingAdmin] = await db
      .select()
      .from(admins)
      .where(eq(admins.emailId, existingEmail.id))
      .limit(1)

    if (existingAdmin) {
      throw conflict('Email is already a global administrator')
    }

    // Email exists but not as admin - use existing email record
    const [result] = await db
      .insert(admins)
      .values({
        emailId: existingEmail.id,
        name: input.name,
        lastname: input.lastname,
      })
      .returning()

    return {
      ...result,
      email: normalizedEmail,
    }
  }

  // Create new email record and admin in transaction
  const result = await db.transaction(async (tx: DatabaseTransaction) => {
    const [newEmail] = await tx
      .insert(emails)
      .values({ email: normalizedEmail })
      .returning()

    if (!newEmail) {
      throw internalError('Failed to create email record')
    }

    const [admin] = await tx
      .insert(admins)
      .values({
        emailId: newEmail.id,
        name: input.name,
        lastname: input.lastname,
      })
      .returning()

    if (!admin) {
      throw internalError('Failed to create admin')
    }

    return admin
  })

  return {
    ...result,
    email: normalizedEmail,
  }
}

/**
 * Remove a global administrator
 */
export async function removeAdmin(db: Database, input: RemoveAdminInput) {
  const [deleted] = await db
    .delete(admins)
    .where(eq(admins.id, input.id))
    .returning()

  if (!deleted) {
    throw notFound('Administrator not found')
  }

  return { success: true }
}
