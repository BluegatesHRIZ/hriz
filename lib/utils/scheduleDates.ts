/**
 * Calendar-date helpers for dated schedules, shared by the API and the UI.
 * Dates are plain YYYY-MM-DD strings handled in UTC so the weekday never
 * shifts with the browser's or server's timezone.
 */

/** Longest range Manage Schedules edits in one go. */
export const MAX_SCHEDULE_RANGE_DAYS = 62;

const WEEKDAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Uppercase weekday name, e.g. "MONDAY", matching `schedule.sch_day`. */
export function weekdayOf(date: string): string {
  return WEEKDAYS[toUtc(date).getUTCDay()];
}

/** Number of days from `from` to `to`, inclusive. 0 when `to` is before `from`. */
export function rangeLength(from: string, to: string): number {
  const diff = Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff + 1;
}

/** Every date from `from` to `to`, inclusive. */
export function listDates(from: string, to: string): string[] {
  const n = rangeLength(from, to);
  return Array.from({ length: n }, (_, i) => addDays(from, i));
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const dow = toUtc(date).getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** "Mon, Dec 1" */
export function formatShortDate(date: string): string {
  return toUtc(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Dec 1, 2026" */
export function formatLongDate(date: string): string {
  return toUtc(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
