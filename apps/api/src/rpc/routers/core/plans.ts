import { eq } from "drizzle-orm";
import { adminProcedure, ORPCError } from "@/rpc/orpc";
import { tenantPlans } from "@/db/schema";
import {
  createPlanInput,
  updatePlanInput,
  planIdInput,
} from "@/db/schemas-zod";

export const plansRouter = {
  listPlans: adminProcedure
    .route({ method: "GET", tags: ["Plans"], summary: "List all plans" })
    .handler(async ({ context }) => {
      return await context.db.select().from(tenantPlans);
    }),

  createPlan: adminProcedure
    .route({ method: "POST", tags: ["Plans"], summary: "Create a plan" })
    .input(createPlanInput)
    .handler(async ({ context, input }) => {
      const [result] = await context.db
        .insert(tenantPlans)
        .values({
          name: input.name,
          price: input.price,
          maxSeats: input.maxSeats,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create plan" });
      }

      return result;
    }),

  updatePlan: adminProcedure
    .route({ method: "PATCH", tags: ["Plans"], summary: "Update a plan" })
    .input(updatePlanInput)
    .handler(async ({ context, input }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.price !== undefined) updates.price = input.price;
      if (input.maxSeats !== undefined) updates.maxSeats = input.maxSeats;

      const [result] = await context.db
        .update(tenantPlans)
        .set(updates)
        .where(eq(tenantPlans.id, input.id))
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Plan not found" });
      }

      return result;
    }),

  deletePlan: adminProcedure
    .route({ method: "DELETE", tags: ["Plans"], summary: "Delete a plan" })
    .input(planIdInput)
    .handler(async ({ context, input }) => {
      const [deleted] = await context.db
        .delete(tenantPlans)
        .where(eq(tenantPlans.id, input.id))
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Plan not found" });
      }

      return { success: true };
    }),
};
