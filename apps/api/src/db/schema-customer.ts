import { text, timestamp, integer, index, unique, uniqueIndex, pgSchema, varchar, bigserial, bigint, boolean, jsonb, check, decimal } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { tenantPlans, emails, keys } from "./schema-platform";

// Customer schema - operational data
export const customerSchema = pgSchema("customer");

// Tenants - customer organizations (churches)
export const tenants = customerSchema.table("tenants", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  planId: integer("plan_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// People - individuals belonging to a tenant
// Contains fixed system fields (email, role)
export const people = customerSchema.table("people", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  emailId: bigint("email_id", { mode: "number" }).notNull().references(() => emails.id).unique(),
  role: varchar("role", { length: 20 }), // null = member, 'owner' or 'admin'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("people_tenant_id_idx").on(table.tenantId),
  index("people_email_id_idx").on(table.emailId),
  // Check constraint: role must be 'owner', 'admin', or null
  check("people_role_check", sql`${table.role} IS NULL OR ${table.role} IN ('owner', 'admin')`),
  // Partial unique index: only 1 owner per tenant
  uniqueIndex("people_tenant_owner_unique").on(table.tenantId).where(sql`${table.role} = 'owner'`),
]);

// Tenant People Fields - custom field definitions per tenant
export const tenantPeopleFields = customerSchema.table("tenant_people_fields", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull(), // text, date, number, phone, select
  isRequired: boolean("is_required").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  options: jsonb("options"), // for select type: ["option1", "option2"]
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("tenant_people_fields_tenant_name_unique").on(table.tenantId, table.name),
  index("tenant_people_fields_tenant_id_idx").on(table.tenantId),
]);

// Tenant People Field Values - custom field values per person
export const tenantPeopleFieldValues = customerSchema.table("tenant_people_field_values", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
  fieldId: bigint("field_id", { mode: "number" }).notNull().references(() => tenantPeopleFields.id, { onDelete: "cascade" }),
  value: text("value"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("tenant_people_field_values_person_field_unique").on(table.personId, table.fieldId),
  index("tenant_people_field_values_person_id_idx").on(table.personId),
  index("tenant_people_field_values_field_id_idx").on(table.fieldId),
]);

// Tenant Helpers - poly relationship: person can help in N tenants (not their primary)
export const tenantHelpers = customerSchema.table(
  "tenant_helpers",
  {
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    personId: bigint("person_id", { mode: "number" }).notNull().references(() => people.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tenant_helpers_pk").on(table.tenantId, table.personId),
    index("tenant_helpers_tenant_id_idx").on(table.tenantId),
    index("tenant_helpers_person_id_idx").on(table.personId),
  ]
);

// Tenant Users - people who can login to the system (counts towards plan seats)
export const tenantUsers = customerSchema.table("tenant_users", {
  personId: bigint("person_id", { mode: "number" }).primaryKey().references(() => people.id, { onDelete: "cascade" }),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
}, (table) => [
  index("tenant_users_person_id_idx").on(table.personId),
]);

// Tenant Members - people who are official members of the church (independent of user status)
// A person can be a member without being a user (Manola case)
// A person can be a user without being a member (Juan case)
export const tenantMembers = customerSchema.table("tenant_members", {
  personId: bigint("person_id", { mode: "number" }).primaryKey().references(() => people.id, { onDelete: "cascade" }),
  memberSince: timestamp("member_since").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("tenant_members_person_id_idx").on(table.personId),
]);

// Tenant Teams
export const tenantTeams = customerSchema.table(
  "tenant_teams",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_teams_tenant_id_idx").on(table.tenantId),
  ]
);

// Tenant Team Members
// IMPORTANT: Team members MUST be active users (tenant_users)
// userId is the personId from tenant_users - only active users can be in teams
export const tenantTeamMembers = customerSchema.table(
  "tenant_team_members",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => tenantTeams.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => tenantUsers.personId, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    role: text("role"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tenant_team_user_unique").on(table.teamId, table.userId),
    index("tenant_team_members_team_id_idx").on(table.teamId),
    index("tenant_team_members_user_id_idx").on(table.userId),
    index("tenant_team_members_tenant_id_idx").on(table.tenantId),
  ]
);

