CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "customer";
--> statement-breakpoint
CREATE TABLE "platform"."admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" bigserial NOT NULL,
	"name" varchar(255) NOT NULL,
	"lastname_1" varchar(255),
	"lastname_2" varchar(255),
	"phone" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "platform"."emails" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "emails_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform"."tenant_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"max_seats" integer DEFAULT 10 NOT NULL,
	"max_people" integer DEFAULT -1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."people" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" bigint NOT NULL,
	"email_id" bigint NOT NULL,
	"role" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "people_email_id_unique" UNIQUE("email_id"),
	CONSTRAINT "people_role_check" CHECK ("customer"."people"."role" IS NULL OR "customer"."people"."role" IN ('owner', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_event_assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" bigint NOT NULL,
	"slot_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_event_slots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"skill_id" bigint NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_event_template_slots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"template_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"team_id" bigint NOT NULL,
	"skill_id" bigint NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_event_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" bigint NOT NULL,
	"template_id" bigint,
	"name" text NOT NULL,
	"date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_helpers" (
	"tenant_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_helpers_pk" UNIQUE("tenant_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_people_field_values" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"person_id" bigint NOT NULL,
	"field_id" bigint NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_people_field_values_person_field_unique" UNIQUE("person_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_people_fields" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"field_type" varchar(50) NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"options" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_people_fields_tenant_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_skill_concurrency" (
	"skill_id_1" bigint NOT NULL,
	"skill_id_2" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_skill_concurrency_pk" UNIQUE("skill_id_1","skill_id_2","tenant_id")
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_team_member_skills" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_member_id" bigint NOT NULL,
	"skill_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"proficiency_level" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_team_member_skill_unique" UNIQUE("team_member_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_team_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"person_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_team_person_unique" UNIQUE("team_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_team_skills" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"team_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"name" text NOT NULL,
	"proficiency" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_teams" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" bigint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_users" (
	"person_id" bigint PRIMARY KEY NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer"."tenants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"plan_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "platform"."admins" ADD CONSTRAINT "admins_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "platform"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."people" ADD CONSTRAINT "people_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."people" ADD CONSTRAINT "people_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "platform"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_event_id_tenant_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "customer"."tenant_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_slot_id_tenant_event_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "customer"."tenant_event_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_slots" ADD CONSTRAINT "tenant_event_slots_event_id_tenant_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "customer"."tenant_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_slots" ADD CONSTRAINT "tenant_event_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_slots" ADD CONSTRAINT "tenant_event_slots_team_id_tenant_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "customer"."tenant_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_slots" ADD CONSTRAINT "tenant_event_slots_skill_id_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_template_slots" ADD CONSTRAINT "tenant_event_template_slots_template_id_tenant_event_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "customer"."tenant_event_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_template_slots" ADD CONSTRAINT "tenant_event_template_slots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_template_slots" ADD CONSTRAINT "tenant_event_template_slots_team_id_tenant_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "customer"."tenant_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_template_slots" ADD CONSTRAINT "tenant_event_template_slots_skill_id_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_templates" ADD CONSTRAINT "tenant_event_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_events" ADD CONSTRAINT "tenant_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_events" ADD CONSTRAINT "tenant_events_template_id_tenant_event_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "customer"."tenant_event_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_helpers" ADD CONSTRAINT "tenant_helpers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_helpers" ADD CONSTRAINT "tenant_helpers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_people_field_values" ADD CONSTRAINT "tenant_people_field_values_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_people_field_values" ADD CONSTRAINT "tenant_people_field_values_field_id_tenant_people_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "customer"."tenant_people_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_people_fields" ADD CONSTRAINT "tenant_people_fields_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_skill_concurrency" ADD CONSTRAINT "tenant_skill_concurrency_skill_id_1_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id_1") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_skill_concurrency" ADD CONSTRAINT "tenant_skill_concurrency_skill_id_2_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id_2") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_skill_concurrency" ADD CONSTRAINT "tenant_skill_concurrency_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_member_skills" ADD CONSTRAINT "tenant_team_member_skills_team_member_id_tenant_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "customer"."tenant_team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_member_skills" ADD CONSTRAINT "tenant_team_member_skills_skill_id_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_member_skills" ADD CONSTRAINT "tenant_team_member_skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_members" ADD CONSTRAINT "tenant_team_members_team_id_tenant_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "customer"."tenant_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_members" ADD CONSTRAINT "tenant_team_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_members" ADD CONSTRAINT "tenant_team_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_skills" ADD CONSTRAINT "tenant_team_skills_team_id_tenant_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "customer"."tenant_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_skills" ADD CONSTRAINT "tenant_team_skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_teams" ADD CONSTRAINT "tenant_teams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_users" ADD CONSTRAINT "tenant_users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_tenant_id_idx" ON "customer"."people" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_email_id_idx" ON "customer"."people" USING btree ("email_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_tenant_owner_unique" ON "customer"."people" USING btree ("tenant_id") WHERE "customer"."people"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_event_id_idx" ON "customer"."tenant_event_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_slot_id_idx" ON "customer"."tenant_event_assignments" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_tenant_id_idx" ON "customer"."tenant_event_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_person_id_idx" ON "customer"."tenant_event_assignments" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tenant_event_slots_event_id_idx" ON "customer"."tenant_event_slots" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tenant_event_slots_tenant_id_idx" ON "customer"."tenant_event_slots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_event_template_slots_template_id_idx" ON "customer"."tenant_event_template_slots" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "tenant_event_template_slots_tenant_id_idx" ON "customer"."tenant_event_template_slots" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_event_templates_tenant_id_idx" ON "customer"."tenant_event_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_events_tenant_id_idx" ON "customer"."tenant_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_events_template_id_idx" ON "customer"."tenant_events" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "tenant_events_date_idx" ON "customer"."tenant_events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "tenant_helpers_tenant_id_idx" ON "customer"."tenant_helpers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_helpers_person_id_idx" ON "customer"."tenant_helpers" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tenant_people_field_values_person_id_idx" ON "customer"."tenant_people_field_values" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tenant_people_field_values_field_id_idx" ON "customer"."tenant_people_field_values" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "tenant_people_fields_tenant_id_idx" ON "customer"."tenant_people_fields" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_skill_concurrency_tenant_id_idx" ON "customer"."tenant_skill_concurrency" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_skill_concurrency_skill1_idx" ON "customer"."tenant_skill_concurrency" USING btree ("skill_id_1");--> statement-breakpoint
CREATE INDEX "tenant_skill_concurrency_skill2_idx" ON "customer"."tenant_skill_concurrency" USING btree ("skill_id_2");--> statement-breakpoint
CREATE INDEX "tenant_team_member_skills_team_member_id_idx" ON "customer"."tenant_team_member_skills" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "tenant_team_member_skills_skill_id_idx" ON "customer"."tenant_team_member_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "tenant_team_member_skills_tenant_id_idx" ON "customer"."tenant_team_member_skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_team_members_team_id_idx" ON "customer"."tenant_team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tenant_team_members_person_id_idx" ON "customer"."tenant_team_members" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tenant_team_members_tenant_id_idx" ON "customer"."tenant_team_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_team_skills_team_id_idx" ON "customer"."tenant_team_skills" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tenant_team_skills_tenant_id_idx" ON "customer"."tenant_team_skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_teams_tenant_id_idx" ON "customer"."tenant_teams" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_users_person_id_idx" ON "customer"."tenant_users" USING btree ("person_id");