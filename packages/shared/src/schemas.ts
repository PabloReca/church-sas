import { z } from "zod/v4";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import {
  tenantPlans,
  tenants,
  tenantPeopleFields,
  people,
  tenantHelpers,
  tenantUsers,
  tenantTeams,
  tenantTeamMembers,
  tenantTeamSkills,
  tenantTeamMemberSkills,
  tenantSkillIncompatibility,
  tenantEventTemplates,
  tenantEventTemplateSlots,
  tenantEvents,
  tenantEventSlots,
  tenantEventAssignments,
} from "./db/schema";

export const fieldTypeEnum = z.enum([
  "text",
  "date",
  "number",
  "phone",
  "select",
]);
export const roleTypeEnum = z.enum(["owner", "admin"]);
const eventStatusEnum = z.enum([
  "draft",
  "published",
  "completed",
  "cancelled",
]);

// UUID validation helper for sensitive entity IDs
const uuidSchema = z.string().uuid();

export { z };

const planInsertSchema = createInsertSchema(tenantPlans, {
  price: z.number(),
  currency: z.string().optional().default("USD"),
});
export const createPlanInput = planInsertSchema
  .pick({ name: true, price: true, currency: true, maxSeats: true })
  .extend({ maxSeats: z.number() });
export const updatePlanInput = createPlanInput
  .partial()
  .extend({ id: z.number() });
export const planIdInput = z.object({ id: z.number() });

const tenantInsertSchema = createInsertSchema(tenants);
export const createTenantInput = tenantInsertSchema
  .pick({ name: true, planId: true })
  .extend({ adminEmail: z.string().email(), adminName: z.string().min(1) });
export const setupTenantInput = z.object({
  tenantName: z.string().min(1),
  ownerName: z.string().min(1),
});
export const updateTenantInput = tenantInsertSchema
  .pick({ name: true, planId: true })
  .partial()
  .extend({ id: uuidSchema });
export const tenantIdInput = z.object({ id: uuidSchema });
export const inviteCodeInput = z.object({ inviteCode: z.string().min(1) });
export const userCountInput = z.object({ tenantId: uuidSchema });
export const canJoinInput = z.object({ tenantId: uuidSchema });
export const joinByInviteCodeInput = z.object({
  inviteCode: z.string().min(1),
});

const peopleFieldInsertSchema = createInsertSchema(tenantPeopleFields, {
  fieldType: fieldTypeEnum,
  options: z.string().nullable().optional(),
});
export const createFieldInput = peopleFieldInsertSchema
  .pick({
    tenantId: true,
    name: true,
    displayName: true,
    fieldType: true,
    isRequired: true,
    displayOrder: true,
    options: true,
  })
  .extend({ isRequired: z.boolean(), displayOrder: z.number() });
const peopleFieldUpdateSchema = createUpdateSchema(tenantPeopleFields, {
  fieldType: () => fieldTypeEnum,
  options: z.string().nullable().optional(),
});
export const updateFieldInput = peopleFieldUpdateSchema
  .pick({
    tenantId: true,
    displayName: true,
    fieldType: true,
    isRequired: true,
    displayOrder: true,
    options: true,
  })
  .extend({ tenantId: uuidSchema, fieldId: z.number() });
export const deleteFieldInput = z.object({
  tenantId: uuidSchema,
  fieldId: z.number(),
});
export const listFieldsInput = z.object({ tenantId: uuidSchema });

const peopleInsertSchema = createInsertSchema(people, {
  role: () => roleTypeEnum.nullable(),
});
export const getPersonInput = z.object({ personId: uuidSchema });
export const createPersonInput = peopleInsertSchema
  .pick({ tenantId: true, role: true })
  .extend({
    email: z.string().email(),
    fields: z.record(z.string(), z.string()).optional(),
  });
export const updatePersonInput = z.object({
  personId: uuidSchema,
  role: roleTypeEnum.nullable().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  isActive: z.number().min(0).max(1).optional(),
});
export const getByEmailInput = z.object({
  tenantId: uuidSchema,
  email: z.string().email(),
});

export const listTenantPeopleInput = z.object({ tenantId: uuidSchema });
export const getPersonInTenantInput = z.object({
  tenantId: uuidSchema,
  personId: uuidSchema,
});

export const isAdminInput = z.object({ email: z.string().email() });
export const addAdminInput = z.object({
  email: z.string().email(),
  name: z.string(),
  lastname: z.string().optional(),
});
export const removeAdminInput = z.object({ id: z.number() });

export const setPersonRoleInput = z.object({
  personId: uuidSchema,
  role: roleTypeEnum.nullable(),
});
export const getPersonRoleInput = z.object({ personId: uuidSchema });

const tenantHelperInsertSchema = createInsertSchema(tenantHelpers);
export const addHelperInput = tenantHelperInsertSchema.pick({
  tenantId: true,
  personId: true,
});
export const removeHelperInput = addHelperInput;
export const listHelpersInput = addHelperInput.pick({ tenantId: true });
export const listPersonHelperTenantsInput = addHelperInput.pick({
  personId: true,
});

const tenantUserInsertSchema = createInsertSchema(tenantUsers);
export const addTenantUserInput = tenantUserInsertSchema.pick({
  personId: true,
});
export const removeTenantUserInput = addTenantUserInput;
export const isTenantUserInput = addTenantUserInput;
export const countTenantUsersInput = z.object({ tenantId: uuidSchema });

const teamInsertSchema = createInsertSchema(tenantTeams);
export const createTeamInput = teamInsertSchema.pick({
  tenantId: true,
  name: true,
  description: true,
});
export const updateTeamInput = createTeamInput
  .partial()
  .extend({ tenantId: uuidSchema, teamId: z.number() });