// Tenant Team Skills
export const tenantTeamSkills = customerSchema.table(
  "tenant_team_skills",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => tenantTeams.id, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    proficiency: integer("proficiency"), // minimum proficiency level required
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_team_skills_team_id_idx").on(table.teamId),
    index("tenant_team_skills_tenant_id_idx").on(table.tenantId),
  ]
);

// Tenant Team Member Skills
export const tenantTeamMemberSkills = customerSchema.table(
  "tenant_team_member_skills",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    teamMemberId: bigint("team_member_id", { mode: "number" }).notNull().references(() => tenantTeamMembers.id, { onDelete: "cascade" }),
    skillId: bigint("skill_id", { mode: "number" }).notNull().references(() => tenantTeamSkills.id, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    proficiencyLevel: integer("proficiency_level"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tenant_team_member_skill_unique").on(table.teamMemberId, table.skillId),
    index("tenant_team_member_skills_team_member_id_idx").on(table.teamMemberId),
    index("tenant_team_member_skills_skill_id_idx").on(table.skillId),
    index("tenant_team_member_skills_tenant_id_idx").on(table.tenantId),
  ]
);

// Skill Incompatibility - pairs of skills that CANNOT be used simultaneously by the same person in an event
// This is a blacklist: if a pair exists here, those skills are incompatible
// By default, all skill combinations are allowed unless explicitly listed here
export const tenantSkillIncompatibility = customerSchema.table(
  "tenant_skill_incompatibility",
  {
    skillId1: bigint("skill_id_1", { mode: "number" }).notNull().references(() => tenantTeamSkills.id, { onDelete: "cascade" }),
    skillId2: bigint("skill_id_2", { mode: "number" }).notNull().references(() => tenantTeamSkills.id, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("tenant_skill_incompatibility_pk").on(table.skillId1, table.skillId2, table.tenantId),
    index("tenant_skill_incompatibility_tenant_id_idx").on(table.tenantId),
    index("tenant_skill_incompatibility_skill1_idx").on(table.skillId1),
    index("tenant_skill_incompatibility_skill2_idx").on(table.skillId2),
  ]
);

// Event Templates - reusable event configurations
export const tenantEventTemplates = customerSchema.table(
  "tenant_event_templates",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_event_templates_tenant_id_idx").on(table.tenantId),
  ]
);

// Event Template Slots - slots defined in a template
export const tenantEventTemplateSlots = customerSchema.table(
  "tenant_event_template_slots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    templateId: bigint("template_id", { mode: "number" }).notNull().references(() => tenantEventTemplates.id, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => tenantTeams.id, { onDelete: "cascade" }),
    skillId: bigint("skill_id", { mode: "number" }).notNull().references(() => tenantTeamSkills.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_event_template_slots_template_id_idx").on(table.templateId),
    index("tenant_event_template_slots_tenant_id_idx").on(table.tenantId),
  ]
);

// Events - actual event instances
export const tenantEvents = customerSchema.table(
  "tenant_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    templateId: bigint("template_id", { mode: "number" }).references(() => tenantEventTemplates.id, { onDelete: "set null" }), // nullable, reference to original template
    name: text("name").notNull(),
    date: timestamp("date").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"), // draft, published, completed, cancelled
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_events_tenant_id_idx").on(table.tenantId),
    index("tenant_events_template_id_idx").on(table.templateId),
    index("tenant_events_date_idx").on(table.date),
  ]
);

// Event Slots - copied from template slots when event is created (snapshot)
export const tenantEventSlots = customerSchema.table(
  "tenant_event_slots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: bigint("event_id", { mode: "number" }).notNull().references(() => tenantEvents.id, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    teamId: bigint("team_id", { mode: "number" }).notNull().references(() => tenantTeams.id, { onDelete: "cascade" }),
    skillId: bigint("skill_id", { mode: "number" }).notNull().references(() => tenantTeamSkills.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_event_slots_event_id_idx").on(table.eventId),
    index("tenant_event_slots_tenant_id_idx").on(table.tenantId),
  ]
);

