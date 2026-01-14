#!/usr/bin/env bun
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";
import { logger } from "@/lib/logger";

if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL);
const MIGRATIONS_DIR = join(import.meta.dir, "../../drizzle");

logger.info("Starting database migration...");

try {
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const files = await readdir(MIGRATIONS_DIR);
  const sqlFiles = files.filter(f => f.endsWith(".sql")).sort();

  if (sqlFiles.length === 0) {
    logger.info("No migration files found");
    process.exit(0);
  }

  for (const file of sqlFiles) {
    logger.info({ file }, 'Applying migration');

    const [existing] = await client<{ hash: string }[]>`
      SELECT hash FROM drizzle_migrations WHERE hash = ${file}
    `;

    if (existing) {
      logger.info("  Already applied, skipping");
      continue;
    }

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
    await client.unsafe(sql);

    await client`
      INSERT INTO drizzle_migrations (hash) VALUES (${file})
    `;

    logger.info("  Applied successfully");
  }

  logger.info("All migrations completed!");
} catch (error) {
  logger.error({ err: error }, "Migration failed");
  process.exit(1);
} finally {
  await client.end();
}
