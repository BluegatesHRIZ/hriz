/**
 * Dated schedules set from Manage Schedules.
 *
 * Each dated entry is stored as an approved schedule change
 * (`schedadjust_summary` + `schedadjust_detail`), which the attendance
 * recompute already applies on top of the weekly schedule for that date.
 */

/** One date's schedule as the editor and API exchange it. Times are HH:mm. */
export interface DatedScheduleDay {
  /** YYYY-MM-DD */
  date: string;
  sch_in: string;
  sch_out: string;
  sch_bin: string;
  sch_bout: string;
  sch_rest: boolean;
  /** R regular, N night, F flexible, E exempted */
  sch_shift: string;
  have_break: boolean;
}

/**
 * Where a dated entry came from: set by an admin in Manage Schedules, or an
 * employee's own approved schedule change request (read-only here).
 */
export type DatedScheduleSource = "admin" | "request";

export interface DatedScheduleEntry extends DatedScheduleDay {
  source: DatedScheduleSource;
}

/** One day of the employee's recurring weekly schedule (`schedule` table). */
export interface WeeklyScheduleDay extends Omit<DatedScheduleDay, "date"> {
  /** Uppercase weekday, e.g. "MONDAY". */
  sch_day: string;
}

/** One row of GET /api/schedules: an employee and their dated entries in the range. */
export interface EmployeeDatedScheduleRow {
  emp_id: string;
  emp_name: string;
  emp_dept: string | null;
  emp_dept_desc: string | null;
  emp_loc: string | null;
  emp_loc_desc: string | null;
  /** Only dates that have an entry, sorted by date. */
  days: DatedScheduleEntry[];
  /** Weekly schedule, used for attendance on dates with no entry. */
  weekly: WeeklyScheduleDay[];
}

/** Body of POST /api/schedules/bulk-apply: the same dates for many employees. */
export interface DatedScheduleBulkRequest {
  empIds: string[];
  days: DatedScheduleDay[];
}

/** One employee's changed dates in a grid save. */
export interface DatedScheduleGridEmployee {
  empId: string;
  days: DatedScheduleDay[];
  /** Dates whose Manage Schedules entry should be removed. */
  clearDates: string[];
}

/** Body of PUT /api/schedules/grid: the changed cells, grouped by employee. */
export interface DatedScheduleGridRequest {
  employees: DatedScheduleGridEmployee[];
}

export interface DatedScheduleSaveResponse {
  message: string;
  /** Employees that had at least one date written or cleared. */
  employees: number;
  /** Employee-date entries written. */
  written: number;
  /** Employee-date entries skipped because an approved employee request covers them. */
  skipped: number;
  /** Employee-date entries removed. */
  cleared: number;
}
