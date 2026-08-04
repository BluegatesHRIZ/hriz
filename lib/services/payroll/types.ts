/**
 * Shared types for the payroll engine.
 *
 * Every module under `lib/services/payroll/` except `repository.ts` / `post.ts`
 * is PURE — no Prisma, no DB, no I/O. That is deliberate:
 *
 *   - Next.js routes load rows with Prisma and call the pure functions.
 *   - `scripts/payroll-parity.ts` loads the same rows with the `mariadb` driver
 *     (Prisma 7's wasm query compiler will not load under `tsx`) and calls the
 *     exact same pure functions.
 *
 * Both paths therefore exercise identical arithmetic, which is what makes the
 * parity harness meaningful.
 */

/** `empsalary.emp_salpayrolltype` — Daily / Semi-monthly / Monthly. */
export type PayrollType = "D" | "S" | "M";

/**
 * The rate ladder, mirroring the client's own spreadsheet chain:
 *   semi -> monthly -> annual -> day -> hour -> minute
 *
 * `factor` is `settings_tab.set_yrdays` (313 on the live DB = 365 - 52 Sundays,
 * i.e. a 6-day workweek). It is read from settings, never hardcoded.
 */
export interface RateLadder {
  factor: number;
  hoursPerDay: number;
  annual: number;
  monthly: number;
  daily: number;
  hourly: number;
  minute: number;
}

/**
 * One `comded` row — the configuration for a pay component.
 *
 * `cd_tax` is the authority on what enters taxable income. It is set on
 * deductions as well as credits, and the pattern shows it means "does this line
 * PARTICIPATE in taxable income" rather than "is this an earning":
 *
 *   cd_tax = 1  Salary, Overtime, Allowance, De Minimis,
 *               Absent, Late, Undertime, SSS, PHIC, HDMF
 *   cd_tax = 0  Reimbursement, Commission, COLA, Telco Allowance,
 *               Coop, Charge, Personal Loan
 *
 * Loan repayments do not reduce taxable pay; absences and statutory
 * contributions do. That is a coherent rule and it is actively maintained —
 * COLA and Telco Allowance were deliberately marked exempt.
 *
 * `cd_slip` separates real payslip lines ('1') from the `CD11xx`/`CD12xx`/
 * `CD13xx`/`CD10xx` audit-snapshot rows ('0'), which carry bracket values
 * rather than money and must never be summed.
 */
export interface ComponentRule {
  code: string;
  /** `cd_type` — "C" credit, "D" deduction. */
  type: "C" | "D";
  /** `cd_tax === 1`. */
  taxable: boolean;
  /** `cd_slip === "1"` — a real payslip line, not an audit snapshot. */
  onSlip: boolean;
  description: string | null;
}

/** `comded` keyed by `cd_code`. */
export type ComponentRules = Map<string, ComponentRule>;

/** One `comded` component as it will be written to `pay_amounts`. */
export interface PayComponent {
  /** `comded.cd_code`, e.g. "CD1" (Salary), "CD7" (Absent). */
  code: string;
  /** "C" = credit/earning, "D" = deduction. Mirrors `comded.cd_type`. */
  type: "C" | "D";
  /** Employee-side amount -> `pay_amounts.pya_amt`. */
  amount: number;
  /** Employer-side amount -> `pay_amounts.pya_eramt` (statutory ER shares). */
  employerAmount?: number;
  /** `comded.cd_tax` — whether the component enters taxable income. */
  taxable: boolean;
  /** Optional free-text -> `pay_amounts.pya_desc`. */
  description?: string;
  /** True for keyed-in adjustments -> `pay_amounts.pya_adj = 1`. */
  isAdjustment?: boolean;
}
