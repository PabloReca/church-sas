import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import { tenants, admins, tenantPlans, emails, people, tenantPeopleFields, tenantPeopleFieldValues, tenantUsers } from "@/db/schema";
import { tenantsRouter } from "./tenants";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

const adminEmail = "tenants-admin@test.com";
let adminEmailId: number;
let tenantId: number;
let planId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  if (!plan) throw new Error("Failed to create test plan");
  planId = plan.id;

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
  if (tenantId) {
    // Clean up tenant data - order matters due to FK constraints
    const tenantPeople = await db.select().from(people).where(eq(people.tenantId, tenantId));
    for (const person of tenantPeople) {
      await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.personId, person.id));
      await db.delete(tenantUsers).where(eq(tenantUsers.personId, person.id));
    }
    await db.delete(tenantPeopleFields).where(eq(tenantPeopleFields.tenantId, tenantId));
    await db.delete(people).where(eq(people.tenantId, tenantId));
    // Now delete people's emails
    for (const person of tenantPeople) {
      if (person.emailId) {
        await db.delete(emails).where(eq(emails.id, person.emailId));
      }
    }
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }
  await db.delete(admins).where(eq(admins.emailId, adminEmailId));
  await db.delete(emails).where(eq(emails.id, adminEmailId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
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
  });
});
