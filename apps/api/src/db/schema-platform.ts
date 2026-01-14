import { text, timestamp, integer, serial, numeric, pgSchema, varchar, bigserial, boolean, unique } from "drizzle-orm/pg-core";
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
  lastname: varchar("lastname", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Keys - musical keys shared across all tenants
export const keys = platformSchema.table("keys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 10 }).notNull(), // 'C', 'Db', 'D', etc.
  isMinor: boolean("is_minor").notNull(), // true = minor, false = major
  transpositionIndex: integer("transposition_index").notNull(), // 1-12 (C=1, Db=2, ..., B=12)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("keys_name_is_minor_transposition_index_unique").on(table.name, table.isMinor, table.transpositionIndex),
]);

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

export const tenantPlansRelations = relations(tenantPlans, () => ({
  // tenants: Will be defined in customer schema
}));

export const keysRelations = relations(keys, () => ({
  // songs: Will be related to songs in customer schema
}));

// Types

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

export type TenantPlan = typeof tenantPlans.$inferSelect;
export type NewTenantPlan = typeof tenantPlans.$inferInsert;

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type Key = typeof keys.$inferSelect;
export type NewKey = typeof keys.$inferInsert;
