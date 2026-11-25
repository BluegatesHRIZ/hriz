import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { formatTimeForInput } from "@/lib/utils/time";
import { timeStringToDate } from "@/lib/services/schedule.service";
import {
  MAX_SCHEDULE_RANGE_DAYS,
  isIsoDate,
  rangeLength,
} from "@/lib/utils/scheduleDates";
import type { Prisma } from "../../src/generated/prisma/client";
import type {
  DatedScheduleDay,
  DatedScheduleEntry,
  DatedScheduleSource,
} from "@/lib/types";

/**
 * Dated schedules for Manage Schedules.
 *
 * Entries are written as approved schedule changes (`schedadjust_summary` with
 * status 1 + one `schedadjust_detail` per date). The attendance recompute
 * (`SCHED_SQL` in attendance-recompute.ts) already lays those over the weekly
 * schedule for the matching date, so no attendance logic changes.
 *
 * Summaries written here carry `MANAGE_SCHEDULES_REASON` so they can be told
 * apart from employees' own requests. The recompute's UPDATE ... JOIN applies
 * only one detail per employee and date, so this service keeps at most one
 * approved entry per employee-date: setting a date replaces the earlier
 * Manage Schedules entry, and a date already covered by an employee's approved
 * request is skipped rather than overwritten.
 */

export const MANAGE_SCHEDULES_REASON = "Set in Manage Schedules";

const SHIFTS = new Set(["R", "N", "F", "E"]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIDNIGHT = "00:00";

const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);

/** Returns an error message, or null when the day is valid. */
export function validateDatedDay(day: DatedScheduleDay): string | null {
  if (!SHIFTS.has(day.sch_shift)) return `Unknown shift "${day.sch_shift}".`;
  if (day.sch_rest) return null;
  for (const t of [day.sch_in, day.sch_out]) {
    if (!HHMM.test(t)) return `Invalid time "${t}" on ${day.date}.`;
  }
  if (day.have_break) {
    for (const t of [day.sch_bin, day.sch_bout]) {
      if (!HHMM.test(t)) return `Invalid break time "${t}" on ${day.date}.`;
    }
  }
  return null;
}

/**
 * Parse and validate request days. Rejects duplicate dates and ranges longer
 * than MAX_SCHEDULE_RANGE_DAYS.
 */
export function parseDatedDays(
  raw: unknown
): { ok: true; days: DatedScheduleDay[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) return { ok: false, message: "Provide the dates to set." };
  const days: DatedScheduleDay[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>;
    if (!isIsoDate(r.date)) return { ok: false, message: "Every row needs a valid date." };
    if (seen.has(r.date)) return { ok: false, message: `${r.date} appears twice.` };
    seen.add(r.date);
    const day: DatedScheduleDay = {
      date: r.date,
      sch_in: typeof r.sch_in === "string" ? r.sch_in.slice(0, 5) : "",
      sch_out: typeof r.sch_out === "string" ? r.sch_out.slice(0, 5) : "",
      sch_bin: typeof r.sch_bin === "string" ? r.sch_bin.slice(0, 5) : "",
      sch_bout: typeof r.sch_bout === "string" ? r.sch_bout.slice(0, 5) : "",
      sch_rest: r.sch_rest === true,
      sch_shift: typeof r.sch_shift === "string" ? r.sch_shift : "R",
      have_break: r.have_break === true,
    };
    const error = validateDatedDay(day);
    if (error) return { ok: false, message: error };
    days.push(day);
  }
  return checkRange([...seen]) ?? { ok: true, days };
}

/** Parse a list of YYYY-MM-DD strings. */
export function parseDateList(
  raw: unknown
): { ok: true; dates: string[] } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, dates: [] };
  if (!Array.isArray(raw) || !raw.every(isIsoDate)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }
  const dates = [...new Set(raw as string[])];
  return checkRange(dates) ?? { ok: true, dates };
}

function checkRange(dates: string[]): { ok: false; message: string } | null {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  if (rangeLength(sorted[0], sorted[sorted.length - 1]) > MAX_SCHEDULE_RANGE_DAYS) {
    return {
      ok: false,
      message: `Pick a range of ${MAX_SCHEDULE_RANGE_DAYS} days or fewer.`,
    };
  }
  return null;
}

interface ApprovedDetail {
  detailId: string;
  summaryId: string;
  empId: string;
  date: string;
  source: DatedScheduleSource;
  entry: DatedScheduleEntry;
}

/**
 * Approved schedule-change details for these employees between `from` and
 * `to` (inclusive), tagged by source.
 */
