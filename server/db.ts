/**
 * server/db.ts
 *
 * Database connection and Drizzle ORM instance.
 *
 * ─── HOW TO SWITCH TO A DIFFERENT DATABASE ───────────────────────────────────
 *
 * This app uses PostgreSQL via the `pg` driver and Drizzle ORM.
 * The connection is driven entirely by the DATABASE_URL environment variable,
 * so swapping databases is a one-step change:
 *
 *   1. Update the DATABASE_URL secret with the new connection string.
 *      Format: postgres://<user>:<password>@<host>:<port>/<dbname>
 *      Example: postgres://admin:secret@db.example.com:5432/learntracker
 *
 *      In Replit: open the Secrets panel and update DATABASE_URL there.
 *      Locally: set it in your .env file (never commit real credentials).
 *
 *   2. Run migrations against the new database so the schema is up to date:
 *        npm run db:push
 *      This uses drizzle-kit to apply the schema from shared/schema.ts.
 *
 *   3. Restart the server — the new pool will connect automatically.
 *
 * ─── WHAT EACH EXPORT DOES ───────────────────────────────────────────────────
 *
 *   pool  — raw pg connection pool. Use this if you ever need to run a
 *            transaction outside of Drizzle, or for health-check queries.
 *
 *   db    — Drizzle ORM instance. This is what server/storage.ts imports
 *            for all query and mutation operations.
 *
 * ─── SWITCHING TO A DIFFERENT DATABASE ENGINE ────────────────────────────────
 *
 * If you need to switch from PostgreSQL to another engine (e.g. MySQL, SQLite):
 *
 *   1. Install the matching Drizzle driver, e.g.:
 *        npm install drizzle-orm/mysql2   (for MySQL)
 *        npm install drizzle-orm/better-sqlite3  (for SQLite)
 *
 *   2. Replace the imports below with the new driver.
 *
 *   3. Update shared/schema.ts — Drizzle column types differ per engine
 *      (e.g. mysqlTable instead of pgTable).
 *
 *   4. Update the drizzle() call below to use the new driver instance.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Connection pool — pg manages multiple concurrent connections automatically.
// Adjust pool size via { max: N } if your database plan has connection limits.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Drizzle instance used throughout server/storage.ts for all queries.
export const db = drizzle(pool, { schema });
