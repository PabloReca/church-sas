import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  admins,
  tenantPlans,
  tenantTeams,
  tenantTeamSkills,
  tenantTeamMembers,
  tenantTeamMemberSkills,
  tenantPeopleFields,
  people,
} from "./schema";

// Base schemas from Drizzle
const adminSchema = createInsertSchema(admins);
const tenantPlanSchema = createInsertSchema(tenantPlans);
// tenantHelpers uses simple z.object schemas directly
const tenantTeamSchema = createInsertSchema(tenantTeams);
const tenantTeamSkillSchema = createInsertSchema(tenantTeamSkills);
const tenantTeamMemberSchema = createInsertSchema(tenantTeamMembers);
const tenantTeamMemberSkillSchema = createInsertSchema(tenantTeamMemberSkills);
const tenantPeopleFieldSchema = createInsertSchema(tenantPeopleFields);
const personSchema = createInsertSchema(people);

// Plan
export const createPlanInput = tenantPlanSchema.pick({ name: true, price: true, maxSeats: true });
export const updatePlanInput = tenantPlanSchema.pick({ name: true, price: true, maxSeats: true }).partial().extend({ id: z.number() });
export const planIdInput = z.object({ id: z.number() });

// Tenant
export const createTenantInput = z.object({
  name: z.string().min(1),
  planId: z.number(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1),
});

// Setup Tenant (public, from pending token)
export const setupTenantInput = z.object({
  tenantName: z.string().min(1),
  ownerName: z.string().min(1),
});
export const updateTenantInput = z.object({ id: z.number(), name: z.string().min(1).optional(), planId: z.number().optional() });
export const tenantIdInput = z.object({ id: z.number() });
export const inviteCodeInput = z.object({ inviteCode: z.string().min(1) });
export const userCountInput = z.object({ tenantId: z.number() });
export const canJoinInput = z.object({ tenantId: z.number() });
export const joinByInviteCodeInput = z.object({ inviteCode: z.string().min(1) });

// Person Field (tenant custom fields)
export const fieldTypeEnum = z.enum(["text", "date", "number", "phone", "select"]);
export const createFieldInput = tenantPeopleFieldSchema
  .pick({ name: true, displayName: true, fieldType: true, isRequired: true, displayOrder: true, options: true })
  .extend({ tenantId: z.number() });
export const updateFieldInput = tenantPeopleFieldSchema
  .pick({ displayName: true, fieldType: true, isRequired: true, displayOrder: true, options: true })
  .partial()
  .extend({ tenantId: z.number(), fieldId: z.number() });
export const deleteFieldInput = z.object({ tenantId: z.number(), fieldId: z.number() });
export const listFieldsInput = z.object({ tenantId: z.number() });

// Person
export const roleTypeEnum = z.enum(["owner", "admin"]);
export const getPersonInput = z.object({ personId: z.number() });
export const createPersonInput = personSchema
  .pick({ tenantId: true, role: true })
  .extend({
    email: z.string().email(),
    fields: z.record(z.string(), z.string()).optional(), // { fieldName: value }
  });
export const updatePersonInput = personSchema
  .pick({ role: true })
  .partial()
  .extend({
    personId: z.number(),
    // Email is NOT updatable - it's tied to OAuth identity
    fields: z.record(z.string(), z.string()).optional(),
    isActive: z.number().min(0).max(1).optional(),
  });
export const getByEmailInput = personSchema.pick({ tenantId: true }).extend({ email: z.string().email() });

// Tenant People
export const listTenantPeopleInput = z.object({ tenantId: z.number() });
export const getPersonInTenantInput = z.object({ tenantId: z.number(), personId: z.number() });

// Administrator
export const isAdminInput = z.object({ email: z.string().email() });
export const addAdminInput = adminSchema
  .pick({ name: true, lastname: true })
  .extend({ email: z.string().email() });
export const removeAdminInput = z.object({ id: z.number() });

// Person Role (set on people table directly)
export const setPersonRoleInput = z.object({
  personId: z.number(),
  role: roleTypeEnum.nullable(), // null to remove role
});
export const getPersonRoleInput = z.object({ personId: z.number() });

// Tenant Helper
export const addHelperInput = z.object({
  tenantId: z.number(),
  personId: z.number()
});
export const removeHelperInput = addHelperInput;
export const listHelpersInput = z.object({ tenantId: z.number() });
export const listPersonHelperTenantsInput = z.object({ personId: z.number() });

// Tenant User (can login to system)
export const addTenantUserInput = z.object({ personId: z.number() });
export const removeTenantUserInput = addTenantUserInput;
export const isTenantUserInput = addTenantUserInput;
export const countTenantUsersInput = z.object({ tenantId: z.number() });

// Team
export const createTeamInput = tenantTeamSchema.pick({ tenantId: true, name: true, description: true });
export const updateTeamInput = tenantTeamSchema
  .pick({ name: true, description: true })
  .partial()
  .extend({ tenantId: z.number(), teamId: z.number() });
