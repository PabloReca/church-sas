import { eq, and } from "drizzle-orm";
import { tenantProcedure, ORPCError, requireTenantUser } from "@/rpc/orpc";
import {
  emails,
  tenantTeamMembers,
  people,
} from "@/db/schema";
import {
  addTeamMemberInput,
  removeTeamMemberInput,
  updateTeamMemberInput,
  listTeamMembersInput,
} from "@/db/schemas-zod";

export const teamMembersRouter = {
  addMember: tenantProcedure
    .route({ method: "POST", tags: ["Team Members"], summary: "Add a member to a team" })
    .input(addTeamMemberInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      // Verify person exists and belongs to the same tenant
      const [person] = await context.db
        .select()
        .from(people)
        .where(
          and(
            eq(people.id, input.personId),
            eq(people.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!person) {
        throw new ORPCError("NOT_FOUND", { message: "Person not found or does not belong to this tenant" });
      }

      const [result] = await context.db
        .insert(tenantTeamMembers)
        .values({
          teamId: input.teamId,
          personId: input.personId,
          tenantId: input.tenantId,
          role: input.role,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to add team member" });
      }

      return result;
    }),

  listMembers: tenantProcedure
    .route({ method: "GET", tags: ["Team Members"], summary: "List members of a team" })
    .input(listTeamMembersInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const members = await context.db
        .select({
          id: tenantTeamMembers.id,
          teamId: tenantTeamMembers.teamId,
          personId: tenantTeamMembers.personId,
          role: tenantTeamMembers.role,
          createdAt: tenantTeamMembers.createdAt,
          email: emails.email,
        })
        .from(tenantTeamMembers)
        .innerJoin(people, eq(tenantTeamMembers.personId, people.id))
        .leftJoin(emails, eq(people.emailId, emails.id))
        .where(
          and(
            eq(tenantTeamMembers.teamId, input.teamId),
            eq(tenantTeamMembers.tenantId, input.tenantId)
          )
        );

      return members;
    }),

  updateMember: tenantProcedure
    .route({ method: "PATCH", tags: ["Team Members"], summary: "Update a team member" })
    .input(updateTeamMemberInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const updateData: Record<string, string | null | undefined> = {};
      if (input.role !== undefined) updateData.role = input.role;

      if (Object.keys(updateData).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantTeamMembers)
        .set(updateData)
        .where(
          and(
            eq(tenantTeamMembers.teamId, input.teamId),
            eq(tenantTeamMembers.personId, input.personId),
            eq(tenantTeamMembers.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Team member not found" });
      }

      return result;
    }),

  removeMember: tenantProcedure
    .route({ method: "DELETE", tags: ["Team Members"], summary: "Remove a team member" })
    .input(removeTeamMemberInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .delete(tenantTeamMembers)
        .where(
          and(
            eq(tenantTeamMembers.teamId, input.teamId),
            eq(tenantTeamMembers.personId, input.personId),
            eq(tenantTeamMembers.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Team member not found" });
      }

      return { success: true };
    }),
};
