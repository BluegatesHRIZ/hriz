/**
 * Paid vs unpaid leave resolution.
 *
 * WHY THIS MODULE EXISTS (plan risk R7)
 * -------------------------------------
 * `attendance-recompute.ts` credits leave into `att_wrkhrsdec` WITHOUT looking
 * at whether the leave is paid:
 *
 *     att_wrkhrsdec = if(att_ltype='W', <full scheduled hours>,
 *                     if(att_ltype='H' and att_lhalf='A', <AM half>, ...))
 *
 * Nothing there references `leave_summary.lea_swithpay` / `lea_swithoutpay`.
 * So if payroll trusted `att_wrkhrsdec` alone, UNPAID LEAVE WOULD BE PAID.
 * This module is the single sanctioned exception to the "payroll reads
 * `attendance` only" rule — it goes back to `leave_summary` for the split.
 *
 * ALLOCATION RULE
 * ---------------
 * `leave_summary` stores the split as two application-level day COUNTS, not
 * per-date flags. Example (LEA-202501060000121, employee 000012):
 *
 *     lea_swithpay = 1, lea_swithoutpay = 3, with 4 `leave_detail` dates
 *
 * There is no column saying WHICH of the four days is the paid one. We consume
 * the paid budget in `lea_dctr` order — i.e. leave credits are used up
 * chronologically, the conventional reading. This is an assumption; it is
 * documented here and in the plan so it can be corrected if the client
 * disagrees, and it only matters when an application mixes paid and unpaid.
 *
 * NEGATIVE COUNTS (plan risk R8)
 * ------------------------------
 * Real rows exist with `lea_swithpay = -11, lea_swithoutpay = 13` against only
 * two detail dates (over-drawn credits recorded as a negative balance rather
 * than clamped). A negative budget is meaningless, and 13 unpaid days cannot
 * apply to a 2-day application. We clamp the paid budget into
 * [0, total leave fraction]: a negative becomes 0, i.e. the whole application
 * is treated as unpaid. That is the conservative direction — it never pays out
 * on the strength of corrupt data.
 */

/** `leave_detail.lea_dtype` — whole day or half day. */
export type LeaveDuration = "W" | "H";

/** One `leave_detail` row. */
export interface LeaveDate {
  /** `lea_ddate` as YYYY-MM-DD. */
  date: string;
  /** `lea_dctr` — the application's own ordering. */
  sequence: number;
  /** `lea_dtype`. */
  duration: LeaveDuration;
  /** `lea_dampm` — "A" | "P" | null. Blank strings occur in the data. */
  half: string | null;
}

/** One `leave_summary` row plus its details. */
export interface LeaveApplication {
  /** `lea_sid`. */
  id: string;
  /** `lea_semp`. */
  employee: string;
  /** `lea_stype`, e.g. "L1", "L2", "L10". */
  leaveType: string | null;
  /** `lea_sstatus` — only 1 (approved) is honoured. */
  status: number | null;
  /** `lea_swithpay`. May be negative in legacy rows. */
  withPayDays: number;
  /** `lea_swithoutpay`. */
  withoutPayDays: number;
  dates: LeaveDate[];
}

/** Resolved, per-date outcome. */
export interface ResolvedLeaveDay {
  date: string;
  /** 1 for a whole day, 0.5 for a half day. */
  fraction: number;
  paid: boolean;
  applicationId: string;
}

/** Approved status on `leave_summary`. */
export const LEAVE_APPROVED = 1;

/** A half day is worth half a day's pay. */
export function fractionFor(duration: LeaveDuration): number {
  return duration === "H" ? 0.5 : 1;
}

/**
 * Split one approved application's dates into paid and unpaid.
 *
 * Unapproved applications resolve to an empty list — they must not affect pay.
 */
export function resolveLeaveApplication(app: LeaveApplication): ResolvedLeaveDay[] {
  if (app.status !== LEAVE_APPROVED) return [];

  const ordered = [...app.dates].sort((a, b) => a.sequence - b.sequence);
  const totalFraction = ordered.reduce((sum, d) => sum + fractionFor(d.duration), 0);

  // Clamp the paid budget: negatives -> 0, and never more than the application
  // actually covers (see R8).
  const budget = Math.min(Math.max(app.withPayDays, 0), totalFraction);

  let remaining = budget;
  const out: ResolvedLeaveDay[] = [];
  for (const d of ordered) {
    const fraction = fractionFor(d.duration);
    // Tolerance guards against float drift when halves accumulate.
    const paid = remaining + 1e-9 >= fraction;
    if (paid) remaining -= fraction;
    out.push({ date: d.date, fraction, paid, applicationId: app.id });
  }
  return out;
}

/**
 * Collapse many applications into a per-date map of PAID leave fraction.
 *
 * Overlapping applications on one date are summed and capped at 1 — an
 * employee cannot be paid more than a full day of leave for a single date.
 * Unpaid leave is deliberately absent from this map: it falls through to the
 * absence calculation in `deductions.ts`, which is exactly the R7 fix.
 */
export function paidLeaveByDate(apps: LeaveApplication[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const app of apps) {
    for (const day of resolveLeaveApplication(app)) {
      if (!day.paid) continue;
      const next = (map.get(day.date) ?? 0) + day.fraction;
      map.set(day.date, Math.min(next, 1));
    }
  }
  return map;
}

/** Same as `paidLeaveByDate` but for unpaid days — useful for payslip display. */
export function unpaidLeaveByDate(apps: LeaveApplication[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const app of apps) {
    for (const day of resolveLeaveApplication(app)) {
      if (day.paid) continue;
      const next = (map.get(day.date) ?? 0) + day.fraction;
      map.set(day.date, Math.min(next, 1));
    }
  }
  return map;
}
