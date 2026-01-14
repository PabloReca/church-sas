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
  tenantSkillIncompatibility,
  tenantEventTemplates,
  tenantEventTemplateSlots,
  tenantEvents,
  tenantEventSlots,
  tenantEventAssignments,
} from "@/db/schema";
import { eventsRouter } from "./index";
import { eventSlotsRouter } from "./slots";
import { eventAssignmentsRouter } from "./assignments";
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
let tenantATeam2Id: number;
let tenantATeam2SkillId: number;
let tenantASkill1Id: number;
let tenantASkill2Id: number;
let tenantASkill3Id: number;
let tenantBId: number;
let tenantBOwnerEmailId: number;
let tenantBOwnerId: number;

beforeAll(async () => {
  // Clean up any existing test data first
  await db.delete(tenants).where(eq(tenants.slug, "tenant-a-events"));
  await db.delete(tenants).where(eq(tenants.slug, "tenant-b-events"));

  // Clean up test emails
  await db.delete(emails).where(eq(emails.email, "owner-a-events@test.com"));
  await db.delete(emails).where(eq(emails.email, "admin-a-events@test.com"));
  await db.delete(emails).where(eq(emails.email, "member-a-events@test.com"));
  await db.delete(emails).where(eq(emails.email, "owner-b-events@test.com"));

  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Events",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // ============ TENANT A SETUP ============
  const [tenantA] = await db.insert(tenants).values({
    name: "Tenant A Events",
    slug: "tenant-a-events",
    planId,
  }).returning();
  tenantAId = tenantA!.id;

  // Create Tenant A Owner
  const [ownerAEmail] = await db.insert(emails).values({ email: "owner-a-events@test.com" }).returning();
  tenantAOwnerEmailId = ownerAEmail!.id;
  const [ownerA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAOwnerEmailId,
    role: "owner",
  }).returning();
  tenantAOwnerId = ownerA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAOwnerId });

  // Create Tenant A Admin
  const [adminAEmail] = await db.insert(emails).values({ email: "admin-a-events@test.com" }).returning();
  tenantAAdminEmailId = adminAEmail!.id;
  const [adminA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAAdminEmailId,
    role: "admin",
  }).returning();
  tenantAAdminId = adminA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAAdminId });

  // Create Tenant A Member (no role)
  const [memberAEmail] = await db.insert(emails).values({ email: "member-a-events@test.com" }).returning();
  tenantAMemberEmailId = memberAEmail!.id;
  const [memberA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAMemberEmailId,
    role: null,
  }).returning();
  tenantAMemberId = memberA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAMemberId });

  // Create Tenant A Team 1 (Sound)
  const [teamA] = await db.insert(tenantTeams).values({
    tenantId: tenantAId,
    name: "Sound Team A Events",
  }).returning();
  tenantATeamId = teamA!.id;

  // Create Tenant A Team 2 (Music) - for testing one-team-per-event restriction
  const [teamA2] = await db.insert(tenantTeams).values({
    tenantId: tenantAId,
    name: "Music Team A Events",
  }).returning();
  tenantATeam2Id = teamA2!.id;

  // Add member to both teams
  const [teamMemberA] = await db.insert(tenantTeamMembers).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    userId: tenantAMemberId,
  }).returning();

  const [teamMemberA2] = await db.insert(tenantTeamMembers).values({
    tenantId: tenantAId,
    teamId: tenantATeam2Id,
    userId: tenantAMemberId,
  }).returning();

  // Create skill for Team 2
  const [team2Skill] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeam2Id,
    name: "Piano",
  }).returning();
  tenantATeam2SkillId = team2Skill!.id;

  // Assign skill to member in Team 2
  await db.insert(tenantTeamMemberSkills).values({
    tenantId: tenantAId,
    teamMemberId: teamMemberA2!.id,
    skillId: tenantATeam2SkillId,
    proficiencyLevel: 3,
  });

  // Create Skills for Tenant A
  const [skill1] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    name: "FOH Engineer",
  }).returning();
  tenantASkill1Id = skill1!.id;

  const [skill2] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    name: "Recording Engineer",
  }).returning();
  tenantASkill2Id = skill2!.id;

  const [skill3] = await db.insert(tenantTeamSkills).values({
    tenantId: tenantAId,
    teamId: tenantATeamId,
    name: "Monitor Engineer",
  }).returning();
  tenantASkill3Id = skill3!.id;

  // Assign skills to member (all 3 skills)
  await db.insert(tenantTeamMemberSkills).values({
    tenantId: tenantAId,
    teamMemberId: teamMemberA!.id,
    skillId: tenantASkill1Id,
    proficiencyLevel: 3,
  });
  await db.insert(tenantTeamMemberSkills).values({
    tenantId: tenantAId,
    teamMemberId: teamMemberA!.id,
    skillId: tenantASkill2Id,
    proficiencyLevel: 2,
  });
  await db.insert(tenantTeamMemberSkills).values({
    tenantId: tenantAId,
    teamMemberId: teamMemberA!.id,
    skillId: tenantASkill3Id,
    proficiencyLevel: 2,
  });

  // Add incompatibility between skill1 and skill3 (they CANNOT be used together)
  // skill1 and skill2 have NO incompatibility, so they CAN be used together
  await db.insert(tenantSkillIncompatibility).values({
    tenantId: tenantAId,
    skillId1: tenantASkill1Id,
    skillId2: tenantASkill3Id,
  });

  // ============ TENANT B SETUP ============
  const [tenantB] = await db.insert(tenants).values({
    name: "Tenant B Events",
    slug: "tenant-b-events",
    planId,
  }).returning();
  tenantBId = tenantB!.id;

  // Create Tenant B Owner
  const [ownerBEmail] = await db.insert(emails).values({ email: "owner-b-events@test.com" }).returning();
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
  // Only delete if IDs are defined (beforeAll succeeded)
  if (tenantAId !== undefined) {
    await db.delete(tenantEventAssignments).where(eq(tenantEventAssignments.tenantId, tenantAId));
    await db.delete(tenantEventSlots).where(eq(tenantEventSlots.tenantId, tenantAId));
    await db.delete(tenantEvents).where(eq(tenantEvents.tenantId, tenantAId));
    await db.delete(tenantEventTemplateSlots).where(eq(tenantEventTemplateSlots.tenantId, tenantAId));
    await db.delete(tenantEventTemplates).where(eq(tenantEventTemplates.tenantId, tenantAId));
    await db.delete(tenantSkillIncompatibility).where(eq(tenantSkillIncompatibility.tenantId, tenantAId));
    await db.delete(tenantTeamMemberSkills).where(eq(tenantTeamMemberSkills.tenantId, tenantAId));
    await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantAId));
    await db.delete(tenantTeamMembers).where(eq(tenantTeamMembers.tenantId, tenantAId));
    await db.delete(people).where(eq(people.tenantId, tenantAId));
    await db.delete(tenants).where(eq(tenants.id, tenantAId));
  }
  if (tenantBId !== undefined) {
    await db.delete(tenantEventAssignments).where(eq(tenantEventAssignments.tenantId, tenantBId));
    await db.delete(tenantEventSlots).where(eq(tenantEventSlots.tenantId, tenantBId));
    await db.delete(tenantEvents).where(eq(tenantEvents.tenantId, tenantBId));
    await db.delete(tenantEventTemplateSlots).where(eq(tenantEventTemplateSlots.tenantId, tenantBId));
    await db.delete(tenantEventTemplates).where(eq(tenantEventTemplates.tenantId, tenantBId));
    await db.delete(tenantTeamMemberSkills).where(eq(tenantTeamMemberSkills.tenantId, tenantBId));
    await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantBId));
    await db.delete(tenantTeamMembers).where(eq(tenantTeamMembers.tenantId, tenantBId));
    await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantBId));
    await db.delete(people).where(eq(people.tenantId, tenantBId));
    await db.delete(tenants).where(eq(tenants.id, tenantBId));
  }
  if (tenantATeamId !== undefined) {
    await db.delete(tenantTeams).where(eq(tenantTeams.id, tenantATeamId));
  }
  if (tenantATeam2Id !== undefined) {
    await db.delete(tenantTeams).where(eq(tenantTeams.id, tenantATeam2Id));
  }
  if (tenantAOwnerId !== undefined) {
    await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAOwnerId));
  }
  if (tenantAAdminId !== undefined) {
    await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAAdminId));
  }
  if (tenantAMemberId !== undefined) {
    await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAMemberId));
  }
  if (tenantBOwnerId !== undefined) {
    await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantBOwnerId));
  }
  if (tenantAOwnerEmailId !== undefined) {
    await db.delete(emails).where(eq(emails.id, tenantAOwnerEmailId));
  }
  if (tenantAAdminEmailId !== undefined) {
    await db.delete(emails).where(eq(emails.id, tenantAAdminEmailId));
  }
  if (tenantAMemberEmailId !== undefined) {
    await db.delete(emails).where(eq(emails.id, tenantAMemberEmailId));
  }
  if (tenantBOwnerEmailId !== undefined) {
    await db.delete(emails).where(eq(emails.id, tenantBOwnerEmailId));
  }
  if (planId !== undefined) {
    await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
  }
});

