#!/usr/bin/env bun
import { getDb } from "../../src/db/connection";
import { tenantPlans } from "../../src/db/schema-platform";
import { eq } from "drizzle-orm";

const PLANS = [
  {
    name: "Plan Básico",
    price: "9.99",
    currency: "EUR",
    maxSeats: 5,
    maxPeople: 50,
  },
  {
    name: "Plan Profesional",
    price: "29.99",
    currency: "EUR",
    maxSeats: 20,
    maxPeople: 200,
  },
  {
    name: "Plan Empresarial",
    price: "99.99",
    currency: "EUR",
    maxSeats: 100,
    maxPeople: -1,
  },
];

async function createPlans() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const db = getDb();

  console.log("Creating tenant plans...");

  for (const plan of PLANS) {
    const existing = await db
      .select()
      .from(tenantPlans)
      .where(eq(tenantPlans.name, plan.name))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Plan "${plan.name}" already exists`);
      continue;
    }

    await db.insert(tenantPlans).values(plan);
    console.log(`  Created plan: ${plan.name}`);
  }

  console.log("Plans created successfully!");
}

createPlans().catch((error) => {
  console.error("Failed to create plans:", error);
  process.exit(1);
});
