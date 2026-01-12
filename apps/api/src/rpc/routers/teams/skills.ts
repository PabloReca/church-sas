import { eq, and } from "drizzle-orm";
import { tenantProcedure, ORPCError, requireTenantUser } from "@/rpc/orpc";
import {
  tenantTeamSkills,
  tenantTeamMemberSkills,
  tenantTeamMembers,
} from "@/db/schema";
import {
  createTeamSkillInput,
  updateTeamSkillInput,
  deleteTeamSkillInput,
  listTeamSkillsInput,
  assignMemberSkillInput,
  updateMemberSkillInput,
  removeMemberSkillInput,
  listMemberSkillsInput,
} from "@/db/schemas-zod";

export const teamSkillsRouter = {
  createSkill: tenantProcedure
    .route({ method: "POST", tags: ["Team Skills"], summary: "Create a team skill" })
    .input(createTeamSkillInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .insert(tenantTeamSkills)
        .values({
          teamId: input.teamId,
          tenantId: input.tenantId,
          name: input.name,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create skill" });
      }

      return result;
    }),

  listSkills: tenantProcedure
    .route({ method: "GET", tags: ["Team Skills"], summary: "List skills for a team" })
    .input(listTeamSkillsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantTeamSkills)
        .where(
          and(
            eq(tenantTeamSkills.teamId, input.teamId),
            eq(tenantTeamSkills.tenantId, input.tenantId)
          )
        );
    }),

  updateSkill: tenantProcedure
    .route({ method: "PATCH", tags: ["Team Skills"], summary: "Update a team skill" })
    .input(updateTeamSkillInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .update(tenantTeamSkills)
        .set({ name: input.name })
        .where(
          and(
            eq(tenantTeamSkills.id, input.skillId),
            eq(tenantTeamSkills.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Skill not found" });
      }

      return result;
    }),

  deleteSkill: tenantProcedure
    .route({ method: "DELETE", tags: ["Team Skills"], summary: "Delete a team skill" })
    .input(deleteTeamSkillInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .delete(tenantTeamSkills)
        .where(
          and(
            eq(tenantTeamSkills.id, input.skillId),
            eq(tenantTeamSkills.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Skill not found" });
      }

      return { success: true };
    }),

  assignMemberSkill: tenantProcedure
    .route({ method: "POST", tags: ["Team Skills"], summary: "Assign a skill to a team member" })
    .input(assignMemberSkillInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      // Verify that the skill belongs to the same tenant
      const [skill] = await context.db
        .select()
        .from(tenantTeamSkills)
        .where(
          and(
            eq(tenantTeamSkills.id, input.skillId),
            eq(tenantTeamSkills.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!skill) {
        throw new ORPCError("NOT_FOUND", { message: "Skill not found or does not belong to this tenant" });
      }

      // Verify that the team member belongs to the same tenant
      const [member] = await context.db
        .select()
        .from(tenantTeamMembers)
        .where(
          and(
            eq(tenantTeamMembers.id, input.teamMemberId),
            eq(tenantTeamMembers.tenantId, input.tenantId)
          )
        )
        .limit(1);

      if (!member) {
        throw new ORPCError("NOT_FOUND", { message: "Team member not found or does not belong to this tenant" });
      }

      const [result] = await context.db
        .insert(tenantTeamMemberSkills)
        .values({
          teamMemberId: input.teamMemberId,
          skillId: input.skillId,
          tenantId: input.tenantId,
          proficiencyLevel: input.proficiencyLevel,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to assign skill" });
      }

      return result;
    }),

  listMemberSkills: tenantProcedure
    .route({ method: "GET", tags: ["Team Skills"], summary: "List skills for a team member" })
    .input(listMemberSkillsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select({
          id: tenantTeamMemberSkills.id,
          teamMemberId: tenantTeamMemberSkills.teamMemberId,
          skillId: tenantTeamMemberSkills.skillId,
          proficiencyLevel: tenantTeamMemberSkills.proficiencyLevel,
          createdAt: tenantTeamMemberSkills.createdAt,
          skillName: tenantTeamSkills.name,
        })
        .from(tenantTeamMemberSkills)
        .innerJoin(tenantTeamSkills, eq(tenantTeamMemberSkills.skillId, tenantTeamSkills.id))
        .where(
          and(
            eq(tenantTeamMemberSkills.teamMemberId, input.teamMemberId),
            eq(tenantTeamMemberSkills.tenantId, input.tenantId)
          )
        );
    }),

  updateMemberSkill: tenantProcedure
    .route({ method: "PATCH", tags: ["Team Skills"], summary: "Update a member skill" })
    .input(updateMemberSkillInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const updateData: Record<string, number | null | undefined> = {};
      if (input.proficiencyLevel !== undefined)
        updateData.proficiencyLevel = input.proficiencyLevel;

      if (Object.keys(updateData).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantTeamMemberSkills)
        .set(updateData)
        .where(
          and(
            eq(tenantTeamMemberSkills.teamMemberId, input.teamMemberId),
            eq(tenantTeamMemberSkills.skillId, input.skillId),
            eq(tenantTeamMemberSkills.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Member skill not found" });
      }

      return result;
    }),

  removeMemberSkill: tenantProcedure
    .route({ method: "DELETE", tags: ["Team Skills"], summary: "Remove a skill from a team member" })
    .input(removeMemberSkillInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .delete(tenantTeamMemberSkills)
        .where(
          and(
            eq(tenantTeamMemberSkills.teamMemberId, input.teamMemberId),
            eq(tenantTeamMemberSkills.skillId, input.skillId),
            eq(tenantTeamMemberSkills.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Member skill not found" });
      }

      return { success: true };
    }),
};
