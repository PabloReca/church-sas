// Core
import { tenantsRouter } from "./core/tenants";
import { plansRouter } from "./core/plans";
import { tenantUsersRouter } from "./core/tenant-users";
import { adminRouter } from "./core/admin";

// People
import { peopleRouter } from "./people";
import { peopleTenantsRouter } from "./people/people-tenants";
import { peopleFieldsRouter } from "./people/people-fields";

// Teams
import { teamsRouter } from "./teams";
import { teamMembersRouter } from "./teams/members";
import { teamSkillsRouter } from "./teams/skills";
import { skillIncompatibilityRouter } from "./teams/skill-incompatibility";

// Events
import { eventsRouter } from "./events";
import { eventSlotsRouter } from "./events/slots";
import { eventAssignmentsRouter } from "./events/assignments";
import { eventTemplatesRouter } from "./events/templates";

export const appRouter = {
  tenants: tenantsRouter,
  plans: plansRouter,
  tenantUsers: tenantUsersRouter,
  people: peopleRouter,
  peopleTenants: peopleTenantsRouter,
  peopleFields: peopleFieldsRouter,
  admin: adminRouter,
  teams: teamsRouter,
  teamMembers: teamMembersRouter,
  teamSkills: teamSkillsRouter,
  events: eventsRouter,
  eventSlots: eventSlotsRouter,
  eventAssignments: eventAssignmentsRouter,
  eventTemplates: eventTemplatesRouter,
  skillIncompatibility: skillIncompatibilityRouter,
};

export type AppRouter = typeof appRouter;
