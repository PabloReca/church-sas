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
  tenantEvents,
  tenantEventSlots,
} from "@/db/schema";
import { eventSlotsRouter } from "./slots";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

let planId: number;
let tenantId: number;
let ownerEmailId: number;
let ownerId: number;
let memberEmailId: number;
let memberId: number;
let teamId: number;
let skillId: number;
let eventId: number;
let slotId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Slots",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // Create tenant
  const [tenant] = await db.insert(tenants).values({
    name: "Test Tenant Slots",
    slug: "test-tenant-slots",
    planId,
  }).returning();
  tenantId = tenant!.id;

  // Create owner
  const [ownerEmail] = await db.insert(emails).values({ email: "owner-slots@test.com" }).returning();
  ownerEmailId = ownerEmail!.id;
  const [owner] = await db.insert(people).values({
    tenantId,
    emailId: ownerEmailId,
    role: "owner",
  }).returning();
  ownerId = owner!.id;
  await db.insert(tenantUsers).values({ personId: ownerId });

  // Create member (no role)
  const [memberEmail] = await db.insert(emails).values({ email: "member-slots@test.com" }).returning();
  memberEmailId = memberEmail!.id;
  const [member] = await db.insert(people).values({
    tenantId,
    emailId: memberEmailId,
    role: null,
  }).returning();
  memberId = member!.id;
  await db.insert(tenantUsers).values({ personId: memberId });

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

  // Create event
  const [event] = await db.insert(tenantEvents).values({
    tenantId,
    name: "Test Event",
    date: new Date("2025-12-25"),
  }).returning();
  eventId = event!.id;
});

afterAll(async () => {
  // Clean up in reverse order of dependencies
  await db.delete(tenantEventSlots).where(eq(tenantEventSlots.tenantId, tenantId));
  await db.delete(tenantEvents).where(eq(tenantEvents.tenantId, tenantId));
  await db.delete(tenantTeamSkills).where(eq(tenantTeamSkills.tenantId, tenantId));
  await db.delete(tenantTeams).where(eq(tenantTeams.tenantId, tenantId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, ownerId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, memberId));
  await db.delete(people).where(eq(people.tenantId, tenantId));
  await db.delete(emails).where(eq(emails.id, ownerEmailId));
  await db.delete(emails).where(eq(emails.id, memberEmailId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("Event Slots Router", () => {
  describe("createSlot", () => {
    test("can create slot", async () => {
      const result = await callAs(
        eventSlotsRouter.createSlot,
        {
          tenantId,
          eventId,
          teamId,
          skillId,
          quantity: 2,
        },
        ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result).toBeDefined();
      expect(result.quantity).toBe(2);
      expect(result.teamId).toBe(teamId);
      expect(result.skillId).toBe(skillId);
      slotId = result.id;
    });

    test("cannot create slot with team from wrong tenant", async () => {
      expect(
        callAs(
          eventSlotsRouter.createSlot,
          {
            tenantId,
            eventId,
            teamId: 999999,
            skillId,
            quantity: 1,
          },
          ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Team not found in this tenant");
    });

    test("cannot create slot with skill from wrong team", async () => {
      expect(
        callAs(
          eventSlotsRouter.createSlot,
          {
            tenantId,
            eventId,
            teamId,
            skillId: 999999,
            quantity: 1,
          },
          ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Skill not found in this team");
    });

    test("member cannot create slot", async () => {
      expect(
        callAs(
          eventSlotsRouter.createSlot,
          {
            tenantId,
            eventId,
            teamId,
            skillId,
            quantity: 1,
          },
          ctx.asUser(memberId, "member-slots@test.com", "Member").inTenant(tenantId)
        )
      ).rejects.toThrow();
    });
  });

  describe("listSlots", () => {
    test("can list event slots", async () => {
      const result = await callAs(
        eventSlotsRouter.listSlots,
        { tenantId, eventId },
        ctx.asUser(memberId, "member-slots@test.com", "Member").inTenant(tenantId)
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.eventId).toBe(eventId);
    });

    test("cannot list slots without tenant access", async () => {
      expect(
        callAs(
          eventSlotsRouter.listSlots,
          { tenantId, eventId },
          ctx.asUser(999, "outsider@test.com", "Outsider")
        )
      ).rejects.toThrow();
    });
  });

  describe("updateSlot", () => {
    test("can update slot quantity", async () => {
      const result = await callAs(
        eventSlotsRouter.updateSlot,
        {
          tenantId,
          slotId,
          quantity: 5,
        },
        ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.quantity).toBe(5);
      expect(result.id).toBe(slotId);
    });

    test("cannot update slot without quantity", async () => {
      expect(
        callAs(
          eventSlotsRouter.updateSlot,
          { tenantId, slotId },
          ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("No fields to update");
    });

    test("cannot update non-existent slot", async () => {
      expect(
        callAs(
          eventSlotsRouter.updateSlot,
          {
            tenantId,
            slotId: 999999,
            quantity: 1,
          },
          ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Event slot not found");
    });

    test("member cannot update slot", async () => {
      expect(
        callAs(
          eventSlotsRouter.updateSlot,
          {
            tenantId,
            slotId,
            quantity: 3,
          },
          ctx.asUser(memberId, "member-slots@test.com", "Member").inTenant(tenantId)
        )
      ).rejects.toThrow();
    });
  });

  describe("deleteSlot", () => {
    test("cannot delete non-existent slot", async () => {
      expect(
        callAs(
          eventSlotsRouter.deleteSlot,
          { tenantId, slotId: 999999 },
          ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
        )
      ).rejects.toThrow("Event slot not found");
    });

    test("member cannot delete slot", async () => {
      expect(
        callAs(
          eventSlotsRouter.deleteSlot,
          { tenantId, slotId },
          ctx.asUser(memberId, "member-slots@test.com", "Member").inTenant(tenantId)
        )
      ).rejects.toThrow();
    });

    test("can delete slot", async () => {
      const result = await callAs(
        eventSlotsRouter.deleteSlot,
        { tenantId, slotId },
        ctx.asUser(ownerId, "owner-slots@test.com", "Owner").inTenant(tenantId).asTenantOwner()
      );

      expect(result.success).toBe(true);

      // Verify slot was deleted
      const slots = await db
        .select()
        .from(tenantEventSlots)
        .where(eq(tenantEventSlots.id, slotId));
      expect(slots.length).toBe(0);
    });
  });
});
