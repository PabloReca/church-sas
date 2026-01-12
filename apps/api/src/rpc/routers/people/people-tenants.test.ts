import { describe, test, expect } from "bun:test";
import { peopleTenantsRouter } from "./people-tenants";

describe("People Tenants Router", () => {
  test("router exports required methods", () => {
    expect(peopleTenantsRouter.myTenants).toBeDefined();
    expect(peopleTenantsRouter.listTenantPeople).toBeDefined();
  });

  // NOTE: Functional tests for people tenants are in people.test.ts
  // as they require the full people context setup
});
