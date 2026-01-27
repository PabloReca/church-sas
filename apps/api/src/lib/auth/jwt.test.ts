import { describe, test, expect } from "vitest";
import { generateJWT, verifyJWT, generatePendingJWT, verifyPendingJWT, type UserPayload, type PendingUserPayload } from "./jwt";

describe("JWT Module", () => {
  const mockUserPayload: UserPayload = {
    userId: "550e8400-e29b-41d4-a716-446655440123",
    email: "test@example.com",
    name: "Test User",
    tenantId: "550e8400-e29b-41d4-a716-446655440456",
    isAdmin: false,
    isTenantAdmin: true,
  };

  const mockPendingPayload: Omit<PendingUserPayload, 'type'> = {
    email: "pending@example.com",
    name: "Pending User",
    picture: "https://example.com/avatar.jpg",
  };

  describe("generateJWT", () => {
    test("should generate a valid JWT token", async () => {
      const token = await generateJWT(mockUserPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT has 3 parts
    });

    test("should generate different tokens for different payloads", async () => {
      const token1 = await generateJWT(mockUserPayload);
      const token2 = await generateJWT({
        ...mockUserPayload,
        userId: "550e8400-e29b-41d4-a716-446655440999",
      });

      expect(token1).not.toBe(token2);
    });

    test("should handle user with null name", async () => {
      const payloadWithNullName = {
        ...mockUserPayload,
        name: null,
      };

      const token = await generateJWT(payloadWithNullName);
      expect(token).toBeDefined();
    });
  });

  describe("verifyJWT", () => {
    test("should verify and decode a valid token", async () => {
      const token = await generateJWT(mockUserPayload);
      const decoded = await verifyJWT(token);

      expect(decoded.userId).toBe(mockUserPayload.userId);
      expect(decoded.email).toBe(mockUserPayload.email);
      expect(decoded.name).toBe(mockUserPayload.name);
      expect(decoded.tenantId).toBe(mockUserPayload.tenantId);
      expect(decoded.isAdmin).toBe(mockUserPayload.isAdmin);
      expect(decoded.isTenantAdmin).toBe(mockUserPayload.isTenantAdmin);
    });

    test("should fail with invalid token", async () => {
      await expect(
        verifyJWT("invalid.token.here")
      ).rejects.toThrow();
    });

    test("should fail with tampered token", async () => {
      const token = await generateJWT(mockUserPayload);
      const tamperedToken = token.slice(0, -5) + "XXXXX";

      await expect(
        verifyJWT(tamperedToken)
      ).rejects.toThrow();
    });

    test("should handle null name correctly", async () => {
      const payloadWithNullName = {
        ...mockUserPayload,
        name: null,
      };

      const token = await generateJWT(payloadWithNullName);
      const decoded = await verifyJWT(token);

      expect(decoded.name).toBeNull();
    });
  });

  describe("generatePendingJWT", () => {
    test("should generate a valid pending JWT token", async () => {
      const token = await generatePendingJWT(mockPendingPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    test("should handle null picture", async () => {
      const payloadWithNullPicture = {
        ...mockPendingPayload,
        picture: null,
      };

      const token = await generatePendingJWT(payloadWithNullPicture);
      expect(token).toBeDefined();
    });
  });

  describe("verifyPendingJWT", () => {
    test("should verify and decode a valid pending token", async () => {
      const token = await generatePendingJWT(mockPendingPayload);
      const decoded = await verifyPendingJWT(token);

      expect(decoded.type).toBe("pending");
      expect(decoded.email).toBe(mockPendingPayload.email);
      expect(decoded.name).toBe(mockPendingPayload.name);
      expect(decoded.picture).toBe(mockPendingPayload.picture);
    });

    test("should fail with regular user token", async () => {
      const regularToken = await generateJWT(mockUserPayload);

      await expect(
        verifyPendingJWT(regularToken)
      ).rejects.toThrow("Invalid pending token");
    });

    test("should fail with invalid token", async () => {
      await expect(
        verifyPendingJWT("invalid.token.here")
      ).rejects.toThrow();
    });

    test("should handle null picture correctly", async () => {
      const payloadWithNullPicture = {
        ...mockPendingPayload,
        picture: null,
      };

      const token = await generatePendingJWT(payloadWithNullPicture);
      const decoded = await verifyPendingJWT(token);

      expect(decoded.picture).toBeNull();
    });
  });

  describe("Round-trip tests", () => {
    test("admin user should round-trip correctly", async () => {
      const adminPayload: UserPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440001",
        email: "admin@example.com",
        name: "Admin User",
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        isAdmin: true,
        isTenantAdmin: false,
      };

      const token = await generateJWT(adminPayload);
      const decoded = await verifyJWT(token);

      expect(decoded).toEqual(adminPayload);
    });

    test("tenant admin should round-trip correctly", async () => {
      const tenantAdminPayload: UserPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440002",
        email: "tenant-admin@example.com",
        name: "Tenant Admin",
        tenantId: "550e8400-e29b-41d4-a716-446655440100",
        isAdmin: false,
        isTenantAdmin: true,
      };

      const token = await generateJWT(tenantAdminPayload);
      const decoded = await verifyJWT(token);

      expect(decoded).toEqual(tenantAdminPayload);
    });

    test("regular user should round-trip correctly", async () => {
      const regularPayload: UserPayload = {
        userId: "550e8400-e29b-41d4-a716-446655440003",
        email: "user@example.com",
        name: "Regular User",
        tenantId: "550e8400-e29b-41d4-a716-446655440200",
        isAdmin: false,
        isTenantAdmin: false,
      };

      const token = await generateJWT(regularPayload);
      const decoded = await verifyJWT(token);

      expect(decoded).toEqual(regularPayload);
    });
  });
});
