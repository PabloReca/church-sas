import { eq, count, and } from "drizzle-orm";
import { protectedProcedure, adminProcedure, ORPCError } from "@/rpc/orpc";
import { tenants, people, tenantHelpers, tenantPlans, tenantUsers } from "@/db/schema";
import {
  setPersonRoleInput,
  getPersonRoleInput,
  addHelperInput,
  removeHelperInput,
  listHelpersInput,
  addTenantUserInput,
  removeTenantUserInput,
  countTenantUsersInput,
} from "@/db/schemas-zod";

export const tenantUsersRouter = {
  // Person Roles (set directly on people table)
  setPersonRole: adminProcedure
    .route({ method: "POST", tags: ["Access Management"], summary: "Set person's role (owner/admin/null)" })
    .input(setPersonRoleInput)
    .handler(async ({ context, input }) => {
      // Get current person
      const [person] = await context.db
        .select()
        .from(people)
        .where(eq(people.id, input.personId))
        .limit(1);

      if (!person) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found" });
      }

      // If setting to owner, check there isn't already an owner in this tenant
      if (input.role === "owner") {
        const [existingOwner] = await context.db
          .select()
          .from(people)
          .where(and(
            eq(people.tenantId, person.tenantId),
            eq(people.role, "owner")
          ))
          .limit(1);

        if (existingOwner && existingOwner.id !== input.personId) {
          throw new ORPCError("CONFLICT", { message: "Tenant already has an owner" });
        }
      }

      // Cannot remove owner role (must transfer first)
      if (person.role === "owner" && input.role !== "owner") {
        throw new ORPCError("BAD_REQUEST", { message: "Cannot remove owner role. Transfer ownership first." });
      }

      const [result] = await context.db
        .update(people)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(people.id, input.personId))
        .returning();

      return result;
    }),

  getPersonRole: protectedProcedure
    .route({ method: "GET", tags: ["Access Management"], summary: "Get person's role (owner/admin/null)" })
    .input(getPersonRoleInput)
    .handler(async ({ context, input }) => {
      const [person] = await context.db
        .select({ role: people.role })
        .from(people)
        .where(eq(people.id, input.personId))
        .limit(1);

      return { role: person?.role ?? null };
    }),

  // Helpers
  addHelper: adminProcedure
    .route({ method: "POST", tags: ["Access Management"], summary: "Add a person as helper to a tenant" })
    .input(addHelperInput)
    .handler(async ({ context, input }) => {
      // Check if person exists
      const [person] = await context.db
        .select()
        .from(people)
        .where(eq(people.id, input.personId))
        .limit(1);

      if (!person) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found" });
      }

      // Person cannot be helper of their own tenant
      if (person.tenantId === input.tenantId) {
        throw new ORPCError("BAD_REQUEST", { message: "Person cannot be a helper in their own tenant" });
      }

      const [result] = await context.db
        .insert(tenantHelpers)
        .values({
          tenantId: input.tenantId,
          personId: input.personId,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        throw new ORPCError("CONFLICT", { message: "Person is already a helper for this tenant" });
      }

      return result;
    }),

  removeHelper: adminProcedure
    .route({ method: "DELETE", tags: ["Access Management"], summary: "Remove a helper from a tenant" })
    .input(removeHelperInput)
    .handler(async ({ context, input }) => {
      const [deleted] = await context.db
        .delete(tenantHelpers)
        .where(and(
          eq(tenantHelpers.tenantId, input.tenantId),
          eq(tenantHelpers.personId, input.personId)
        ))
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Helper not found" });
      }

      return { success: true };
    }),

  listHelpers: protectedProcedure
    .route({ method: "GET", tags: ["Access Management"], summary: "List all helpers for a tenant" })
    .input(listHelpersInput)
    .handler(async ({ context, input }) => {
      return await context.db
        .select({
          personId: tenantHelpers.personId,
          createdAt: tenantHelpers.createdAt,
        })
        .from(tenantHelpers)
        .where(eq(tenantHelpers.tenantId, input.tenantId));
    }),

  // Tenant Users (can login to system)
  add: adminProcedure
    .route({ method: "POST", tags: ["Access Management"], summary: "Add a tenant user (enable login)" })
    .input(addTenantUserInput)
    .handler(async ({ context, input }) => {
      // Check if person exists
      const [person] = await context.db
        .select()
        .from(people)
        .where(eq(people.id, input.personId))
        .limit(1);

      if (!person) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found" });
      }

      // Check seat limit
      const [tenant] = await context.db
        .select({ maxSeats: tenantPlans.maxSeats })
        .from(tenants)
        .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
        .where(eq(tenants.id, person.tenantId))
        .limit(1);

      if (!tenant) {
        throw new ORPCError("NOT_FOUND", { message: "Tenant not found" });
      }

      const [currentUsers] = await context.db
        .select({ count: count() })
        .from(tenantUsers)
        .innerJoin(people, eq(tenantUsers.personId, people.id))
        .where(eq(people.tenantId, person.tenantId));

      if ((currentUsers?.count ?? 0) >= tenant.maxSeats) {
        throw new ORPCError("BAD_REQUEST", { message: "User limit reached for this plan" });
      }

      const [result] = await context.db
        .insert(tenantUsers)
        .values({ personId: input.personId })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        throw new ORPCError("CONFLICT", { message: "User already active" });
      }

      return result;
    }),

  remove: adminProcedure
    .route({ method: "DELETE", tags: ["Access Management"], summary: "Remove a tenant user (disable login)" })
    .input(removeTenantUserInput)
    .handler(async ({ context, input }) => {
      const [deleted] = await context.db
        .delete(tenantUsers)
        .where(eq(tenantUsers.personId, input.personId))
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Tenant user not found" });
      }

      return { success: true };
    }),

  count: protectedProcedure
    .route({ method: "GET", tags: ["Access Management"], summary: "Count tenant users" })
    .input(countTenantUsersInput)
    .handler(async ({ context, input }) => {
      const [result] = await context.db
        .select({ count: count() })
        .from(tenantUsers)
        .innerJoin(people, eq(tenantUsers.personId, people.id))
        .where(eq(people.tenantId, input.tenantId));

      // Get plan limit
      const [tenant] = await context.db
        .select({ maxSeats: tenantPlans.maxSeats })
        .from(tenants)
        .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      return {
        tenantUsers: result?.count ?? 0,
        maxSeats: tenant?.maxSeats ?? 0,
      };
    }),
};
