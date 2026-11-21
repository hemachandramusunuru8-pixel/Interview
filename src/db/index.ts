import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

// Reuse one connection pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres>; db?: Db };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = globalForDb.pgClient ?? postgres(url, { max: 10 });
  if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;
  return drizzle(client, { schema });
}

/**
 * The database connects on first use, not when this file is imported. `next build` imports every
 * route to analyse it, and building must not need a database (or its secrets) to succeed.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    globalForDb.db ??= createDb();
    const value = Reflect.get(globalForDb.db, prop, globalForDb.db);
    return typeof value === "function" ? value.bind(globalForDb.db) : value;
  },
});
