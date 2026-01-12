import { describe, test, expect } from "bun:test";
import { teamMembersRouter } from "./members";

describe("Team Members Router", () => {
  test("router exports required methods", () => {
    expect(teamMembersRouter.addMember).toBeDefined();
    expect(teamMembersRouter.listMembers).toBeDefined();
    expect(teamMembersRouter.updateMember).toBeDefined();
    expect(teamMembersRouter.removeMember).toBeDefined();
  });

  // NOTE: Functional tests for team members are in teams.test.ts
  // as they require the full team context setup
});
