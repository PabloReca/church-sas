import { describe, test, expect } from "vitest";
import { isAdmin, requireAdmin } from "./helpers";
import type { UserPayload } from "./jwt";

describe("Auth Helpers", () => {
  const adminUser: UserPayload = {
    userId: "550e8400-e29b-41d4-a716-446655440001",
    email: "admin@example.com",
    name: "Admin User",
    tenantId: "550e8400-e29b-41d4-a716-446655440000",
    isAdmin: true,
    isTenantAdmin: false,
  };

  const regularUser: UserPayload = {
    userId: "550e8400-e29b-41d4-a716-446655440003",
    email: "user@example.com",
    name: "Regular User",
    tenantId: "550e8400-e29b-41d4-a716-446655440100",
    isAdmin: false,
    isTenantAdmin: false,
  };

  describe("isAdmin", () => {
    test("should return true for admin user", () => {
      expect(isAdmin(adminUser)).toBe(true);
    });

    test("should return false for non-admin user", () => {
      expect(isAdmin(regularUser)).toBe(false);
    });
  });

  describe("requireAdmin", () => {
    test("should not throw for admin user", () => {
      expect(() => requireAdmin(adminUser)).not.toThrow();
    });

    test("should throw for non-admin user", () => {
      expect(() => requireAdmin(regularUser)).toThrow("Admin access required");
    });
  });
});
