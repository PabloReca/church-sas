import { eq, and } from "drizzle-orm";
import { protectedProcedure, ORPCError, requireTenantUser, requireTenantManager } from "@/rpc/orpc";
import {
  tenantEventSlots,
  tenantEventAssignments,
  tenantSkillIncompatibility,
  tenantTeamMemberSkills,
  tenantTeamMembers,
  tenantUsers,
  people,
} from "@/db/schema";
import {
  createEventAssignmentInput,
  deleteEventAssignmentInput,
  listEventAssignmentsInput,
} from "@/db/schemas-zod";

export const eventAssignmentsRouter = {
  createAssignment: protectedProcedure
    .route({ method: "POST", tags: ["Event Assignments"], summary: "Assign a person to an event slot" })
    .input(createEventAssignmentInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      // Get the slot to know the required skill
      const [slot] = await context.db
        .select()
        .from(tenantEventSlots)
        .where(
          and(
            eq(tenantEventSlots.id, input.slotId),
            eq(tenantEventSlots.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!slot) {
        throw new ORPCError("NOT_FOUND", { message: "Event slot not found" });
      }

      // Verify user exists and belongs to tenant
      const [user] = await context.db
        .select()
        .from(tenantUsers)
        .innerJoin(people, eq(tenantUsers.personId, people.id))
        .where(
          and(
            eq(tenantUsers.personId, input.userId),
            eq(people.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!user) {
        throw new ORPCError("NOT_FOUND", { message: "Active user not found in this tenant" });
      }

      // Verify user is member of the required team and has the required skill
      const [teamMember] = await context.db
        .select()
        .from(tenantTeamMembers)
        .where(
          and(
            eq(tenantTeamMembers.userId, input.userId),
            eq(tenantTeamMembers.teamId, slot.teamId),
            eq(tenantTeamMembers.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!teamMember) {
        throw new ORPCError("BAD_REQUEST", { message: "User is not a member of the required team" });
      }

      const [memberSkill] = await context.db
        .select()
        .from(tenantTeamMemberSkills)
        .where(
          and(
            eq(tenantTeamMemberSkills.teamMemberId, teamMember.id),
            eq(tenantTeamMemberSkills.skillId, slot.skillId)
          )
        )
        .limit(1);

      if (!memberSkill) {
        throw new ORPCError("BAD_REQUEST", { message: "User does not have the required skill" });
      }

      // Check existing assignments for this user in this event
      const existingAssignments = await context.db
        .select({
          skillId: tenantEventSlots.skillId,
          teamId: tenantEventSlots.teamId,
        })
        .from(tenantEventAssignments)
        .innerJoin(tenantEventSlots, eq(tenantEventAssignments.slotId, tenantEventSlots.id))
        .where(
          and(
            eq(tenantEventAssignments.eventId, input.eventId),
            eq(tenantEventAssignments.userId, input.userId)
          )
        );

      if (existingAssignments.length > 0) {
        // Check that user is only assigned to ONE team per event
        const existingTeamId = existingAssignments[0]!.teamId;
        if (existingTeamId !== slot.teamId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "User can only be assigned to one team per event",
          });
        }

        // Check skill incompatibility (blacklist) - reject if pair is in the incompatibility table
        for (const existing of existingAssignments) {
          const [id1, id2] = existing.skillId < slot.skillId
            ? [existing.skillId, slot.skillId]
            : [slot.skillId, existing.skillId];

          const [incompatibility] = await context.db
            .select()
            .from(tenantSkillIncompatibility)
            .where(
              and(
                eq(tenantSkillIncompatibility.tenantId, input.tenantId),
                eq(tenantSkillIncompatibility.skillId1, id1),
                eq(tenantSkillIncompatibility.skillId2, id2)
              )
            )
            .limit(1);

          // If found in blacklist, reject
          if (incompatibility) {
            throw new ORPCError("BAD_REQUEST", {
              message: "These skills cannot be used simultaneously by the same person",
            });
          }
        }
      }

      const [result] = await context.db
        .insert(tenantEventAssignments)
        .values({
          eventId: input.eventId,
          slotId: input.slotId,
          tenantId: input.tenantId,
          userId: input.userId,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create assignment" });
      }

      return result;
    }),

  deleteAssignment: protectedProcedure
    .route({ method: "DELETE", tags: ["Event Assignments"], summary: "Remove an event assignment" })
    .input(deleteEventAssignmentInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [deleted] = await context.db
        .delete(tenantEventAssignments)
        .where(
          and(
            eq(tenantEventAssignments.id, input.assignmentId),
            eq(tenantEventAssignments.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Assignment not found" });
      }

      return { success: true };
    }),

  listAssignments: protectedProcedure
    .route({ method: "GET", tags: ["Event Assignments"], summary: "List event assignments" })
    .input(listEventAssignmentsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantEventAssignments)
        .where(
          and(
            eq(tenantEventAssignments.eventId, input.eventId),
            eq(tenantEventAssignments.tenantId, input.tenantId)
          )
        );
    }),
};
