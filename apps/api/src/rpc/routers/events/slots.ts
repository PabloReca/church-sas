import { eq, and } from "drizzle-orm";
import { protectedProcedure, ORPCError, requireTenantUser, requireTenantManager } from "@/rpc/orpc";
import {
  tenantEventSlots,
  tenantTeams,
  tenantTeamSkills,
} from "@/db/schema";
import {
  createEventSlotInput,
  updateEventSlotInput,
  deleteEventSlotInput,
  listEventSlotsInput,
} from "@/db/schemas-zod";

export const eventSlotsRouter = {
  createSlot: protectedProcedure
    .route({ method: "POST", tags: ["Event Slots"], summary: "Create an event slot" })
    .input(createEventSlotInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      // Verify team belongs to this tenant
      const [team] = await context.db
        .select()
        .from(tenantTeams)
        .where(
          and(
            eq(tenantTeams.id, input.teamId),
            eq(tenantTeams.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!team) {
        throw new ORPCError("BAD_REQUEST", { message: "Team not found in this tenant" });
      }

      // Verify skill belongs to this tenant and to this team
      const [skill] = await context.db
        .select()
        .from(tenantTeamSkills)
        .where(
          and(
            eq(tenantTeamSkills.id, input.skillId),
            eq(tenantTeamSkills.tenantId, input.tenantId),
            eq(tenantTeamSkills.teamId, input.teamId)
          )
        )
        .limit(1);

      if (!skill) {
        throw new ORPCError("BAD_REQUEST", { message: "Skill not found in this team" });
      }

      const [result] = await context.db
        .insert(tenantEventSlots)
        .values({
          eventId: input.eventId,
          tenantId: input.tenantId,
          teamId: input.teamId,
          skillId: input.skillId,
          quantity: input.quantity,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create event slot" });
      }

      return result;
    }),

  updateSlot: protectedProcedure
    .route({ method: "PATCH", tags: ["Event Slots"], summary: "Update an event slot" })
    .input(updateEventSlotInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      if (input.quantity === undefined) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantEventSlots)
        .set({ quantity: input.quantity })
        .where(
          and(
            eq(tenantEventSlots.id, input.slotId),
            eq(tenantEventSlots.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Event slot not found" });
      }

      return result;
    }),

  deleteSlot: protectedProcedure
    .route({ method: "DELETE", tags: ["Event Slots"], summary: "Delete an event slot" })
    .input(deleteEventSlotInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [deleted] = await context.db
        .delete(tenantEventSlots)
        .where(
          and(
            eq(tenantEventSlots.id, input.slotId),
            eq(tenantEventSlots.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Event slot not found" });
      }

      return { success: true };
    }),

  listSlots: protectedProcedure
    .route({ method: "GET", tags: ["Event Slots"], summary: "List event slots" })
    .input(listEventSlotsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantEventSlots)
        .where(
          and(
            eq(tenantEventSlots.eventId, input.eventId),
            eq(tenantEventSlots.tenantId, input.tenantId)
          )
        );
    }),
};
