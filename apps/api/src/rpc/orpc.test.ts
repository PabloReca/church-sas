import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import { tenants, people, emails, tenantHelpers, tenantPlans, admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";
import { call } from "@orpc/server";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  tenantProcedure,
  requireTenantUser,
  requireTenantOwner,
  requireTenantManager,
  throwORPCError,
  ORPCError
} from "./orpc";
import { z } from "zod";

const db = getDb();
const ctx = new TestContext(db);

let testPlanId: number;
let tenantAId: number;
let tenantBId: number;
let emailAId: number;
let emailBId: number;
let emailCId: number;
let emailAdminId: number;
let personAId: number;
let personBId: number;
let personCOwnerId: number;

beforeAll(async () => {
  // Create test plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan",
    price: "1000",
    maxSeats: 10,
  }).returning();
  if (!plan) throw new Error("Failed to create plan");
  testPlanId = plan.id;

  // Create tenants
  const [tenantA] = await db.insert(tenants).values({
    name: "Tenant A",
    slug: "tenant-a-orpc",
    planId: testPlanId,
  }).returning();
  if (!tenantA) throw new Error("Failed to create tenant A");
  tenantAId = tenantA.id;

  const [tenantB] = await db.insert(tenants).values({
    name: "Tenant B",
    slug: "tenant-b-orpc",
    planId: testPlanId,
  }).returning();
  if (!tenantB) throw new Error("Failed to create tenant B");
  tenantBId = tenantB.id;

  // Create emails
  const [emailA] = await db.insert(emails).values({
    email: "persona@orpc-test.com",
  }).returning();
  if (!emailA) throw new Error("Failed to create email A");
  emailAId = emailA.id;

  const [emailB] = await db.insert(emails).values({
    email: "personb@orpc-test.com",
  }).returning();
  if (!emailB) throw new Error("Failed to create email B");
  emailBId = emailB.id;

  const [emailC] = await db.insert(emails).values({
    email: "personc@orpc-test.com",
  }).returning();
  if (!emailC) throw new Error("Failed to create email C");
  emailCId = emailC.id;

  const [emailAdmin] = await db.insert(emails).values({
    email: "admin@orpc-test.com",
  }).returning();
  if (!emailAdmin) throw new Error("Failed to create admin email");
  emailAdminId = emailAdmin.id;

  // Create people
  // Person A - regular member in tenant A
  const [personA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: emailAId,
    role: null,
  }).returning();
  if (!personA) throw new Error("Failed to create person A");
  personAId = personA.id;

  // Person B - admin in tenant A
  const [personB] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: emailBId,
    role: "admin",
  }).returning();
  if (!personB) throw new Error("Failed to create person B");
  personBId = personB.id;

  // Person C - owner in tenant B
  const [personC] = await db.insert(people).values({
    tenantId: tenantBId,
    emailId: emailCId,
    role: "owner",
  }).returning();
  if (!personC) throw new Error("Failed to create person C");
  personCOwnerId = personC.id;

  // Create global admin
  await db.insert(admins).values({
    emailId: emailAdminId,
    name: "Global Admin",
  });

  // Make person A a helper in tenant B
  await db.insert(tenantHelpers).values({
    tenantId: tenantBId,
    personId: personAId,
  });
});

afterAll(async () => {
  // Cleanup
  await db.delete(tenantHelpers).where(eq(tenantHelpers.personId, personAId));
  await db.delete(admins).where(eq(admins.emailId, emailAdminId));
  await db.delete(people).where(eq(people.tenantId, tenantAId));
  await db.delete(people).where(eq(people.tenantId, tenantBId));
  await db.delete(tenants).where(eq(tenants.id, tenantAId));
  await db.delete(tenants).where(eq(tenants.id, tenantBId));
  await db.delete(emails).where(eq(emails.id, emailAId));
  await db.delete(emails).where(eq(emails.id, emailBId));
  await db.delete(emails).where(eq(emails.id, emailCId));
  await db.delete(emails).where(eq(emails.id, emailAdminId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, testPlanId));
});

