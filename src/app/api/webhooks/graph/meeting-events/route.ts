import { NextResponse } from "next/server";
import { queueMeetingNotifications } from "@/lib/graph-meeting-events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken !== null) {
    // Graph requires the URL-decoded opaque value as plain text within ten seconds.
    return new Response(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 202 });
  }

  // The shared secret is checked before insertion. JWT validation and encrypted
  // resource processing happen in the durable cron worker.
  await queueMeetingNotifications(body);
  return new NextResponse(null, { status: 202 });
}
