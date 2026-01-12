import { eq, and } from "drizzle-orm";
import { protectedProcedure, ORPCError, requireTenantUser, requireTenantManager } from "@/rpc/orpc";
import {
  tenantEventTemplates,
  tenantEventTemplateSlots,
  tenantEvents,
  tenantEventSlots,
} from "@/db/schema";
import {
  createEventInput,
  updateEventInput,
  deleteEventInput,
  getEventInput,
  listEventsInput,
} from "@/db/schemas-zod";

export const eventsRouter = {
  create: protectedProcedure
    .route({ method: "POST", tags: ["Events"], summary: "Create an event" })
    .input(createEventInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      // If template provided, verify it belongs to this tenant
      if (input.templateId) {
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

        if (!template) {
          throw new ORPCError("BAD_REQUEST", { message: "Template not found in this tenant" });
        }
      }

      const result = await context.db.transaction(async (tx) => {
        // Create the event
        const [event] = await tx
          .insert(tenantEvents)
          .values({
            tenantId: input.tenantId,
            templateId: input.templateId || null,
            name: input.name,
            date: new Date(input.date),
            status: "draft",
          })
          .returning();

        if (!event) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create event" });
        }

        // If template provided, copy slots from template
        if (input.templateId) {
          const templateSlots = await tx
            .select()
            .from(tenantEventTemplateSlots)
            .where(
              and(
                eq(tenantEventTemplateSlots.templateId, input.templateId),
                eq(tenantEventTemplateSlots.tenantId, input.tenantId)
              )
            );

          if (templateSlots.length > 0) {
            await tx.insert(tenantEventSlots).values(
              templateSlots.map((slot) => ({
                eventId: event.id,
                tenantId: input.tenantId,
                teamId: slot.teamId,
                skillId: slot.skillId,
                quantity: slot.quantity,
              }))
            );
          }
        }

        return event;
      });

      return result;
    }),

  update: protectedProcedure
    .route({ method: "PATCH", tags: ["Events"], summary: "Update an event" })
    .input(updateEventInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.date !== undefined) updates.date = new Date(input.date);
      if (input.status !== undefined) updates.status = input.status;

      if (Object.keys(updates).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantEvents)
        .set(updates)
        .where(
          and(
            eq(tenantEvents.id, input.eventId),
            eq(tenantEvents.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      return result;
    }),

  delete: protectedProcedure
    .route({ method: "DELETE", tags: ["Events"], summary: "Delete an event" })
    .input(deleteEventInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [deleted] = await context.db
        .delete(tenantEvents)
        .where(
          and(
            eq(tenantEvents.id, input.eventId),
            eq(tenantEvents.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Event not found" });
      }

      return { success: true };
    }),

  get: protectedProcedure
    .route({ method: "GET", tags: ["Events"], summary: "Get an event by ID" })
    .input(getEventInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [event] = await context.db
        .select()
        .from(tenantEvents)
        .where(
          and(
            eq(tenantEvents.id, input.eventId),
            eq(tenantEvents.tenantId, input.tenantId)
          )
        )
        .limit(1);

      return event || null;
    }),

  list: protectedProcedure
    .route({ method: "GET", tags: ["Events"], summary: "List events in a tenant" })
    .input(listEventsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantEvents)
        .where(eq(tenantEvents.tenantId, input.tenantId));
    }),
};
