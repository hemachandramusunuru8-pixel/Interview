import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDueJobs } from "@/lib/scheduled-jobs";

// Called every few minutes by a scheduler (see `npm run tick` for local use).
// Protected by a shared secret, not by a user session.
function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorised(req)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await runDueJobs();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
