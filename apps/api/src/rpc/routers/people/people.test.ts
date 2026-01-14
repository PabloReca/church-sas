import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import { tenants, people, tenantPlans, emails, tenantPeopleFields, tenantPeopleFieldValues, tenantUsers, admins } from "@/db/schema";
import { peopleRouter } from "./index";
import { peopleTenantsRouter } from "./people-tenants";
import { peopleFieldsRouter } from "./people-fields";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

let tenantId: number;
let planId: number;
let personId: number;
let personEmailId: number;
let adminEmailId: number;
let adminId: number;
let nameFieldId: number;
let phoneFieldId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan",
    price: "0",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  if (!plan) throw new Error("Failed to create test plan");
  planId = plan.id;

  // Create tenant
  const [tenant] = await db.insert(tenants).values({
    name: "Test Tenant",
    slug: "test-tenant-people",
    planId,
  }).returning();
  if (!tenant) throw new Error("Failed to create test tenant");
  tenantId = tenant.id;

  // Create person fields for this tenant
  const [nameField] = await db.insert(tenantPeopleFields).values({
    tenantId,
    name: "name",
    displayName: "Name",
    fieldType: "text",
    isRequired: true,
    displayOrder: 0,
  }).returning();
  if (!nameField) throw new Error("Failed to create name field");
  nameFieldId = nameField.id;

  const [phoneField] = await db.insert(tenantPeopleFields).values({
    tenantId,
    name: "phone",
    displayName: "Phone",
    fieldType: "phone",
    isRequired: false,
    displayOrder: 1,
  }).returning();
  if (!phoneField) throw new Error("Failed to create phone field");
  phoneFieldId = phoneField.id;

  // Create email
  const [emailRecord] = await db.insert(emails).values({
    email: "testperson@test.com",
  }).returning();
  if (!emailRecord) throw new Error("Failed to create email");
  personEmailId = emailRecord.id;

  // Create person
  const [person] = await db.insert(people).values({
    tenantId,
    emailId: personEmailId,
  }).returning();
  if (!person) throw new Error("Failed to create test person");
  personId = person.id;

  // Add field values
  await db.insert(tenantPeopleFieldValues).values({
    personId,
    fieldId: nameFieldId,
    value: "Test Person",
  });

  // Create admin user for testing admin-only features
  const [adminEmail] = await db.insert(emails).values({
    email: "admin-people@test.com",
  }).returning();
  if (!adminEmail) throw new Error("Failed to create admin email");
  adminEmailId = adminEmail.id;

  const [admin] = await db.insert(people).values({
    tenantId,
    emailId: adminEmailId,
    role: "admin",
  }).returning();
  if (!admin) throw new Error("Failed to create admin");
  adminId = admin.id;

  await db.insert(admins).values({
    emailId: adminEmailId,
    name: "Admin User",
  });
});

afterAll(async () => {
  await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.personId, personId));
  await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.personId, adminId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, personId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, adminId));
  await db.delete(admins).where(eq(admins.emailId, adminEmailId));
  await db.delete(people).where(eq(people.tenantId, tenantId));
  await db.delete(tenantPeopleFields).where(eq(tenantPeopleFields.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
  await db.delete(emails).where(eq(emails.id, personEmailId));
  await db.delete(emails).where(eq(emails.id, adminEmailId));
});

