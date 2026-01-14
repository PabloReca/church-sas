import { eq } from "drizzle-orm";
import { adminProcedure, ORPCError } from "@/rpc/orpc";
import { emails, admins } from "@/db/schema";
import { addAdminInput, removeAdminInput } from "@/db/schemas-zod";

export const adminRouter = {
  list: adminProcedure
    .route({ method: "GET", tags: ["Admin"], summary: "List all global administrators" })
    .handler(async ({ context }) => {
      const result = await context.db
        .select({
          id: admins.id,
          email: emails.email,
          name: admins.name,
          lastname: admins.lastname,
          createdAt: admins.createdAt,
          updatedAt: admins.updatedAt,
        })
        .from(admins)
        .innerJoin(emails, eq(admins.emailId, emails.id));

      return result;
    }),

  add: adminProcedure
    .route({ method: "POST", tags: ["Admin"], summary: "Add a global administrator" })
    .input(addAdminInput)
    .handler(async ({ context, input }) => {
      const normalizedEmail = input.email.toLowerCase();

      // Check if email already exists
      const [existingEmail] = await context.db
        .select()
        .from(emails)
        .where(eq(emails.email, normalizedEmail))
        .limit(1);

      if (existingEmail) {
        // Check if already an admin
        const [existingAdmin] = await context.db
          .select()
          .from(admins)
          .where(eq(admins.emailId, existingEmail.id))
          .limit(1);

        if (existingAdmin) {
          throw new ORPCError("CONFLICT", { message: "Email is already a global administrator" });
        }

        // Email exists but not as admin - use existing email record
        const [result] = await context.db
          .insert(admins)
          .values({
            emailId: existingEmail.id,
            name: input.name,
            lastname: input.lastname,
          })
          .returning();

        return {
          ...result,
          email: normalizedEmail,
        };
      }

      // Create new email record and admin in transaction
      const result = await context.db.transaction(async (tx) => {
        const [newEmail] = await tx
          .insert(emails)
          .values({ email: normalizedEmail })
          .returning();

        if (!newEmail) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create email record" });
        }

        const [admin] = await tx
          .insert(admins)
          .values({
            emailId: newEmail.id,
            name: input.name,
            lastname: input.lastname,
          })
          .returning();

        if (!admin) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create admin" });
        }

        return admin;
      });

      return {
        ...result,
        email: normalizedEmail,
      };
    }),

  remove: adminProcedure
    .route({ method: "DELETE", tags: ["Admin"], summary: "Remove a global administrator" })
    .input(removeAdminInput)
    .handler(async ({ context, input }) => {
      const [deleted] = await context.db
        .delete(admins)
        .where(eq(admins.id, input.id))
        .returning();

      if (!deleted) {
        throw new ORPCError("NOT_FOUND", { message: "Administrator not found" });
      }

      return { success: true };
    }),
};
