import { prisma } from "@/lib/db/prisma";
import { formatTimeForDatabase } from "@/lib/utils/time";
import type { Prisma } from "../../src/generated/prisma/client";

const DAY_CODES: Record<string, string> = {
  MONDAY: "MN",
  TUESDAY: "TU",
  WEDNESDAY: "WD",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "ST",
  SUNDAY: "SN",
};

/**
 * Compute the schedule primary key: `{emp_id}{2-char day code}` (e.g. 000123MN).
 * Mirrors the legacy stored procedure insert_schedule.
 */
export function getSchId(sch_emp: string, sch_day: string): string {
  const code =
    DAY_CODES[sch_day.toUpperCase()] ?? sch_day.slice(0, 2).toUpperCase();
  return `${sch_emp}${code}`;
}

/**
 * Parse "HH:mm:ss" to a Date (time-only for Prisma TIME field).
 * Prisma expects Date; MySQL TIME is stored as 1970-01-01 + time in UTC.
 */
export function timeStringToDate(timeStr: string): Date {
  const [h, m, s] = timeStr.split(":").map(Number);
  const date = new Date(Date.UTC(1970, 0, 1, h ?? 0, m ?? 0, s ?? 0));
  return date;
}

export interface ScheduleForm {
  sch_day: string;
  sch_in: string;
  sch_out: string;
  sch_bin: string;
  sch_bout: string;
  sch_hrs: number;
  sch_rest: boolean;
  sch_shift: string;
  have_break: boolean;
  sch_emp: string;
}

/**
 * Build a `schedule` row payload from a ScheduleForm for a given employee.
 * Shared by the single-day, per-employee batch, and bulk-apply write paths so
 * the sch_id derivation and TIME conversion stay identical everywhere.
 */
function buildScheduleRow(
  schedule: ScheduleForm,
  empId: string
): Prisma.scheduleCreateManyInput {
  return {
    sch_id: getSchId(empId, schedule.sch_day),
    sch_day: schedule.sch_day,
    sch_in: timeStringToDate(formatTimeForDatabase(schedule.sch_in)),
    sch_out: timeStringToDate(formatTimeForDatabase(schedule.sch_out)),
    sch_bin: timeStringToDate(formatTimeForDatabase(schedule.sch_bin)),
    sch_bout: timeStringToDate(formatTimeForDatabase(schedule.sch_bout)),
    sch_hrs: schedule.sch_hrs,
    sch_rest: schedule.sch_rest ? 1 : 0,
    sch_shift: schedule.sch_shift,
    sch_emp: empId,
    sch_break: schedule.have_break ? 1 : 0,
  };
}

/**
 * Schedule service (Prisma-based).
 * Mirrors stored procedure insert_schedule exactly (reference: sql/stored_proc.sql).
 */
export async function insertSchedule(schedule: ScheduleForm) {
  const row = buildScheduleRow(schedule, schedule.sch_emp);
  // SP does INSERT only (no update), so we replace via delete + create.
  await prisma.schedule.deleteMany({ where: { sch_id: row.sch_id } });
  return prisma.schedule.create({ data: row });
}

export async function updateSchedule(schedule: ScheduleForm) {
  // SP has no update_schedule, so use insert (which replaces)
  return insertSchedule(schedule);
}

/**
 * Replace one employee's full weekly schedule in a single round-trip pair.
 *
 * Previously the PUT route looped `findFirst` + delete + create per day
 * (14+ sequential queries/employee). This does one `deleteMany({ sch_id IN })`
 * + one `createMany` inside a transaction, using the `idx_schedule_emp` /
 * PK indexes. Returns the number of day rows written.
 */
export async function saveEmployeeScheduleBatch(
  empId: string,
  days: ScheduleForm[]
): Promise<number> {
  if (!days.length) return 0;
  const rows = days.map((d) => buildScheduleRow(d, empId));
  const ids = rows.map((r) => r.sch_id);
  await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { sch_id: { in: ids } } }),
    prisma.schedule.createMany({ data: rows }),
  ]);
  return rows.length;
}

const BULK_CHUNK_SIZE = 200;

/**
 * Apply the same weekly schedule (`days`) to many employees at once.
 *
 * Employees are processed in chunks; each chunk is one
 * `deleteMany({ sch_id IN [...] })` + one `createMany([...])` inside a
 * transaction. This turns e.g. 1,000 employees × 7 days into a handful of
 * round-trips instead of thousands of sequential queries. Replaces each
 * target employee's full weekly template (insert-only semantics). Returns the
 * number of employees updated.
 */
export async function bulkApplySchedule(
  empIds: string[],
  days: ScheduleForm[]
): Promise<number> {
  const uniqueEmpIds = Array.from(new Set(empIds.filter(Boolean)));
  if (!uniqueEmpIds.length || !days.length) return 0;

  for (let i = 0; i < uniqueEmpIds.length; i += BULK_CHUNK_SIZE) {
    const chunk = uniqueEmpIds.slice(i, i + BULK_CHUNK_SIZE);
    const rows = chunk.flatMap((empId) =>
      days.map((d) => buildScheduleRow(d, empId))
    );
    const ids = rows.map((r) => r.sch_id);
    await prisma.$transaction([
      prisma.schedule.deleteMany({ where: { sch_id: { in: ids } } }),
      prisma.schedule.createMany({ data: rows }),
    ]);
  }

  return uniqueEmpIds.length;
}
