import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { getSession } from "@/lib/dal";
import { signedResumeUrl } from "@/lib/storage";

// Checks the role, then redirects to a link that expires after 60 seconds.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> },
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "admin" && session.user.role !== "recruiter") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id, candidateId } = await params;
  const ids = z.object({ id: z.string().uuid(), candidateId: z.string().uuid() }).safeParse({ id, candidateId });
  if (!ids.success) return new NextResponse("Not found", { status: 404 });

  const [row] = await db
    .select({ path: candidates.resumePath })
    .from(candidates)
    .where(and(eq(candidates.id, ids.data.candidateId), eq(candidates.jobId, ids.data.id)));
  if (!row) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(await signedResumeUrl(row.path));
}
