import { eq, and } from "drizzle-orm";
import { tenantProcedure, ORPCError, requireTenantUser } from "@/rpc/orpc";
import {
  emails,
  tenantTeamMembers,
  tenantUsers,
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

      // Verify user exists (must be an active user, not just a person)
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
        throw new ORPCError("NOT_FOUND", { message: "Active user not found or does not belong to this tenant" });
      }

      const [result] = await context.db
        .insert(tenantTeamMembers)
        .values({
          teamId: input.teamId,
          userId: input.userId,
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
          userId: tenantTeamMembers.userId,
          role: tenantTeamMembers.role,
          createdAt: tenantTeamMembers.createdAt,
          email: emails.email,
        })
        .from(tenantTeamMembers)
        .innerJoin(people, eq(tenantTeamMembers.userId, people.id))
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
            eq(tenantTeamMembers.userId, input.userId),
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
            eq(tenantTeamMembers.userId, input.userId),
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
