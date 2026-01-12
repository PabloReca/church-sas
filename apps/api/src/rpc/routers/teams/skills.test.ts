import { describe, test, expect } from "bun:test";
import { teamSkillsRouter } from "./skills";

describe("Team Skills Router", () => {
  test("router exports required methods", () => {
    expect(teamSkillsRouter.createSkill).toBeDefined();
    expect(teamSkillsRouter.listSkills).toBeDefined();
    expect(teamSkillsRouter.updateSkill).toBeDefined();
    expect(teamSkillsRouter.deleteSkill).toBeDefined();
    expect(teamSkillsRouter.assignMemberSkill).toBeDefined();
    expect(teamSkillsRouter.listMemberSkills).toBeDefined();
    expect(teamSkillsRouter.updateMemberSkill).toBeDefined();
    expect(teamSkillsRouter.removeMemberSkill).toBeDefined();
  });

  // NOTE: Functional tests for team skills are in teams.test.ts
  // as they require the full team context setup
});