export const deleteTeamInput = z.object({
  tenantId: uuidSchema,
  teamId: z.number(),
});
export const getTeamInput = deleteTeamInput;
export const listTeamsInput = z.object({ tenantId: uuidSchema });

const teamMemberInsertSchema = createInsertSchema(tenantTeamMembers);
export const addTeamMemberInput = teamMemberInsertSchema.pick({
  tenantId: true,
  teamId: true,
  userId: true,
  role: true,
});
export const updateTeamMemberInput = addTeamMemberInput
  .partial()
  .extend({ tenantId: uuidSchema, teamId: z.number(), userId: uuidSchema });
export const removeTeamMemberInput = addTeamMemberInput.pick({
  tenantId: true,
  teamId: true,
  userId: true,
});
export const listTeamMembersInput = removeTeamMemberInput.pick({
  tenantId: true,
  teamId: true,
});

const teamSkillInsertSchema = createInsertSchema(tenantTeamSkills);
export const createTeamSkillInput = teamSkillInsertSchema.pick({
  tenantId: true,
  teamId: true,
  name: true,
});
export const updateTeamSkillInput = createTeamSkillInput
  .pick({ tenantId: true, name: true })
  .extend({ skillId: z.number() });
export const deleteTeamSkillInput = z.object({
  tenantId: uuidSchema,
  skillId: z.number(),
});
export const listTeamSkillsInput = createTeamSkillInput.pick({
  tenantId: true,
  teamId: true,
});

const teamMemberSkillInsertSchema = createInsertSchema(tenantTeamMemberSkills);
export const assignMemberSkillInput = teamMemberSkillInsertSchema.pick({
  tenantId: true,
  teamMemberId: true,
  skillId: true,
});
export const removeMemberSkillInput = assignMemberSkillInput;
export const listMemberSkillsInput = assignMemberSkillInput.pick({
  tenantId: true,
  teamMemberId: true,
});

const skillIncompatibilityInsertSchema = createInsertSchema(
  tenantSkillIncompatibility,
);
export const addSkillIncompatibilityInput =
  skillIncompatibilityInsertSchema.pick({
    tenantId: true,
    skillId1: true,
    skillId2: true,
  });
export const removeSkillIncompatibilityInput = addSkillIncompatibilityInput;
export const listSkillIncompatibilityInput = addSkillIncompatibilityInput.pick({
  tenantId: true,
});

const eventTemplateInsertSchema = createInsertSchema(tenantEventTemplates, {
  name: z.string().min(1),
});
export const createEventTemplateInput = eventTemplateInsertSchema.pick({
  tenantId: true,
  name: true,
  description: true,
});
export const updateEventTemplateInput = createEventTemplateInput
  .partial()
  .extend({ tenantId: uuidSchema, templateId: z.number() });
export const deleteEventTemplateInput = z.object({
  tenantId: uuidSchema,
  templateId: z.number(),
});
export const getEventTemplateInput = deleteEventTemplateInput;
export const listEventTemplatesInput = z.object({ tenantId: uuidSchema });

const eventTemplateSlotInsertSchema = createInsertSchema(
  tenantEventTemplateSlots,
);
export const createEventTemplateSlotInput = eventTemplateSlotInsertSchema
  .pick({
    tenantId: true,
    templateId: true,
    teamId: true,
    skillId: true,
    quantity: true,
  })
  .extend({ quantity: z.number().min(1).default(1) });
export const updateEventTemplateSlotInput = z.object({
  tenantId: uuidSchema,
  slotId: z.number(),
  quantity: z.number().min(1).optional(),
});
export const deleteEventTemplateSlotInput = z.object({
  tenantId: uuidSchema,
  slotId: z.number(),
});
export const listEventTemplateSlotsInput = z.object({
  tenantId: uuidSchema,
  templateId: z.number(),
});

const eventInsertSchema = createInsertSchema(tenantEvents, {
  name: z.string().min(1),
});
export const createEventInput = eventInsertSchema
  .pick({ tenantId: true, templateId: true, name: true, date: true })
  .extend({ date: z.string().datetime() });
export const updateEventInput = z.object({
  tenantId: uuidSchema,
  eventId: z.number(),
  name: z.string().min(1).optional(),
  date: z.string().datetime().optional(),
  status: eventStatusEnum.optional(),
});
export const deleteEventInput = z.object({
  tenantId: uuidSchema,
  eventId: z.number(),
});
export const getEventInput = deleteEventInput;
export const listEventsInput = z.object({ tenantId: uuidSchema });

const eventSlotInsertSchema = createInsertSchema(tenantEventSlots);
export const createEventSlotInput = eventSlotInsertSchema
  .pick({
    tenantId: true,
    eventId: true,
    teamId: true,
    skillId: true,
    quantity: true,
  })
  .extend({ quantity: z.number().min(1).default(1) });
export const updateEventSlotInput = z.object({
  tenantId: uuidSchema,
  slotId: z.number(),
  quantity: z.number().min(1).optional(),
});
export const deleteEventSlotInput = z.object({
  tenantId: uuidSchema,
  slotId: z.number(),
});
export const listEventSlotsInput = z.object({
  tenantId: uuidSchema,
  eventId: z.number(),
});

const eventAssignmentInsertSchema = createInsertSchema(tenantEventAssignments);
export const createEventAssignmentInput = eventAssignmentInsertSchema.pick({
  tenantId: true,
  eventId: true,
  slotId: true,
  userId: true,
});
export const deleteEventAssignmentInput = z.object({
  tenantId: uuidSchema,
  assignmentId: z.number(),
});
export const listEventAssignmentsInput = z.object({
  tenantId: uuidSchema,
  eventId: z.number(),
});
