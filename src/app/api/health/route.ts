import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Public health check: shows where the app thinks its database is and whether it can reach it.
// Never returns the user name or password from DATABASE_URL.
export const dynamic = "force-dynamic";

function target() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return { configured: false as const };
  try {
    const u = new URL(raw);
    return { configured: true as const, host: u.hostname, port: u.port || "5432", database: u.pathname.slice(1) };
  } catch {
    return { configured: true as const, problem: "DATABASE_URL is not a valid address (check for spaces or quotes)" };
  }
}

/** The innermost error message, which names the real cause (e.g. a timeout or a missing database). */
function rootMessage(err: unknown): string {
  let e = err as { message?: string; cause?: unknown } | undefined;
  let msg = e?.message ?? String(err);
  while (e && e.cause) {
    e = e.cause as { message?: string; cause?: unknown };
    if (e?.message) msg = e.message;
  }
  // Never echo anything that looks like a connection string back to the browser.
  return msg.replace(/postgres(ql)?:\/\/\S+/gi, "postgres://***").slice(0, 200);
}

export async function GET() {
  const info = { target: target(), serverRegion: process.env.AWS_REGION ?? null };
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ database: "ok", ms: Date.now() - started, ...info });
  } catch (err) {
    return NextResponse.json({ database: "error", ms: Date.now() - started, error: rootMessage(err), ...info }, { status: 503 });
  }
}
