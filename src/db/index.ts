import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { pgPool?: Pool; db?: Db };

// Serverless hosts start many short-lived instances, each with its own pool, so keep each pool small.
// Production must use Supabase's transaction pooler (port 6543). node-postgres sends one query per
// connection at a time and queues the rest, which the transaction pooler requires: the previous driver
// sent queued queries down busy connections and they hung.
const serverless = Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool =
    globalForDb.pgPool ??
    new Pool({
      connectionString: url,
      // DB_POOL_MAX tunes this per host, e.g. 20 on a long-running server; small defaults otherwise.
      max: Number(process.env.DB_POOL_MAX) || (serverless ? 3 : 5),
      idleTimeoutMillis: 10_000, // give connections back quickly
      connectionTimeoutMillis: 10_000, // fail fast instead of hanging a request
    });
  // An idle connection that drops (network, pooler restart) emits "error" on the pool. Without a
  // listener Node treats it as unhandled and the whole function crashes; log it and let pg reconnect.
  if (!globalForDb.pgPool) pool.on("error", (err) => console.error("Postgres pool error:", err.message));
  if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;
  return drizzle(pool, { schema });
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
