/**
 * Time-based deductions: absence (CD7), late (CD8) and undertime (CD9).
 *
 * All inputs come from `attendance`, which `recomputeAttendance(from, to)` has
 * already overlaid with the five APPROVED request types (COA, overtime,
 * undertime, leave, schedule adjustment). This module must therefore never
 * re-join `coa_*` / `overtime` / `undertime` / `schedadjust_*` — doing so would
 * double-count. Leave is the one exception, handled in `leave.ts` (risk R7).
 *
 * Quantities are kept separate from pesos on purpose: the parity harness
 * inverts stored amounts back into days/minutes to check the rate ladder, and
 * that only works if the two stages are distinct.
 *
 * Verified against posted runs — every stored CD7/CD9 amount divides back into
 * an exact quantity: 3.5, 7.0, 10.0, 20.0 and 8.0 absent days, and 148.00
 * undertime minutes. See `scripts/payroll-parity.ts`.
 */

import type { PayComponent, RateLadder } from "./types";

/**
 * One row of `attendance`, already recomputed.
 *
 * TIME columns are converted to whole minutes by the caller
 * (`HOUR(x) * 60 + MINUTE(x)`) rather than to float hours — float hours are
 * what produce the `7.999999999941792` drift visible in the client's
 * spreadsheet, and we do not want to reproduce it.
 */
export interface AttendanceDay {
  /** `att_date` as YYYY-MM-DD. */
  date: string;
  /** True when the employee had a shift — `att_schin` and `att_schout` set. */
  scheduled: boolean;
  /** `att_restday = '1'`. */
  restDay: boolean;
  /** `att_holiday`: "N", "Y1" (legal), "Y2" (special). */
  holiday: string;
  /** Both `att_fin` and `att_fout` present, i.e. the employee actually worked. */
  hasPunch: boolean;
  /** `att_late` in whole minutes (already net of `set_graceperiod`). */
  lateMinutes: number;
  /** `att_undertime` in whole minutes. */
  undertimeMinutes: number;
}

/** Raw quantities, before pricing. */
export interface DeductionQuantities {
  absentDays: number;
  lateMinutes: number;
  undertimeMinutes: number;
  /** Paid leave days that offset what would otherwise be absence. */
  paidLeaveDays: number;
  /**
   * Scheduled working days covered by work or paid leave — what a daily-paid
   * ("D") employee's basic is built from.
   */
  paidDays: number;
}

/**
 * Work out how much of each scheduled day went unworked and unpaid.
 *
 * A day is absent when it was scheduled, was not a rest day, was not worked,
 * and is not covered by PAID leave. Unpaid leave deliberately falls through to
 * absence — that is the R7 fix.
 *
 * Rest days, unscheduled days and unworked holidays are never absences. An
 * unworked regular holiday still counts toward `paidDays` (daily-paid staff
 * are paid for it); worked holidays' premiums are priced by `premiums.ts`.
 *
 * @param days            attendance rows for the cutoff
 * @param paidLeave       date -> paid leave fraction, from `leave.ts`
 */
export function quantifyDeductions(
  days: AttendanceDay[],
  paidLeave: Map<string, number> = new Map(),
): DeductionQuantities {
  let absentDays = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let paidLeaveDays = 0;
  let paidDays = 0;

  for (const day of days) {
    const leaveFraction = Math.min(paidLeave.get(day.date) ?? 0, 1);
    if (leaveFraction > 0) paidLeaveDays += leaveFraction;

    // Lates and undertime only exist on days actually worked.
    if (day.hasPunch) {
      lateMinutes += Math.max(0, day.lateMinutes);
      undertimeMinutes += Math.max(0, day.undertimeMinutes);
    }

    if (!day.scheduled || day.restDay) continue;

    // A holiday is never an absence. Unworked, a regular holiday (Y1) is still
    // a paid day; a special holiday (Y2) is "no work, no pay". Worked holidays
    // count as worked below, with the premium priced by `premiums.ts`.
    if (day.holiday !== "N" && !day.hasPunch) {
      if (day.holiday === "Y1") paidDays += 1;
      continue;
    }

    const workedFraction = day.hasPunch ? 1 : 0;
    const covered = Math.min(1, workedFraction + leaveFraction);
    paidDays += covered;
    absentDays += Math.max(0, 1 - covered);
  }

  return { absentDays, lateMinutes, undertimeMinutes, paidLeaveDays, paidDays };
}

/** `comded` codes for the three time-based deductions. */
export const CD_ABSENT = "CD7";
export const CD_LATE = "CD8";
export const CD_UNDERTIME = "CD9";

// ------------------------------------------------- advances / loans --------

/**
 * An `empadvance` row — a company loan or cash advance being amortised.
 *
 * The live example is a 10,000 "Company Loan" with `emp_adaddedamt` 300
 * (interest/fees), repaid at `emp_adamtperpay` 500 across
 * `emp_adpaypermonth` 2 cutoffs a month.
 */
export interface Advance {
  /** `emp_adid`. */
  id: string;
  /** `emp_adtype`, e.g. "Company Loan". */
  type: string | null;
  /** `emp_adamt` — the principal. */
  principal: number;
  /** `emp_adaddedamt` — interest or fees added on top. */
  addedAmount: number;
  /** `emp_adamtperpay` — the instalment. */
  perPay: number;
  /** `emp_adpaypermonth` — 1 or 2 cutoffs per month. */
  paysPerMonth: number | null;
  /** `emp_adpaycutoff` — which cutoff, when only one a month. */
  cutoff: number | null;
  /** `emp_adstart` / `emp_adend` as YYYY-MM-DD. */
  start: string | null;
  end: string | null;
  /** `emp_adpaid` — cumulative amount already recovered. */
  paid: number;
  /** `emp_adstatus` — only 1 is active. */
  status: number | null;
}

