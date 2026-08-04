/**
 * Rate derivation — turns an `empsalary` amount into the daily / hourly /
 * per-minute rates every deduction is priced against.
 *
 * The chain mirrors the client's `sample pay.xlsx` (`Sheet1`) exactly:
 *
 *     semi -> monthly -> annual -> day -> hour -> minute
 *
 * The divisor is `settings_tab.set_yrdays`, which is 313 on the live DB
 * (365 - 52 Sundays = a 6-day workweek). It is passed in, never hardcoded.
 *
 * The spreadsheet floated three candidates (annual/313, semi/13, monthly/26).
 * Those collapse to a single question — does a work-year have 313 or 312 days?
 * (26/month x 12 = 312/year). Production already answered it: verified against
 * posted payslip PR052025104 / employee 000010 (monthly 16,515):
 *
 *     198,180 / 313                      = 633.16293929712 per day
 *     1,187.1805111821086 / 633.16293929712 = 1.875 days exactly
 *
 * 312, 314, 365 and 26 all miss. See `scripts/payroll-parity.ts`.
 *
 * NOTE: these functions return full float precision on purpose. Rounding
 * happens once, at persist time — never mid-ladder — otherwise parity against
 * the stored `pay_details` values drifts by centavos.
 */

import type { PayrollType, RateLadder } from "./types";

/** Standard working hours in a day. `settings_tab` has no column for this. */
export const DEFAULT_HOURS_PER_DAY = 8;

/** Semi-monthly cutoffs per year — 2 per month. */
const CUTOFFS_PER_YEAR = 24;
const MONTHS_PER_YEAR = 12;

/**
 * Annualise an `empsalary.emp_salamt` according to its payroll type.
 *
 * For "D" the stored amount is already a daily rate, so multiplying by the
 * factor here and dividing by it again in `deriveRates` is an intentional
 * round-trip: it keeps a single code path for all three types and yields the
 * stated daily rate back unchanged.
 */
export function annualise(
  amount: number,
  type: PayrollType,
  factor: number,
): number {
  switch (type) {
    case "D":
      return amount * factor;
    case "S":
      return amount * CUTOFFS_PER_YEAR;
    case "M":
      return amount * MONTHS_PER_YEAR;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown emp_salpayrolltype: ${String(exhaustive)}`);
    }
  }
}

/**
 * Build the full rate ladder for one employee.
 *
 * @param amount      `empsalary.emp_salamt`
 * @param type        `empsalary.emp_salpayrolltype` ("D" | "S" | "M")
 * @param factor      `settings_tab.set_yrdays` (313 live)
 * @param hoursPerDay defaults to 8
 */
export function deriveRates(
  amount: number,
  type: PayrollType,
  factor: number,
  hoursPerDay: number = DEFAULT_HOURS_PER_DAY,
): RateLadder {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error(`Invalid year-days factor (settings_tab.set_yrdays): ${factor}`);
  }
  if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
    throw new Error(`Invalid hoursPerDay: ${hoursPerDay}`);
  }

  const annual = annualise(amount, type, factor);
  const daily = annual / factor;
  const hourly = daily / hoursPerDay;

  return {
    factor,
    hoursPerDay,
    annual,
    monthly: annual / MONTHS_PER_YEAR,
    daily,
    hourly,
    minute: hourly / 60,
  };
}

/**
 * The salary actually paid in one cutoff, before any deduction.
 *
 * Semi-monthly is the only cadence in the 47 posted runs; "M" employees are
 * still paid across two cutoffs, so their basic is half the monthly amount.
 * "D" employees have no fixed basic — their pay is built from days present, so
 * this returns 0 and `deductions.ts` drives the amount instead.
 */
export function basicForCutoff(amount: number, type: PayrollType): number {
  switch (type) {
    case "D":
      return 0;
    case "S":
      return amount;
    case "M":
      return amount / 2;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown emp_salpayrolltype: ${String(exhaustive)}`);
    }
  }
}

/**
 * The basis SSS / PhilHealth / Pag-IBIG brackets are looked up against.
 *
 * Verified against posted runs: employee 000008 (semi 15,000 -> monthly 30,000)
 * matched `gss_tee` 1,500 / `gss_ter` 3,030, and employee 000010 (monthly
 * 16,515) matched `gss_tee` 825 / `gss_ter` 1,680. Both are MONTHLY figures
 * deducted in full within a single cutoff.
 */
export function statutoryBasis(rates: RateLadder): number {
  return rates.monthly;
}
