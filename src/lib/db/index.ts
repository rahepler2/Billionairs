import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __liftedDb?: DB; __liftedPool?: Pool };

export function db(): DB {
  if (!globalForDb.__liftedDb) {
    const pool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 10,
      // All queries go through drizzle's parameterized builder; never string-concatenate SQL.
      statement_timeout: 10_000,
    });
    globalForDb.__liftedPool = pool;
    globalForDb.__liftedDb = drizzle(pool, { schema });
  }
  return globalForDb.__liftedDb;
}

export { schema };