async function findApprovedDetails(
  empIds: string[],
  from: string,
  to: string
): Promise<ApprovedDetail[]> {
  if (!empIds.length) return [];
  const details = await prisma.schedadjust_detail.findMany({
    where: { sca_ddate: { gte: toDbDate(from), lte: toDbDate(to) } },
  });
  const summaryIds = [
    ...new Set(details.map((d) => d.sca_dpk).filter((x): x is string => !!x)),
  ];
  if (!summaryIds.length) return [];

  const summaries = await prisma.schedadjust_summary.findMany({
    where: {
      sca_sid: { in: summaryIds },
      sca_semp: { in: empIds },
      sca_sstatus: 1,
    },
    select: { sca_sid: true, sca_semp: true, sca_sreason: true },
  });
  const summaryById = new Map(summaries.map((s) => [s.sca_sid, s]));

  const result: ApprovedDetail[] = [];
  for (const d of details) {
    const summary = d.sca_dpk ? summaryById.get(d.sca_dpk) : undefined;
    if (!summary?.sca_semp || !d.sca_ddate) continue;
    const source: DatedScheduleSource =
      summary.sca_sreason === MANAGE_SCHEDULES_REASON ? "admin" : "request";
    const date = fromDbDate(d.sca_ddate);
    const rest = d.sca_drest === 1;
    const hasBreak = !rest && d.sca_dbreak === 1;
    result.push({
      detailId: d.sca_did,
      summaryId: summary.sca_sid,
      empId: summary.sca_semp,
      date,
      source,
      entry: {
        date,
        sch_in: rest ? "" : formatTimeForInput(d.sca_dshiftstart) ?? "",
        sch_out: rest ? "" : formatTimeForInput(d.sca_dshiftend) ?? "",
        sch_bin: hasBreak ? formatTimeForInput(d.sca_dbreakstart) ?? "" : "",
        sch_bout: hasBreak ? formatTimeForInput(d.sca_dbreakend) ?? "" : "",
        sch_rest: rest,
        sch_shift: d.sca_dshift || "R",
        have_break: hasBreak,
        source,
      },
    });
  }
  return result;
}

/**
 * Each employee's dated entries between `from` and `to`, sorted by date. When
 * an employee request and a Manage Schedules entry share a date, the request
 * is shown, since saving here skips that date.
 */
export async function getDatedSchedules(
  empIds: string[],
  from: string,
  to: string
): Promise<Map<string, DatedScheduleEntry[]>> {
  const details = await findApprovedDetails(empIds, from, to);
  const byEmp = new Map<string, Map<string, DatedScheduleEntry>>();
  for (const d of details) {
    const dates = byEmp.get(d.empId) ?? new Map<string, DatedScheduleEntry>();
    const existing = dates.get(d.date);
    if (!existing || (existing.source === "admin" && d.source === "request")) {
      dates.set(d.date, d.entry);
    }
    byEmp.set(d.empId, dates);
  }
  const result = new Map<string, DatedScheduleEntry[]>();
  for (const [empId, dates] of byEmp) {
    result.set(
      empId,
      [...dates.values()].sort((a, b) => a.date.localeCompare(b.date))
    );
  }
  return result;
}

function buildDetailRow(
  summaryId: string,
  counter: number,
  day: DatedScheduleDay
): Prisma.schedadjust_detailCreateManyInput {
  // Same encoding as the Schedule Change request form: a rest day stores
  // midnight for every time, and no break stores a zero-length break.
  const rest = day.sch_rest;
  const hasBreak = !rest && day.have_break;
  const t = (v: string) => timeStringToDate(v || MIDNIGHT);
  return {
    sca_did: randomUUID().replace(/-/g, ""),
    sca_dpk: summaryId,
    sca_dctr: counter,
    sca_ddate: toDbDate(day.date),
    sca_dshiftstart: t(rest ? MIDNIGHT : day.sch_in),
    sca_dbreakstart: t(hasBreak ? day.sch_bin : MIDNIGHT),
    sca_dbreakend: t(hasBreak ? day.sch_bout : MIDNIGHT),
    sca_dshiftend: t(rest ? MIDNIGHT : day.sch_out),
    sca_drest: rest ? 1 : 0,
    sca_dbreak: hasBreak ? 1 : 0,
    sca_dshift: day.sch_shift,
  };
}

export interface SaveDatedSchedulesInput {
  empIds: string[];
  /** Dates to set. */
  days: DatedScheduleDay[];
  /** Dates whose Manage Schedules entry is removed. */
  clearDates?: string[];
  /** Employee id of the admin saving, recorded as the approver. */
  adminId: string;
}

export interface SaveDatedSchedulesResult {
  employees: number;
  written: number;
  skipped: number;
  cleared: number;
}

