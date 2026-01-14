CREATE SCHEMA "platform";
--> statement-breakpoint
CREATE SCHEMA "customer";
--> statement-breakpoint
CREATE TABLE "platform"."admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" bigserial NOT NULL,
	"name" varchar(255) NOT NULL,
	"lastname" varchar(255),
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
CREATE TABLE "platform"."keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(10) NOT NULL,
	"is_minor" boolean NOT NULL,
	"transposition_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "keys_name_is_minor_transposition_index_unique" UNIQUE("name","is_minor","transposition_index")
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
CREATE TABLE "customer"."songs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"tenant_id" bigint NOT NULL,
	"title" varchar(40) NOT NULL,
	"artist" varchar(40) NOT NULL,
	"album" varchar(40) NOT NULL,
	"release_year" integer NOT NULL,
	"bpm" numeric(5, 2) NOT NULL,
	"duration" integer NOT NULL,
	"chords_and_lyrics" text NOT NULL,
	"time_sig_num" integer NOT NULL,
	"time_sig_den" integer NOT NULL,
	"is_male_lead" boolean NOT NULL,
	"original_key_id" integer NOT NULL,
	"recommended_male_offset" integer NOT NULL,
	"recommended_female_offset" integer NOT NULL,
	"spotify_url" varchar(200),
	"apple_music_url" varchar(200),
	"youtube_url" varchar(200),
	"inclusion_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "songs_release_year_check" CHECK ("customer"."songs"."release_year" >= 1000 AND "customer"."songs"."release_year" <= 3000),
	CONSTRAINT "songs_bpm_check" CHECK ("customer"."songs"."bpm" >= 40 AND "customer"."songs"."bpm" <= 300),
	CONSTRAINT "songs_duration_check" CHECK ("customer"."songs"."duration" >= 60 AND "customer"."songs"."duration" <= 900),
	CONSTRAINT "songs_chords_and_lyrics_not_empty" CHECK (length("customer"."songs"."chords_and_lyrics") > 0 AND length("customer"."songs"."chords_and_lyrics") <= 4000),
	CONSTRAINT "songs_time_sig_num_check" CHECK ("customer"."songs"."time_sig_num" >= 1 AND "customer"."songs"."time_sig_num" <= 32),
	CONSTRAINT "songs_time_sig_den_check" CHECK ("customer"."songs"."time_sig_den" IN (1, 2, 4, 8, 16, 32)),
	CONSTRAINT "songs_recommended_male_offset_check" CHECK ("customer"."songs"."recommended_male_offset" >= -11 AND "customer"."songs"."recommended_male_offset" <= 11),
	CONSTRAINT "songs_recommended_female_offset_check" CHECK ("customer"."songs"."recommended_female_offset" >= -11 AND "customer"."songs"."recommended_female_offset" <= 11)
);
--> statement-breakpoint
CREATE TABLE "customer"."tenant_event_assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" bigint NOT NULL,
	"slot_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
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
CREATE TABLE "customer"."tenant_members" (
	"person_id" bigint PRIMARY KEY NOT NULL,
	"member_since" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "customer"."tenant_skill_incompatibility" (
	"skill_id_1" bigint NOT NULL,
	"skill_id_2" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_skill_incompatibility_pk" UNIQUE("skill_id_1","skill_id_2","tenant_id")
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
	"user_id" bigint NOT NULL,
	"tenant_id" bigint NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_team_user_unique" UNIQUE("team_id","user_id")
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
ALTER TABLE "customer"."songs" ADD CONSTRAINT "songs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."songs" ADD CONSTRAINT "songs_original_key_id_keys_id_fk" FOREIGN KEY ("original_key_id") REFERENCES "platform"."keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_event_id_tenant_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "customer"."tenant_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_slot_id_tenant_event_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "customer"."tenant_event_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_event_assignments" ADD CONSTRAINT "tenant_event_assignments_user_id_tenant_users_person_id_fk" FOREIGN KEY ("user_id") REFERENCES "customer"."tenant_users"("person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "customer"."tenant_members" ADD CONSTRAINT "tenant_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_people_field_values" ADD CONSTRAINT "tenant_people_field_values_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_people_field_values" ADD CONSTRAINT "tenant_people_field_values_field_id_tenant_people_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "customer"."tenant_people_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_people_fields" ADD CONSTRAINT "tenant_people_fields_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_skill_incompatibility" ADD CONSTRAINT "tenant_skill_incompatibility_skill_id_1_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id_1") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_skill_incompatibility" ADD CONSTRAINT "tenant_skill_incompatibility_skill_id_2_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id_2") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_skill_incompatibility" ADD CONSTRAINT "tenant_skill_incompatibility_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_member_skills" ADD CONSTRAINT "tenant_team_member_skills_team_member_id_tenant_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "customer"."tenant_team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_member_skills" ADD CONSTRAINT "tenant_team_member_skills_skill_id_tenant_team_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "customer"."tenant_team_skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_member_skills" ADD CONSTRAINT "tenant_team_member_skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_members" ADD CONSTRAINT "tenant_team_members_team_id_tenant_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "customer"."tenant_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_members" ADD CONSTRAINT "tenant_team_members_user_id_tenant_users_person_id_fk" FOREIGN KEY ("user_id") REFERENCES "customer"."tenant_users"("person_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_members" ADD CONSTRAINT "tenant_team_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_skills" ADD CONSTRAINT "tenant_team_skills_team_id_tenant_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "customer"."tenant_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_team_skills" ADD CONSTRAINT "tenant_team_skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_teams" ADD CONSTRAINT "tenant_teams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "customer"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer"."tenant_users" ADD CONSTRAINT "tenant_users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "customer"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "people_tenant_id_idx" ON "customer"."people" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "people_email_id_idx" ON "customer"."people" USING btree ("email_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_tenant_owner_unique" ON "customer"."people" USING btree ("tenant_id") WHERE "customer"."people"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "songs_tenant_id_idx" ON "customer"."songs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "songs_original_key_id_idx" ON "customer"."songs" USING btree ("original_key_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_event_id_idx" ON "customer"."tenant_event_assignments" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_slot_id_idx" ON "customer"."tenant_event_assignments" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_tenant_id_idx" ON "customer"."tenant_event_assignments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_event_assignments_user_id_idx" ON "customer"."tenant_event_assignments" USING btree ("user_id");--> statement-breakpoint
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
CREATE INDEX "tenant_members_person_id_idx" ON "customer"."tenant_members" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tenant_people_field_values_person_id_idx" ON "customer"."tenant_people_field_values" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tenant_people_field_values_field_id_idx" ON "customer"."tenant_people_field_values" USING btree ("field_id");--> statement-breakpoint
CREATE INDEX "tenant_people_fields_tenant_id_idx" ON "customer"."tenant_people_fields" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_skill_incompatibility_tenant_id_idx" ON "customer"."tenant_skill_incompatibility" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_skill_incompatibility_skill1_idx" ON "customer"."tenant_skill_incompatibility" USING btree ("skill_id_1");--> statement-breakpoint
CREATE INDEX "tenant_skill_incompatibility_skill2_idx" ON "customer"."tenant_skill_incompatibility" USING btree ("skill_id_2");--> statement-breakpoint
CREATE INDEX "tenant_team_member_skills_team_member_id_idx" ON "customer"."tenant_team_member_skills" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "tenant_team_member_skills_skill_id_idx" ON "customer"."tenant_team_member_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "tenant_team_member_skills_tenant_id_idx" ON "customer"."tenant_team_member_skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_team_members_team_id_idx" ON "customer"."tenant_team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tenant_team_members_user_id_idx" ON "customer"."tenant_team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tenant_team_members_tenant_id_idx" ON "customer"."tenant_team_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_team_skills_team_id_idx" ON "customer"."tenant_team_skills" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tenant_team_skills_tenant_id_idx" ON "customer"."tenant_team_skills" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_teams_tenant_id_idx" ON "customer"."tenant_teams" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_users_person_id_idx" ON "customer"."tenant_users" USING btree ("person_id");