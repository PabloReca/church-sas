import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { config } from "@/config";
import { logger } from "@/lib/logger";

const databaseUrl = config.database.url;

if (!databaseUrl) {
  logger.warn("Missing DATABASE_URL environment variable");
}

const client = databaseUrl ? postgres(databaseUrl) : null;
const _db = client ? drizzle(client, { schema }) : null;

export type Database = NonNullable<typeof _db>;

export function getDb(): Database {
  if (!_db) throw new Error("Database not available");
  return _db;
}

export const db = _db;
export const sql = client;
