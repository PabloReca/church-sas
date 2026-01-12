import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import {
  tenants,
  tenantPlans,
  emails,
  people,
  tenantUsers,
  tenantHelpers,
} from "@/db/schema";
import { tenantUsersRouter } from "./tenant-users";
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
let tenantBId: number;
let tenantBOwnerEmailId: number;
let tenantBOwnerId: number;
let tenantBMemberEmailId: number;
let tenantBMemberId: number;

beforeAll(async () => {
  // Create plan with limited seats for testing
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan Users",
    price: "10",
    maxSeats: 3, // Limited seats for testing
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // ============ TENANT A SETUP ============
  const [tenantA] = await db.insert(tenants).values({
    name: "Tenant A Users",
    slug: "tenant-a-users",
    planId,
  }).returning();
  tenantAId = tenantA!.id;

  // Create Tenant A Owner
  const [ownerAEmail] = await db.insert(emails).values({ email: "owner-a-users@test.com" }).returning();
  tenantAOwnerEmailId = ownerAEmail!.id;
  const [ownerA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAOwnerEmailId,
    role: "owner",
  }).returning();
  tenantAOwnerId = ownerA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAOwnerId });

  // Create Tenant A Admin
  const [adminAEmail] = await db.insert(emails).values({ email: "admin-a-users@test.com" }).returning();
  tenantAAdminEmailId = adminAEmail!.id;
  const [adminA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAAdminEmailId,
    role: "admin",
  }).returning();
  tenantAAdminId = adminA!.id;
  await db.insert(tenantUsers).values({ personId: tenantAAdminId });

  // Create Tenant A Member (no tenant user yet)
  const [memberAEmail] = await db.insert(emails).values({ email: "member-a-users@test.com" }).returning();
  tenantAMemberEmailId = memberAEmail!.id;
  const [memberA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: tenantAMemberEmailId,
    role: null,
  }).returning();
  tenantAMemberId = memberA!.id;

  // ============ TENANT B SETUP ============
  const [tenantB] = await db.insert(tenants).values({
    name: "Tenant B Users",
    slug: "tenant-b-users",
    planId,
  }).returning();
  tenantBId = tenantB!.id;

  // Create Tenant B Owner
  const [ownerBEmail] = await db.insert(emails).values({ email: "owner-b-users@test.com" }).returning();
  tenantBOwnerEmailId = ownerBEmail!.id;
  const [ownerB] = await db.insert(people).values({
    tenantId: tenantBId,
    emailId: tenantBOwnerEmailId,
    role: "owner",
  }).returning();
  tenantBOwnerId = ownerB!.id;
  await db.insert(tenantUsers).values({ personId: tenantBOwnerId });

  // Create Tenant B Member
  const [memberBEmail] = await db.insert(emails).values({ email: "member-b-users@test.com" }).returning();
  tenantBMemberEmailId = memberBEmail!.id;
  const [memberB] = await db.insert(people).values({
    tenantId: tenantBId,
    emailId: tenantBMemberEmailId,
    role: null,
  }).returning();
  tenantBMemberId = memberB!.id;
});

