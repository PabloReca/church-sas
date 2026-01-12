import { describe, test, expect } from "bun:test";
import { plansRouter } from "./plans";

describe("Plans Router", () => {
  test("router exports required methods", () => {
    expect(plansRouter.listPlans).toBeDefined();
    expect(plansRouter.createPlan).toBeDefined();
    expect(plansRouter.updatePlan).toBeDefined();
    expect(plansRouter.deletePlan).toBeDefined();
  });

  // NOTE: Functional tests for plans would typically be integrated
  // with tenant tests as plans are closely related to tenant creation
});
