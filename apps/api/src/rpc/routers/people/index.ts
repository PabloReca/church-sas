import { eq, and } from "drizzle-orm";
import { protectedProcedure, tenantProcedure, ORPCError, requireTenantUser } from "@/rpc/orpc";
import { emails, people, tenantHelpers, tenantUsers, tenantPeopleFields, tenantPeopleFieldValues } from "@/db/schema";
import {
  getPersonInput,
  createPersonInput,
  updatePersonInput,
  getPersonInTenantInput,
} from "@/db/schemas-zod";
import { requirePersonAccess, isAdmin } from "@/lib/auth-helpers";

// Helper to get person with all field values
async function getPersonWithFields(db: typeof import("@/db/connection").getDb extends () => infer R ? R : never, personId: number) {
  const [person] = await db
    .select({
      id: people.id,
      tenantId: people.tenantId,
      emailId: people.emailId,
      role: people.role,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
    })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);

  if (!person) return null;

  // Get email
  const [emailRecord] = await db
    .select()
    .from(emails)
    .where(eq(emails.id, person.emailId))
    .limit(1);
  const email = emailRecord?.email ?? null;

  // Get field values with field info
  const fieldValuesRaw = await db
    .select({
      fieldName: tenantPeopleFields.name,
      displayName: tenantPeopleFields.displayName,
      fieldType: tenantPeopleFields.fieldType,
      value: tenantPeopleFieldValues.value,
    })
    .from(tenantPeopleFieldValues)
    .innerJoin(tenantPeopleFields, eq(tenantPeopleFieldValues.fieldId, tenantPeopleFields.id))
    .where(eq(tenantPeopleFieldValues.personId, personId));

  const fields: Record<string, string | null> = {};
  for (const fv of fieldValuesRaw) {
    fields[fv.fieldName] = fv.value;
  }

  return {
    ...person,
    email,
    fields,
  };
}

