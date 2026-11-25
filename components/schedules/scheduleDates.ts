/**
 * Dated-schedule helpers for Manage Schedules.
 *
 * A `DatedDayValue` is a weekly `ScheduleDayValue` (its `sch_day` is the
 * date's weekday) plus the date itself, so the same day rules
 * (`applyDayUpdate`, `calculateHours`) apply. Weekly patterns (presets and
 * saved templates) fill a date range by weekday.
 */
import {
  DAYS,
  DEFAULT_DAY,
  applyDayUpdate,
  calculateHours,
  type ScheduleDayValue,
} from "./scheduleDays";
import { weekdayOf } from "@/lib/utils/scheduleDates";
import type {
  DatedScheduleDay,
  DatedScheduleEntry,
  WeeklyScheduleDay,
} from "@/lib/types";

export interface DatedDayValue extends ScheduleDayValue {
  /** YYYY-MM-DD */
  date: string;
  /** False when the date has no entry (grid edit only); it is cleared on save. */
  set: boolean;
  /** Covered by the employee's own approved request: shown, not editable. */
  locked: boolean;
}

/** One date from a weekly pattern, matched by weekday. */
function fromPattern(date: string, week: ScheduleDayValue[]): DatedDayValue {
  const weekday = weekdayOf(date);
  const source = week.find((d) => d.sch_day === weekday);
  const base = source ?? { sch_day: weekday, ...DEFAULT_DAY };
  return { ...base, sch_day: weekday, date, set: true, locked: false };
}

/** Fill every date from a weekly pattern. */
export function fillRange(
  dates: string[],
  week: ScheduleDayValue[]
): DatedDayValue[] {
  return dates.map((date) => fromPattern(date, week));
}

/**
 * Rebuild the rows for a new range: dates already in `prev` keep their
 * values, new dates come from the weekly pattern.
 */
export function reconcileRange(
  prev: DatedDayValue[],
  dates: string[],
  week: ScheduleDayValue[]
): DatedDayValue[] {
  const byDate = new Map(prev.map((d) => [d.date, d]));
  return dates.map((date) => byDate.get(date) ?? fromPattern(date, week));
}

/** Editor value for a saved entry. */
function fromEntry(entry: DatedScheduleEntry): DatedDayValue {
  const value: DatedDayValue = {
    sch_day: weekdayOf(entry.date),
    date: entry.date,
    sch_in: entry.sch_in || DEFAULT_DAY.sch_in,
    sch_out: entry.sch_out || DEFAULT_DAY.sch_out,
    sch_bin: entry.sch_bin || DEFAULT_DAY.sch_bin,
    sch_bout: entry.sch_bout || DEFAULT_DAY.sch_bout,
    sch_hrs: 0,
    sch_rest: entry.sch_rest,
    sch_shift: entry.sch_shift,
    have_break: entry.sch_rest ? DEFAULT_DAY.have_break : entry.have_break,
    set: true,
    locked: entry.source === "request",
  };
  value.sch_hrs = calculateHours(value);
  return value;
}

/**
 * Rows for one employee's grid edit: saved entries as they are, and dates
 * with no entry left unset (pre-filled from `week` in case they get set).
 */
export function rowsForEmployee(
  dates: string[],
  entries: DatedScheduleEntry[],
  week: ScheduleDayValue[]
): DatedDayValue[] {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  return dates.map((date) => {
    const entry = byDate.get(date);
    return entry ? fromEntry(entry) : { ...fromPattern(date, week), set: false };
  });
}

/** API shape for the rows that should be written. */
export function toDatedPayload(days: DatedDayValue[]): DatedScheduleDay[] {
  return days
    .filter((d) => d.set && !d.locked)
    .map((d) => ({
      date: d.date,
      sch_in: d.sch_in,
      sch_out: d.sch_out,
      sch_bin: d.sch_bin,
      sch_bout: d.sch_bout,
      sch_rest: d.sch_rest,
      sch_shift: d.sch_shift,
      have_break: d.have_break,
    }));
}

