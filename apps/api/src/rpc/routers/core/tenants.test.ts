import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import { tenants, admins, tenantPlans, emails, people, tenantPeopleFields, tenantPeopleFieldValues, tenantUsers, tenantHelpers } from "@/db/schema";
import { tenantsRouter } from "./tenants";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

const adminEmail = "tenants-admin@test.com";
let adminEmailId: number;
let tenantId: number;
let secondTenantId: number = 0;
let planId: number;
let secondPlanId: number;

beforeAll(async () => {
  // Create first plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  if (!plan) throw new Error("Failed to create test plan");
  planId = plan.id;

  // Create second plan for testing plan updates
  const [plan2] = await db.insert(tenantPlans).values({
    name: "Premium Plan",
    price: "20",
    maxSeats: 20,
    maxPeople: 100,
  }).returning();
  if (!plan2) throw new Error("Failed to create second test plan");
  secondPlanId = plan2.id;

  // Create admin email
  let [emailRecord] = await db.select().from(emails).where(eq(emails.email, adminEmail)).limit(1);
  if (!emailRecord) {
    [emailRecord] = await db.insert(emails).values({ email: adminEmail }).returning();
  }
  if (!emailRecord) throw new Error("Failed to create email record");
  adminEmailId = emailRecord.id;

  // Create admin
  await db.insert(admins).values({
    emailId: adminEmailId,
    name: "Test Admin",
  });
});

afterAll(async () => {
  // Clean up function for a tenant
  const cleanupTenant = async (id: number) => {
    const tenantPeople = await db.select().from(people).where(eq(people.tenantId, id));
    for (const person of tenantPeople) {
      await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.personId, person.id));
      await db.delete(tenantUsers).where(eq(tenantUsers.personId, person.id));
      await db.delete(tenantHelpers).where(eq(tenantHelpers.personId, person.id));
    }
    await db.delete(tenantPeopleFields).where(eq(tenantPeopleFields.tenantId, id));
    await db.delete(people).where(eq(people.tenantId, id));
    for (const person of tenantPeople) {
      if (person.emailId) {
        await db.delete(emails).where(eq(emails.id, person.emailId));
      }
    }
    await db.delete(tenants).where(eq(tenants.id, id));
  };

  if (tenantId) await cleanupTenant(tenantId);
  if (secondTenantId) await cleanupTenant(secondTenantId);

  await db.delete(admins).where(eq(admins.emailId, adminEmailId));
  await db.delete(emails).where(eq(emails.id, adminEmailId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, secondPlanId));
});

