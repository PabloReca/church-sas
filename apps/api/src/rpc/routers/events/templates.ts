import { eq, and } from "drizzle-orm";
import { protectedProcedure, ORPCError, requireTenantUser, requireTenantManager } from "@/rpc/orpc";
import { tenantEventTemplates, tenantEventTemplateSlots } from "@/db/schema";
import {
  createEventTemplateInput,
  updateEventTemplateInput,
  deleteEventTemplateInput,
  getEventTemplateInput,
  listEventTemplatesInput,
  createEventTemplateSlotInput,
  updateEventTemplateSlotInput,
  deleteEventTemplateSlotInput,
  listEventTemplateSlotsInput,
} from "@/db/schemas-zod";

export const eventTemplatesRouter = {
  // ============ EVENT TEMPLATES ============

  create: protectedProcedure
    .route({ method: "POST", tags: ["Event Templates"], summary: "Create an event template" })
    .input(createEventTemplateInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [result] = await context.db
        .insert(tenantEventTemplates)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          description: input.description,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create template" });
      }

      return result;
    }),

  update: protectedProcedure
    .route({ method: "PATCH", tags: ["Event Templates"], summary: "Update an event template" })
    .input(updateEventTemplateInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;

      if (Object.keys(updates).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantEventTemplates)
        .set(updates)
        .where(
          and(
            eq(tenantEventTemplates.id, input.templateId),
            eq(tenantEventTemplates.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Template not found" });
      }

      return result;
    }),

  delete: protectedProcedure
    .route({ method: "DELETE", tags: ["Event Templates"], summary: "Delete an event template" })
    .input(deleteEventTemplateInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [deleted] = await context.db
        .delete(tenantEventTemplates)
        .where(
          and(
            eq(tenantEventTemplates.id, input.templateId),
            eq(tenantEventTemplates.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Template not found" });
      }

      return { success: true };
    }),

  get: protectedProcedure
    .route({ method: "GET", tags: ["Event Templates"], summary: "Get an event template" })
    .input(getEventTemplateInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [template] = await context.db
        .select()
        .from(tenantEventTemplates)
        .where(
          and(
            eq(tenantEventTemplates.id, input.templateId),
            eq(tenantEventTemplates.tenantId, input.tenantId)
          )
        )
        .limit(1);

      return template || null;
    }),

  list: protectedProcedure
    .route({ method: "GET", tags: ["Event Templates"], summary: "List event templates" })
    .input(listEventTemplatesInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantEventTemplates)
        .where(eq(tenantEventTemplates.tenantId, input.tenantId));
    }),

  // ============ EVENT TEMPLATE SLOTS ============

  createSlot: protectedProcedure
    .route({ method: "POST", tags: ["Event Templates"], summary: "Create a template slot" })
    .input(createEventTemplateSlotInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [result] = await context.db
        .insert(tenantEventTemplateSlots)
        .values({
          templateId: input.templateId,
          tenantId: input.tenantId,
          teamId: input.teamId,
          skillId: input.skillId,
          quantity: input.quantity,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create template slot" });
      }

      return result;
    }),

  updateSlot: protectedProcedure
    .route({ method: "PATCH", tags: ["Event Templates"], summary: "Update a template slot" })
    .input(updateEventTemplateSlotInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      if (input.quantity === undefined) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantEventTemplateSlots)
        .set({ quantity: input.quantity })
        .where(
          and(
            eq(tenantEventTemplateSlots.id, input.slotId),
            eq(tenantEventTemplateSlots.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Template slot not found" });
      }

      return result;
    }),

  deleteSlot: protectedProcedure
    .route({ method: "DELETE", tags: ["Event Templates"], summary: "Delete a template slot" })
    .input(deleteEventTemplateSlotInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [deleted] = await context.db
        .delete(tenantEventTemplateSlots)
        .where(
          and(
            eq(tenantEventTemplateSlots.id, input.slotId),
            eq(tenantEventTemplateSlots.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Template slot not found" });
      }

      return { success: true };
    }),

  listSlots: protectedProcedure
    .route({ method: "GET", tags: ["Event Templates"], summary: "List template slots" })
    .input(listEventTemplateSlotsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantEventTemplateSlots)
        .where(
          and(
            eq(tenantEventTemplateSlots.templateId, input.templateId),
            eq(tenantEventTemplateSlots.tenantId, input.tenantId)
          )
        );
    }),
};
