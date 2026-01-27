import Elysia from "elysia";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "@/db/connection";
import { tenants, people, tenantPlans, emails, tenantHelpers } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserPayload } from "@/lib/auth/jwt";
import { generateJWT } from "@/lib/auth/jwt";
import { contextPlugin } from "./context";
import { makeJsonRequest, readJson } from "../../../tests/http";
import { handleHttpError } from "@/lib/http-errors";
import {
  requireTenantUser,
  requireTenantManager,
  authGuard,
  adminGuard,
  tenantUserGuard,
  tenantManagerGuard,
} from "./guards";

const db = getDb();

describe("Elysia Guards - Helper Functions", () => {
  let planId: number;
  let tenant1Id: string;
  let tenant2Id: string;
  let ownerEmailId: string;
  let ownerId: string;
  let adminEmailId: string;
  let adminId: string;
  let memberEmailId: string;
  let memberId: string;
  let outsiderEmailId: string;
  let outsiderId: string;

  const platformAdmin: UserPayload = {
    userId: "550e8400-e29b-41d4-a716-446655440999",
    email: "platform-admin@test.com",
    name: "Platform Admin",
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    isAdmin: true,
    isTenantAdmin: false,
  };

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

    // Create tenant 1
    const [tenant1] = await db.insert(tenants).values({
      name: "Tenant 1",
      planId,
    }).returning();
    if (!tenant1) throw new Error("Failed to create tenant 1");
    tenant1Id = tenant1.id;

    // Create tenant 2
    const [tenant2] = await db.insert(tenants).values({
      name: "Tenant 2",
      planId,
    }).returning();
    if (!tenant2) throw new Error("Failed to create tenant 2");
    tenant2Id = tenant2.id;

    // Create owner for tenant 1
    const [ownerEmail] = await db.insert(emails).values({
      email: `owner-guards-${Date.now()}@test.com`,
    }).returning();
    if (!ownerEmail) throw new Error("Failed to create owner email");
    ownerEmailId = ownerEmail.id;

    const [owner] = await db.insert(people).values({
      tenantId: tenant1Id,
      emailId: ownerEmailId,
      role: "owner",
    }).returning();
    if (!owner) throw new Error("Failed to create owner");
    ownerId = owner.id;

    // Create admin for tenant 1
    const [adminEmail] = await db.insert(emails).values({
      email: `admin-guards-${Date.now()}@test.com`,
    }).returning();
    if (!adminEmail) throw new Error("Failed to create admin email");
    adminEmailId = adminEmail.id;

    const [admin] = await db.insert(people).values({
      tenantId: tenant1Id,
      emailId: adminEmailId,
      role: "admin",
    }).returning();
    if (!admin) throw new Error("Failed to create admin");
    adminId = admin.id;

    // Create regular member for tenant 1
    const [memberEmail] = await db.insert(emails).values({
      email: `member-guards-${Date.now()}@test.com`,
    }).returning();
    if (!memberEmail) throw new Error("Failed to create member email");
    memberEmailId = memberEmail.id;

    const [member] = await db.insert(people).values({
      tenantId: tenant1Id,
      emailId: memberEmailId,
      role: null,
    }).returning();
    if (!member) throw new Error("Failed to create member");
    memberId = member.id;

    // Create outsider (member of tenant 2)
    const [outsiderEmail] = await db.insert(emails).values({
      email: `outsider-guards-${Date.now()}@test.com`,
    }).returning();
    if (!outsiderEmail) throw new Error("Failed to create outsider email");
    outsiderEmailId = outsiderEmail.id;

    const [outsider] = await db.insert(people).values({
      tenantId: tenant2Id,
      emailId: outsiderEmailId,
      role: null,
    }).returning();
    if (!outsider) throw new Error("Failed to create outsider");
    outsiderId = outsider.id;
  });

  afterAll(async () => {
    if (memberId && tenant2Id) {
      await db.delete(tenantHelpers).where(eq(tenantHelpers.personId, memberId));
    }
    if (tenant1Id) await db.delete(people).where(eq(people.tenantId, tenant1Id));
    if (tenant2Id) await db.delete(people).where(eq(people.tenantId, tenant2Id));
    if (ownerEmailId) await db.delete(emails).where(eq(emails.id, ownerEmailId));
    if (adminEmailId) await db.delete(emails).where(eq(emails.id, adminEmailId));
    if (memberEmailId) await db.delete(emails).where(eq(emails.id, memberEmailId));
    if (outsiderEmailId) await db.delete(emails).where(eq(emails.id, outsiderEmailId));
    if (tenant1Id) await db.delete(tenants).where(eq(tenants.id, tenant1Id));
    if (tenant2Id) await db.delete(tenants).where(eq(tenants.id, tenant2Id));
    if (planId) await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
  });

  describe("requireTenantUser", () => {
    test("should allow platform admin to access any tenant", async () => {
      await expect(
        requireTenantUser(db, platformAdmin, tenant1Id)
      ).resolves.not.toThrow();

      await expect(
        requireTenantUser(db, platformAdmin, tenant2Id)
      ).resolves.not.toThrow();
    });

    test("should allow primary tenant member to access their tenant", async () => {
      const memberUser: UserPayload = {
        userId: memberId,
        email: "member@test.com",
        name: "Member",
        tenantId: tenant1Id,
        isAdmin: false,
        isTenantAdmin: false,
      };

      await expect(
        requireTenantUser(db, memberUser, tenant1Id)
      ).resolves.not.toThrow();
    });

    test("should deny user access to other tenant", async () => {
      const memberUser: UserPayload = {
        userId: memberId,
        email: "member@test.com",
        name: "Member",
        tenantId: tenant1Id,
        isAdmin: false,
        isTenantAdmin: false,
      };

      await expect(
        requireTenantUser(db, memberUser, tenant2Id)
      ).rejects.toThrow("Access denied to this tenant");
    });

    test("should allow helper to access tenant they help", async () => {
      // Add member as helper to tenant 2
      await db.insert(tenantHelpers).values({
        tenantId: tenant2Id,
        personId: memberId,
      });

      const memberUser: UserPayload = {
        userId: memberId,
        email: "member@test.com",
        name: "Member",
        tenantId: tenant1Id,
        isAdmin: false,
        isTenantAdmin: false,
      };

      await expect(
        requireTenantUser(db, memberUser, tenant2Id)
      ).resolves.not.toThrow();

      // Cleanup
      await db.delete(tenantHelpers).where(eq(tenantHelpers.personId, memberId));
    });
  });

  describe("requireTenantManager", () => {
    test("should allow platform admin to perform manager actions", async () => {
      await expect(
        requireTenantManager(db, platformAdmin, tenant1Id)
      ).resolves.not.toThrow();
    });

    test("should allow tenant owner to perform manager actions", async () => {
      const ownerUser: UserPayload = {
        userId: ownerId,
        email: "owner@test.com",
        name: "Owner",
        tenantId: tenant1Id,
        isAdmin: false,
        isTenantAdmin: true,
      };

      await expect(
        requireTenantManager(db, ownerUser, tenant1Id)
      ).resolves.not.toThrow();
    });

    test("should allow tenant admin to perform manager actions", async () => {
      const adminUser: UserPayload = {
        userId: adminId,
        email: "admin@test.com",
        name: "Admin",
        tenantId: tenant1Id,
        isAdmin: false,
        isTenantAdmin: true,
      };

      await expect(
        requireTenantManager(db, adminUser, tenant1Id)
      ).resolves.not.toThrow();
    });

    test("should deny regular member from performing manager actions", async () => {
      const memberUser: UserPayload = {
        userId: memberId,
        email: "member@test.com",
        name: "Member",
        tenantId: tenant1Id,
        isAdmin: false,
        isTenantAdmin: false,
      };

      await expect(
        requireTenantManager(db, memberUser, tenant1Id)
      ).rejects.toThrow("Only tenant owner or admin can perform this action");
    });

    test("should deny outsider from performing manager actions", async () => {
      const outsiderUser: UserPayload = {
        userId: outsiderId,
        email: "outsider@test.com",
        name: "Outsider",
        tenantId: tenant2Id,
        isAdmin: false,
        isTenantAdmin: false,
      };

      await expect(
        requireTenantManager(db, outsiderUser, tenant1Id)
      ).rejects.toThrow("Only tenant owner or admin can perform this action");
    });
  });

  describe("route guards", () => {
    test("authGuard rejects missing user and allows authenticated user", async () => {
      const token = await generateJWT({
        userId: "550e8400-e29b-41d4-a716-446655440001",
        email: "user@test.com",
        name: "User",
        tenantId: "550e8400-e29b-41d4-a716-446655440001",
        isAdmin: false,
        isTenantAdmin: false,
      });

      const app = new Elysia()
        .onError(handleHttpError)
        .use(contextPlugin)
        .use(authGuard)
        .get("/guard", () => ({ ok: true }));

      const noAuthResponse = await app.handle(new Request("http://localhost/guard"));
      expect(noAuthResponse.status).toBe(401);

      const authResponse = await app.handle(makeJsonRequest("/guard", token));
      expect(authResponse.status).toBe(200);
      const authData = await readJson<{ ok: boolean }>(authResponse);
      expect(authData.ok).toBe(true);
    });

    test("adminGuard rejects non-admin and allows admin", async () => {
      const adminToken = await generateJWT({
        userId: "550e8400-e29b-41d4-a716-446655440002",
        email: "admin@test.com",
        name: "Admin",
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        isAdmin: true,
        isTenantAdmin: false,
      });
      const userToken = await generateJWT({
        userId: "550e8400-e29b-41d4-a716-446655440003",
        email: "member@test.com",
        name: "Member",
        tenantId: "550e8400-e29b-41d4-a716-446655440001",
        isAdmin: false,
        isTenantAdmin: false,
      });

      const app = new Elysia()
        .onError(handleHttpError)
        .use(contextPlugin)
        .use(adminGuard)
        .get("/guard", () => ({ ok: true }));

      const noAuthResponse = await app.handle(new Request("http://localhost/guard"));
      expect(noAuthResponse.status).toBe(401);

      const forbiddenResponse = await app.handle(makeJsonRequest("/guard", userToken));
      expect(forbiddenResponse.status).toBe(403);

      const adminResponse = await app.handle(makeJsonRequest("/guard", adminToken));
      expect(adminResponse.status).toBe(200);
      const adminData = await readJson<{ ok: boolean }>(adminResponse);
      expect(adminData.ok).toBe(true);
    });

    test("tenantUserGuard enforces tenantId and user", async () => {
      const adminToken = await generateJWT({
        userId: "550e8400-e29b-41d4-a716-446655440004",
        email: "guard-admin@test.com",
        name: "Guard Admin",
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        isAdmin: true,
        isTenantAdmin: false,
      });

      const app = new Elysia()
        .onError(handleHttpError)
        .use(contextPlugin)
        .use(tenantUserGuard)
        .get("/guard/:tenantId", ({ params }) => ({ tenantId: params.tenantId }))
        .get("/guard", () => ({ ok: true }));

      const noAuthResponse = await app.handle(new Request("http://localhost/guard/550e8400-e29b-41d4-a716-446655440001"));
      expect(noAuthResponse.status).toBe(401);

      const missingTenantResponse = await app.handle(makeJsonRequest("/guard", adminToken));
      expect(missingTenantResponse.status).toBe(400);

      const okResponse = await app.handle(makeJsonRequest("/guard/550e8400-e29b-41d4-a716-446655440001", adminToken));
      expect(okResponse.status).toBe(200);
      const okData = await readJson<{ tenantId: string }>(okResponse);
      expect(okData.tenantId).toBe("550e8400-e29b-41d4-a716-446655440001");
    });

    test("tenantManagerGuard enforces tenantId and user", async () => {
      const adminToken = await generateJWT({
        userId: "550e8400-e29b-41d4-a716-446655440005",
        email: "guard-manager@test.com",
        name: "Guard Manager",
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        isAdmin: true,
        isTenantAdmin: false,
      });

      const app = new Elysia()
        .onError(handleHttpError)
        .use(contextPlugin)
        .use(tenantManagerGuard)
        .get("/guard/:tenantId", ({ params }) => ({ tenantId: params.tenantId }))
        .get("/guard", () => ({ ok: true }));

      const noAuthResponse = await app.handle(new Request("http://localhost/guard/550e8400-e29b-41d4-a716-446655440001"));
      expect(noAuthResponse.status).toBe(401);

      const missingTenantResponse = await app.handle(makeJsonRequest("/guard", adminToken));
      expect(missingTenantResponse.status).toBe(400);

      const okResponse = await app.handle(makeJsonRequest("/guard/550e8400-e29b-41d4-a716-446655440001", adminToken));
      expect(okResponse.status).toBe(200);
      const okData = await readJson<{ tenantId: string }>(okResponse);
      expect(okData.tenantId).toBe("550e8400-e29b-41d4-a716-446655440001");
    });
  });
});
