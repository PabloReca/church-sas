import { os, ORPCError } from "@orpc/server";
import type { Context } from "./context";
import { people, tenantHelpers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin, isAdmin } from "@/lib/auth-helpers";

// Base ORPC instance with context
export const pub = os.$context<Context>();

// Re-export ORPCError from @orpc/server
export { ORPCError };

// Helper function to throw ORPC errors with the correct syntax
export function throwORPCError(
  code: "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT" | "INTERNAL_SERVER_ERROR",
  message: string
): never {
  throw new ORPCError(code, { message });
}

// Auth middleware - requires authenticated user
const authMiddleware = pub.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Not authenticated" });
  }
  return next({
    context: { ...context, user: context.user },
  });
});

// Admin middleware - requires admin user
const adminMiddleware = pub.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Not authenticated" });
  }
  requireAdmin(context.user);
  return next({
    context: { ...context, user: context.user },
  });
});

// Tenant middleware - requires user to be member of tenant
// Note: This middleware checks tenant access AFTER the input is parsed
const tenantMiddleware = pub.middleware(async ({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Not authenticated" });
  }

  // The actual tenant check will be done in each procedure since
  // we need access to the parsed input
  return next({ context: { ...context, user: context.user } });
});

// Helper to check tenant access - call this in tenant procedures
export async function requireTenantUser(
  context: Context & { user: NonNullable<Context["user"]> },
  tenantId: number
): Promise<void> {
  // Admins can access any tenant
  if (isAdmin(context.user)) {
    return;
  }

  // Check if person belongs to this tenant (primary) or is a helper
  const personId = context.user.userId;

  // First check if it's their primary tenant
  const [person] = await context.db
    .select()
    .from(people)
    .where(
      and(
        eq(people.id, personId),
        eq(people.tenantId, tenantId)
      )
    )
    .limit(1);

  if (person) {
    return; // Person belongs to this tenant
  }

  // Check if they're a helper in this tenant
  const [helper] = await context.db
    .select()
    .from(tenantHelpers)
    .where(
      and(
        eq(tenantHelpers.personId, personId),
        eq(tenantHelpers.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!helper) {
    throw new ORPCError("FORBIDDEN", { message: "Access denied to this tenant" });
  }
}

// Helper to check tenant owner access
export async function requireTenantOwner(
  context: Context & { user: NonNullable<Context["user"]> },
  tenantId: number
): Promise<void> {
  // Global admins can do anything
  if (isAdmin(context.user)) {
    return;
  }

  const personId = context.user.userId;

  const [person] = await context.db
    .select()
    .from(people)
    .where(
      and(
        eq(people.id, personId),
        eq(people.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!person || person.role !== "owner") {
    throw new ORPCError("FORBIDDEN", { message: "Only tenant owner can perform this action" });
  }
}

// Helper to check tenant admin access (owner OR admin)
export async function requireTenantManager(
  context: Context & { user: NonNullable<Context["user"]> },
  tenantId: number
): Promise<void> {
  // Global admins can do anything
  if (isAdmin(context.user)) {
    return;
  }

  const personId = context.user.userId;

  const [person] = await context.db
    .select()
    .from(people)
    .where(
      and(
        eq(people.id, personId),
        eq(people.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!person || (person.role !== "owner" && person.role !== "admin")) {
    throw new ORPCError("FORBIDDEN", { message: "Only tenant owner or admin can perform this action" });
  }
}

// Procedure builders
export const publicProcedure = pub;
export const protectedProcedure = pub.use(authMiddleware);
export const adminProcedure = pub.use(adminMiddleware);
export const tenantProcedure = pub.use(tenantMiddleware);
