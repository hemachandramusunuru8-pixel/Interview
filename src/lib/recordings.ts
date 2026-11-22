import "server-only";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { interviewRecordings, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { findOnlineMeetingId, listMeetingRecordings } from "@/lib/graph";

/** Teams needs a few minutes (sometimes longer) to process a recording, so keep looking for this long. */
export const RECORDING_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Do not ask Microsoft about the same interview more often than this. */
export const RECHECK_EVERY_MS = 5 * 60 * 1000;
const BATCH = 10;

export type SyncResult = { checked: number; saved: number; failed: number };

/**
 * Finds Teams recordings for interviews that have ended recently and saves them, so Admins and
 * Recruiters can watch them later. Safe to run often and from several places at once: each interview
 * is claimed with a single UPDATE before Microsoft is asked, and a recording is saved only once.
 */
export async function syncRecordings(opts: { candidateId?: string; now?: Date } = {}): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const recheckBefore = new Date(now.getTime() - RECHECK_EVERY_MS);
  const windowStart = new Date(now.getTime() - RECORDING_WINDOW_MS);

  const claimed = await db
    .update(interviews)
    .set({ recordingsCheckedAt: now })
    .where(
      and(
        inArray(
          interviews.id,
          db
            .select({ id: interviews.id })
            .from(interviews)
            .where(
              and(
                isNotNull(interviews.teamsJoinUrl),
                inArray(interviews.status, ["scheduled", "completed"]),
                lt(interviews.endsAt, now), // the meeting has ended
                gt(interviews.endsAt, windowStart), // ...recently
                or(isNull(interviews.recordingsCheckedAt), lt(interviews.recordingsCheckedAt, recheckBefore)),
                opts.candidateId ? eq(interviews.candidateId, opts.candidateId) : undefined,
              ),
            )
            .limit(BATCH),
        ),
        or(isNull(interviews.recordingsCheckedAt), lt(interviews.recordingsCheckedAt, recheckBefore)),
      ),
    )
    .returning({
      id: interviews.id,
      joinUrl: interviews.teamsJoinUrl,
      onlineMeetingId: interviews.onlineMeetingId,
    });

  const result: SyncResult = { checked: claimed.length, saved: 0, failed: 0 };
  for (const row of claimed) {
    try {
      let meetingId = row.onlineMeetingId;
      if (!meetingId && row.joinUrl) {
        meetingId = await findOnlineMeetingId(row.joinUrl);
        if (meetingId) await db.update(interviews).set({ onlineMeetingId: meetingId }).where(eq(interviews.id, row.id));
      }
      if (!meetingId) continue;

      for (const rec of await listMeetingRecordings(meetingId)) {
        const inserted = await db
          .insert(interviewRecordings)
          .values({
            interviewId: row.id,
            graphRecordingId: rec.id,
            meetingId,
            startedAt: rec.createdDateTime ? new Date(rec.createdDateTime) : null,
            endedAt: rec.endDateTime ? new Date(rec.endDateTime) : null,
          })
          .onConflictDoNothing({ target: interviewRecordings.graphRecordingId })
          .returning({ id: interviewRecordings.id });
        if (inserted.length > 0) {
          result.saved++;
          await logActivity({
            actorId: null,
            action: "recording.saved",
            entityType: "interview",
            entityId: row.id,
            details: { recordingId: inserted[0].id },
          });
        }
      }
    } catch (err) {
      result.failed++;
      console.error("Recording sync failed for interview", row.id, err);
    }
  }
  return result;
}

/** Saved recordings for a set of interviews, oldest first. */
export async function recordingsFor(interviewIds: string[]) {
  if (interviewIds.length === 0) return [];
  return db
    .select()
    .from(interviewRecordings)
    .where(inArray(interviewRecordings.interviewId, interviewIds))
    .orderBy(sql`${interviewRecordings.startedAt} asc nulls last`);
}