describe("ORPC - throwORPCError", () => {
  test("should throw ORPC error with correct code and message", () => {
    expect(() => throwORPCError("FORBIDDEN", "Access denied")).toThrow(ORPCError);

    try {
      throwORPCError("NOT_FOUND", "Resource not found");
    } catch (error) {
      expect(error).toBeInstanceOf(ORPCError);
      if (error instanceof ORPCError) {
        expect(error.code).toBe("NOT_FOUND");
        expect(error.message).toBe("Resource not found");
      }
    }
  });

  test("should handle all error codes", () => {
    const codes = ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "BAD_REQUEST", "CONFLICT", "INTERNAL_SERVER_ERROR"] as const;

    for (const code of codes) {
      try {
        throwORPCError(code, `Test ${code}`);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ORPCError);
        if (error instanceof ORPCError) {
          expect(error.code).toBe(code);
        }
      }
    }
  });
});

describe("ORPC - Procedure Builders", () => {
  describe("publicProcedure", () => {
    test("should allow unauthenticated access", async () => {
      const testProc = publicProcedure
        .input(z.object({ message: z.string() }))
        .handler(({ input }) => ({ result: input.message }));

      const result = await call(testProc, { message: "hello" }, {
        context: { db, user: null, req: new Request("http://localhost") }
      });
      expect(result.result).toBe("hello");
    });

    test("should work without user in context", async () => {
      const testProc = publicProcedure
        .handler(() => ({ success: true }));

      const result = await call(testProc, {}, {
        context: { db, user: null, req: new Request("http://localhost") }
      });
      expect(result.success).toBe(true);
    });
  });

  describe("protectedProcedure", () => {
    test("should allow authenticated user", async () => {
      const testProc = protectedProcedure
        .handler(({ context }) => ({ userId: context.user.userId }));

      const result = await callAs(testProc, {}, ctx.asUser(personAId, "persona@orpc-test.com"));
      expect(result.userId).toBe(personAId);
    });

    test("should reject unauthenticated user", async () => {
      const testProc = protectedProcedure
        .handler(() => ({ success: true }));

      await expect(
        call(testProc, {}, {
          context: { db, user: null, req: new Request("http://localhost") }
        })
      ).rejects.toThrow();
    });
  });

  describe("adminProcedure", () => {
    test("should allow admin user", async () => {
      const testProc = adminProcedure
        .handler(({ context }) => ({ userId: context.user.userId }));

      const result = await callAs(testProc, {}, ctx.asUser(1, "admin@orpc-test.com").asAdmin());
      expect(result.userId).toBe(1);
    });

    test("should reject non-admin user", async () => {
      const testProc = adminProcedure
        .handler(() => ({ success: true }));

      await expect(
        callAs(testProc, {}, ctx.asUser(personAId, "persona@orpc-test.com"))
      ).rejects.toThrow();
    });

    test("should reject unauthenticated user", async () => {
      const testProc = adminProcedure
        .handler(() => ({ success: true }));

      await expect(
        call(testProc, {}, {
          context: { db, user: null, req: new Request("http://localhost") }
        })
      ).rejects.toThrow();
    });
  });

  describe("tenantProcedure", () => {
    test("should allow authenticated user to pass middleware", async () => {
      const testProc = tenantProcedure
        .handler(({ context }) => ({ userId: context.user.userId }));

      const result = await callAs(testProc, {}, ctx.asUser(personAId, "persona@orpc-test.com"));
      expect(result.userId).toBe(personAId);
    });

    test("should reject unauthenticated user", async () => {
      const testProc = tenantProcedure
        .handler(() => ({ success: true }));

      await expect(
        call(testProc, {}, {
          context: { db, user: null, req: new Request("http://localhost") }
        })
      ).rejects.toThrow();
    });
  });
});

