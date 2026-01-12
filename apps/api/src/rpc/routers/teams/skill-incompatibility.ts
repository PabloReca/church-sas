import { eq, and, or } from "drizzle-orm";
import { protectedProcedure, ORPCError, requireTenantUser, requireTenantManager } from "@/rpc/orpc";
import { tenantSkillIncompatibility, tenantTeamSkills } from "@/db/schema";
import {
  addSkillIncompatibilityInput,
  removeSkillIncompatibilityInput,
  listSkillIncompatibilityInput,
} from "@/db/schemas-zod";

export const skillIncompatibilityRouter = {
  // Add an incompatibility rule between two skills (they cannot be used simultaneously)
  add: protectedProcedure
    .route({ method: "POST", tags: ["Team Skills"], summary: "Add skill incompatibility rule" })
    .input(addSkillIncompatibilityInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      // Verify both skills belong to this tenant
      const skills = await context.db
        .select()
        .from(tenantTeamSkills)
        .where(
          and(
            eq(tenantTeamSkills.tenantId, input.tenantId),
            or(
              eq(tenantTeamSkills.id, input.skillId1),
              eq(tenantTeamSkills.id, input.skillId2)
            )
          )
        );

      if (skills.length !== 2) {
        throw new ORPCError("BAD_REQUEST", { message: "One or both skills do not belong to this tenant" });
      }

      // Ensure skillId1 < skillId2 for consistency (bidirectional)
      const [id1, id2] = input.skillId1 < input.skillId2
        ? [input.skillId1, input.skillId2]
        : [input.skillId2, input.skillId1];

      const [result] = await context.db
        .insert(tenantSkillIncompatibility)
        .values({
          tenantId: input.tenantId,
          skillId1: id1,
          skillId2: id2,
        })
        .onConflictDoNothing()
        .returning();

      if (!result) {
        throw new ORPCError("CONFLICT", { message: "Skill incompatibility already exists" });
      }

      return result;
    }),

  // Remove an incompatibility rule (allow skills to be used together again)
  remove: protectedProcedure
    .route({ method: "DELETE", tags: ["Team Skills"], summary: "Remove skill incompatibility rule" })
    .input(removeSkillIncompatibilityInput)
    .handler(async ({ context, input }) => {
      await requireTenantManager(context, input.tenantId);

      const [id1, id2] = input.skillId1 < input.skillId2
        ? [input.skillId1, input.skillId2]
        : [input.skillId2, input.skillId1];

      const [deleted] = await context.db
        .delete(tenantSkillIncompatibility)
        .where(
          and(
            eq(tenantSkillIncompatibility.tenantId, input.tenantId),
            eq(tenantSkillIncompatibility.skillId1, id1),
            eq(tenantSkillIncompatibility.skillId2, id2)
          )
        )
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Skill incompatibility not found" });
      }

      return { success: true };
    }),

  // List all incompatibility rules for this tenant
  list: protectedProcedure
    .route({ method: "GET", tags: ["Team Skills"], summary: "List skill incompatibility rules" })
    .input(listSkillIncompatibilityInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select({
          skillId1: tenantSkillIncompatibility.skillId1,
          skillId2: tenantSkillIncompatibility.skillId2,
          skill1Name: tenantTeamSkills.name,
        })
        .from(tenantSkillIncompatibility)
        .innerJoin(tenantTeamSkills, eq(tenantSkillIncompatibility.skillId1, tenantTeamSkills.id))
        .where(eq(tenantSkillIncompatibility.tenantId, input.tenantId));
    }),
};
