#!/usr/bin/env bun
import { getDb } from "../../src/db/connection";
import { emails, admins } from "../../src/db/schema-platform";
import { eq } from "drizzle-orm";

async function createFirstAdmin() {
  const email = process.env.MASTER_ADMIN_EMAIL;

  if (!email) {
    console.error("ERROR: MASTER_ADMIN_EMAIL not set");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const db = getDb();
  const normalizedEmail = email.toLowerCase();

  const existingAdmins = await db.select().from(admins).limit(1);

  if (existingAdmins.length > 0) {
    console.log("Admins already exist");
    return;
  }

  // Check if email already exists
  let [emailRecord] = await db
    .select()
    .from(emails)
    .where(eq(emails.email, normalizedEmail))
    .limit(1);

  // Create email if it doesn't exist
  if (!emailRecord) {
    [emailRecord] = await db
      .insert(emails)
      .values({ email: normalizedEmail })
      .returning();
  }

  if (!emailRecord) {
    console.error("Failed to create email record");
    process.exit(1);
  }

  const [newAdmin] = await db
    .insert(admins)
    .values({
      emailId: emailRecord.id,
      name: 'Admin',
    })
    .returning();

  if (!newAdmin) {
    console.error("Failed to create admin");
    process.exit(1);
  }

  console.log(`✓ First admin created: ${normalizedEmail}`);
}

createFirstAdmin().catch((error) => {
  console.error("Failed to create first admin:", error);
  process.exit(1);
});