/** "14 dates: 10 working, 4 rest" */
export function summariseDates(days: DatedDayValue[]): string {
  const active = days.filter((d) => d.set && !d.locked);
  if (!active.length) return "No dates to set";
  const rest = active.filter((d) => d.sch_rest).length;
  const working = active.length - rest;
  const parts = [`${working} working`];
  if (rest) parts.push(`${rest} rest`);
  return `${active.length} date${active.length === 1 ? "" : "s"}: ${parts.join(", ")}`;
}

/**
 * The weekly pattern in the range: the first occurrence of each weekday.
 * Null when the range does not cover all seven weekdays.
 */
export function weekFromDates(days: DatedDayValue[]): ScheduleDayValue[] | null {
  const week = DAYS.map((weekday) => days.find((d) => d.sch_day === weekday));
  if (week.some((d) => !d)) return null;
  return (week as DatedDayValue[]).map((d) => ({
    sch_day: d.sch_day,
    sch_in: d.sch_in,
    sch_out: d.sch_out,
    sch_bin: d.sch_bin,
    sch_bout: d.sch_bout,
    sch_hrs: d.sch_hrs,
    sch_rest: d.sch_rest,
    sch_shift: d.sch_shift,
    have_break: d.have_break,
  }));
}

// ---------------------------------------------------------------------------
// Spreadsheet-style grid cells
// ---------------------------------------------------------------------------

/** What a typed cell means. */
export type CellInput =
  | { kind: "clear" }
  | { kind: "rest" }
  | { kind: "exempt" }
  | { kind: "work"; sch_in: string; sch_out: string }
  | { kind: "error"; message: string };

export const CELL_HELP =
  "Type 8-5, 08:00-17:00, 8am-5pm, 22-6, rest or exempt. Leave empty to clear.";

const TIME_RE = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/;

interface ParsedTime {
  minutes: number;
  hasMeridiem: boolean;
}

function parseTime(raw: string): ParsedTime | null {
  const m = TIME_RE.exec(raw.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.[0];
  if (min > 59) return null;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === "p" && h < 12) h += 12;
    if (meridiem === "a" && h === 12) h = 0;
  } else if (h > 23) {
    return null;
  }
  return { minutes: h * 60 + min, hasMeridiem: !!meridiem };
}

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Parse what was typed in a grid cell. "8-5" reads as 08:00-17:00: an end
 * without am/pm that is earlier than the start becomes PM when that still
 * ends after the start; otherwise it is an overnight shift (e.g. 22-6).
 */
export function parseCellText(text: string): CellInput {
  const t = text.trim().toLowerCase().replace(/[\u2013\u2014]/g, "-");
  if (t === "" || t === "-") return { kind: "clear" };
  if (["rest", "r", "off", "rd", "rest day"].includes(t)) return { kind: "rest" };
  if (["exempt", "e", "exempted", "ex"].includes(t)) return { kind: "exempt" };

  const parts = t.split(/\s*(?:-|to)\s*/);
  if (parts.length !== 2) {
    return { kind: "error", message: CELL_HELP };
  }
  const start = parseTime(parts[0]);
  const end = parseTime(parts[1]);
  if (!start || !end) return { kind: "error", message: CELL_HELP };

  let endMinutes = end.minutes;
  if (
    !end.hasMeridiem &&
    endMinutes < 12 * 60 &&
    endMinutes < start.minutes &&
    endMinutes + 12 * 60 > start.minutes
  ) {
    endMinutes += 12 * 60;
  }
  if (endMinutes === start.minutes) {
    return { kind: "error", message: "Start and end can't be the same time." };
  }
  return { kind: "work", sch_in: hhmm(start.minutes), sch_out: hhmm(endMinutes) };
}

/** Text shown in a grid cell for an entry. */
export function cellText(entry: DatedScheduleDay | undefined): string {
  if (!entry) return "";
  if (entry.sch_rest) return "Rest";
  if (entry.sch_shift === "E") return "Exempt";
  return `${entry.sch_in}-${entry.sch_out}`;
}

