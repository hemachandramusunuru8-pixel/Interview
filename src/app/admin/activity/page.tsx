import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, user } from "@/db/schema";
import { ActivityIcon } from "@/components/icons";
import { Avatar, Badge, Card, EmptyState, PageHeader, TD, TH, THead, TR, Table } from "@/components/ui";
import { describeAction, timeAgo } from "@/lib/dashboard";
import { requireRole } from "@/lib/dal";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 200;

const ENTITY_TONE = { user: "purple", job: "green", candidate: "indigo", interview: "blue" } as const;

function detailsText(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

export default async function ActivityPage() {
  await requireRole("admin");

  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
      actorName: user.name,
    })
    .from(activityLog)
    .leftJoin(user, eq(activityLog.actorId, user.id))
    .orderBy(desc(activityLog.createdAt))
    .limit(PAGE_SIZE);

  return (
    <>
      <PageHeader title="Activity log" description={`Who did what and when. Showing the latest ${PAGE_SIZE} actions.`} />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<ActivityIcon width={22} height={22} />} title="Nothing has happened yet." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Action</TH>
                <TH>By</TH>
                <TH>Details</TH>
                <TH className="text-right">When</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Badge tone={ENTITY_TONE[r.entityType as keyof typeof ENTITY_TONE] ?? "gray"}>{r.entityType}</Badge>
                      <span className="font-medium text-slate-900">{describeAction(r.action)}</span>
                    </div>
                  </TD>
                  <TD>
                    {r.actorName ? (
                      <span className="flex items-center gap-2"><Avatar name={r.actorName} size="sm" />{r.actorName}</span>
                    ) : (
                      <span className="text-slate-500">System</span>
                    )}
                  </TD>
                  <TD className="max-w-sm text-xs text-slate-500">{detailsText(r.details) || "-"}</TD>
                  <TD className="whitespace-nowrap text-right text-slate-500" >
                    <span title={r.createdAt.toLocaleString("en-GB")}>{timeAgo(r.createdAt)}</span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
