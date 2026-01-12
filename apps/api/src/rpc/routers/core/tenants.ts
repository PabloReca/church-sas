import { eq, count } from "drizzle-orm";
import { protectedProcedure, adminProcedure, ORPCError } from "@/rpc/orpc";
import { emails, tenants, people, tenantPlans, tenantUsers, tenantPeopleFields, tenantPeopleFieldValues, tenantHelpers } from "@/db/schema";
import {
  createTenantInput,
  updateTenantInput,
  tenantIdInput,
} from "@/db/schemas-zod";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

export const tenantsRouter = {
  list: adminProcedure
    .route({ method: "GET", tags: ["Tenants"], summary: "List all tenants" })
    .handler(async ({ context }) => {
      return await context.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          planId: tenants.planId,
          createdAt: tenants.createdAt,
          planName: tenantPlans.name,
          maxSeats: tenantPlans.maxSeats,
          maxPeople: tenantPlans.maxPeople,
          price: tenantPlans.price,
          currency: tenantPlans.currency,
        })
        .from(tenants)
        .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id));
    }),

  getById: protectedProcedure
    .route({ method: "GET", tags: ["Tenants"], summary: "Get tenant by ID" })
    .input(tenantIdInput)
    .handler(async ({ context, input }) => {
      const [tenant] = await context.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          planId: tenants.planId,
          createdAt: tenants.createdAt,
          planName: tenantPlans.name,
          maxSeats: tenantPlans.maxSeats,
          maxPeople: tenantPlans.maxPeople,
        })
        .from(tenants)
        .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
        .where(eq(tenants.id, input.id))
        .limit(1);

      return tenant || null;
    }),

  getPeopleCount: adminProcedure
    .route({ method: "GET", tags: ["Tenants"], summary: "Get people count for a tenant" })
    .input(tenantIdInput)
    .handler(async ({ context, input }) => {
      // Get tenant and plan info
      const [tenant] = await context.db
        .select({
          maxSeats: tenantPlans.maxSeats,
          maxPeople: tenantPlans.maxPeople,
        })
        .from(tenants)
        .innerJoin(tenantPlans, eq(tenants.planId, tenantPlans.id))
        .where(eq(tenants.id, input.id))
        .limit(1);

      if (!tenant) {
        throw new ORPCError("NOT_FOUND", { message: "Tenant not found" });
      }

      // Count primary members
      const [primaryMembersResult] = await context.db
        .select({ count: count() })
        .from(people)
        .where(eq(people.tenantId, input.id));

      // Count active seats (from active_seats table joined with people)
      const [tenantUsersResult] = await context.db
        .select({ count: count() })
        .from(tenantUsers)
        .innerJoin(people, eq(tenantUsers.personId, people.id))
        .where(eq(people.tenantId, input.id));

      // Count helpers separately
      const [helperCount] = await context.db
        .select({ count: count() })
        .from(tenantHelpers)
        .where(eq(tenantHelpers.tenantId, input.id));

      return {
        // Active SaaS seats - counts towards plan limit
        tenantUsers: tenantUsersResult?.count ?? 0,

        // Total people (members + helpers)
        totalPeople: (primaryMembersResult?.count ?? 0) + (helperCount?.count ?? 0),

        // Plan limits
        maxSeats: tenant.maxSeats,
        maxPeople: tenant.maxPeople,

        // Breakdown
        primaryMembers: primaryMembersResult?.count ?? 0,
        helpers: helperCount?.count ?? 0,
      };
    }),

  create: adminProcedure
    .route({ method: "POST", tags: ["Tenants"], summary: "Create a new tenant" })
    .input(createTenantInput)
    .handler(async ({ context, input }) => {
      const slug = generateSlug(input.name);
      const normalizedEmail = input.adminEmail.toLowerCase();

      // Check if slug already exists
      const [existing] = await context.db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);

      if (existing) {
        throw new ORPCError("CONFLICT", { message: "A tenant with a similar name already exists" });
      }

      // Check if email already exists
      const [existingEmail] = await context.db
        .select()
        .from(emails)
        .where(eq(emails.email, normalizedEmail))
        .limit(1);

      if (existingEmail) {
        throw new ORPCError("CONFLICT", { message: "Email already in use" });
      }

      // Create tenant + owner person in a transaction
      const result = await context.db.transaction(async (tx) => {
        // 1. Create email record
        const [emailRecord] = await tx
          .insert(emails)
          .values({ email: normalizedEmail })
          .returning();

        if (!emailRecord) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create email record" });
        }

        // 2. Create tenant
        const [tenant] = await tx
          .insert(tenants)
          .values({
            name: input.name,
            slug,
            planId: input.planId,
          })
          .returning();

        if (!tenant) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create tenant" });
        }

        // 3. Create owner person with role
        const [ownerPerson] = await tx
          .insert(people)
          .values({
            tenantId: tenant.id,
            emailId: emailRecord.id,
            role: "owner",
          })
          .returning();

        if (!ownerPerson) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create owner person" });
        }

        // 4. Create default "name" field for this tenant and set owner's name
        const [nameField] = await tx
          .insert(tenantPeopleFields)
          .values({
            tenantId: tenant.id,
            name: "name",
            displayName: "Name",
            fieldType: "text",
            isRequired: true,
            displayOrder: 0,
          })
          .returning();

        if (nameField) {
          await tx.insert(tenantPeopleFieldValues).values({
            personId: ownerPerson.id,
            fieldId: nameField.id,
            value: input.adminName,
          });
        }

        // 5. Activate owner person seat
        await tx.insert(tenantUsers).values({
          personId: ownerPerson.id,
        });

        return tenant;
      });

      return result;
    }),

  update: adminProcedure
    .route({ method: "PATCH", tags: ["Tenants"], summary: "Update a tenant" })
    .input(updateTenantInput)
    .handler(async ({ context, input }) => {
      const updates: Record<string, unknown> = {};

      if (input.name !== undefined) {
        updates.name = input.name;
        updates.slug = generateSlug(input.name);
      }

      if (input.planId !== undefined) {
        updates.planId = input.planId;
      }

      if (Object.keys(updates).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenants)
        .set(updates)
        .where(eq(tenants.id, input.id))
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Tenant not found" });
      }

      return result;
    }),

  remove: adminProcedure
    .route({ method: "DELETE", tags: ["Tenants"], summary: "Delete a tenant" })
    .input(tenantIdInput)
    .handler(async ({ context, input }) => {
      const [deleted] = await context.db
        .delete(tenants)
        .where(eq(tenants.id, input.id))
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Tenant not found" });
      }

      return { success: true };
    }),
};
