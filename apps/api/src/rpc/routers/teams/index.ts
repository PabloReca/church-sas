import { eq, and } from "drizzle-orm";
import { tenantProcedure, ORPCError, requireTenantUser } from "@/rpc/orpc";
import { tenantTeams } from "@/db/schema";
import {
  createTeamInput,
  updateTeamInput,
  deleteTeamInput,
  getTeamInput,
  listTeamsInput,
} from "@/db/schemas-zod";

export const teamsRouter = {
  create: tenantProcedure
    .route({ method: "POST", tags: ["Teams"], summary: "Create a team" })
    .input(createTeamInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .insert(tenantTeams)
        .values({
          tenantId: input.tenantId,
          name: input.name,
          description: input.description,
        })
        .returning();

      if (!result) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create team" });
      }

      return result;
    }),

  list: tenantProcedure
    .route({ method: "GET", tags: ["Teams"], summary: "List teams in a tenant" })
    .input(listTeamsInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      return await context.db
        .select()
        .from(tenantTeams)
        .where(eq(tenantTeams.tenantId, input.tenantId));
    }),

  get: tenantProcedure
    .route({ method: "GET", tags: ["Teams"], summary: "Get a specific team" })
    .input(getTeamInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .select()
        .from(tenantTeams)
        .where(
          and(
            eq(tenantTeams.id, input.teamId),
            eq(tenantTeams.tenantId, input.tenantId)
          )
        )
        .limit(1);

      return result || null;
    }),

  update: tenantProcedure
    .route({ method: "PATCH", tags: ["Teams"], summary: "Update a team" })
    .input(updateTeamInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const updateData: Record<string, string | null> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined)
        updateData.description = input.description ?? null;

      if (Object.keys(updateData).length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
      }

      const [result] = await context.db
        .update(tenantTeams)
        .set(updateData)
        .where(
          and(
            eq(tenantTeams.id, input.teamId),
            eq(tenantTeams.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Team not found" });
      }

      return result;
    }),

  delete: tenantProcedure
    .route({ method: "DELETE", tags: ["Teams"], summary: "Delete a team" })
    .input(deleteTeamInput)
    .handler(async ({ context, input }) => {
      await requireTenantUser(context, input.tenantId);

      const [result] = await context.db
        .delete(tenantTeams)
        .where(
          and(
            eq(tenantTeams.id, input.teamId),
            eq(tenantTeams.tenantId, input.tenantId)
          )
        )
        .returning();

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Team not found" });
      }

      return { success: true };
    }),
};
