import Link from "next/link";
import { CalendarIcon, VideoIcon } from "@/components/icons";
import { EmptyState, buttonClass } from "@/components/ui";

type Item = {
  id: string;
  startsAt: Date;
  timeZone: string;
  round: number;
  candidateName: string;
  jobTitle: string;
  panelistName?: string | null;
  teamsJoinUrl?: string | null;
  href?: string;
};

function DateTile({ date, tz }: { date: Date; tz: string }) {
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "short" }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric" }).format(date);
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
      <span className="text-[10px] font-semibold uppercase leading-none">{month}</span>
      <span className="text-lg font-semibold leading-tight">{day}</span>
    </div>
  );
}

function time(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(date);
}

/** Compact list of interviews with a date tile and a Teams button. */
export function InterviewList({ items, emptyText = "Nothing scheduled." }: { items: Item[]; emptyText?: string }) {
  if (items.length === 0) {
    return <EmptyState icon={<CalendarIcon width={22} height={22} />} title={emptyText} />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((i) => {
        const body = (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{i.candidateName}</p>
            <p className="truncate text-xs text-slate-500">
              {i.jobTitle} · Round {i.round}
              {i.panelistName ? ` · ${i.panelistName}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{time(i.startsAt, i.timeZone)}</p>
          </div>
        );
        return (
          <li key={i.id} className="flex items-center gap-3 px-5 py-3">
            <DateTile date={i.startsAt} tz={i.timeZone} />
            {i.href ? <Link href={i.href} className="min-w-0 flex-1 hover:opacity-80">{body}</Link> : body}
            {i.teamsJoinUrl && (
              <a href={i.teamsJoinUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                <VideoIcon width={16} height={16} />
                Join
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