/**
 * Set (and optionally clear) dated entries for many employees.
 *
 * Per employee: earlier Manage Schedules entries on the touched dates are
 * removed, dates covered by the employee's own approved request are skipped,
 * and the rest are written under one new approved summary. Summaries left
 * with no details are deleted; the others get their date range refreshed.
 */
export async function saveDatedSchedules(
  input: SaveDatedSchedulesInput
): Promise<SaveDatedSchedulesResult> {
  const empIds = [...new Set(input.empIds.filter(Boolean))];
  const dayByDate = new Map(input.days.map((d) => [d.date, d]));
  const clearDates = new Set(
    (input.clearDates ?? []).filter((d) => !dayByDate.has(d))
  );
  const touched = [...new Set([...dayByDate.keys(), ...clearDates])].sort();
  const result: SaveDatedSchedulesResult = {
    employees: 0,
    written: 0,
    skipped: 0,
    cleared: 0,
  };
  if (!empIds.length || !touched.length) return result;

  const touchedSet = new Set(touched);
  const existing = (
    await findApprovedDetails(empIds, touched[0], touched[touched.length - 1])
  ).filter((d) => touchedSet.has(d.date));

  const existingByEmp = new Map<string, ApprovedDetail[]>();
  for (const d of existing) {
    const list = existingByEmp.get(d.empId) ?? [];
    list.push(d);
    existingByEmp.set(d.empId, list);
  }

  const approver = input.adminId.slice(0, 6);
  const now = new Date();
  const affectedSummaries = new Set<string>();

  for (const empId of empIds) {
    const mine = existingByEmp.get(empId) ?? [];
    const requestDates = new Set(
      mine.filter((d) => d.source === "request").map((d) => d.date)
    );
    const adminDetails = mine.filter((d) => d.source === "admin");
    const toWrite = [...dayByDate.values()]
      .filter((d) => !requestDates.has(d.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const clearedHere = adminDetails.filter((d) => clearDates.has(d.date));

    result.skipped += dayByDate.size - toWrite.length;
    if (!toWrite.length && !adminDetails.length) continue;

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (adminDetails.length) {
      ops.push(
        prisma.schedadjust_detail.deleteMany({
          where: { sca_did: { in: adminDetails.map((d) => d.detailId) } },
        })
      );
      adminDetails.forEach((d) => affectedSummaries.add(d.summaryId));
    }
    if (toWrite.length) {
      const summaryId = `SCA-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      ops.push(
        prisma.schedadjust_summary.create({
          data: {
            sca_sid: summaryId,
            sca_sctr: 1,
            sca_sdatefrom: toDbDate(toWrite[0].date),
            sca_sdateto: toDbDate(toWrite[toWrite.length - 1].date),
            sca_semp: empId,
            sca_sapplieddate: now,
            sca_sreason: MANAGE_SCHEDULES_REASON,
            sca_sstatus: 1,
            sca_sapprovedby: approver,
            sca_sapproveddate: now,
          },
        }),
        prisma.schedadjust_detail.createMany({
          data: toWrite.map((d, i) => buildDetailRow(summaryId, i + 1, d)),
        })
      );
    }
    await prisma.$transaction(ops);

    result.employees += 1;
    result.written += toWrite.length;
    result.cleared += clearedHere.length;
  }

  await tidySummaries([...affectedSummaries]);
  return result;
}

/**
 * Delete Manage Schedules summaries that no longer have any dates, and
 * refresh the date range of the ones that still do.
 */
async function tidySummaries(summaryIds: string[]) {
  if (!summaryIds.length) return;
  const remaining = await prisma.schedadjust_detail.groupBy({
    by: ["sca_dpk"],
    where: { sca_dpk: { in: summaryIds } },
    _min: { sca_ddate: true },
    _max: { sca_ddate: true },
  });
  const left = new Map(remaining.map((r) => [r.sca_dpk, r]));
  const empty = summaryIds.filter((id) => !left.has(id));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (empty.length) {
    ops.push(
      prisma.schedadjust_summary.deleteMany({
        where: {
          sca_sid: { in: empty },
          sca_sreason: MANAGE_SCHEDULES_REASON,
        },
      })
    );
  }
  for (const r of remaining) {
    if (!r.sca_dpk) continue;
    ops.push(
      prisma.schedadjust_summary.updateMany({
        where: { sca_sid: r.sca_dpk, sca_sreason: MANAGE_SCHEDULES_REASON },
        data: {
          sca_sdatefrom: r._min.sca_ddate,
          sca_sdateto: r._max.sca_ddate,
        },
      })
    );
  }
  if (ops.length) await prisma.$transaction(ops);
}