describe("ORPC - requireTenantUser", () => {
  test("should allow global admin to access any tenant", async () => {
    const mockContext = {
      db,
      user: {
        userId: 99999,
        email: "admin@orpc-test.com",
        name: "Global Admin",
        isAdmin: true,
        tenantId: 0,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantUser(mockContext, tenantAId)).resolves.toBeUndefined();
  });

  test("should allow user to access their primary tenant", async () => {
    const mockContext = {
      db,
      user: {
        userId: personAId,
        email: "persona@orpc-test.com",
        name: "Person A",
        isAdmin: false,
        tenantId: tenantAId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantUser(mockContext, tenantAId)).resolves.toBeUndefined();
  });

  test("should allow helper to access tenant they help in", async () => {
    const mockContext = {
      db,
      user: {
        userId: personAId,
        email: "persona@orpc-test.com",
        name: "Person A",
        isAdmin: false,
        tenantId: tenantAId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    // Person A is a helper in tenant B
    await expect(requireTenantUser(mockContext, tenantBId)).resolves.toBeUndefined();
  });

  test("should reject user accessing tenant they don't belong to", async () => {
    const mockContext = {
      db,
      user: {
        userId: personCOwnerId,
        email: "personc@orpc-test.com",
        name: "Person C",
        isAdmin: false,
        tenantId: tenantBId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantUser(mockContext, tenantAId)).rejects.toThrow("Access denied to this tenant");
  });
});

describe("ORPC - requireTenantOwner", () => {
  test("should allow global admin", async () => {
    const mockContext = {
      db,
      user: {
        userId: 99999,
        email: "admin@orpc-test.com",
        name: "Global Admin",
        isAdmin: true,
        tenantId: 0,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantOwner(mockContext, tenantAId)).resolves.toBeUndefined();
  });

  test("should allow tenant owner", async () => {
    const mockContext = {
      db,
      user: {
        userId: personCOwnerId,
        email: "personc@orpc-test.com",
        name: "Person C",
        isAdmin: false,
        tenantId: tenantBId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantOwner(mockContext, tenantBId)).resolves.toBeUndefined();
  });

  test("should reject tenant admin (not owner)", async () => {
    const mockContext = {
      db,
      user: {
        userId: personBId,
        email: "personb@orpc-test.com",
        name: "Person B",
        isAdmin: false,
        tenantId: tenantAId,
        isTenantAdmin: true,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantOwner(mockContext, tenantAId)).rejects.toThrow("Only tenant owner can perform this action");
  });

  test("should reject regular member", async () => {
    const mockContext = {
      db,
      user: {
        userId: personAId,
        email: "persona@orpc-test.com",
        name: "Person A",
        isAdmin: false,
        tenantId: tenantAId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantOwner(mockContext, tenantAId)).rejects.toThrow("Only tenant owner can perform this action");
  });

  test("should reject user from different tenant", async () => {
    const mockContext = {
      db,
      user: {
        userId: personCOwnerId,
        email: "personc@orpc-test.com",
        name: "Person C",
        isAdmin: false,
        tenantId: tenantBId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantOwner(mockContext, tenantAId)).rejects.toThrow("Only tenant owner can perform this action");
  });
});

describe("ORPC - requireTenantManager", () => {
  test("should allow global admin", async () => {
    const mockContext = {
      db,
      user: {
        userId: 99999,
        email: "admin@orpc-test.com",
        name: "Global Admin",
        isAdmin: true,
        tenantId: 0,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantManager(mockContext, tenantAId)).resolves.toBeUndefined();
  });

  test("should allow tenant owner", async () => {
    const mockContext = {
      db,
      user: {
        userId: personCOwnerId,
        email: "personc@orpc-test.com",
        name: "Person C",
        isAdmin: false,
        tenantId: tenantBId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantManager(mockContext, tenantBId)).resolves.toBeUndefined();
  });

  test("should allow tenant admin", async () => {
    const mockContext = {
      db,
      user: {
        userId: personBId,
        email: "personb@orpc-test.com",
        name: "Person B",
        isAdmin: false,
        tenantId: tenantAId,
        isTenantAdmin: true,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantManager(mockContext, tenantAId)).resolves.toBeUndefined();
  });

  test("should reject regular member", async () => {
    const mockContext = {
      db,
      user: {
        userId: personAId,
        email: "persona@orpc-test.com",
        name: "Person A",
        isAdmin: false,
        tenantId: tenantAId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantManager(mockContext, tenantAId)).rejects.toThrow("Only tenant owner or admin can perform this action");
  });

  test("should reject user from different tenant", async () => {
    const mockContext = {
      db,
      user: {
        userId: personCOwnerId,
        email: "personc@orpc-test.com",
        name: "Person C",
        isAdmin: false,
        tenantId: tenantBId,
        isTenantAdmin: false,
      },
      req: new Request("http://localhost"),
    };

    await expect(requireTenantManager(mockContext, tenantAId)).rejects.toThrow("Only tenant owner or admin can perform this action");
  });
});
