import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import {
  tenants,
  tenantPlans,
  emails,
  people,
  tenantUsers,
  tenantTeams,
  tenantTeamSkills,
  tenantEventTemplates,
  tenantEventTemplateSlots,
} from "@/db/schema";
import { eventTemplatesRouter } from "./templates";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

// Test data IDs
let planId: number;
let tenantAId: number;
let tenantAOwnerEmailId: number;
let tenantAOwnerId: number;
let tenantAAdminEmailId: number;
let tenantAAdminId: number;
let tenantAMemberEmailId: number;
let tenantAMemberId: number;
let tenantATeamId: number;
let tenantASkillId: number;
let tenantBId: number;
let tenantBOwnerEmailId: number;
let tenantBOwnerId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Event Templates",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // ============ TENANT A SETUP ============
  const [tenantA] = await db.insert(tenants).values({
    name: "Tenant A Templates",
    slug: "tenant-a-templates",
    planId,
  }).returning();
  tenantAId = tenantA!.id;

  // Create Tenant A Owner
  const [ownerAEmail] = await db.insert(emails).values({ email: "owner-a-templates@test.com" }).returning();
  tenantAOwnerEmailId = ownerAEmail!.id;
  const [ownerA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAOwnerEmailId,
    role: "owner",
  }).returning();
  tenantAOwnerId = ownerA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAOwnerId });

  // Create Tenant A Admin
  const [adminAEmail] = await db.insert(emails).values({ email: "admin-a-templates@test.com" }).returning();
  tenantAAdminEmailId = adminAEmail!.id;
  const [adminA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAAdminEmailId,
    role: "admin",
  }).returning();
  tenantAAdminId = adminA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAAdminId });

  // Create Tenant A Member (no role)
  const [memberAEmail] = await db.insert(emails).values({ email: "member-a-templates@test.com" }).returning();
  tenantAMemberEmailId = memberAEmail!.id;
  const [memberA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAMemberEmailId,
    role: null,
  }).returning();
  tenantAMemberId = memberA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAMemberId });

  // Create Tenant A Team
  const [teamA] = await db.insert(tenantTeams).values({
    tenantId: tenantAId,
    name: "Sound Team A Templates",
  }).returning();
  tenantATeamId = teamA!.id;

  // Create Skill for Tenant A
  const [skill] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    name: "FOH Engineer",
  }).returning();
  tenantASkillId = skill!.id;

  // ============ TENANT B SETUP ============
  const [tenantB] = await db.insert(tenants).values({
    name: "Tenant B Templates",
    slug: "tenant-b-templates",
    planId,
  }).returning();
  tenantBId = tenantB!.id;

  // Create Tenant B Owner
  const [ownerBEmail] = await db.insert(emails).values({ email: "owner-b-templates@test.com" }).returning();
  tenantBOwnerEmailId = ownerBEmail!.id;
  const [ownerB] = await db.insert(people).values({
    tenantId: tenantBId,
    emailId: tenantBOwnerEmailId,
    role: "owner",
  }).returning();
  tenantBOwnerId = ownerB!.id;
  await db.insert(tenantUsers).values({ personId: tenantBOwnerId });
});

