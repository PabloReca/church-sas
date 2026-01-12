import { text, timestamp, integer, serial, numeric, pgSchema, varchar, bigserial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Platform schema - global SaaS configuration
export const platformSchema = pgSchema("platform");

// Emails - centralized email registry for uniqueness across people and admins
export const emails = platformSchema.table("emails", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tenant Plans - available subscription plans
export const tenantPlans = platformSchema.table("tenant_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),

  // maxSeats: Active SaaS users who can login (counted in active_users table)
  maxSeats: integer("max_seats").notNull().default(10),

  // maxPeople: Total people records allowed (members, kids, etc.)
  // -1 = unlimited
  maxPeople: integer("max_people").notNull().default(-1),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admins - global SaaS administrators (company employees, separate from customers)
export const admins = platformSchema.table("admins", {
  id: serial("id").primaryKey(),
  emailId: bigserial("email_id", { mode: "number" }).notNull().references(() => emails.id).unique(),
  name: varchar("name", { length: 255 }).notNull(),
  lastname1: varchar("lastname_1", { length: 255 }),
  lastname2: varchar("lastname_2", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations

export const emailsRelations = relations(emails, ({ one }) => ({
  admin: one(admins, {
    fields: [emails.id],
    references: [admins.emailId],
  }),
}));

export const adminsRelations = relations(admins, ({ one }) => ({
  email: one(emails, {
    fields: [admins.emailId],
    references: [emails.id],
  }),
}));

export const tenantPlansRelations = relations(tenantPlans, ({ many }) => ({
  tenants: many(tenantPlans), // Will be defined in customer schema
}));

// Types

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

export type TenantPlan = typeof tenantPlans.$inferSelect;
export type NewTenantPlan = typeof tenantPlans.$inferInsert;

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