export const peopleRouter = {
  test: protectedProcedure
    .route({ method: "POST", tags: ["People"], summary: "Test endpoint" })
    .handler(async ({ context }) => {
      return { message: "test works", userId: context.user.userId };
    }),

  me: protectedProcedure
    .route({ method: "GET", tags: ["People"], summary: "Get current person" })
    .handler(async ({ context }) => {
      const result = await getPersonWithFields(context.db, context.user.userId);

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found" });
      }

      return result;
    }),

  get: protectedProcedure
    .route({ method: "GET", tags: ["People"], summary: "Get person by ID" })
    .input(getPersonInput)
    .handler(async ({ context, input }) => {
      requirePersonAccess(context.user, input.personId);

      const result = await getPersonWithFields(context.db, input.personId);

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found" });
      }

      // Check if person has active seat
      const [activeSeat] = await context.db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.personId, input.personId))
        .limit(1);

      return {
        ...result,
        isActive: activeSeat ? 1 : 0,
      };
    }),

  update: protectedProcedure
    .route({ method: "PATCH", tags: ["People"], summary: "Update person" })
    .input(updatePersonInput)
    .handler(async ({ context, input }) => {
      requirePersonAccess(context.user, input.personId);

      // Get current person to know tenant
      const [currentPerson] = await context.db
        .select()
        .from(people)
        .where(eq(people.id, input.personId))
        .limit(1);

      if (!currentPerson) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found" });
      }

      let emailUpdated = false;

      // Handle email update
      if (input.email !== undefined) {
        const normalizedEmail = input.email.toLowerCase();

        // Check if email already exists
        const [existingEmail] = await context.db
          .select()
          .from(emails)
          .where(eq(emails.email, normalizedEmail))
          .limit(1);

        if (existingEmail) {
          // Check if it's used by this same person
          if (currentPerson.emailId !== existingEmail.id) {
            throw new ORPCError("CONFLICT", { message: "Email already in use" });
          }
        } else {
          // Create new email record
          const [newEmail] = await context.db
            .insert(emails)
            .values({ email: normalizedEmail })
            .returning();

          if (newEmail) {
            await context.db
              .update(people)
              .set({ emailId: newEmail.id, updatedAt: new Date() })
              .where(eq(people.id, input.personId));
            emailUpdated = true;
          }
        }
      }

      // Handle field values update
      if (input.fields && Object.keys(input.fields).length > 0) {
        // Get field definitions for this tenant
        const tenantFields = await context.db
          .select()
          .from(tenantPeopleFields)
          .where(eq(tenantPeopleFields.tenantId, currentPerson.tenantId));

        const fieldMap = new Map(tenantFields.map(f => [f.name, f]));

        for (const [fieldName, value] of Object.entries(input.fields)) {
          const field = fieldMap.get(fieldName);
          if (!field) {
            throw new ORPCError("BAD_REQUEST", { message: `Unknown field: ${fieldName}` });
          }

          // Upsert field value
          const [existing] = await context.db
            .select()
            .from(tenantPeopleFieldValues)
            .where(and(
              eq(tenantPeopleFieldValues.personId, input.personId),
              eq(tenantPeopleFieldValues.fieldId, field.id)
            ))
            .limit(1);

          if (existing) {
            await context.db
              .update(tenantPeopleFieldValues)
              .set({ value, updatedAt: new Date() })
              .where(eq(tenantPeopleFieldValues.id, existing.id));
          } else {
            await context.db
              .insert(tenantPeopleFieldValues)
              .values({
                personId: input.personId,
                fieldId: field.id,
                value,
              });
          }
        }

        // Update person timestamp
        await context.db
          .update(people)
          .set({ updatedAt: new Date() })
          .where(eq(people.id, input.personId));
      }

      // Only admins can change isActive status
      if (input.isActive !== undefined && isAdmin(context.user)) {
        const [existing] = await context.db
          .select()
          .from(tenantUsers)
          .where(eq(tenantUsers.personId, input.personId))
          .limit(1);

        if (input.isActive === 1 && !existing) {
          await context.db.insert(tenantUsers).values({ personId: input.personId });
        } else if (input.isActive === 0 && existing) {
          await context.db.delete(tenantUsers).where(eq(tenantUsers.personId, input.personId));
        }
      }

      const hasChanges = emailUpdated ||
        (input.fields && Object.keys(input.fields).length > 0) ||
        input.isActive !== undefined;

      if (!hasChanges) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      return await getPersonWithFields(context.db, input.personId);
    }),

  getPersonInTenant: tenantProcedure
    .route({ method: "GET", tags: ["People"], summary: "Get a specific person in a tenant" })
    .input(getPersonInTenantInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const result = await getPersonWithFields(context.db, input.personId);

      if (!result) {
        return null;
      }

      // Check if person belongs to this tenant (primary or helper)
      const isPrimary = result.tenantId === input.tenantId;

      if (!isPrimary) {
        const [helper] = await context.db
          .select()
          .from(tenantHelpers)
          .where(and(eq(tenantHelpers.personId, input.personId), eq(tenantHelpers.tenantId, input.tenantId)))
          .limit(1);

        if (!helper) {
          throw new ORPCError("NOT_FOUND", { message: "Person not found in this tenant" });
        }
      }

      const [activeSeat] = await context.db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.personId, result.id))
        .limit(1);

      return {
        ...result,
        isPrimary,
        isHelper: !isPrimary,
        isActive: activeSeat ? 1 : 0,
      };
    }),

  create: tenantProcedure
    .route({ method: "POST", tags: ["People"], summary: "Create a new person" })
    .input(createPersonInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const normalizedEmail = input.email.toLowerCase();

      const [existingEmail] = await context.db
        .select()
        .from(emails)
        .where(eq(emails.email, normalizedEmail))
        .limit(1);

      if (existingEmail) {
        throw new ORPCError("CONFLICT", { message: "Email already in use" });
      }

      const [newEmail] = await context.db
        .insert(emails)
        .values({ email: normalizedEmail })
        .returning();

      if (!newEmail) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create email" });
      }

      // Create person
      const [person] = await context.db
        .insert(people)
        .values({
          tenantId: input.tenantId,
          emailId: newEmail.id,
          role: input.role ?? null,
        })
        .returning();

      if (!person) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create person" });
      }

      // Handle field values if provided
      if (input.fields && Object.keys(input.fields).length > 0) {
        const tenantFields = await context.db
          .select()
          .from(tenantPeopleFields)
          .where(eq(tenantPeopleFields.tenantId, input.tenantId));

        const fieldMap = new Map(tenantFields.map(f => [f.name, f]));

        for (const [fieldName, value] of Object.entries(input.fields)) {
          const field = fieldMap.get(fieldName);
          if (!field) {
            throw new ORPCError("BAD_REQUEST", { message: `Unknown field: ${fieldName}` });
          }

          await context.db
            .insert(tenantPeopleFieldValues)
            .values({
              personId: person.id,
              fieldId: field.id,
              value,
            });
        }
      }

      return await getPersonWithFields(context.db, person.id);
    }),
};
