import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { getDb } from "@/db/connection";
import {
  tenants,
  tenantPlans,
  emails,
  people,
  tenantUsers,
  tenantHelpers,
  tenantPeopleFields,
  tenantPeopleFieldValues,
} from "@/db/schema";
import { peopleTenantsRouter } from "./people-tenants";
import { eq } from "drizzle-orm";
import { TestContext, callAs } from "@/lib/test-helpers";

const db = getDb();
const ctx = new TestContext(db);

let planId: number;
let tenantAId: number;
let tenantBId: number;
let personAEmailId: number;
let personAId: number;
let personBEmailId: number;
let personBId: number;
let helperEmailId: number;
let helperId: number;
let nameFieldAId: number;
let nameFieldBId: number;

beforeAll(async () => {
  // Create plan
  const [plan] = await db.insert(tenantPlans).values({
    name: "Test Plan People Tenants",
    price: "10",
    maxSeats: 10,
    maxPeople: 50,
  }).returning();
  planId = plan!.id;

  // Create Tenant A
  const [tenantA] = await db.insert(tenants).values({
    name: "Tenant A People",
    slug: "tenant-a-people-tenants",
    planId,
  }).returning();
  tenantAId = tenantA!.id;

  // Create Tenant B
  const [tenantB] = await db.insert(tenants).values({
    name: "Tenant B People",
    slug: "tenant-b-people-tenants",
    planId,
  }).returning();
  tenantBId = tenantB!.id;

  // Create Person A (owner of Tenant A)
  const [personAEmail] = await db.insert(emails).values({ email: "persona-tenants@test.com" }).returning();
  personAEmailId = personAEmail!.id;
  const [personA] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: personAEmailId,
    role: "owner",
  }).returning();
  personAId = personA!.id;
  await db.insert(tenantUsers).values({ personId: personAId });

  // Create Person B (member of Tenant B)
  const [personBEmail] = await db.insert(emails).values({ email: "personb-tenants@test.com" }).returning();
  personBEmailId = personBEmail!.id;
  const [personB] = await db.insert(people).values({
    tenantId: tenantBId,
    emailId: personBEmailId,
    role: null,
  }).returning();
  personBId = personB!.id;
  await db.insert(tenantUsers).values({ personId: personBId });

  // Add Person A as helper in Tenant B
  await db.insert(tenantHelpers).values({
    tenantId: tenantBId,
    personId: personAId,
  });

  // Create Helper Person (primary tenant A, helper in B)
  const [helperEmail] = await db.insert(emails).values({ email: "helper-tenants@test.com" }).returning();
  helperEmailId = helperEmail!.id;
  const [helper] = await db.insert(people).values({
    tenantId: tenantAId,
    emailId: helperEmailId,
    role: null,
  }).returning();
  helperId = helper!.id;
  await db.insert(tenantUsers).values({ personId: helperId });
  await db.insert(tenantHelpers).values({
    tenantId: tenantBId,
    personId: helperId,
  });

  // Create name fields for both tenants
  const [fieldA] = await db.insert(tenantPeopleFields).values({
    tenantId: tenantAId,
    name: "name",
    displayName: "Name",
    fieldType: "text",
    isRequired: true,
    displayOrder: 0,
  }).returning();
  nameFieldAId = fieldA!.id;

  const [fieldB] = await db.insert(tenantPeopleFields).values({
    tenantId: tenantBId,
    name: "name",
    displayName: "Name",
    fieldType: "text",
    isRequired: true,
    displayOrder: 0,
  }).returning();
  nameFieldBId = fieldB!.id;

  // Set field values
  await db.insert(tenantPeopleFieldValues).values([
    { personId: personAId, fieldId: nameFieldAId, value: "Person A" },
    { personId: personBId, fieldId: nameFieldBId, value: "Person B" },
    { personId: helperId, fieldId: nameFieldAId, value: "Helper Person" },
  ]);
});

afterAll(async () => {
  // Clean up in reverse order
  await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.fieldId, nameFieldAId));
  await db.delete(tenantPeopleFieldValues).where(eq(tenantPeopleFieldValues.fieldId, nameFieldBId));
  await db.delete(tenantPeopleFields).where(eq(tenantPeopleFields.id, nameFieldAId));
  await db.delete(tenantPeopleFields).where(eq(tenantPeopleFields.id, nameFieldBId));
  await db.delete(tenantHelpers).where(eq(tenantHelpers.tenantId, tenantBId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, personAId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, personBId));
  await db.delete(tenantUsers).where(eq(tenantUsers.personId, helperId));
  await db.delete(people).where(eq(people.id, personAId));
  await db.delete(people).where(eq(people.id, personBId));
  await db.delete(people).where(eq(people.id, helperId));
  await db.delete(emails).where(eq(emails.id, personAEmailId));
  await db.delete(emails).where(eq(emails.id, personBEmailId));
  await db.delete(emails).where(eq(emails.id, helperEmailId));
  await db.delete(tenants).where(eq(tenants.id, tenantAId));
  await db.delete(tenants).where(eq(tenants.id, tenantBId));
  await db.delete(tenantPlans).where(eq(tenantPlans.id, planId));
});

