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
  tenantSkillIncompatibility,
} from "@/db/schema";
import { skillIncompatibilityRouter } from "./skill-incompatibility";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

// Test data IDs
let planId: number;
let tenantAId: number;
let tenantAOwnerEmailId: number;
let tenantAOwnerId: number;
let tenantAMemberEmailId: number;
let tenantAMemberId: number;
let tenantATeamId: number;
let tenantASkill1Id: number;
let tenantASkill2Id: number;
let tenantBId: number;
let tenantBOwnerEmailId: number;
let tenantBOwnerId: number;
let tenantBTeamId: number;
let tenantBSkillId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Skill Incompatibility",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // ============ TENANT A SETUP ============
  const [tenantA] = await db.insert(tenants).values({
    name: "Tenant A Incompatibility",
    slug: "tenant-a-incompatibility",
    planId,
  }).returning();
  tenantAId = tenantA!.id;

  // Create Tenant A Owner
  const [ownerAEmail] = await db.insert(emails).values({ email: "owner-a-incompatibility@test.com" }).returning();
  tenantAOwnerEmailId = ownerAEmail!.id;
  const [ownerA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAOwnerEmailId,
    role: "owner",
  }).returning();
  tenantAOwnerId = ownerA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAOwnerId });

  // Create Tenant A Member (no role)
  const [memberAEmail] = await db.insert(emails).values({ email: "member-a-incompatibility@test.com" }).returning();
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
    name: "Sound Team A Incompatibility",
  }).returning();
  tenantATeamId = teamA!.id;

  // Create Skills for Tenant A
  const [skill1] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    name: "MD",
  }).returning();
  tenantASkill1Id = skill1!.id;

  const [skill2] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    name: "Lead Singer",
  }).returning();
  tenantASkill2Id = skill2!.id;

  // ============ TENANT B SETUP ============
  const [tenantB] = await db.insert(tenants).values({
    name: "Tenant B Incompatibility",
    slug: "tenant-b-incompatibility",
    planId,
  }).returning();
  tenantBId = tenantB!.id;

  // Create Tenant B Owner
  const [ownerBEmail] = await db.insert(emails).values({ email: "owner-b-incompatibility@test.com" }).returning();
  tenantBOwnerEmailId = ownerBEmail!.id;
  const [ownerB] = await db.insert(people).values({
    tenantId: tenantBId,
    emailId: tenantBOwnerEmailId,
    role: "owner",
  }).returning();
  tenantBOwnerId = ownerB!.id;
  await db.insert(tenantUsers).values({ personId: tenantBOwnerId });

  // Create Tenant B Team
  const [teamB] = await db.insert(tenantTeams).values({
    tenantId: tenantBId,
    name: "Sound Team B Incompatibility",
  }).returning();
  tenantBTeamId = teamB!.id;

  // Create Skill for Tenant B
  const [skillB] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantBId,
    teamId: tenantBTeamId,
    name: "FOH Engineer B",
  }).returning();
  tenantBSkillId = skillB!.id;
});

afterAll(async () => {
  // Clean up in reverse order of dependencies
  await db.delete(tenantSkillIncompatibility).where(eq(tenantSkillIncompatibility.tenantId, tenantAId));
  await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantAId));
  await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantBId));
  await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantAId));
  await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantBId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAOwnerId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAMemberId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantBOwnerId));
  await db.delete(people).where(eq(people.tenantId, tenantAId));
  await db.delete(people).where(eq(people.tenantId, tenantBId));
  await db.delete(emails).where(eq(emails.id, tenantAOwnerEmailId));
  await db.delete(emails).where(eq(emails.id, tenantAMemberEmailId));
  await db.delete(emails).where(eq(emails.id, tenantBOwnerEmailId));
  await db.delete(tenants).where(eq(tenants.id, tenantAId));
  await db.delete(tenants).where(eq(tenants.id, tenantBId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("Skill Incompatibility Router", () => {
  describe("add", () => {
    test("can add incompatibility between skills in same tenant", async () => {
      // MD and Lead Singer cannot be done simultaneously
      const result = await callAs(
        skillIncompatibilityRouter.add,
        { tenantId: tenantAId, skillId1: tenantASkill1Id, skillId2: tenantASkill2Id },
        ctx.asUser(tenantAOwnerId, "owner-a-incompatibility@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
    });

    test("cannot add incompatibility using skill from another tenant", async () => {
      await expect(
        callAs(
          skillIncompatibilityRouter.add,
          { tenantId: tenantAId, skillId1: tenantASkill1Id, skillId2: tenantBSkillId },
          ctx.asUser(tenantAOwnerId, "owner-a-incompatibility@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
        )
      ).rejects.toThrow("One or both skills do not belong to this tenant");
    });

    test("member cannot add skill incompatibility", async () => {
      await expect(
        callAs(
          skillIncompatibilityRouter.add,
          { tenantId: tenantAId, skillId1: tenantASkill1Id, skillId2: tenantASkill2Id },
          ctx.asUser(tenantAMemberId, "member-a-incompatibility@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });
  });

  describe("list", () => {
    test("can list skill incompatibilities", async () => {
      const result = await callAs(
        skillIncompatibilityRouter.list,
        { tenantId: tenantAId },
        ctx.asUser(tenantAMemberId, "member-a-incompatibility@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result.length).toBeGreaterThan(0);
    });

    test("tenant B cannot see tenant A incompatibilities", async () => {
      const result = await callAs(
        skillIncompatibilityRouter.list,
        { tenantId: tenantBId },
        ctx.asUser(tenantBOwnerId, "owner-b-incompatibility@test.com", "Owner B").inTenant(tenantBId).asTenantOwner()
      );

      expect(result.length).toBe(0);
    });
  });

  describe("remove", () => {
    test("can remove skill incompatibility", async () => {
      const result = await callAs(
        skillIncompatibilityRouter.remove,
        { tenantId: tenantAId, skillId1: tenantASkill1Id, skillId2: tenantASkill2Id },
        ctx.asUser(tenantAOwnerId, "owner-a-incompatibility@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });

    test("member cannot remove skill incompatibility", async () => {
      // First add it back
      await callAs(
        skillIncompatibilityRouter.add,
        { tenantId: tenantAId, skillId1: tenantASkill1Id, skillId2: tenantASkill2Id },
        ctx.asUser(tenantAOwnerId, "owner-a-incompatibility@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      // Try to remove as member
      await expect(
        callAs(
          skillIncompatibilityRouter.remove,
          { tenantId: tenantAId, skillId1: tenantASkill1Id, skillId2: tenantASkill2Id },
          ctx.asUser(tenantAMemberId, "member-a-incompatibility@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });
  });
});