// Event Assignments - user assigned to a slot
// Only active users can be assigned to events
export const tenantEventAssignments = customerSchema.table(
  "tenant_event_assignments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    eventId: bigint("event_id", { mode: "number" }).notNull().references(() => tenantEvents.id, { onDelete: "cascade" }),
    slotId: bigint("slot_id", { mode: "number" }).notNull().references(() => tenantEventSlots.id, { onDelete: "cascade" }),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: bigint("user_id", { mode: "number" }).notNull().references(() => tenantUsers.personId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tenant_event_assignments_event_id_idx").on(table.eventId),
    index("tenant_event_assignments_slot_id_idx").on(table.slotId),
    index("tenant_event_assignments_tenant_id_idx").on(table.tenantId),
    index("tenant_event_assignments_user_id_idx").on(table.userId),
  ]
);

// Songs - song library for worship teams
export const songs = customerSchema.table(
  "songs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: bigint("tenant_id", { mode: "number" }).notNull().references(() => tenants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 40 }).notNull(),
    artist: varchar("artist", { length: 40 }).notNull(),
    album: varchar("album", { length: 40 }).notNull(),
    releaseYear: integer("release_year").notNull(),
    bpm: decimal("bpm", { precision: 5, scale: 2 }).notNull(),
    duration: integer("duration").notNull(), // seconds
    chordsAndLyrics: text("chords_and_lyrics").notNull(),
    timeSigNum: integer("time_sig_num").notNull(),
    timeSigDen: integer("time_sig_den").notNull(),
    isMaleLead: boolean("is_male_lead").notNull(),
    originalKeyId: integer("original_key_id").notNull().references(() => keys.id),
    recommendedMaleOffset: integer("recommended_male_offset").notNull(),
    recommendedFemaleOffset: integer("recommended_female_offset").notNull(),
    spotifyUrl: varchar("spotify_url", { length: 200 }),
    appleMusicUrl: varchar("apple_music_url", { length: 200 }),
    youtubeUrl: varchar("youtube_url", { length: 200 }),
    inclusionDate: timestamp("inclusion_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("songs_tenant_id_idx").on(table.tenantId),
    index("songs_original_key_id_idx").on(table.originalKeyId),
    check("songs_release_year_check", sql`${table.releaseYear} >= 1000 AND ${table.releaseYear} <= 3000`),
    check("songs_bpm_check", sql`${table.bpm} >= 40 AND ${table.bpm} <= 300`),
    check("songs_duration_check", sql`${table.duration} >= 60 AND ${table.duration} <= 900`),
    check("songs_chords_and_lyrics_not_empty", sql`length(${table.chordsAndLyrics}) > 0 AND length(${table.chordsAndLyrics}) <= 4000`),
    check("songs_time_sig_num_check", sql`${table.timeSigNum} >= 1 AND ${table.timeSigNum} <= 32`),
    check("songs_time_sig_den_check", sql`${table.timeSigDen} IN (1, 2, 4, 8, 16, 32)`),
    check("songs_recommended_male_offset_check", sql`${table.recommendedMaleOffset} >= -11 AND ${table.recommendedMaleOffset} <= 11`),
    check("songs_recommended_female_offset_check", sql`${table.recommendedFemaleOffset} >= -11 AND ${table.recommendedFemaleOffset} <= 11`),
  ]
);

// Relations

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  plan: one(tenantPlans, {
    fields: [tenants.planId],
    references: [tenantPlans.id],
  }),
  tenantPeopleFields: many(tenantPeopleFields),
  people: many(people),
  tenantHelpers: many(tenantHelpers),
  tenantTeams: many(tenantTeams),
  tenantTeamMembers: many(tenantTeamMembers),
  tenantEventTemplates: many(tenantEventTemplates),
  tenantEvents: many(tenantEvents),
  songs: many(songs),
}));

export const tenantPeopleFieldsRelations = relations(tenantPeopleFields, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantPeopleFields.tenantId],
    references: [tenants.id],
  }),
  values: many(tenantPeopleFieldValues),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [people.tenantId],
    references: [tenants.id],
  }),
  email: one(emails, {
    fields: [people.emailId],
    references: [emails.id],
  }),
  fieldValues: many(tenantPeopleFieldValues),
  tenantUser: one(tenantUsers, {
    fields: [people.id],
    references: [tenantUsers.personId],
  }),
  tenantMember: one(tenantMembers, {
    fields: [people.id],
    references: [tenantMembers.personId],
  }),
  helperTenants: many(tenantHelpers),
}));