describe("Events Router", () => {
  let templateId: number;
  let eventId: number;
  let slotId: number;

  beforeAll(async () => {
    // Create a template with slots for testing
    const [template] = await db.insert(tenantEventTemplates).values({
      tenantId: tenantAId,
      name: "Test Event Template",
    }).returning();
    templateId = template!.id;

    await db.insert(tenantEventTemplateSlots).values({
      tenantId: tenantAId,
      templateId,
      teamId: tenantATeamId,
      skillId: tenantASkill1Id,
      quantity: 1,
    });
  });

  describe("Event Creation", () => {
    test("can create event from template and slots are copied", async () => {
      const result = await callAs(
        eventsRouter.create,
        {
          tenantId: tenantAId,
          templateId,
          name: "Sunday Service Jan 1",
          date: new Date("2025-01-01T10:00:00Z").toISOString(),
        },
        ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("Sunday Service Jan 1");
      expect(result.templateId).toBe(templateId);
      eventId = result.id;

      // Verify slots were copied
      const slots = await db
        .select()
        .from(tenantEventSlots)
        .where(eq(tenantEventSlots.eventId, eventId));

      expect(slots.length).toBe(1);
      expect(slots[0]!.skillId).toBe(tenantASkill1Id);
      slotId = slots[0]!.id;
    });

    test("can create event without template", async () => {
      const result = await callAs(
        eventsRouter.create,
        {
          tenantId: tenantAId,
          name: "Ad-hoc Event",
          date: new Date("2025-01-15T10:00:00Z").toISOString(),
        },
        ctx.asUser(tenantAAdminId, "admin-a-events@test.com", "Admin A").inTenant(tenantAId).asTenantAdmin()
      );

      expect(result).toBeDefined();
      expect(result.templateId).toBeNull();
    });

    test("cannot create event using template from another tenant", async () => {
      // Create template in tenant B
      const [templateB] = await db.insert(tenantEventTemplates).values({
        tenantId: tenantBId,
        name: "Template B",
      }).returning();

      await expect(
        callAs(
          eventsRouter.create,
          {
            tenantId: tenantAId,
            templateId: templateB!.id,
            name: "Cross-tenant Event",
            date: new Date().toISOString(),
          },
          ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
        )
      ).rejects.toThrow();
    });

    test("member cannot create event", async () => {
      await expect(
        callAs(
          eventsRouter.create,
          {
            tenantId: tenantAId,
            name: "Unauthorized Event",
            date: new Date().toISOString(),
          },
          ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });
  });

  describe("Event Slots", () => {
    test("can add slot to event", async () => {
      const result = await callAs(
        eventSlotsRouter.createSlot,
        {
          tenantId: tenantAId,
          eventId,
          teamId: tenantATeamId,
          skillId: tenantASkill2Id,
          quantity: 2,
        },
        ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.quantity).toBe(2);
    });

    test("can list event slots", async () => {
      const result = await callAs(
        eventSlotsRouter.listSlots,
        { tenantId: tenantAId, eventId },
        ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result.length).toBeGreaterThan(0);
    });

    test("member cannot add slot", async () => {
      await expect(
        callAs(
          eventSlotsRouter.createSlot,
          {
            tenantId: tenantAId,
            eventId,
            teamId: tenantATeamId,
            skillId: tenantASkill1Id,
            quantity: 1,
          },
          ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });
  });

  describe("Event Assignments", () => {
    test("can assign person with correct skill to slot", async () => {
      const result = await callAs(
        eventAssignmentsRouter.createAssignment,
        {
          tenantId: tenantAId,
          eventId,
          slotId,
          userId: tenantAMemberId,
        },
        ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(tenantAMemberId);
    });

    test("cannot assign person from another tenant", async () => {
      await expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId: tenantAId,
            eventId,
            slotId,
            userId: tenantBOwnerId,
          },
          ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
        )
      ).rejects.toThrow("Active user not found in this tenant");
    });

    test("cannot assign person without required skill", async () => {
      // tenantAOwnerId is not a team member, so doesn't have skills
      await expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId: tenantAId,
            eventId,
            slotId,
            userId: tenantAOwnerId,
          },
          ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
        )
      ).rejects.toThrow();
    });

    test("cannot assign person to incompatible skills", async () => {
      // Member already assigned to skill1 slot
      // skill1 and skill3 are marked as INCOMPATIBLE
      // First create a slot requiring skill3
      const [skill3Slot] = await db.insert(tenantEventSlots).values({
        tenantId: tenantAId,
        eventId,
        teamId: tenantATeamId,
        skillId: tenantASkill3Id,
        quantity: 1,
      }).returning();

      await expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId: tenantAId,
            eventId,
            slotId: skill3Slot!.id,
            userId: tenantAMemberId,
          },
          ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
        )
      ).rejects.toThrow("These skills cannot be used simultaneously by the same person");
    });

    test("can assign person to compatible skills (no incompatibility defined)", async () => {
      // Member already assigned to skill1 slot
      // Try to assign to skill2 slot (which has NO incompatibility with skill1)
      // By default, all skills are compatible unless explicitly marked as incompatible
      const [skill2Slot] = await db.insert(tenantEventSlots).values({
        tenantId: tenantAId,
        eventId,
        teamId: tenantATeamId,
        skillId: tenantASkill2Id,
        quantity: 1,
      }).returning();

      const result = await callAs(
        eventAssignmentsRouter.createAssignment,
        {
          tenantId: tenantAId,
          eventId,
          slotId: skill2Slot!.id,
          userId: tenantAMemberId,
        },
        ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result).toBeDefined();
    });

    test("can list event assignments", async () => {
      const result = await callAs(
        eventAssignmentsRouter.listAssignments,
        { tenantId: tenantAId, eventId },
        ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result.length).toBeGreaterThan(0);
    });

    test("member cannot create assignment", async () => {
      await expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId: tenantAId,
            eventId,
            slotId,
            userId: tenantAMemberId,
          },
          ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });

    test("cannot assign person to multiple teams in same event", async () => {
      // Member is already assigned to Team 1 (Sound) via skill1 slot
      // Try to assign to Team 2 (Music) - should fail
      const [team2Slot] = await db.insert(tenantEventSlots).values({
        tenantId: tenantAId,
        eventId,
        teamId: tenantATeam2Id,
        skillId: tenantATeam2SkillId,
        quantity: 1,
      }).returning();

      await expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId: tenantAId,
            eventId,
            slotId: team2Slot!.id,
            userId: tenantAMemberId,
          },
          ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
        )
      ).rejects.toThrow("User can only be assigned to one team per event");
    });
  });

  describe("Event Listing and Retrieval", () => {
    test("can list events in tenant", async () => {
      const result = await callAs(
        eventsRouter.list,
        { tenantId: tenantAId },
        ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result.length).toBeGreaterThan(0);
    });

    test("can get event by id", async () => {
      const result = await callAs(
        eventsRouter.get,
        { tenantId: tenantAId, eventId },
        ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(eventId);
    });
  });

  describe("Event Updates and Deletion", () => {
    test("can update event", async () => {
      const result = await callAs(
        eventsRouter.update,
        { tenantId: tenantAId, eventId, name: "Updated Event Name" },
        ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.name).toBe("Updated Event Name");
    });

    test("member cannot update event", async () => {
      await expect(
        callAs(
          eventsRouter.update,
          { tenantId: tenantAId, eventId, name: "Hacked" },
          ctx.asUser(tenantAMemberId, "member-a-events@test.com", "Member A").inTenant(tenantAId)
        )
      ).rejects.toThrow("Only tenant owner or admin");
    });

    test("can delete event", async () => {
      const result = await callAs(
        eventsRouter.delete,
        { tenantId: tenantAId, eventId },
        ctx.asUser(tenantAOwnerId, "owner-a-events@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.success).toBe(true);
    });
  });
});
