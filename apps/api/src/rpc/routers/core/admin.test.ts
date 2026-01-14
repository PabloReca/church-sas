import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import { admins, emails } from "@/db/schema";
import { adminRouter } from "./admin";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

const adminEmail = "admin-router@test.com";
let adminEmailId: number;

beforeAll(async () => {
  // Create email record
  let [emailRecord] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, adminEmail))
    .limit(1);

  if (!emailRecord) {
    [emailRecord] = await db
      .insert(emails)
      .values({ email: adminEmail })
      .returning();
  }

  if (!emailRecord) throw new Error("Failed to create email record");
  adminEmailId = emailRecord.id;

  await db.insert(admins).values({
    emailId: adminEmailId,
    name: "Test Admin",
  });
});

afterAll(async () => {
  await db.delete(admins).where(eq(admins.emailId, adminEmailId));
  // Clean up newadmin email if exists
  const [newAdminEmail] = await db.select().from(emails).where(eq(emails.email, "newadmin@test.com")).limit(1);
  if (newAdminEmail) {
    await db.delete(admins).where(eq(admins.emailId, newAdminEmail.id));
    await db.delete(emails).where(eq(emails.id, newAdminEmail.id));
  }
  await db.delete(emails).where(eq(emails.id, adminEmailId));
});

describe("Admin Router", () => {
  describe("list", () => {
    test("should list all administrators as admin", async () => {
      const result = await callAs(
        adminRouter.list,
        undefined,
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.length).toBeGreaterThan(0);
      const adminEntry = result.find((a: { email: string }) => a.email === adminEmail);
      expect(adminEntry?.name).toBe("Test Admin");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          adminRouter.list,
          undefined,
          ctx.asUser(1, "regular@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("add", () => {
    test("should add a new administrator with new email", async () => {
      const result = await callAs(
        adminRouter.add,
        {
          email: "newadmin@test.com",
          name: "New Admin",
          lastname: "Last",
        },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result?.email).toBe("newadmin@test.com");
      expect(result?.name).toBe("New Admin");
    });

    test("should reuse existing email when promoting to admin", async () => {
      // First, create an email that exists but is not an admin yet
      const existingEmail = "existing-user@test.com";
      const [emailRecord] = await db.insert(emails).values({ email: existingEmail }).returning();

      // Now add this email as admin (should reuse the email record)
      const result = await callAs(
        adminRouter.add,
        {
          email: existingEmail,
          name: "Promoted Admin",
          lastname: "User",
        },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result?.email).toBe(existingEmail);
      expect(result?.name).toBe("Promoted Admin");

      // Verify it used the existing email record
      const allEmails = await db.select().from(emails).where(eq(emails.email, existingEmail));
      expect(allEmails.length).toBe(1); // Should only have one email record

      // Cleanup
      const [adminRecord] = await db.select().from(admins).where(eq(admins.emailId, emailRecord!.id)).limit(1);
      if (adminRecord) {
        await db.delete(admins).where(eq(admins.id, adminRecord.id));
      }
      await db.delete(emails).where(eq(emails.id, emailRecord!.id));
    });

    test("should fail to add duplicate administrator", async () => {
      expect(
        callAs(
          adminRouter.add,
          {
            email: "newadmin@test.com",
            name: "Duplicate Admin",
          },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Email is already a global administrator");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          adminRouter.add,
          {
            email: "hacker@test.com",
            name: "Hacker",
          },
          ctx.asUser(1, "regular@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });

  describe("remove", () => {
    test("should remove an administrator", async () => {
      const [newAdminEmail] = await db.select().from(emails).where(eq(emails.email, "newadmin@test.com")).limit(1);
      if (!newAdminEmail) throw new Error("newadmin email not found");

      const [adminToRemove] = await db
        .select()
        .from(admins)
        .where(eq(admins.emailId, newAdminEmail.id))
        .limit(1);

      if (!adminToRemove) throw new Error("Admin to remove not found");

      const result = await callAs(
        adminRouter.remove,
        { id: adminToRemove.id },
        ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
      );

      expect(result.success).toBe(true);
    });

    test("should fail to remove non-existent administrator", async () => {
      expect(
        callAs(
          adminRouter.remove,
          { id: 999999 },
          ctx.asUser(1, adminEmail, "Test Admin").asAdmin()
        )
      ).rejects.toThrow("Administrator not found");
    });

    test("should fail without admin privileges", async () => {
      expect(
        callAs(
          adminRouter.remove,
          { id: 1 },
          ctx.asUser(1, "regular@test.com", "Regular User")
        )
      ).rejects.toThrow();
    });
  });
});
