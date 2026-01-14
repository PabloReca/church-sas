import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import {
  tenants,
  tenantPlans,
  emails,
  people,
  tenantUsers,
  tenantTeams,
  tenantTeamMembers,
  tenantTeamSkills,
  tenantTeamMemberSkills,
} from "@/db/schema";
import { teamsRouter } from "./index";
import { teamMembersRouter } from "./members";
import { teamSkillsRouter } from "./skills";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

// Test data IDs
let planId: number;
let tenantId: number;
let ownerEmailId: number;
let ownerId: number;
let memberEmailId: number;
let memberId: number;
let teamId: number;
let skillId: number;
let teamMemberId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Teams",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // Create tenant
  const [tenant] = await db.insert(tenants).values({
    name: "Test Tenant Teams",
    slug: "test-tenant-teams",
    planId,
  }).returning();
  tenantId = tenant!.id;

  // Create owner
  const [ownerEmail] = await db.insert(emails).values({ email: "owner-teams@test.com" }).returning();
  ownerEmailId = ownerEmail!.id;
  const [owner] = await db.insert(people).values({
    tenantId,
    emailId: ownerEmailId,
    role: "owner",
  }).returning();
  ownerId = owner!.id;
  await db.insert(tenantUsers).values({ personId: ownerId });

  // Create member
  const [memberEmail] = await db.insert(emails).values({ email: "member-teams@test.com" }).returning();
  memberEmailId = memberEmail!.id;
  const [member] = await db.insert(people).values({
    tenantId,
    emailId: memberEmailId,
    role: null,
  }).returning();
  memberId = member!.id;
  await db.insert(tenantUsers).values({ personId: memberId });
});

afterAll(async () => {
  // Clean up in reverse order of dependencies
  await db.delete(tenantTeamMemberSkills).where(eq(tenantTeamMemberSkills.tenantId, tenantId));
  await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantId));
  await db.delete(tenantTeamMembers).where(eq(tenantTeamMembers.tenantId, tenantId));
  await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, ownerId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, memberId));
  await db.delete(people).where(eq(people.tenantId, tenantId));
  await db.delete(emails).where(eq(emails.id, ownerEmailId));
  await db.delete(emails).where(eq(emails.id, memberEmailId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("Teams Router", () => {
  describe("Team CRUD", () => {
    test("can create team", async () => {
      const result = await callAs(
        teamsRouter.create,
        { tenantId, name: "Sound Team", description: "Audio team" },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Sound Team");
      teamId = result.id;
    });

    test("can list teams", async () => {
      const result = await callAs(
        teamsRouter.list,
        { tenantId },
        ctx.asUser(memberId, "member-teams@test.com", "Member").inTenant(tenantId)
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.name).toBe("Sound Team");
    });

    test("can get team by id", async () => {
      const result = await callAs(
        teamsRouter.get,
        { tenantId, teamId },
        ctx.asUser(memberId, "member-teams@test.com", "Member").inTenant(tenantId)
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(teamId);
    });

    test("can update team", async () => {
      const result = await callAs(
        teamsRouter.update,
        { tenantId, teamId, name: "Audio Team" },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.name).toBe("Audio Team");
    });
  });

  describe("Team Members", () => {
    test("can add member to team", async () => {
      const result = await callAs(
        teamMembersRouter.addMember,
        { tenantId, teamId, userId: memberId, role: "member" },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(memberId);
      teamMemberId = result.id;
    });

    test("can list team members", async () => {
      const result = await callAs(
        teamMembersRouter.listMembers,
        { tenantId, teamId },
        ctx.asUser(memberId, "member-teams@test.com", "Member").inTenant(tenantId)
      );

      expect(result.length).toBe(1);
      expect(result[0]!.userId).toBe(memberId);
    });

    test("can update team member role", async () => {
      const result = await callAs(
        teamMembersRouter.updateMember,
        { tenantId, teamId, userId: memberId, role: "leader" },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.role).toBe("leader");
    });
  });

  describe("Team Skills", () => {
    test("can create team skill", async () => {
      const result = await callAs(
        teamSkillsRouter.createSkill,
        { tenantId, teamId, name: "FOH Engineer" },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("FOH Engineer");
      skillId = result.id;
    });

    test("can list team skills", async () => {
      const result = await callAs(
        teamSkillsRouter.listSkills,
        { tenantId, teamId },
        ctx.asUser(memberId, "member-teams@test.com", "Member").inTenant(tenantId)
      );

      expect(result.length).toBe(1);
      expect(result[0]!.name).toBe("FOH Engineer");
    });

    test("can update skill name", async () => {
      const result = await callAs(
        teamSkillsRouter.updateSkill,
        { tenantId, skillId, name: "Front of House Engineer" },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.name).toBe("Front of House Engineer");
    });
  });

  describe("Member Skills", () => {
    test("can assign skill to member", async () => {
      const result = await callAs(
        teamSkillsRouter.assignMemberSkill,
        { tenantId, teamMemberId, skillId, proficiencyLevel: 3 },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.proficiencyLevel).toBe(3);
    });

    test("can list member skills", async () => {
      const result = await callAs(
        teamSkillsRouter.listMemberSkills,
        { tenantId, teamMemberId },
        ctx.asUser(memberId, "member-teams@test.com", "Member").inTenant(tenantId)
      );

      expect(result.length).toBe(1);
      expect(result[0]!.skillId).toBe(skillId);
      expect(result[0]!.skillName).toBe("Front of House Engineer");
    });

    test("can update member skill proficiency", async () => {
      const result = await callAs(
        teamSkillsRouter.updateMemberSkill,
        { tenantId, teamMemberId, skillId, proficiencyLevel: 4 },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.proficiencyLevel).toBe(4);
    });

    test("can remove skill from member", async () => {
      const result = await callAs(
        teamSkillsRouter.removeMemberSkill,
        { tenantId, teamMemberId, skillId },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Cleanup", () => {
    test("can remove member from team", async () => {
      const result = await callAs(
        teamMembersRouter.removeMember,
        { tenantId, teamId, userId: memberId },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });

    test("can delete skill", async () => {
      const result = await callAs(
        teamSkillsRouter.deleteSkill,
        { tenantId, skillId },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });

    test("can delete team", async () => {
      const result = await callAs(
        teamsRouter.delete,
        { tenantId, teamId },
        ctx.asUser(ownerId, "owner-teams@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });
  });
});
