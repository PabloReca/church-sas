import { eq, and } from "drizzle-orm";
import { tenantProcedure, ORPCError, requireTenantUser } from "@/rpc/orpc";
import { tenantPeopleFields } from "@/db/schema";
import {
  createFieldInput,
  updateFieldInput,
  deleteFieldInput,
  listFieldsInput,
} from "@/db/schemas-zod";

export const peopleFieldsRouter = {
  create: tenantProcedure
    .route({ method: "POST", tags: ["Person Fields"], summary: "Create a custom field for a tenant" })
    .input(createFieldInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      // Check if field name already exists for this tenant
      const [existing] = await context.db
        .select()
        .from(tenantPeopleFields)
        .where(and(eq(tenantPeopleFields.tenantId, input.tenantId), eq(tenantPeopleFields.name, input.name)))
        .limit(1);

      if (existing) {
        throw new ORPCError("CONFLICT", { message: "Field with this name already exists" });
      }

      const [result] = await context.db
        .insert(tenantPeopleFields)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          displayName: input.displayName,
          fieldType: input.fieldType,
          isRequired: input.isRequired ?? false,
          displayOrder: input.displayOrder ?? 0,
          options: input.options,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create field" });
      }

      return result;
    }),

  update: tenantProcedure
    .route({ method: "PATCH", tags: ["Person Fields"], summary: "Update a custom field" })
    .input(updateFieldInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const updateData: Record<string, unknown> = {};
      if (input.displayName !== undefined) updateData.displayName = input.displayName;
      if (input.fieldType !== undefined) updateData.fieldType = input.fieldType;
      if (input.isRequired !== undefined) updateData.isRequired = input.isRequired;
      if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder;
      if (input.options !== undefined) updateData.options = input.options;

      if (Object.keys(updateData).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantPeopleFields)
        .set(updateData)
        .where(and(eq(tenantPeopleFields.id, input.fieldId), eq(tenantPeopleFields.tenantId, input.tenantId)))
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Field not found" });
      }

      return result;
    }),

  delete: tenantProcedure
    .route({ method: "DELETE", tags: ["Person Fields"], summary: "Delete a custom field (cascades to all values)" })
    .input(deleteFieldInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .delete(tenantPeopleFields)
        .where(and(eq(tenantPeopleFields.id, input.fieldId), eq(tenantPeopleFields.tenantId, input.tenantId)))
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Field not found" });
      }

      return { success: true };
    }),

  list: tenantProcedure
    .route({ method: "GET", tags: ["Person Fields"], summary: "List all custom fields for a tenant" })
    .input(listFieldsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantPeopleFields)
        .where(eq(tenantPeopleFields.tenantId, input.tenantId))
        .orderBy(tenantPeopleFields.displayOrder);
    }),
};
