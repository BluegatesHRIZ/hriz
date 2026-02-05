import { prisma } from "@/lib/db/prisma";
import { formatTimeForDatabase } from "@/lib/utils/time";

const DAY_CODES: Record<string, string> = {
  MONDAY: "MN",
  TUESDAY: "TU",
  WEDNESDAY: "WD",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "ST",
  SUNDAY: "SN",
};

function getSchId(sch_emp: string, sch_day: string): string {
  const code =
    DAY_CODES[sch_day.toUpperCase()] ?? sch_day.slice(0, 2).toUpperCase();
  return `${sch_emp}${code}`;
}

/**
 * Parse "HH:mm:ss" to a Date (time-only for Prisma TIME field).
 * Prisma expects Date; MySQL TIME is stored as 1970-01-01 + time in UTC.
 */
function timeStringToDate(timeStr: string): Date {
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
 * Schedule service (Prisma-based).
 * Mirrors stored procedure insert_schedule exactly (reference: sql/stored_proc.sql).
 */
export async function insertSchedule(schedule: ScheduleForm) {
  // Mirrors stored procedure: generate sch_id based on day name
  const dayUpper = schedule.sch_day.toUpperCase();
  let sch_id: string;
  if (dayUpper === "MONDAY") sch_id = `${schedule.sch_emp}MN`;
  else if (dayUpper === "TUESDAY") sch_id = `${schedule.sch_emp}TU`;
  else if (dayUpper === "WEDNESDAY") sch_id = `${schedule.sch_emp}WD`;
  else if (dayUpper === "THURSDAY") sch_id = `${schedule.sch_emp}TH`;
  else if (dayUpper === "FRIDAY") sch_id = `${schedule.sch_emp}FR`;
  else if (dayUpper === "SATURDAY") sch_id = `${schedule.sch_emp}ST`;
  else if (dayUpper === "SUNDAY") sch_id = `${schedule.sch_emp}SN`;
  else sch_id = getSchId(schedule.sch_emp, schedule.sch_day);

  // SP does INSERT only (no update), so we use create with skipDuplicates or delete+create
  await prisma.schedule.deleteMany({ where: { sch_id } });
  return prisma.schedule.create({
    data: {
      sch_id,
      sch_day: schedule.sch_day,
      sch_in: timeStringToDate(formatTimeForDatabase(schedule.sch_in)),
      sch_out: timeStringToDate(formatTimeForDatabase(schedule.sch_out)),
      sch_bin: timeStringToDate(formatTimeForDatabase(schedule.sch_bin)),
      sch_bout: timeStringToDate(formatTimeForDatabase(schedule.sch_bout)),
      sch_hrs: schedule.sch_hrs,
      sch_rest: schedule.sch_rest ? 1 : 0,
      sch_shift: schedule.sch_shift,
      sch_emp: schedule.sch_emp,
      sch_break: schedule.have_break ? 1 : 0,
    },
  });
}

export async function updateSchedule(schedule: ScheduleForm) {
  // SP has no update_schedule, so use insert (which replaces)
  return insertSchedule(schedule);
}