export const tenantPeopleFieldValuesRelations = relations(tenantPeopleFieldValues, ({ one }) => ({
  person: one(people, {
    fields: [tenantPeopleFieldValues.personId],
    references: [people.id],
  }),
  field: one(tenantPeopleFields, {
    fields: [tenantPeopleFieldValues.fieldId],
    references: [tenantPeopleFields.id],
  }),
}));

export const tenantHelpersRelations = relations(tenantHelpers, ({ one }) => ({
  person: one(people, {
    fields: [tenantHelpers.personId],
    references: [people.id],
  }),
  tenant: one(tenants, {
    fields: [tenantHelpers.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one, many }) => ({
  person: one(people, {
    fields: [tenantUsers.personId],
    references: [people.id],
  }),
  tenantTeamMembers: many(tenantTeamMembers),
}));

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  person: one(people, {
    fields: [tenantMembers.personId],
    references: [people.id],
  }),
}));

export const tenantTeamsRelations = relations(tenantTeams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantTeams.tenantId],
    references: [tenants.id],
  }),
  tenantTeamMembers: many(tenantTeamMembers),
  tenantTeamSkills: many(tenantTeamSkills),
}));

export const tenantTeamMembersRelations = relations(tenantTeamMembers, ({ one, many }) => ({
  tenantTeam: one(tenantTeams, {
    fields: [tenantTeamMembers.teamId],
    references: [tenantTeams.id],
  }),
  user: one(tenantUsers, {
    fields: [tenantTeamMembers.userId],
    references: [tenantUsers.personId],
  }),
  tenant: one(tenants, {
    fields: [tenantTeamMembers.tenantId],
    references: [tenants.id],
  }),
  tenantTeamMemberSkills: many(tenantTeamMemberSkills),
}));

export const tenantTeamSkillsRelations = relations(tenantTeamSkills, ({ one, many }) => ({
  tenantTeam: one(tenantTeams, {
    fields: [tenantTeamSkills.teamId],
    references: [tenantTeams.id],
  }),
  tenant: one(tenants, {
    fields: [tenantTeamSkills.tenantId],
    references: [tenants.id],
  }),
  tenantTeamMemberSkills: many(tenantTeamMemberSkills),
  incompatibilityAsSkill1: many(tenantSkillIncompatibility, { relationName: "skill1" }),
  incompatibilityAsSkill2: many(tenantSkillIncompatibility, { relationName: "skill2" }),
}));