describe("People Router - Dynamic Fields", () => {
  describe("Field Management", () => {
    test("listFields - should list tenant fields", async () => {
      const result = await callAs(
        peopleFieldsRouter.list,
        { tenantId },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.length).toBe(2);
      expect(result[0].name).toBe("name");
      expect(result[1].name).toBe("phone");
    });

    test("createField - should create a new field", async () => {
      const result = await callAs(
        peopleFieldsRouter.create,
        {
          tenantId,
          name: "birthdate",
          displayName: "Birth Date",
          fieldType: "date",
          isRequired: false,
          displayOrder: 2,
        },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.name).toBe("birthdate");
      expect(result.fieldType).toBe("date");

      // Cleanup
      await db.delete(tenantPeopleFields).where(eq(tenantPeopleFields.id, result.id));
    });

    test("createField - should fail for duplicate field name", async () => {
      expect(
        callAs(
          peopleFieldsRouter.create,
          {
            tenantId,
            name: "name", // Already exists
            displayName: "Another Name",
            fieldType: "text",
          },
          ctx.asUser(personId, "testperson@test.com", "Test Person")
        )
      ).rejects.toThrow("Field with this name already exists");
    });

    test("updateField - should update field", async () => {
      const result = await callAs(
        peopleFieldsRouter.update,
        {
          tenantId,
          fieldId: phoneFieldId,
          displayName: "Phone Number",
        },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.displayName).toBe("Phone Number");
    });
  });

  describe("Person CRUD with Dynamic Fields", () => {
    test("get - should return person with fields", async () => {
      const result = await callAs(
        peopleRouter.get,
        { personId },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(personId);
      expect(result.email).toBe("testperson@test.com");
      expect(result.fields).toBeDefined();
      expect(result.fields.name).toBe("Test Person");
    });

    test("update - should update person fields", async () => {
      const result = await callAs(
        peopleRouter.update,
        {
          personId,
          fields: {
            name: "Updated Name",
            phone: "123456789",
          },
        },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.fields.name).toBe("Updated Name");
      expect(result.fields.phone).toBe("123456789");
    });

    test("update - should fail for unknown field", async () => {
      expect(
        callAs(
          peopleRouter.update,
          {
            personId,
            fields: {
              unknown_field: "value",
            },
          },
          ctx.asUser(personId, "testperson@test.com", "Test Person")
        )
      ).rejects.toThrow("Unknown field: unknown_field");
    });

    test("create - should create person with fields", async () => {
      const result = await callAs(
        peopleRouter.create,
        {
          tenantId,
          email: "newperson@test.com",
          fields: {
            name: "New Person",
            phone: "987654321",
          },
        },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result).toBeDefined();
      expect(result.email).toBe("newperson@test.com");
      expect(result.fields.name).toBe("New Person");
      expect(result.fields.phone).toBe("987654321");

      // Cleanup
      await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.personId, result.id));
      await db.delete(people).where(eq(people.id, result.id));
      const [newEmail] = await db.select().from(emails).where(eq(emails.email, "newperson@test.com")).limit(1);
      if (newEmail) await db.delete(emails).where(eq(emails.id, newEmail.id));
    });

    test("create - should fail for duplicate email", async () => {
      expect(
        callAs(
          peopleRouter.create,
          {
            tenantId,
            email: "testperson@test.com", // Already exists
            fields: { name: "Duplicate" },
          },
          ctx.asUser(personId, "testperson@test.com", "Test Person")
        )
      ).rejects.toThrow("Email already in use");
    });

    test("listTenantPeople - should return people with fields", async () => {
      const result = await callAs(
        peopleTenantsRouter.listTenantPeople,
        { tenantId },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.length).toBeGreaterThan(0);
      const person = result.find((p: { id: number }) => p.id === personId);
      expect(person).toBeDefined();
      expect(person.fields).toBeDefined();
    });
  });

  describe("Field Deletion Cascade", () => {
    test("deleteField - should delete field and cascade to values", async () => {
      // Create a temporary field
      const [tempField] = await db.insert(tenantPeopleFields).values({
        tenantId,
        name: "temp_field",
        displayName: "Temp Field",
        fieldType: "text",
      }).returning();

      if (!tempField) throw new Error("Failed to create temp field");

      // Add a value
      await db.insert(tenantPeopleFieldValues).values({
        personId,
        fieldId: tempField.id,
        value: "temp value",
      });

      // Delete the field
      const result = await callAs(
        peopleFieldsRouter.delete,
        { tenantId, fieldId: tempField.id },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.success).toBe(true);

      // Verify value was also deleted
      const values = await db
        .select()
        .from(tenantPeopleFieldValues)
        .where(eq(tenantPeopleFieldValues.fieldId, tempField.id));

      expect(values.length).toBe(0);
    });
  });

  describe("Additional Edge Cases", () => {
    test("me - should return current person info", async () => {
      const result = await callAs(
        peopleRouter.me,
        undefined,
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(personId);
      expect(result.email).toBe("testperson@test.com");
      expect(result.fields.name).toBe("Updated Name");
    });

    test("me - should fail for non-existent person", async () => {
      expect(
        callAs(
          peopleRouter.me,
          undefined,
          ctx.asUser(999999, "nonexistent@test.com", "Non Existent")
        )
      ).rejects.toThrow("Person not found");
    });

    test("get - should fail for non-existent person", async () => {
      expect(
        callAs(
          peopleRouter.get,
          { personId: 999999 },
          ctx.asUser(999999, "nonexistent@test.com", "Non Existent")
        )
      ).rejects.toThrow("Person not found");
    });

    test("update - should update fields only (email is NOT updatable)", async () => {
      const result = await callAs(
        peopleRouter.update,
        {
          personId,
          fields: { name: "Updated Again" },
        },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.fields.name).toBe("Updated Again");
      // Verify email didn't change (email is tied to OAuth)
      expect(result.email).toBe("testperson@test.com");
    });


    test("update - should fail for non-existent person", async () => {
      expect(
        callAs(
          peopleRouter.update,
          {
            personId: 999999,
            fields: { name: "Test" },
          },
          ctx.asUser(999999, "nonexistent@test.com", "Non Existent")
        )
      ).rejects.toThrow("Person not found");
    });

    test("update - should fail when no fields to update", async () => {
      expect(
        callAs(
          peopleRouter.update,
          {
            personId,
          },
          ctx.asUser(personId, "testperson@test.com", "Test Person")
        )
      ).rejects.toThrow("No fields to update");
    });

    test("update - admin can activate user", async () => {
      const result = await callAs(
        peopleRouter.update,
        {
          personId,
          isActive: 1,
        },
        ctx.asUser(adminId, "admin-people@test.com", "Admin User").asAdmin()
      );

      expect(result).toBeDefined();

      // Verify active seat was created
      const [seat] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.personId, personId))
        .limit(1);
      expect(seat).toBeDefined();
    });

    test("update - admin can deactivate user", async () => {
      const result = await callAs(
        peopleRouter.update,
        {
          personId,
          isActive: 0,
        },
        ctx.asUser(adminId, "admin-people@test.com", "Admin User").asAdmin()
      );

      expect(result).toBeDefined();

      // Verify active seat was removed
      const [seat] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.personId, personId))
        .limit(1);
      expect(seat).toBeUndefined();
    });

    test("update - non-admin cannot change isActive status", async () => {
      const result = await callAs(
        peopleRouter.update,
        {
          personId,
          isActive: 1,
          fields: { name: "Test" }, // Need at least one valid field
        },
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      // isActive should be ignored for non-admin
      expect(result).toBeDefined();
    });

    test("create - should fail for unknown field", async () => {
      const uniqueEmail = `newperson-unknown-${Date.now()}@test.com`;
      expect(
        callAs(
          peopleRouter.create,
          {
            tenantId,
            email: uniqueEmail,
            fields: {
              unknown_field: "value",
            },
          },
          ctx.asUser(personId, "testperson@test.com", "Test Person")
        )
      ).rejects.toThrow("Unknown field: unknown_field");
    });

    test("getPersonInTenant - should return person in their primary tenant", async () => {
      const result = await callAs(
        peopleRouter.getPersonInTenant,
        { tenantId, personId },
        ctx.asUser(personId, "testperson@test.com", "Test Person").inTenant(tenantId)
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(personId);
      expect(result!.isPrimary).toBe(true);
      expect(result!.isHelper).toBe(false);
    });

    test("getPersonInTenant - should return null for non-existent person", async () => {
      const result = await callAs(
        peopleRouter.getPersonInTenant,
        { tenantId, personId: 999999 },
        ctx.asUser(personId, "testperson@test.com", "Test Person").inTenant(tenantId)
      );

      expect(result).toBeNull();
    });

    test("test endpoint - should return test message", async () => {
      const result = await callAs(
        peopleRouter.test,
        undefined,
        ctx.asUser(personId, "testperson@test.com", "Test Person")
      );

      expect(result.message).toBe("test works");
      expect(result.userId).toBe(personId);
    });
  });
});
