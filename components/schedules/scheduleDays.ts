/**
 * Shared weekly-schedule day helpers.
 *
 * The Schedule Management module and the employee Work Schedule tab both edit a
 * 7-day recurring template with the same rules (auto-calculated hours, auto-set
 * break window, rest-day / exempt handling). This module holds those pure rules
 * plus the canonical day value shape so both surfaces stay consistent.
 *
 * `ScheduleDayValue` matches the API's `ScheduleDayForm` / template `TemplateDay`
 * (the `sch_*` fields minus `sch_emp`), so values round-trip without mapping.
 */

export const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export const SHIFTS = [
  { id: "R", name: "Regular" },
  { id: "N", name: "Night Shift" },
  { id: "F", name: "Flexible" },
  { id: "E", name: "Exempted" },
] as const;

export interface ScheduleDayValue {
  sch_day: string; // uppercase day name
  sch_in: string; // HH:mm
  sch_out: string; // HH:mm
  sch_bin: string; // HH:mm
  sch_bout: string; // HH:mm
  sch_hrs: number;
  sch_rest: boolean;
  sch_shift: string;
  have_break: boolean;
}

const DEFAULT_DAY: Omit<ScheduleDayValue, "sch_day"> = {
  sch_in: "09:00",
  sch_out: "18:00",
  sch_bin: "13:00",
  sch_bout: "14:00",
  sch_hrs: 8,
  sch_rest: false,
  sch_shift: "R",
  have_break: true,
};

/** A fresh, unsaved 7-day week using sensible office defaults. */
export function emptyWeek(): ScheduleDayValue[] {
  return DAYS.map((day) => ({ sch_day: day, ...DEFAULT_DAY }));
}

/**
 * Normalise an arbitrary set of day rows (e.g. from the API, which may be
 * missing days) into exactly 7 ordered days, filling gaps with defaults.
 */
export function toFullWeek(
  partial: Partial<ScheduleDayValue>[] | undefined | null
): ScheduleDayValue[] {
  const map = new Map<string, Partial<ScheduleDayValue>>();
  (partial ?? []).forEach((d) => {
    if (d.sch_day) map.set(d.sch_day.toUpperCase(), d);
  });
  return DAYS.map((day) => {
    const found = map.get(day);
    return found
      ? {
          sch_day: day,
          sch_in: found.sch_in || DEFAULT_DAY.sch_in,
          sch_out: found.sch_out || DEFAULT_DAY.sch_out,
          sch_bin: found.sch_bin || DEFAULT_DAY.sch_bin,
          sch_bout: found.sch_bout || DEFAULT_DAY.sch_bout,
          sch_hrs: found.sch_hrs ?? DEFAULT_DAY.sch_hrs,
          sch_rest: found.sch_rest ?? false,
          sch_shift: found.sch_shift || DEFAULT_DAY.sch_shift,
          have_break: found.have_break ?? DEFAULT_DAY.have_break,
        }
      : { sch_day: day, ...DEFAULT_DAY };
  });
}

const parseMinutes = (timeStr: string): number => {
  const [hours, minutes] = (timeStr || "0:0").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

/** Compute worked hours from in/out minus the break window. Mirrors the C# rule. */
export function calculateHours(sched: ScheduleDayValue): number {
  if (sched.sch_rest || sched.sch_shift === "E") return 0;

  const timeIn = parseMinutes(sched.sch_in);
  const timeOut = parseMinutes(sched.sch_out);
  let totalMinutes =
    timeOut > timeIn ? timeOut - timeIn : timeOut + 24 * 60 - timeIn;

  if (sched.have_break) {
    const breakIn = parseMinutes(sched.sch_bin);
    const breakOut = parseMinutes(sched.sch_bout);
    const breakMinutes =
      breakOut > breakIn ? breakOut - breakIn : breakOut + 24 * 60 - breakIn;
    totalMinutes -= breakMinutes;
  }

  return Math.round((totalMinutes / 60) * 100) / 100;
}

/**
 * Apply a partial update to a day, re-deriving hours and auto-setting the break
 * window when time-in changes (break in = in + 4h, break out = break in + 1h).
 * Returns a new object; does not mutate the input.
 */
export function applyDayUpdate(
  day: ScheduleDayValue,
  updates: Partial<ScheduleDayValue>
): ScheduleDayValue {
  const next: ScheduleDayValue = { ...day, ...updates };

  if (updates.sch_in) {
    const [hours, minutes] = updates.sch_in.split(":").map(Number);
    let breakInHours = (hours ?? 0) + 4;
    if (breakInHours >= 24) breakInHours -= 24;
    let breakOutHours = breakInHours + 1;
    if (breakOutHours >= 24) breakOutHours -= 24;
    const mm = (minutes ?? 0).toString().padStart(2, "0");
    next.sch_bin = `${breakInHours.toString().padStart(2, "0")}:${mm}`;
    next.sch_bout = `${breakOutHours.toString().padStart(2, "0")}:${mm}`;
  }

  if (
    updates.sch_in ||
    updates.sch_out ||
    updates.sch_bin ||
    updates.sch_bout ||
    updates.have_break !== undefined ||
    updates.sch_rest !== undefined ||
    updates.sch_shift !== undefined
  ) {
    next.sch_hrs = calculateHours(next);
  }

  return next;
}

export function formatDayName(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

/** Short label for grid headers etc. (e.g. "Mon"). */
export function shortDayName(day: string): string {
  return formatDayName(day).slice(0, 3);
}

const withSeconds = (t: string): string => (t ? `${t}:00` : "00:00:00");

/**
 * Convert editor day values into the API write shape (times as HH:mm:00,
 * `sch_emp` filled by the server). Used by bulk-apply, grid save, and templates.
 */
export function toScheduleForm(days: ScheduleDayValue[]) {
  return days.map((d) => ({
    sch_day: d.sch_day,
    sch_in: withSeconds(d.sch_in),
    sch_out: withSeconds(d.sch_out),
    sch_bin: withSeconds(d.sch_bin),
    sch_bout: withSeconds(d.sch_bout),
    sch_hrs: d.sch_hrs,
    sch_rest: d.sch_rest,
    sch_shift: d.sch_shift,
    have_break: d.have_break,
  }));
}

/** One-line human summary of a week, e.g. "Mon–Fri 09:00–18:00 · Sat, Sun rest". */
export function summariseWeek(days: ScheduleDayValue[]): string {
  if (!days.length) return "No schedule set";
  const working = days.filter((d) => !d.sch_rest && d.sch_shift !== "E");
  const rest = days.filter((d) => d.sch_rest);
  if (!working.length) return "All days rest / exempt";

  const first = working[0];
  const uniform = working.every(
    (d) => d.sch_in === first.sch_in && d.sch_out === first.sch_out
  );
  const workLabel = uniform
    ? `${working.map((d) => shortDayName(d.sch_day)).join(", ")} ${first.sch_in}–${first.sch_out}`
    : `${working.length} working day${working.length === 1 ? "" : "s"}`;
  const restLabel = rest.length
    ? ` · ${rest.map((d) => shortDayName(d.sch_day)).join(", ")} rest`
    : "";
  return workLabel + restLabel;
}