describe("Tenants Router", () => {
  describe("create", () => {
    test("should create a tenant with admin person and default name field", async () => {
      const result = await callAs(
        tenantsRouter.create,
        {
          name: "Test Tenant",
          planId,
          adminEmail: "tenantadmin@test.com",
          adminName: "Tenant Admin",
        },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result!.name).toBe("Test Tenant");
      expect(result!.slug).toBe("test-tenant");
      expect(result!.planId).toBe(planId);
      tenantId = result!.id;

      // Verify admin person was created with owner role
      const [adminPerson] = await db
        .select()
        .from(people)
        .where(eq(people.tenantId, tenantId))
        .limit(1);
      expect(adminPerson).toBeDefined();
      expect(adminPerson!.role).toBe("owner");

      // Verify default "name" field was created
      const [nameField] = await db
        .select()
        .from(tenantPeopleFields)
        .where(eq(tenantPeopleFields.tenantId, tenantId))
        .limit(1);
      expect(nameField).toBeDefined();
      expect(nameField!.name).toBe("name");

      // Verify admin's name was set
      const [nameValue] = await db
        .select()
        .from(tenantPeopleFieldValues)
        .where(eq(tenantPeopleFieldValues.personId, adminPerson!.id))
        .limit(1);
      expect(nameValue).toBeDefined();
      expect(nameValue!.value).toBe("Tenant Admin");

      // Verify active seat was created
      const [seat] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.personId, adminPerson!.id))
        .limit(1);
      expect(seat).toBeDefined();
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          tenantsRouter.create,
          { name: "Test Tenant 2", planId, adminEmail: "test2@test.com", adminName: "Test" },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });

    test("should fail for duplicate email", async () => {
      expect(
        callAs(
          tenantsRouter.create,
          {
            name: "Another Tenant",
            planId,
            adminEmail: "tenantadmin@test.com", // Already used
            adminName: "Another Admin",
          },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Email already in use");
    });
  });

  describe("list", () => {
    test("should list all tenants as admin", async () => {
      const result = await callAs(
        tenantsRouter.list,
        undefined,
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.length).toBeGreaterThan(0);
      const tenant = result.find((t: { id: number }) => t.id === tenantId);
      expect(tenant?.name).toBe("Test Tenant");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          tenantsRouter.list,
          undefined,
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("getById", () => {
    test("should get tenant by ID", async () => {
      const result = await callAs(
        tenantsRouter.getById,
        { id: tenantId },
        ctx.asUser(1, "user@test.com", "Regular User")
      );

      expect(result?.id).toBe(tenantId);
      expect(result?.name).toBe("Test Tenant");
    });

    test("should return null for non-existent tenant", async () => {
      const result = await callAs(
        tenantsRouter.getById,
        { id: 999999 },
        ctx.asUser(1, "user@test.com", "Regular User")
      );

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    test("should update tenant name", async () => {
      const result = await callAs(
        tenantsRouter.update,
        { id: tenantId, name: "Updated Tenant" },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.name).toBe("Updated Tenant");
      expect(result.slug).toBe("updated-tenant");
    });

    test("should update tenant planId", async () => {
      const result = await callAs(
        tenantsRouter.update,
        { id: tenantId, planId: secondPlanId },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.planId).toBe(secondPlanId);
      expect(result.name).toBe("Updated Tenant");
    });

    test("should update both name and planId", async () => {
      const result = await callAs(
        tenantsRouter.update,
        { id: tenantId, name: "Final Tenant", planId: planId },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.name).toBe("Final Tenant");
      expect(result.slug).toBe("final-tenant");
      expect(result.planId).toBe(planId);
    });

    test("should fail when no fields to update", async () => {
      expect(
        callAs(
          tenantsRouter.update,
          { id: tenantId },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("No fields to update");
    });

    test("should fail for non-existent tenant", async () => {
      expect(
        callAs(
          tenantsRouter.update,
          { id: 999999, name: "Non-existent" },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Tenant not found");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          tenantsRouter.update,
          { id: tenantId, name: "Unauthorized" },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("getPeopleCount", () => {
    test("should return people count for tenant", async () => {
      const result = await callAs(
        tenantsRouter.getPeopleCount,
        { id: tenantId },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result.tenantUsers).toBe(1); // Owner has active seat
      expect(result.primaryMembers).toBe(1); // Owner is primary member
      expect(result.helpers).toBe(0);
      expect(result.totalPeople).toBe(1);
      expect(result.maxSeats).toBe(10);
      expect(result.maxPeople).toBe(50);
    });

    test("should fail for non-existent tenant", async () => {
      expect(
        callAs(
          tenantsRouter.getPeopleCount,
          { id: 999999 },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Tenant not found");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          tenantsRouter.getPeopleCount,
          { id: tenantId },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("remove", () => {
    test("should fail to delete non-existent tenant", async () => {
      expect(
        callAs(
          tenantsRouter.remove,
          { id: 999999 },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Tenant not found");
    });

    test("should create a tenant to be deleted", async () => {
      const result = await callAs(
        tenantsRouter.create,
        {
          name: "Tenant To Delete",
          planId,
          adminEmail: `delete-test-${Date.now()}@test.com`,
          adminName: "Delete Test",
        },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Tenant To Delete");
      secondTenantId = result.id;
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          tenantsRouter.remove,
          { id: secondTenantId },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });

    test("should delete tenant as admin", async () => {
      const result = await callAs(
        tenantsRouter.remove,
        { id: secondTenantId },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.success).toBe(true);

      // Verify tenant was deleted
      const deletedTenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, secondTenantId))
        .limit(1);
      expect(deletedTenant.length).toBe(0);

      // Clear secondTenantId so afterAll doesn't try to clean it up
      secondTenantId = 0;
    });
  });

  describe("create edge cases", () => {
    test("should fail for duplicate slug (similar names)", async () => {
      // Try to create tenant with name that generates same slug
      expect(
        callAs(
          tenantsRouter.create,
          {
            name: "Final!!Tenant", // Will generate "final-tenant" slug
            planId,
            adminEmail: "duplicate-slug@test.com",
            adminName: "Duplicate Slug",
          },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("A tenant with a similar name already exists");
    });
  });
});