export const deleteTeamInput = z.object({ tenantId: z.number(), teamId: z.number() });
export const getTeamInput = z.object({ tenantId: z.number(), teamId: z.number() });
export const listTeamsInput = z.object({ tenantId: z.number() });

// Team Member
export const addTeamMemberInput = tenantTeamMemberSchema.pick({ tenantId: true, teamId: true, userId: true, role: true });
export const updateTeamMemberInput = tenantTeamMemberSchema
  .pick({ role: true })
  .partial()
  .extend({ tenantId: z.number(), teamId: z.number(), userId: z.number() });
export const removeTeamMemberInput = z.object({ tenantId: z.number(), teamId: z.number(), userId: z.number() });
export const listTeamMembersInput = z.object({ tenantId: z.number(), teamId: z.number() });

// Team Skill
export const createTeamSkillInput = tenantTeamSkillSchema.pick({ tenantId: true, teamId: true, name: true });
export const updateTeamSkillInput = tenantTeamSkillSchema
  .pick({ name: true })
  .extend({ tenantId: z.number(), skillId: z.number() });
export const deleteTeamSkillInput = z.object({ tenantId: z.number(), skillId: z.number() });
export const listTeamSkillsInput = z.object({ tenantId: z.number(), teamId: z.number() });

// Team Member Skill
export const assignMemberSkillInput = tenantTeamMemberSkillSchema.pick({ tenantId: true, teamMemberId: true, skillId: true, proficiencyLevel: true });
export const updateMemberSkillInput = tenantTeamMemberSkillSchema
  .pick({ proficiencyLevel: true })
  .partial()
  .extend({ tenantId: z.number(), teamMemberId: z.number(), skillId: z.number() });
export const removeMemberSkillInput = z.object({ tenantId: z.number(), teamMemberId: z.number(), skillId: z.number() });
export const listMemberSkillsInput = z.object({ tenantId: z.number(), teamMemberId: z.number() });

// Skill Incompatibility (blacklist - skills that CANNOT be used simultaneously)
export const addSkillIncompatibilityInput = z.object({
  tenantId: z.number(),
  skillId1: z.number(),
  skillId2: z.number(),
});
export const removeSkillIncompatibilityInput = addSkillIncompatibilityInput;
export const listSkillIncompatibilityInput = z.object({ tenantId: z.number() });

// Event Template
export const createEventTemplateInput = z.object({
  tenantId: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
});
export const updateEventTemplateInput = z.object({
  tenantId: z.number(),
  templateId: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export const deleteEventTemplateInput = z.object({ tenantId: z.number(), templateId: z.number() });
export const getEventTemplateInput = z.object({ tenantId: z.number(), templateId: z.number() });
export const listEventTemplatesInput = z.object({ tenantId: z.number() });

// Event Template Slot
export const createEventTemplateSlotInput = z.object({
  tenantId: z.number(),
  templateId: z.number(),
  teamId: z.number(),
  skillId: z.number(),
  quantity: z.number().min(1).default(1),
});
export const updateEventTemplateSlotInput = z.object({
  tenantId: z.number(),
  slotId: z.number(),
  quantity: z.number().min(1).optional(),
});
export const deleteEventTemplateSlotInput = z.object({ tenantId: z.number(), slotId: z.number() });
export const listEventTemplateSlotsInput = z.object({ tenantId: z.number(), templateId: z.number() });

// Event
export const createEventInput = z.object({
  tenantId: z.number(),
  templateId: z.number().optional(), // optional, if provided copies slots from template
  name: z.string().min(1),
  date: z.string().datetime(), // ISO date string
});
export const updateEventInput = z.object({
  tenantId: z.number(),
  eventId: z.number(),
  name: z.string().min(1).optional(),
  date: z.string().datetime().optional(),
  status: z.enum(["draft", "published", "completed", "cancelled"]).optional(),
});
export const deleteEventInput = z.object({ tenantId: z.number(), eventId: z.number() });
export const getEventInput = z.object({ tenantId: z.number(), eventId: z.number() });
export const listEventsInput = z.object({ tenantId: z.number() });

// Event Slot
export const createEventSlotInput = z.object({
  tenantId: z.number(),
  eventId: z.number(),
  teamId: z.number(),
  skillId: z.number(),
  quantity: z.number().min(1).default(1),
});
export const updateEventSlotInput = z.object({
  tenantId: z.number(),
  slotId: z.number(),
  quantity: z.number().min(1).optional(),
});
export const deleteEventSlotInput = z.object({ tenantId: z.number(), slotId: z.number() });
export const listEventSlotsInput = z.object({ tenantId: z.number(), eventId: z.number() });

// Event Assignment
export const createEventAssignmentInput = z.object({
  tenantId: z.number(),
  eventId: z.number(),
  slotId: z.number(),
  userId: z.number(),
});
export const deleteEventAssignmentInput = z.object({ tenantId: z.number(), assignmentId: z.number() });
export const listEventAssignmentsInput = z.object({ tenantId: z.number(), eventId: z.number() });
