// Time zone helpers built on Intl, so no extra dependency is needed.

export const TIME_ZONES = [
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "UTC", label: "UTC" },
  { id: "Asia/Dubai", label: "Dubai (GST)" },
  { id: "Asia/Singapore", label: "Singapore (SGT)" },
  { id: "Asia/Tokyo", label: "Tokyo (JST)" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Berlin", label: "Central Europe" },
  { id: "America/New_York", label: "US Eastern" },
  { id: "America/Chicago", label: "US Central" },
  { id: "America/Los_Angeles", label: "US Pacific" },
] as const;

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds that `tz` is ahead of UTC at the given instant. */
function offsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function wallClock(instant: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return [get("year"), get("month"), get("day"), get("hour"), get("minute")] as const;
}

/** Converts a wall-clock time ("2026-12-01T10:30") in `tz` to the real UTC instant. Null if invalid. */
export function zonedToUtc(local: string, tz: string): Date | null {
  const m = LOCAL_RE.exec(local);
  if (!m || !isValidTimeZone(tz)) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Reject impossible dates such as 2026-02-31.
  const check = new Date(asIfUtc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  if (h > 23 || mi > 59) return null;

  let utc = asIfUtc - offsetMs(asIfUtc, tz);
  // Second pass settles times near a daylight-saving change.
  const refined = asIfUtc - offsetMs(utc, tz);
  if (refined !== utc) utc = refined;

  const requested = [y, mo, d, h, mi] as const;
  const sameWallClock = (instant: number) => wallClock(instant, tz).every((value, index) => value === requested[index]);
  // Spring-forward gaps do not round-trip. Repeated autumn times are ambiguous, so require another time.
  if (!sameWallClock(utc)) return null;
  for (const minutes of [-120, -90, -60, -30, 30, 60, 90, 120]) {
    if (sameWallClock(utc + minutes * 60_000)) return null;
  }
  return new Date(utc);
}

/** Formats an instant for display in the given zone, e.g. "Tue, 1 Dec 2026, 10:30 am (Asia/Kolkata)". */
export function formatInZone(date: Date, tz: string): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${text} (${tz})`;
}
