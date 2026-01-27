import { eq } from 'drizzle-orm'
import { tenantPlans } from '@/db/schema'
import type { Database } from '@/db/connection'
import { z } from "@church/shared"
import { createPlanInput, updatePlanInput, planIdInput } from '@church/shared'
import { internalError, notFound } from '@/lib/http-errors'

export type CreatePlanInput = z.infer<typeof createPlanInput>
export type UpdatePlanInput = z.infer<typeof updatePlanInput>
export type PlanIdInput = z.infer<typeof planIdInput>

/**
 * List all plans
 */
export async function listPlans(db: Database) {
  return await db.select().from(tenantPlans)
}

/**
 * Create a new plan
 */
export async function createPlan(db: Database, input: CreatePlanInput) {
  const [result] = await db
    .insert(tenantPlans)
    .values({
      name: input.name,
      price: input.price.toFixed(2), // Convert number to string with 2 decimals
      currency: input.currency || 'USD',
      maxSeats: input.maxSeats,
    })
    .returning()

  if (!result) {
    throw internalError('Failed to create plan')
  }

  return result
}

/**
 * Update an existing plan
 */
export async function updatePlan(db: Database, input: UpdatePlanInput) {
  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) updates.name = input.name
  if (input.price !== undefined) updates.price = input.price.toFixed(2)
  if (input.currency !== undefined) updates.currency = input.currency
  if (input.maxSeats !== undefined) updates.maxSeats = input.maxSeats

  const [result] = await db
    .update(tenantPlans)
    .set(updates)
    .where(eq(tenantPlans.id, input.id))
    .returning()

  if (!result) {
    throw notFound('Plan not found')
  }

  return result
}

/**
 * Delete a plan
 */
export async function deletePlan(db: Database, input: PlanIdInput) {
  const [deleted] = await db
    .delete(tenantPlans)
    .where(eq(tenantPlans.id, input.id))
    .returning()

  if (!deleted) {
    throw notFound('Plan not found')
  }

  return { success: true }
}
