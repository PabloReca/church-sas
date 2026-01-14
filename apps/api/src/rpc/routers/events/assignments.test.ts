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
  tenantEvents,
  tenantEventSlots,
  tenantEventAssignments,
} from "@/db/schema";
import { eventAssignmentsRouter } from "./assignments";
import { eq, or } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

let planId: number;
let tenantId: number;
let ownerEmailId: number;
let ownerId: number;
let memberEmailId: number;
let memberId: number;
let nonMemberEmailId: number;
let nonMemberId: number;
let teamId: number;
let skillId: number;
let eventId: number;
let slotId: number;
let assignmentId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Assignments",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // Create tenant
  const [tenant] = await db.insert(tenants).values({
    name: "Test Tenant Assignments",
    slug: "test-tenant-assignments",
    planId,
  }).returning();
  tenantId = tenant!.id;

  // Create owner
  const [ownerEmail] = await db.insert(emails).values({ email: "owner-assignments@test.com" }).returning();
  ownerEmailId = ownerEmail!.id;
  const [owner] = await db.insert(people).values({
    tenantId,
    emailId: ownerEmailId,
    role: "owner",
  }).returning();
  ownerId = owner!.id;
  await db.insert(tenantUsers).values({ personId: ownerId });

  // Create member (team member with skill)
  const [memberEmail] = await db.insert(emails).values({ email: "member-assignments@test.com" }).returning();
  memberEmailId = memberEmail!.id;
  const [member] = await db.insert(people).values({
    tenantId,
    emailId: memberEmailId,
    role: null,
  }).returning();
  memberId = member!.id;
  await db.insert(tenantUsers).values({ personId: memberId });

  // Create non-member user (not in any team)
  const [nonMemberEmail] = await db.insert(emails).values({ email: "nonmember-assignments@test.com" }).returning();
  nonMemberEmailId = nonMemberEmail!.id;
  const [nonMember] = await db.insert(people).values({
    tenantId,
    emailId: nonMemberEmailId,
    role: null,
  }).returning();
  nonMemberId = nonMember!.id;
  await db.insert(tenantUsers).values({ personId: nonMemberId });

  // Create team
  const [team] = await db.insert(tenantTeams).values({
    tenantId,
    name: "Test Team",
  }).returning();
  teamId = team!.id;

  // Create skill
  const [skill] = await db.insert(tenantTeamSkills).values({
    tenantId,
    teamId,
    name: "Test Skill",
  }).returning();
  skillId = skill!.id;

  // Add member to team
  const [teamMember] = await db.insert(tenantTeamMembers).values({
    tenantId,
    teamId,
    userId: memberId,
    role: "member",
  }).returning();
  if (!teamMember) throw new Error("Failed to create team member");

  // Add skill to member
  await db.insert(tenantTeamMemberSkills).values({
    tenantId,
    teamMemberId: teamMember.id,
    skillId,
    proficiencyLevel: 3,
  });

  // Create event
  const [event] = await db.insert(tenantEvents).values({
    tenantId,
    name: "Test Event",
    date: new Date("2025-12-25"),
  }).returning();
  eventId = event!.id;

  // Create slot
  const [slot] = await db.insert(tenantEventSlots).values({
    eventId,
    tenantId,
    teamId,
    skillId,
    quantity: 2,
  }).returning();
  slotId = slot!.id;
});

afterAll(async () => {
  // Clean up in reverse order of dependencies
  await db.delete(tenantEventAssignments).where(eq(tenantEventAssignments.tenantId, tenantId));
  await db.delete(tenantEventSlots).where(eq(tenantEventSlots.tenantId, tenantId));
  await db.delete(tenantEvents).where(eq(tenantEvents.tenantId, tenantId));
  await db.delete(tenantTeamMemberSkills).where(eq(tenantTeamMemberSkills.tenantId, tenantId));
  await db.delete(tenantTeamMembers).where(eq(tenantTeamMembers.tenantId, tenantId));
  await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantId));
  await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantId));
  await db.delete(tenantUsers).where(
    or(
      eq(tenantUsers.personId, ownerId),
      eq(tenantUsers.personId, memberId),
      eq(tenantUsers.personId, nonMemberId)
    )
  );
  await db.delete(people).where(eq(people.tenantId, tenantId));
  await db.delete(emails).where(
    or(
      eq(emails.id, ownerEmailId),
      eq(emails.id, memberEmailId),
      eq(emails.id, nonMemberEmailId)
    )
  );
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("Event Assignments Router", () => {
  describe("createAssignment", () => {
    test("can create assignment for user with correct skill", async () => {
      const result = await callAs(
        eventAssignmentsRouter.createAssignment,
        {
          tenantId,
          eventId,
          slotId,
          userId: memberId,
        },
        ctx.asUser(ownerId, "owner-assignments@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(memberId);
      expect(result.slotId).toBe(slotId);
      assignmentId = result.id;
    });

    test("cannot create assignment for non-existent slot", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId,
            eventId,
            slotId: 999999,
            userId: memberId,
          },
          ctx.asUser(ownerId, "owner-assignments@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Event slot not found");
    });

    test("cannot create assignment for user not in tenant", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId,
            eventId,
            slotId,
            userId: 999999,
          },
          ctx.asUser(ownerId, "owner-assignments@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Active user not found in this tenant");
    });

    test("cannot create assignment for user not in team", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId,
            eventId,
            slotId,
            userId: nonMemberId,
          },
          ctx.asUser(ownerId, "owner-assignments@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("User is not a member of the required team");
    });

    test("regular member cannot create assignment", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.createAssignment,
          {
            tenantId,
            eventId,
            slotId,
            userId: memberId,
          },
          ctx.asUser(memberId, "member-assignments@test.com", "Member").inTenant(tenantId)
        )
      ).rejects.toThrow();
    });
  });

  describe("listAssignments", () => {
    test("can list assignments", async () => {
      const result = await callAs(
        eventAssignmentsRouter.listAssignments,
        { tenantId, eventId },
        ctx.asUser(memberId, "member-assignments@test.com", "Member").inTenant(tenantId)
      );

      expect(result.length).toBeGreaterThan(0);
      const assignment = result.find((a: { id: number }) => a.id === assignmentId);
      expect(assignment).toBeDefined();
    });

    test("cannot list assignments without tenant access", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.listAssignments,
          { tenantId, eventId },
          ctx.asUser(999, "outsider@test.com", "Outsider")
        )
      ).rejects.toThrow();
    });
  });

  describe("deleteAssignment", () => {
    test("cannot delete non-existent assignment", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.deleteAssignment,
          { tenantId, assignmentId: 999999 },
          ctx.asUser(ownerId, "owner-assignments@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Assignment not found");
    });

    test("regular member cannot delete assignment", async () => {
      expect(
        callAs(
          eventAssignmentsRouter.deleteAssignment,
          { tenantId, assignmentId },
          ctx.asUser(memberId, "member-assignments@test.com", "Member").inTenant(tenantId)
        )
      ).rejects.toThrow();
    });

    test("can delete assignment", async () => {
      const result = await callAs(
        eventAssignmentsRouter.deleteAssignment,
        { tenantId, assignmentId },
        ctx.asUser(ownerId, "owner-assignments@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.success).toBe(true);

      // Verify assignment was deleted
      const assignments = await db
        .select()
        .from(tenantEventAssignments)
        .where(eq(tenantEventAssignments.id, assignmentId));
      expect(assignments.length).toBe(0);
    });
  });
});