/** One instalment taken in this run — becomes a `pay_loan` row. */
export interface AdvanceDeduction {
  advanceId: string;
  type: string | null;
  /** `pyl_amt`. */
  amount: number;
  /** `pyl_bal` — what was outstanding before this instalment. */
  balanceBefore: number;
  balanceAfter: number;
}

/** Active status on `empadvance`. */
export const ADVANCE_ACTIVE = 1;

/**
 * Work out this cutoff's instalment for every running advance.
 *
 * An advance is collected when it is active, has started on or before the
 * period end, has not already ended, and still has a balance. The final
 * instalment is trimmed to whatever is left, so an advance can never
 * over-collect.
 *
 * When `paysPerMonth` is 1 the advance is only collected on the cutoff named by
 * `emp_adpaycutoff`; a null cutoff means "either", so it is taken on the first
 * one presented.
 */
export function amortiseAdvances(
  advances: Advance[],
  period: { start: string; end: string; cutoff?: number | null },
): AdvanceDeduction[] {
  const out: AdvanceDeduction[] = [];

  for (const a of advances) {
    if (a.status !== ADVANCE_ACTIVE) continue;
    if (a.start && a.start > period.end) continue;
    if (a.end && a.end < period.start) continue;

    // Once-a-month advances only fire on their nominated cutoff.
    if (a.paysPerMonth === 1 && a.cutoff != null && period.cutoff != null) {
      if (a.cutoff !== period.cutoff) continue;
    }

    const total = a.principal + a.addedAmount;
    const balanceBefore = total - a.paid;
    if (balanceBefore <= 0) continue;

    const amount = Math.min(a.perPay, balanceBefore);
    if (amount <= 0) continue;

    out.push({
      advanceId: a.id,
      type: a.type,
      amount,
      balanceBefore,
      balanceAfter: balanceBefore - amount,
    });
  }

  return out;
}

/** Total to write to `pay_details.pyd_tloan`. */
export function totalAdvances(deductions: AdvanceDeduction[]): number {
  return deductions.reduce((sum, d) => sum + d.amount, 0);
}

// ------------------------------------------------------- adjustments -------

/**
 * A one-off credit or deduction keyed in against a single payslip.
 *
 * Stored as a `pay_amounts` row with `pya_adj = 1`. The `pay_adjust` table
 * exists in the schema but the legacy app never wrote to it.
 */
export interface Adjustment {
  /** `pya_ctr`. */
  counter: number;
  /** `pya_def` — the `comded` code the adjustment is posted against. */
  code: string;
  /** `pya_cd` — "C" credit or "D" deduction. */
  type: string | null;
  /** `pya_desc`. */
  description: string | null;
  /** `pya_amt`. */
  amount: number;
  /** `pya_tax` — 1 when the adjustment enters taxable income. */
  taxable: number | null;
}

/** `comded` codes for the ad-hoc components adjustments are posted against. */
export const CD_ALLOWANCE = "CD3";
export const CD_DE_MINIMIS = "CD4";

/**
 * Turn adjustments into payslip components.
 *
 * Each adjustment already names the `comded` code it is posted against, so it
 * is preserved verbatim rather than being forced onto a default component.
 */
export function adjustmentComponents(adjustments: Adjustment[]): PayComponent[] {
  return adjustments
    .filter((a) => a.amount !== 0)
    .map((a) => {
      const isCredit = (a.type ?? "C").toUpperCase() === "C";
      return {
        code: a.code || (isCredit ? CD_ALLOWANCE : "CD15"),
        type: isCredit ? ("C" as const) : ("D" as const),
        amount: Math.abs(a.amount),
        taxable: a.taxable === 1,
        description: a.description ?? undefined,
        isAdjustment: true,
      };
    });
}

/** Net effect of adjustments on gross pay: credits positive, deductions negative. */
export function netAdjustments(adjustments: Adjustment[]): {
  credits: number;
  deductions: number;
} {
  let credits = 0;
  let deductions = 0;
  for (const a of adjustments) {
    if (a.amount === 0) continue;
    if ((a.type ?? "C").toUpperCase() === "C") credits += Math.abs(a.amount);
    else deductions += Math.abs(a.amount);
  }
  return { credits, deductions };
}

/**
 * Price the quantities using the rate ladder.
 *
 * Full float precision is preserved — rounding happens once, at persist. The
 * legacy engine stored unrounded values (e.g. 1187.1805111821086), so rounding
 * here would break parity.
 *
 * Zero-valued components are still emitted so a payslip has a stable shape.
 */
export function priceDeductions(
  q: DeductionQuantities,
  rates: RateLadder,
): PayComponent[] {
  return [
    {
      code: CD_ABSENT,
      type: "D",
      amount: q.absentDays * rates.daily,
      taxable: true,
      description: `${q.absentDays} day(s)`,
    },
    {
      code: CD_LATE,
      type: "D",
      amount: q.lateMinutes * rates.minute,
      taxable: true,
      description: `${q.lateMinutes} minute(s)`,
    },
    {
      code: CD_UNDERTIME,
      type: "D",
      amount: q.undertimeMinutes * rates.minute,
      taxable: true,
      description: `${q.undertimeMinutes} minute(s)`,
    },
  ];
}