describe("People Tenants Router", () => {
  describe("myTenants", () => {
    test("should return primary tenant for person without helpers", async () => {
      const result = await callAs(
        peopleTenantsRouter.myTenants,
        undefined,
        ctx.asUser(personBId, "personb-tenants@test.com", "Person B")
      );

      expect(result.length).toBe(1);
      expect(result[0]!.tenantId).toBe(tenantBId);
      expect(result[0]!.isPrimary).toBe(true);
    });

    test("should return primary tenant and helper tenants", async () => {
      const result = await callAs(
        peopleTenantsRouter.myTenants,
        undefined,
        ctx.asUser(personAId, "persona-tenants@test.com", "Person A")
      );

      expect(result.length).toBe(2);

      const primary = result.find((t: { isPrimary: boolean }) => t.isPrimary);
      expect(primary).toBeDefined();
      expect(primary!.tenantId).toBe(tenantAId);
      expect(primary!.tenantName).toBe("Tenant A People");

      const helper = result.find((t: { isPrimary: boolean }) => !t.isPrimary);
      expect(helper).toBeDefined();
      expect(helper!.tenantId).toBe(tenantBId);
      expect(helper!.tenantName).toBe("Tenant B People");
    });

    test("should return both primary and helper tenants for helper person", async () => {
      const result = await callAs(
        peopleTenantsRouter.myTenants,
        undefined,
        ctx.asUser(helperId, "helper-tenants@test.com", "Helper Person")
      );

      expect(result.length).toBe(2);

      const primary = result.find((t: { tenantId: number }) => t.tenantId === tenantAId);
      expect(primary!.isPrimary).toBe(true);

      const helper = result.find((t: { tenantId: number }) => t.tenantId === tenantBId);
      expect(helper!.isPrimary).toBe(false);
    });
  });

  describe("listTenantPeople", () => {
    test("should list primary members in tenant", async () => {
      const result = await callAs(
        peopleTenantsRouter.listTenantPeople,
        { tenantId: tenantAId },
        ctx.asUser(personAId, "persona-tenants@test.com", "Person A").inTenant(tenantAId)
      );

      expect(result.length).toBeGreaterThanOrEqual(2);

      // Person A (owner)
      const personAResult = result.find((p: { id: number }) => p.id === personAId);
      expect(personAResult).toBeDefined();
      expect(personAResult!.isPrimary).toBe(true);
      expect(personAResult!.isHelper).toBe(false);
      expect(personAResult!.role).toBe("owner");
      expect(personAResult!.fields.name).toBe("Person A");

      // Helper (primary member)
      const helperResult = result.find((p: { id: number }) => p.id === helperId);
      expect(helperResult).toBeDefined();
      expect(helperResult!.isPrimary).toBe(true);
      expect(helperResult!.isHelper).toBe(false);
      expect(helperResult!.fields.name).toBe("Helper Person");
    });

    test("should list primary members and helpers in tenant", async () => {
      const result = await callAs(
        peopleTenantsRouter.listTenantPeople,
        { tenantId: tenantBId },
        ctx.asUser(personBId, "personb-tenants@test.com", "Person B").inTenant(tenantBId)
      );

      expect(result.length).toBeGreaterThanOrEqual(3);

      // Person B (primary member)
      const personBResult = result.find((p: { id: number }) => p.id === personBId);
      expect(personBResult).toBeDefined();
      expect(personBResult!.isPrimary).toBe(true);
      expect(personBResult!.isHelper).toBe(false);

      // Person A (helper)
      const helperAResult = result.find((p: { id: number }) => p.id === personAId);
      expect(helperAResult).toBeDefined();
      expect(helperAResult!.isPrimary).toBe(false);
      expect(helperAResult!.isHelper).toBe(true);

      // Helper person (helper in tenant B)
      const helperResult = result.find((p: { id: number }) => p.id === helperId);
      expect(helperResult).toBeDefined();
      expect(helperResult!.isPrimary).toBe(false);
      expect(helperResult!.isHelper).toBe(true);
    });

    test("should include field values for all people", async () => {
      const result = await callAs(
        peopleTenantsRouter.listTenantPeople,
        { tenantId: tenantBId },
        ctx.asUser(personBId, "personb-tenants@test.com", "Person B").inTenant(tenantBId)
      );

      const personB = result.find((p: { id: number }) => p.id === personBId);
      expect(personB!.fields).toBeDefined();
      expect(personB!.fields.name).toBe("Person B");
    });

    test("cannot list people without tenant access", async () => {
      expect(
        callAs(
          peopleTenantsRouter.listTenantPeople,
          { tenantId: tenantAId },
          ctx.asUser(999, "outsider@test.com", "Outsider")
        )
      ).rejects.toThrow();
    });

    test("helper can list people in their helper tenant", async () => {
      const result = await callAs(
        peopleTenantsRouter.listTenantPeople,
        { tenantId: tenantBId },
        ctx.asUser(personAId, "persona-tenants@test.com", "Person A").inTenant(tenantBId)
      );

      expect(result.length).toBeGreaterThan(0);
    });
  });
});
