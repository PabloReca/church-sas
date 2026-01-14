#!/usr/bin/env bun
import { getDb } from "../../src/db/connection";
import { keys } from "../../src/db/schema-platform";
import { eq, and } from "drizzle-orm";

// Musical keys to insert
// Majors: C, G, D, A, E, B, F#, Db, Ab, Eb, Bb, F
// Minors: Am, Em, Bm, F#m, C#m, G#m, Ebm, Bbm, Fm, Cm, Gm, Dm

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

  // Minor keys (using relative notation: Am, Bm, etc.)
  { name: "C", isMinor: true, transpositionIndex: 1 },   // Cm
  { name: "C#", isMinor: true, transpositionIndex: 2 },  // C#m
  { name: "D", isMinor: true, transpositionIndex: 3 },   // Dm
  { name: "Eb", isMinor: true, transpositionIndex: 4 },  // Ebm
  { name: "E", isMinor: true, transpositionIndex: 5 },   // Em
  { name: "F", isMinor: true, transpositionIndex: 6 },   // Fm
  { name: "F#", isMinor: true, transpositionIndex: 7 },  // F#m
  { name: "G", isMinor: true, transpositionIndex: 8 },   // Gm
  { name: "G#", isMinor: true, transpositionIndex: 9 },  // G#m
  { name: "A", isMinor: true, transpositionIndex: 10 },  // Am
  { name: "Bb", isMinor: true, transpositionIndex: 11 }, // Bbm
  { name: "B", isMinor: true, transpositionIndex: 12 },  // Bm
];

async function seedKeys() {
  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL not set");
    process.exit(1);
  }

  const db = getDb();

  console.log("Seeding musical keys...");

  for (const key of KEYS) {
    const existing = await db
      .select()
      .from(keys)
      .where(
        and(
          eq(keys.name, key.name),
          eq(keys.isMinor, key.isMinor),
          eq(keys.transpositionIndex, key.transpositionIndex)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const keyDisplay = key.isMinor ? `${key.name}m` : key.name;
      console.log(`  Key "${keyDisplay}" already exists`);
      continue;
    }

    await db.insert(keys).values(key);
    const keyDisplay = key.isMinor ? `${key.name}m` : key.name;
    console.log(`  Created key: ${keyDisplay} (index: ${key.transpositionIndex})`);
  }

  console.log("Keys seeded successfully!");
}

seedKeys().catch((error) => {
  console.error("Failed to seed keys:", error);
  process.exit(1);
});