afterAll(async () => {
  // Clean up in reverse order of dependencies
  await db.delete(tenantHelpers).where(eq(tenantHelpers.tenantId, tenantAId));
  await db.delete(tenantHelpers).where(eq(tenantHelpers.tenantId, tenantBId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAOwnerId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAAdminId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantAMemberId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantBOwnerId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, tenantBMemberId));
  await db.delete(people).where(eq(people.tenantId, tenantAId));
  await db.delete(people).where(eq(people.tenantId, tenantBId));
  await db.delete(emails).where(eq(emails.id, tenantAOwnerEmailId));
  await db.delete(emails).where(eq(emails.id, tenantAAdminEmailId));
  await db.delete(emails).where(eq(emails.id, tenantAMemberEmailId));
  await db.delete(emails).where(eq(emails.id, tenantBOwnerEmailId));
  await db.delete(emails).where(eq(emails.id, tenantBMemberEmailId));
  await db.delete(tenants).where(eq(tenants.id, tenantAId));
  await db.delete(tenants).where(eq(tenants.id, tenantBId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("Tenant Users Router", () => {
  describe("Person Roles", () => {
    test("can get person role", async () => {
      const result = await callAs(
        tenantUsersRouter.getPersonRole,
        { personId: tenantAOwnerId },
        ctx.asUser(tenantAOwnerId, "owner-a-users@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.role).toBe("owner");
    });

    test("can set person role to admin", async () => {
      const result = await callAs(
        tenantUsersRouter.setPersonRole,
        { personId: tenantAMemberId, role: "admin" },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(result.role).toBe("admin");

      // Reset back to null
      await callAs(
        tenantUsersRouter.setPersonRole,
        { personId: tenantAMemberId, role: null },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );
    });

    test("cannot remove owner role without transfer", async () => {
      await expect(
        callAs(
          tenantUsersRouter.setPersonRole,
          { personId: tenantAOwnerId, role: null },
          ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
        )
      ).rejects.toThrow("Cannot remove owner role");
    });

    test("cannot set second owner in same tenant", async () => {
      await expect(
        callAs(
          tenantUsersRouter.setPersonRole,
          { personId: tenantAAdminId, role: "owner" },
          ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
        )
      ).rejects.toThrow("Tenant already has an owner");
    });
  });

  describe("Tenant Users (Login Access)", () => {
    test("can add tenant user", async () => {
      const result = await callAs(
        tenantUsersRouter.add,
        { personId: tenantAMemberId },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result.personId).toBe(tenantAMemberId);
    });

    test("can count tenant users", async () => {
      const result = await callAs(
        tenantUsersRouter.count,
        { tenantId: tenantAId },
        ctx.asUser(tenantAOwnerId, "owner-a-users@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.tenantUsers).toBe(3); // owner, admin, member
      expect(result.maxSeats).toBe(3);
    });

    test("cannot add user when seat limit reached", async () => {
      // Tenant A already has 3 users (max is 3)
      // Create a new person
      const [newEmail] = await db.insert(emails).values({ email: "newperson@test.com" }).returning();
      const [newPerson] = await db.insert(people).values({
        tenantId: tenantAId,
        emailId: newEmail!.id,
        role: null,
      }).returning();

      await expect(
        callAs(
          tenantUsersRouter.add,
          { personId: newPerson!.id },
          ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
        )
      ).rejects.toThrow("User limit reached");

      // Cleanup
      await db.delete(people).where(eq(people.id, newPerson!.id));
      await db.delete(emails).where(eq(emails.id, newEmail!.id));
    });

    test("can remove tenant user", async () => {
      const result = await callAs(
        tenantUsersRouter.remove,
        { personId: tenantAMemberId },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Helpers", () => {
    test("can add person from another tenant as helper", async () => {
      const result = await callAs(
        tenantUsersRouter.addHelper,
        { tenantId: tenantAId, personId: tenantBMemberId },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(result).toBeDefined();
      expect(result.personId).toBe(tenantBMemberId);
    });

    test("cannot add person as helper to their own tenant", async () => {
      await expect(
        callAs(
          tenantUsersRouter.addHelper,
          { tenantId: tenantAId, personId: tenantAOwnerId },
          ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
        )
      ).rejects.toThrow("Person cannot be a helper in their own tenant");
    });

    test("can list helpers", async () => {
      const result = await callAs(
        tenantUsersRouter.listHelpers,
        { tenantId: tenantAId },
        ctx.asUser(tenantAOwnerId, "owner-a-users@test.com", "Owner A").inTenant(tenantAId).asTenantOwner()
      );

      expect(result.length).toBe(1);
      expect(result[0]!.personId).toBe(tenantBMemberId);
    });

    test("can remove helper", async () => {
      const result = await callAs(
        tenantUsersRouter.removeHelper,
        { tenantId: tenantAId, personId: tenantBMemberId },
        ctx.asUser(999, "globaladmin@test.com", "Global Admin").asAdmin()
      );

      expect(result.success).toBe(true);
    });
  });
});