afterAll(async () => {
  // Clean up in reverse order of dependencies
  await db.delete(tenantEventTemplateSlots).where(eq(tenantEventTemplateSlots.tenantId, tenantAId));
  await db.delete(tenantEventTemplateSlots).where(eq(tenantEventTemplateSlots.tenantId, tenantBId));
  await db.delete(tenantEventTemplates).where(eq(tenantEventTemplates.tenantId, tenantAId));
  await db.delete(tenantEventTemplates).where(eq(tenantEventTemplates.tenantId, tenantBId));
  await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantAId));
  await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantAId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAOwnerId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAAdminId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAMemberId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantBOwnerId));
  await db.delete(people).where(eq(people.tenantId, tenantAId));
  await db.delete(people).where(eq(people.tenantId, tenantBId));
  await db.delete(emails).where(eq(emails.id, tenantAOwnerEmailId));
  await db.delete(emails).where(eq(emails.id, tenantAAdminEmailId));
  await db.delete(emails).where(eq(emails.id, tenantAMemberEmailId));
  await db.delete(emails).where(eq(emails.id, tenantBOwnerEmailId));
  await db.delete(tenants).where(eq(tenants.id, tenantAId));
  await db.delete(tenants).where(eq(tenants.id, tenantBId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("Event Templates Router", () => {
  let templateAId: number;

  describe("create", () => {
    test("owner can create template in their tenant", async () => {
      const result = await callAs(
        eventTemplatesRouter.create,
        { tenantId: tenantAId, name: "Sunday Service", description: "Weekly service" },
        ctx.asUser(tenantAOwnerId, "owner-a-templates@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Sunday Service");
      templateAId = result.id;
    });

    test("admin can create template in their tenant", async () => {
      const result = await callAs(
        eventTemplatesRouter.create,
        { tenantId: tenantAId, name: "Midweek Service" },
        ctx.asUser(tenantAAdminId, "admin-a-templates@test.com", "Admin A").inTenant(tenantAId).asTenantAdmin()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Midweek Service");
    });

    test("member cannot create template", async () => {
      await expect(
        callAs(
          eventTemplatesRouter.create,
          { tenantId: tenantAId, name: "Unauthorized Template" },
          ctx.asUser(tenantAMemberId, "member-a-templates@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });

    test("user from tenant B cannot create template in tenant A", async () => {
      await expect(
        callAs(
          eventTemplatesRouter.create,
          { tenantId: tenantAId, name: "Cross-tenant Template" },
          ctx.asUser(tenantBOwnerId, "owner-b-templates@test.com", "Owner B").inTenant(tenantBId).asTenantOwner()
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });
  });

  describe("list", () => {
    test("user from tenant B cannot see templates from tenant A", async () => {
      const result = await callAs(
        eventTemplatesRouter.list,
        { tenantId: tenantBId },
        ctx.asUser(tenantBOwnerId, "owner-b-templates@test.com", "Owner B").inTenant(tenantBId).asTenantOwner()
      );

      // Should only see tenant B templates (none created yet)
      expect(result.length).toBe(0);
    });

    test("member can list templates in their tenant", async () => {
      const result = await callAs(
        eventTemplatesRouter.list,
        { tenantId: tenantAId },
        ctx.asUser(tenantAMemberId, "member-a-templates@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("get", () => {
    test("can get template by id", async () => {
      const result = await callAs(
        eventTemplatesRouter.get,
        { tenantId: tenantAId, templateId: templateAId },
        ctx.asUser(tenantAMemberId, "member-a-templates@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(templateAId);
      expect(result!.name).toBe("Sunday Service");
    });
  });

  describe("update", () => {
    test("owner can update template", async () => {
      const result = await callAs(
        eventTemplatesRouter.update,
        { tenantId: tenantAId, templateId: templateAId, name: "Sunday Morning Service" },
        ctx.asUser(tenantAOwnerId, "owner-a-templates@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.name).toBe("Sunday Morning Service");
    });

    test("member cannot update template", async () => {
      await expect(
        callAs(
          eventTemplatesRouter.update,
          { tenantId: tenantAId, templateId: templateAId, name: "Hacked" },
          ctx.asUser(tenantAMemberId, "member-a-templates@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });
  });

  describe("Template Slots", () => {
    let slotId: number;

    test("can create slot for template", async () => {
      const result = await callAs(
        eventTemplatesRouter.createSlot,
        {
          tenantId: tenantAId,
          templateId: templateAId,
          teamId: tenantATeamId,
          skillId: tenantASkillId,
          quantity: 2,
        },
        ctx.asUser(tenantAOwnerId, "owner-a-templates@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.quantity).toBe(2);
      slotId = result.id;
    });

    test("can list template slots", async () => {
      const result = await callAs(
        eventTemplatesRouter.listSlots,
        { tenantId: tenantAId, templateId: templateAId },
        ctx.asUser(tenantAMemberId, "member-a-templates@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result.length).toBe(1);
      expect(result[0]!.skillId).toBe(tenantASkillId);
    });

    test("can update slot quantity", async () => {
      const result = await callAs(
        eventTemplatesRouter.updateSlot,
        { tenantId: tenantAId, slotId, quantity: 3 },
        ctx.asUser(tenantAOwnerId, "owner-a-templates@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.quantity).toBe(3);
    });

    test("member cannot create slot", async () => {
      await expect(
        callAs(
          eventTemplatesRouter.createSlot,
          {
            tenantId: tenantAId,
            templateId: templateAId,
            teamId: tenantATeamId,
            skillId: tenantASkillId,
            quantity: 1,
          },
          ctx.asUser(tenantAMemberId, "member-a-templates@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });

    test("can delete slot", async () => {
      const result = await callAs(
        eventTemplatesRouter.deleteSlot,
        { tenantId: tenantAId, slotId },
        ctx.asUser(tenantAOwnerId, "owner-a-templates@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });
  });

  describe("delete", () => {
    test("owner can delete template", async () => {
      const result = await callAs(
        eventTemplatesRouter.delete,
        { tenantId: tenantAId, templateId: templateAId },
        ctx.asUser(tenantAOwnerId, "owner-a-templates@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Global Admin Access", () => {
    test("global admin can create template in any tenant", async () => {
      const result = await callAs(
        eventTemplatesRouter.create,
        { tenantId: tenantBId, name: "Admin Created Template" },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Admin Created Template");
    });

    test("global admin can list templates in any tenant", async () => {
      const result = await callAs(
        eventTemplatesRouter.list,
        { tenantId: tenantAId },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
