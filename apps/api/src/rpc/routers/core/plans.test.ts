import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import { tenantPlans, emails, admins } from "@/db/schema";
import { plansRouter } from "./plans";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

const adminEmail = "plans-admin@test.com";
let adminEmailId: number;
let planId: number;

beforeAll(async () => {
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
  // Clean up plans
  if (planId) {
    await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
  }

  // Clean up admin
  await db.delete(admins).where(eq(admins.emailId, adminEmailId));
  await db.delete(emails).where(eq(emails.id, adminEmailId));
});

describe("Plans Router", () => {
  describe("createPlan", () => {
    test("should create a plan as admin", async () => {
      const result = await callAs(
        plansRouter.createPlan,
        {
          name: "Test Plan",
          price: "29.99",
          maxSeats: 10,
        },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Test Plan");
      expect(result.price).toBe("29.99");
      expect(result.maxSeats).toBe(10);
      planId = result.id;
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          plansRouter.createPlan,
          { name: "Unauthorized Plan", price: "10", maxSeats: 5 },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("listPlans", () => {
    test("should list all plans as admin", async () => {
      const result = await callAs(
        plansRouter.listPlans,
        undefined,
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.length).toBeGreaterThan(0);
      const plan = result.find((p: { id: number }) => p.id === planId);
      expect(plan?.name).toBe("Test Plan");
      expect(plan?.price).toBe("29.99");
      expect(plan?.maxSeats).toBe(10);
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          plansRouter.listPlans,
          undefined,
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("updatePlan", () => {
    test("should update plan name", async () => {
      const result = await callAs(
        plansRouter.updatePlan,
        { id: planId, name: "Updated Plan" },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.name).toBe("Updated Plan");
      expect(result.price).toBe("29.99");
      expect(result.maxSeats).toBe(10);
    });

    test("should update plan price", async () => {
      const result = await callAs(
        plansRouter.updatePlan,
        { id: planId, price: "39.99" },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.name).toBe("Updated Plan");
      expect(result.price).toBe("39.99");
      expect(result.maxSeats).toBe(10);
    });

    test("should update plan maxSeats", async () => {
      const result = await callAs(
        plansRouter.updatePlan,
        { id: planId, maxSeats: 20 },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.name).toBe("Updated Plan");
      expect(result.price).toBe("39.99");
      expect(result.maxSeats).toBe(20);
    });

    test("should update multiple fields at once", async () => {
      const result = await callAs(
        plansRouter.updatePlan,
        { id: planId, name: "Final Plan", price: "49.99", maxSeats: 30 },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.name).toBe("Final Plan");
      expect(result.price).toBe("49.99");
      expect(result.maxSeats).toBe(30);
    });

    test("should fail for non-existent plan", async () => {
      expect(
        callAs(
          plansRouter.updatePlan,
          { id: 999999, name: "Non-existent" },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Plan not found");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          plansRouter.updatePlan,
          { id: planId, name: "Unauthorized Update" },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("deletePlan", () => {
    test("should fail for non-existent plan", async () => {
      expect(
        callAs(
          plansRouter.deletePlan,
          { id: 999999 },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Plan not found");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          plansRouter.deletePlan,
          { id: planId },
          ctx.asUser(1, "user@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });

    test("should delete a plan as admin", async () => {
      const result = await callAs(
        plansRouter.deletePlan,
        { id: planId },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.success).toBe(true);

      // Verify plan was deleted
      const plans = await db.select().from(tenantPlans).where(eq(tenantPlans.id, planId));
      expect(plans.length).toBe(0);

      // Clear planId so afterAll doesn't try to delete it again
      planId = 0;
    });
  });
});
