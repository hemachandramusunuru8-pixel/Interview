import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { BellIcon } from "@/components/icons";

export async function NotificationsLink({ userId }: { userId: string }) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  const unread = r?.n ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      <BellIcon width={20} height={20} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
