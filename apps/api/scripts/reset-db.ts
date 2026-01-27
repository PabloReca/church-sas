#!/usr/bin/env tsx
import 'dotenv/config'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '../drizzle')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

const client = postgres(process.env.DATABASE_URL)

async function resetDatabase() {
  console.log('Resetting database...\n')

  try {
    // 1. Drop schemas and migration table
    console.log('1. Dropping schemas...')
    await client.unsafe('DROP SCHEMA IF EXISTS customer CASCADE')
    await client.unsafe('DROP SCHEMA IF EXISTS platform CASCADE')
    await client.unsafe('DROP TABLE IF EXISTS drizzle_migrations CASCADE')
    console.log('   Schemas dropped\n')

    // 2. Run migrations
    console.log('2. Running migrations...')

    // Create migration tracking table
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const files = await readdir(MIGRATIONS_DIR)
    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

    if (sqlFiles.length === 0) {
      console.error('   No migration files found!')
      process.exit(1)
    }

    for (const file of sqlFiles) {
      console.log(`   Applying: ${file}`)
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
      await client.unsafe(sql)
      await client`INSERT INTO drizzle_migrations (hash) VALUES (${file})`
    }

    console.log(`   Applied ${sqlFiles.length} migration(s)\n`)

    // 3. Seed platform data
    console.log('3. Seeding platform data...')
    await seedPlatform()
    console.log('   Platform data seeded\n')

    console.log('Database reset complete!\n')
    process.exit(0)
  } catch (error) {
    console.error('Reset failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

async function seedPlatform() {
  // Musical keys
  const KEYS = [
    // Major
    { name: 'C', isMinor: false, transpositionIndex: 1 },
    { name: 'Db', isMinor: false, transpositionIndex: 2 },
    { name: 'D', isMinor: false, transpositionIndex: 3 },
    { name: 'Eb', isMinor: false, transpositionIndex: 4 },
    { name: 'E', isMinor: false, transpositionIndex: 5 },
    { name: 'F', isMinor: false, transpositionIndex: 6 },
    { name: 'F#', isMinor: false, transpositionIndex: 7 },
    { name: 'G', isMinor: false, transpositionIndex: 8 },
    { name: 'Ab', isMinor: false, transpositionIndex: 9 },
    { name: 'A', isMinor: false, transpositionIndex: 10 },
    { name: 'Bb', isMinor: false, transpositionIndex: 11 },
    { name: 'B', isMinor: false, transpositionIndex: 12 },
    // Minor
    { name: 'C', isMinor: true, transpositionIndex: 1 },
    { name: 'C#', isMinor: true, transpositionIndex: 2 },
    { name: 'D', isMinor: true, transpositionIndex: 3 },
    { name: 'Eb', isMinor: true, transpositionIndex: 4 },
    { name: 'E', isMinor: true, transpositionIndex: 5 },
    { name: 'F', isMinor: true, transpositionIndex: 6 },
    { name: 'F#', isMinor: true, transpositionIndex: 7 },
    { name: 'G', isMinor: true, transpositionIndex: 8 },
    { name: 'G#', isMinor: true, transpositionIndex: 9 },
    { name: 'A', isMinor: true, transpositionIndex: 10 },
    { name: 'Bb', isMinor: true, transpositionIndex: 11 },
    { name: 'B', isMinor: true, transpositionIndex: 12 },
  ]

  const PLANS = [
    { name: 'Free', price: '0.00', currency: 'USD', maxSeats: 5, maxPeople: 100 },
    { name: 'Pro', price: '29.00', currency: 'USD', maxSeats: 20, maxPeople: 500 },
    { name: 'Enterprise', price: '99.00', currency: 'USD', maxSeats: 100, maxPeople: 5000 },
  ]

  // Insert keys
  for (const key of KEYS) {
    await client`
      INSERT INTO platform.keys (name, is_minor, transposition_index)
      VALUES (${key.name}, ${key.isMinor}, ${key.transpositionIndex})
    `
  }
  console.log(`   Created ${KEYS.length} musical keys`)

  // Insert plans
  for (const plan of PLANS) {
    await client`
      INSERT INTO platform.tenant_plans (name, price, currency, max_seats, max_people)
      VALUES (${plan.name}, ${plan.price}, ${plan.currency}, ${plan.maxSeats}, ${plan.maxPeople})
    `
  }
  console.log(`   Created ${PLANS.length} tenant plans`)

  // Create master admin if MASTER_ADMIN_EMAIL is set
  const adminEmail = process.env.MASTER_ADMIN_EMAIL
  if (adminEmail) {
    const normalizedEmail = adminEmail.toLowerCase()

    const [emailRecord] = await client<{ id: number }[]>`
      INSERT INTO platform.emails (email)
      VALUES (${normalizedEmail})
      RETURNING id
    `

    if (emailRecord) {
      await client`
        INSERT INTO platform.admins (email_id, name)
        VALUES (${emailRecord.id}, 'Admin')
      `

      console.log(`   Created master admin: ${normalizedEmail}`)
    }
  }
}

resetDatabase()