export const tenantTeamMemberSkillsRelations = relations(tenantTeamMemberSkills, ({ one }) => ({
  tenantTeamMember: one(tenantTeamMembers, {
    fields: [tenantTeamMemberSkills.teamMemberId],
    references: [tenantTeamMembers.id],
  }),
  tenantTeamSkill: one(tenantTeamSkills, {
    fields: [tenantTeamMemberSkills.skillId],
    references: [tenantTeamSkills.id],
  }),
  tenant: one(tenants, {
    fields: [tenantTeamMemberSkills.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantSkillIncompatibilityRelations = relations(tenantSkillIncompatibility, ({ one }) => ({
  skill1: one(tenantTeamSkills, {
    fields: [tenantSkillIncompatibility.skillId1],
    references: [tenantTeamSkills.id],
    relationName: "skill1",
  }),
  skill2: one(tenantTeamSkills, {
    fields: [tenantSkillIncompatibility.skillId2],
    references: [tenantTeamSkills.id],
    relationName: "skill2",
  }),
  tenant: one(tenants, {
    fields: [tenantSkillIncompatibility.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantEventTemplatesRelations = relations(tenantEventTemplates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantEventTemplates.tenantId],
    references: [tenants.id],
  }),
  slots: many(tenantEventTemplateSlots),
  events: many(tenantEvents),
}));

export const tenantEventTemplateSlotsRelations = relations(tenantEventTemplateSlots, ({ one }) => ({
  template: one(tenantEventTemplates, {
    fields: [tenantEventTemplateSlots.templateId],
    references: [tenantEventTemplates.id],
  }),
  tenant: one(tenants, {
    fields: [tenantEventTemplateSlots.tenantId],
    references: [tenants.id],
  }),
  team: one(tenantTeams, {
    fields: [tenantEventTemplateSlots.teamId],
    references: [tenantTeams.id],
  }),
  skill: one(tenantTeamSkills, {
    fields: [tenantEventTemplateSlots.skillId],
    references: [tenantTeamSkills.id],
  }),
}));

export const tenantEventsRelations = relations(tenantEvents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantEvents.tenantId],
    references: [tenants.id],
  }),
  template: one(tenantEventTemplates, {
    fields: [tenantEvents.templateId],
    references: [tenantEventTemplates.id],
  }),
  slots: many(tenantEventSlots),
  assignments: many(tenantEventAssignments),
}));

export const tenantEventSlotsRelations = relations(tenantEventSlots, ({ one, many }) => ({
  event: one(tenantEvents, {
    fields: [tenantEventSlots.eventId],
    references: [tenantEvents.id],
  }),
  tenant: one(tenants, {
    fields: [tenantEventSlots.tenantId],
    references: [tenants.id],
  }),
  team: one(tenantTeams, {
    fields: [tenantEventSlots.teamId],
    references: [tenantTeams.id],
  }),
  skill: one(tenantTeamSkills, {
    fields: [tenantEventSlots.skillId],
    references: [tenantTeamSkills.id],
  }),
  assignments: many(tenantEventAssignments),
}));

export const tenantEventAssignmentsRelations = relations(tenantEventAssignments, ({ one }) => ({
  event: one(tenantEvents, {
    fields: [tenantEventAssignments.eventId],
    references: [tenantEvents.id],
  }),
  slot: one(tenantEventSlots, {
    fields: [tenantEventAssignments.slotId],
    references: [tenantEventSlots.id],
  }),
  tenant: one(tenants, {
    fields: [tenantEventAssignments.tenantId],
    references: [tenants.id],
  }),
  user: one(tenantUsers, {
    fields: [tenantEventAssignments.userId],
    references: [tenantUsers.personId],
  }),
}));

export const songsRelations = relations(songs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [songs.tenantId],
    references: [tenants.id],
  }),
  originalKey: one(keys, {
    fields: [songs.originalKeyId],
    references: [keys.id],
  }),
}));

// Types

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type TenantPeopleField = typeof tenantPeopleFields.$inferSelect;
export type NewTenantPeopleField = typeof tenantPeopleFields.$inferInsert;

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;

export type TenantPeopleFieldValue = typeof tenantPeopleFieldValues.$inferSelect;
export type NewTenantPeopleFieldValue = typeof tenantPeopleFieldValues.$inferInsert;

export type TenantHelper = typeof tenantHelpers.$inferSelect;
export type NewTenantHelper = typeof tenantHelpers.$inferInsert;

export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;

export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;

export type TenantTeam = typeof tenantTeams.$inferSelect;
export type NewTenantTeam = typeof tenantTeams.$inferInsert;

export type TenantTeamMember = typeof tenantTeamMembers.$inferSelect;
export type NewTenantTeamMember = typeof tenantTeamMembers.$inferInsert;

export type TenantTeamSkill = typeof tenantTeamSkills.$inferSelect;
export type NewTenantTeamSkill = typeof tenantTeamSkills.$inferInsert;

export type TenantTeamMemberSkill = typeof tenantTeamMemberSkills.$inferSelect;
export type NewTenantTeamMemberSkill = typeof tenantTeamMemberSkills.$inferInsert;

export type TenantSkillIncompatibility = typeof tenantSkillIncompatibility.$inferSelect;
export type NewTenantSkillIncompatibility = typeof tenantSkillIncompatibility.$inferInsert;

export type TenantEventTemplate = typeof tenantEventTemplates.$inferSelect;
export type NewTenantEventTemplate = typeof tenantEventTemplates.$inferInsert;

export type TenantEventTemplateSlot = typeof tenantEventTemplateSlots.$inferSelect;
export type NewTenantEventTemplateSlot = typeof tenantEventTemplateSlots.$inferInsert;

export type TenantEvent = typeof tenantEvents.$inferSelect;
export type NewTenantEvent = typeof tenantEvents.$inferInsert;

export type TenantEventSlot = typeof tenantEventSlots.$inferSelect;
export type NewTenantEventSlot = typeof tenantEventSlots.$inferInsert;

export type TenantEventAssignment = typeof tenantEventAssignments.$inferSelect;
export type NewTenantEventAssignment = typeof tenantEventAssignments.$inferInsert;

export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
