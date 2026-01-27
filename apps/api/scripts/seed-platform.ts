#!/usr/bin/env tsx
import { db } from '../src/db/connection'
import { keys, tenantPlans, admins, emails } from '../src/db/schema'
import { eq, and } from 'drizzle-orm'

// Musical keys data
const KEYS = [
  // Major keys
  { name: "C", isMinor: false, transpositionIndex: 1 },
  { name: "Db", isMinor: false, transpositionIndex: 2 },
  { name: "D", isMinor: false, transpositionIndex: 3 },
  { name: "Eb", isMinor: false, transpositionIndex: 4 },
  { name: "E", isMinor: false, transpositionIndex: 5 },
  { name: "F", isMinor: false, transpositionIndex: 6 },
  { name: "F#", isMinor: false, transpositionIndex: 7 },
  { name: "G", isMinor: false, transpositionIndex: 8 },
  { name: "Ab", isMinor: false, transpositionIndex: 9 },
  { name: "A", isMinor: false, transpositionIndex: 10 },
  { name: "Bb", isMinor: false, transpositionIndex: 11 },
  { name: "B", isMinor: false, transpositionIndex: 12 },
  // Minor keys
  { name: "C", isMinor: true, transpositionIndex: 1 },
  { name: "C#", isMinor: true, transpositionIndex: 2 },
  { name: "D", isMinor: true, transpositionIndex: 3 },
  { name: "Eb", isMinor: true, transpositionIndex: 4 },
  { name: "E", isMinor: true, transpositionIndex: 5 },
  { name: "F", isMinor: true, transpositionIndex: 6 },
  { name: "F#", isMinor: true, transpositionIndex: 7 },
  { name: "G", isMinor: true, transpositionIndex: 8 },
  { name: "G#", isMinor: true, transpositionIndex: 9 },
  { name: "A", isMinor: true, transpositionIndex: 10 },
  { name: "Bb", isMinor: true, transpositionIndex: 11 },
  { name: "B", isMinor: true, transpositionIndex: 12 },
]

// Plan data
const PLANS = [
  { name: 'Free', price: '0.00', currency: 'USD', maxSeats: 5, maxPeople: 100 },
  { name: 'Pro', price: '29.00', currency: 'USD', maxSeats: 20, maxPeople: 500 },
  { name: 'Enterprise', price: '99.00', currency: 'USD', maxSeats: 100, maxPeople: 5000 },
]

async function seedPlatform() {
  console.log('Seeding platform data...\n')

  if (!db) {
    console.error('Database connection not available')
    process.exit(1)
  }

  try {
    // 1. Seed musical keys
    console.log('Seeding musical keys...')
    let keysCreated = 0
    let keysSkipped = 0

    for (const key of KEYS) {
      const existing = await db
        .select()
        .from(keys)
        .where(
          and(
            eq(keys.name, key.name),
            eq(keys.isMinor, key.isMinor)
          )
        )
        .limit(1)

      if (existing.length === 0) {
        await db.insert(keys).values(key)
        keysCreated++
      } else {
        keysSkipped++
      }
    }

    console.log(`  Created ${keysCreated} keys, skipped ${keysSkipped} existing\n`)

    // 2. Seed tenant plans
    console.log('Seeding tenant plans...')
    let plansCreated = 0
    let plansSkipped = 0

    for (const plan of PLANS) {
      const existing = await db
        .select()
        .from(tenantPlans)
        .where(eq(tenantPlans.name, plan.name))
        .limit(1)

      if (existing.length === 0) {
        await db.insert(tenantPlans).values(plan)
        console.log(`  Created plan: ${plan.name}`)
        plansCreated++
      } else {
        console.log(`  Plan already exists: ${plan.name}`)
        plansSkipped++
      }
    }

    console.log(`  Created ${plansCreated} plans, skipped ${plansSkipped} existing\n`)

    // 3. Create first admin (if MASTER_ADMIN_EMAIL is set)
    const adminEmail = process.env.MASTER_ADMIN_EMAIL

    if (adminEmail) {
      console.log('Creating master admin...')
      const normalizedEmail = adminEmail.toLowerCase()

      // Check if any admin exists
      const existingAdmins = await db.select().from(admins).limit(1)

      if (existingAdmins.length === 0) {
        // Create or get email record
        let emailRecord = await db
          .select()
          .from(emails)
          .where(eq(emails.email, normalizedEmail))
          .limit(1)
          .then((rows) => rows[0])

        if (!emailRecord) {
          emailRecord = await db
            .insert(emails)
            .values({ email: normalizedEmail })
            .returning()
            .then((rows) => rows[0])
        }

        if (!emailRecord) {
          console.error('Failed to create email record')
          process.exit(1)
        }

        // Create admin
        await db.insert(admins).values({
          emailId: emailRecord.id,
          name: 'Admin',
        })

        console.log(`  Created admin: ${normalizedEmail}\n`)
      } else {
        console.log(`  Admin already exists\n`)
      }
    } else {
      console.log('MASTER_ADMIN_EMAIL not set, skipping admin creation\n')
    }

    console.log('Platform seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('Platform seeding failed:', error)
    process.exit(1)
  }
}

seedPlatform()
