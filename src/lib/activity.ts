import "server-only";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

type Entry = {
  actorId: string | null; // null for actions taken by the system, such as scheduled jobs
  action: string; // e.g. "job.created"
  entityType: string; // e.g. "job"
  entityId: string;
  details?: object;
};

type ActivityWriter = Pick<typeof db, "insert">;

export async function logActivity(
  { actorId, action, entityType, entityId, details }: Entry,
  writer: ActivityWriter = db,
) {
  await writer.insert(activityLog).values({ actorId, action, entityType, entityId, details });
}