/** Strip a day down to the API shape. */
export function toDatedDay(d: DatedScheduleDay): DatedScheduleDay {
  return {
    date: d.date,
    sch_in: d.sch_in,
    sch_out: d.sch_out,
    sch_bin: d.sch_bin,
    sch_bout: d.sch_bout,
    sch_rest: d.sch_rest,
    sch_shift: d.sch_shift,
    have_break: d.have_break,
  };
}

/**
 * Editor value for a date: `base` with blanks filled from the defaults, or the
 * defaults when there is no base. Hours are worked out.
 */
export function toDayValue(
  base: DatedScheduleDay | null | undefined,
  date: string
): ScheduleDayValue {
  const value: ScheduleDayValue = base
    ? {
        sch_day: weekdayOf(date),
        sch_in: base.sch_in || DEFAULT_DAY.sch_in,
        sch_out: base.sch_out || DEFAULT_DAY.sch_out,
        sch_bin: base.sch_bin || DEFAULT_DAY.sch_bin,
        sch_bout: base.sch_bout || DEFAULT_DAY.sch_bout,
        sch_rest: base.sch_rest,
        sch_shift: base.sch_shift || "R",
        have_break: base.sch_rest ? true : base.have_break,
        sch_hrs: 0,
      }
    : { sch_day: weekdayOf(date), ...DEFAULT_DAY };
  value.sch_hrs = calculateHours(value);
  return value;
}

/** The weekly schedule's day for this date, if the employee has one. */
export function weeklyFor(
  weekly: WeeklyScheduleDay[],
  date: string
): DatedScheduleDay | undefined {
  const weekday = weekdayOf(date);
  const w = weekly.find((d) => d.sch_day === weekday);
  if (!w) return undefined;
  return {
    date,
    sch_in: w.sch_in,
    sch_out: w.sch_out,
    sch_bin: w.sch_bin,
    sch_bout: w.sch_bout,
    sch_rest: w.sch_rest,
    sch_shift: w.sch_shift,
    have_break: w.have_break,
  };
}

/**
 * The day a typed cell produces. `base` is the cell's current value (or null
 * for an empty cell); its break and shift are kept where they still apply.
 * A new break is placed 4 hours after the start, as in the day editor.
 */
export function dayFromCell(
  input: Extract<CellInput, { kind: "rest" | "exempt" | "work" }>,
  date: string,
  base: DatedScheduleDay | null
): DatedScheduleDay {
  const start = toDayValue(base, date);

  let next: ScheduleDayValue;
  if (input.kind === "rest") {
    next = { ...start, sch_rest: true, sch_shift: start.sch_shift === "E" ? "R" : start.sch_shift };
  } else if (input.kind === "exempt") {
    next = { ...start, sch_rest: false, sch_shift: "E" };
  } else {
    const updates: Partial<ScheduleDayValue> = {
      sch_rest: false,
      sch_out: input.sch_out,
    };
    // Only re-place the break when the start moves (applyDayUpdate does it).
    if (input.sch_in !== start.sch_in || !base || base.sch_rest) {
      updates.sch_in = input.sch_in;
    }
    let shift = start.sch_shift === "E" ? "R" : start.sch_shift;
    const overnight = input.sch_out < input.sch_in;
    if (overnight && shift === "R") shift = "N";
    if (!overnight && shift === "N") shift = "R";
    updates.sch_shift = shift;
    next = applyDayUpdate(start, updates);
  }
  return toDatedDay({ ...next, date });
}

/** Whether two days would store the same schedule. */
export function sameDay(a: DatedScheduleDay, b: DatedScheduleDay): boolean {
  if (a.date !== b.date || a.sch_rest !== b.sch_rest || a.sch_shift !== b.sch_shift) {
    return false;
  }
  if (a.sch_rest) return true;
  if (a.sch_in !== b.sch_in || a.sch_out !== b.sch_out) return false;
  if (a.have_break !== b.have_break) return false;
  return !a.have_break || (a.sch_bin === b.sch_bin && a.sch_bout === b.sch_bout);
}
