import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { interviewRecordings, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { getSession } from "@/lib/dal";
import { fetchRecordingContent } from "@/lib/graph";

// Plays a saved Teams recording. Admins and Recruiters only; the video itself stays in Microsoft 365.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; candidateId: string; recordingId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "admin" && session.user.role !== "recruiter") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ids = z
    .object({ id: z.string().uuid(), candidateId: z.string().uuid(), recordingId: z.string().uuid() })
    .safeParse(await params);
  if (!ids.success) return new NextResponse("Not found", { status: 404 });

  // The recording must belong to an interview of this candidate on this job.
  const [rec] = await db
    .select({ meetingId: interviewRecordings.meetingId, graphRecordingId: interviewRecordings.graphRecordingId, interviewId: interviews.id })
    .from(interviewRecordings)
    .innerJoin(interviews, eq(interviewRecordings.interviewId, interviews.id))
    .where(
      and(
        eq(interviewRecordings.id, ids.data.recordingId),
        eq(interviews.candidateId, ids.data.candidateId),
        eq(interviews.jobId, ids.data.id),
      ),
    );
  if (!rec) return new NextResponse("Not found", { status: 404 });

  const range = req.headers.get("range");
  // Log a view once per playback, not for every chunk the video player asks for.
  if (!range || /^bytes=0-/.test(range)) {
    await logActivity({
      actorId: session.user.id,
      action: "recording.viewed",
      entityType: "interview",
      entityId: rec.interviewId,
      details: { recordingId: ids.data.recordingId },
    }).catch((err) => console.error("Could not log recording view:", err));
  }

  let upstream: Response;
  try {
    upstream = await fetchRecordingContent(rec.meetingId, rec.graphRecordingId, range);
  } catch (err) {
    console.error("Recording fetch failed:", err);
    return new NextResponse("The recording could not be loaded from Microsoft. Try again in a moment.", { status: 502 });
  }

  // Preferred: Microsoft hands out its own short-lived link, so the browser streams directly from it.
  const location = upstream.headers.get("location");
  if (upstream.status >= 300 && upstream.status < 400 && location) {
    return NextResponse.redirect(location, 302);
  }

  if (upstream.ok && upstream.body) {
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  console.error("Recording content returned", upstream.status, await upstream.text().catch(() => ""));
  return new NextResponse(
    upstream.status === 404
      ? "This recording is no longer available in Microsoft 365 (it may have expired or been deleted)."
      : "The recording could not be loaded from Microsoft. Try again in a moment.",
    { status: upstream.status === 404 ? 404 : 502 },
  );
}
