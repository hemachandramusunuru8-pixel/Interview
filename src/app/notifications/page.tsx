import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { BellIcon, ChevronRightIcon } from "@/components/icons";
import { Button, Card, EmptyState, PageHeader, cn } from "@/components/ui";
import { timeAgo } from "@/lib/dashboard";
import { requireUser } from "@/lib/dal";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user } = await requireUser();
  // Only the signed-in user's own notifications.
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const unread = rows.filter((r) => !r.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `You have ${unread} unread.` : "You are all caught up."}
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit" variant="secondary">Mark all as read</Button>
            </form>
          ) : undefined
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<BellIcon width={22} height={22} />} title="No notifications yet" description="Requests, confirmations and reminders appear here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => {
              const inner = (
                <>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", n.readAt ? "text-slate-600" : "font-medium text-slate-900")}>{n.title}</p>
                    <p className="truncate text-sm text-slate-500">{n.body}</p>
                    <p className="mt-0.5 text-xs text-slate-400" title={n.createdAt.toLocaleString("en-GB")}>{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.link && <ChevronRightIcon className="mt-1 text-slate-300" />}
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50">{inner}</Link>
                  ) : (
                    <div className="flex items-start gap-3 px-5 py-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
