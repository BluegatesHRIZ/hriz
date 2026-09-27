/**
 * The payroll orchestrator — turns one employee's period data into a complete
 * payslip (a `pay_details` row plus its `pay_amounts` lines).
 *
 * Pure, like the rest of the engine: everything it needs is passed in, so the
 * same code runs under Next.js (Prisma) and under `scripts/payroll-parity.ts`
 * (mariadb).
 *
 * ORDER OF OPERATIONS — this sequence is load-bearing and was derived from
 * posted payroll, not chosen for convenience:
 *
 *   1. basic          from empsalary + payroll type
 *   2. time deductions absent / late / undertime, with PAID leave offsetting
 *                      absence and UNPAID leave falling through to it (R7)
 *   3. premiums        the 31 attendance buckets x otrates
 *   4. statutory       SSS / PhilHealth / Pag-IBIG on the MONTHLY figure
 *   5. obligations     advances/loans, then adjustments
 *   6. components      every payslip line, each flagged from `comded.cd_tax`
 *   7. tax             base = taxable credits - taxable deductions
 *   8. net             gross - every deduction
 *
 * Components are built BEFORE tax because the base is derived from them.
 *
 * The base follows `comded.cd_tax`: taxable credits minus taxable deductions,
 * excluding the audit-snapshot rows (`cd_slip = '0'`) and CD10 Tax itself.
 * This DIVERGES from the legacy engine, which ignored `cd_tax` and taxed
 * `basic - statutory` flat — a deliberate, explicitly chosen change worth a few
 * pesos per payslip. Omitting `componentRules` restores the legacy rule, which
 * is how `scripts/payroll-parity.ts` still reproduces historical payroll.
 */

import type {
  PayComponent,
  PayrollType,
  RateLadder,
  ComponentRules,
} from "./types";
import { deriveRates, basicForCutoff, statutoryBasis } from "./rates";
import {
  quantifyDeductions,
  priceDeductions,
  amortiseAdvances,
  totalAdvances,
  adjustmentComponents,
  netAdjustments,
  type AttendanceDay,
  type Advance,
  type AdvanceDeduction,
  type Adjustment,
  type DeductionQuantities,
} from "./deductions";
import { paidLeaveByDate, type LeaveApplication } from "./leave";
import {
  accumulateBuckets,
  pricePremiums,
  premiumComponent,
  type OvertimeRates,
  type PremiumBucket,
  type PremiumResult,
} from "./premiums";
import {
  computeSss,
  computePhilhealth,
  computePagibig,
  computeTax,
  taxableIncome,
  taxableFromComponents,
  selectSssTable,
  findSssBracket,
  sssSnapshot,
  contributionSnapshot,
  findBracket,
  CD_TAX,
  CD_SSS,
  CD_PHIC,
  CD_HDMF,
  CD_TAX_RATE,
  CD_TAX_AMOUNT,
  type SssBracket,
  type PhilhealthBracket,
  type PagibigBracket,
  type TaxBracket,
  type TaxFrequency,
  type ContributionMode,
} from "./statutory";

/** `comded` code for basic salary. */
export const CD_SALARY = "CD1";
/** `comded` code for de minimis benefits. */
export const CD_DE_MINIMIS = "CD4";
/** `comded` code for allowances. */
export const CD_ALLOWANCE = "CD3";

/** Everything one payslip needs. */
export interface ComputeInput {
  employee: string;

  /** The run being computed. */
  period: {
    /** `pyh_from` / `pyh_to` as YYYY-MM-DD. */
    start: string;
    end: string;
    /** `pyh_per` — 1 or 2. */
    cutoff?: number | null;
    /** Which `govttax` schedule applies; follows the RUN's cadence. */
    taxFrequency?: TaxFrequency;
    /**
     * Per-contribution mode from `pay_header` — the legacy Run Payroll dialog
     * offers Full / Half / None ('2' / '1' / '0'), not a simple on/off. "half"
     * splits the monthly contribution across the month's two cutoffs.
     */
    sssMode?: ContributionMode;
    philhealthMode?: ContributionMode;
    pagibigMode?: ContributionMode;
    /** Tax is With/Without only — the legacy dialog offers no half. */
    applyTax?: boolean;
    applyLoans?: boolean;
    /**
     * Whether premiums and allowances enter taxable income.
     *
     * Defaults to FALSE to reproduce the legacy engine, which taxed basic only:
     * employee 000008 received a 1,500 allowance on posted run PR052025104 and
     * was still taxed on 12,550, giving the stored 319.95. Including it yields
     * 544.95 and breaks parity.
     *
     * That is verified for ALLOWANCES. No posted run contains bucket-derived
     * premium pay, so whether overtime was likewise excluded is UNKNOWN —
     * excluding taxable overtime would under-withhold. Surfaced as a flag so
     * the client can switch it on deliberately rather than have the engine
     * quietly pick a side.
     */
    includeEarningsInTax?: boolean;
    /**
     * Whether absences/lates/undertime reduce the withholding base.
     *
     * Defaults to FALSE: the legacy engine taxed on basic minus statutory
     * regardless of deductions. Verified on PR022026201, where employee 000009
     * had 34,742.09 deducted and was still taxed the full 256.20.
     *
     * Arguably wrong — it over-withholds from anyone who was absent — so it is
     * a deliberate switch rather than a silent choice.
     */
    deductTimeFromTax?: boolean;
  };

  /** From `empsalary`, effective for the period. */
  salary: {
    amount: number;
    type: PayrollType;
    /** `emp_saldeminis`. */
    deMinimis?: number;
    /** `emp_salallow`. */
    allowance?: number;
  };

  /** `settings_tab.set_yrdays`. */
  yearDays: number;

  /** Recomputed `attendance` rows for the period. */
  attendance: AttendanceDay[];

  /** Per-day premium bucket values, straight from `attendance` TIME columns. */
  premiumDays?: Array<Partial<Record<PremiumBucket, string | Date | number | null>>>;

  /** Approved `leave_summary` + `leave_detail` for the period. */
  leave?: LeaveApplication[];

  /** The `otrates` row in force, e.g. OT1. */
  overtimeRates?: OvertimeRates;

  /** Statutory schedules, unfiltered. */
  brackets: {
    sss: SssBracket[];
    philhealth: PhilhealthBracket[];
    pagibig: PagibigBracket[];
    tax: TaxBracket[];
  };

  /** Running `empadvance` rows. */
  advances?: Advance[];

  /** `pay_adjust` rows for this payslip. */
  adjustments?: Adjustment[];

  /**
   * `comded` keyed by code — the authority on what enters taxable income.
   *
   * When supplied, the tax base follows `cd_tax`. When omitted, the engine
   * falls back to the legacy rule (basic minus statutory) so the parity
   * harness can still reproduce historical payroll.
   */
  componentRules?: ComponentRules;
}

/** A complete payslip. */
export interface ComputeResult {
  employee: string;
  rates: RateLadder;

  /** Maps to `pay_details`. */
  basic: number;
  grossEarnings: number;
  timeDeductions: number;
  statutoryEmployee: number;
  statutoryEmployer: number;
  tax: number;
  loans: number;
  adjustmentCredits: number;
  adjustmentDeductions: number;
  totalDeductions: number;
  net: number;

  /** Detail for the payslip and for auditing. */
  quantities: DeductionQuantities;
  premiums: PremiumResult;
  advanceDeductions: AdvanceDeduction[];
  taxableIncome: number;

  /** Maps to `pay_amounts`. */
  components: PayComponent[];
}

/**
 * Compute one payslip.
 *
 * Nothing is rounded here. The legacy engine stored unrounded floats
 * (`1187.1805111821086`), so rounding before persist would break parity;
 * `post.ts` is responsible for any presentation rounding.
 */
export function computePayslip(input: ComputeInput): ComputeResult {
  const {
    employee,
    period,
    salary,
    yearDays,
    attendance,
    premiumDays = [],
    leave = [],
    overtimeRates = {},
    brackets,
    advances = [],
    adjustments = [],
    componentRules,
  } = input;

  const rates = deriveRates(salary.amount, salary.type, yearDays);

  // --- 2. time deductions, with paid leave offsetting absence --------------
  const paidLeave = paidLeaveByDate(leave);
  const quantities = quantifyDeductions(attendance, paidLeave);

  // Daily-paid staff have no fixed basic: they are paid for the days they
  // covered. An absent day is therefore already unpaid, so it is not also
  // charged as CD7 — that would take the same day twice.
  const isDaily = salary.type === "D";
  const basic = isDaily
    ? quantities.paidDays * rates.daily
    : basicForCutoff(salary.amount, salary.type);
  const timeComponents = priceDeductions(
    isDaily ? { ...quantities, absentDays: 0 } : quantities,
    rates,
  );
  const timeDeductions = timeComponents.reduce((s, c) => s + c.amount, 0);

  // --- 3. premiums ---------------------------------------------------------
  const premiums = pricePremiums(
    accumulateBuckets(premiumDays),
    overtimeRates,
    rates,
  );

  // --- 4. statutory --------------------------------------------------------
  const monthly = statutoryBasis(rates);
  const sssTable = selectSssTable(brackets.sss, new Date(period.end));

  const sss = computeSss(monthly, sssTable, period.sssMode ?? "full");
  const phic = computePhilhealth(monthly, brackets.philhealth, period.philhealthMode ?? "full");
  const hdmf = computePagibig(monthly, brackets.pagibig, period.pagibigMode ?? "full");

  const statutoryEmployee = sss.employee + phic.employee + hdmf.employee;
  const statutoryEmployer = sss.employer + phic.employer + hdmf.employer;

  // --- 5. obligations ------------------------------------------------------
  const advanceDeductions = period.applyLoans === false
    ? []
    : amortiseAdvances(advances, {
        start: period.start,
        end: period.end,
        cutoff: period.cutoff,
      });
  const loans = totalAdvances(advanceDeductions);
  const { credits: adjustmentCredits, deductions: adjustmentDeductions } =
    netAdjustments(adjustments);

  // --- 6. components -------------------------------------------------------
  // Built BEFORE tax, because the tax base is derived from them via
  // `comded.cd_tax`. Each line's `taxable` flag comes from the config rather
  // than being hardcoded, so the payslip reflects what `comded` actually says.
  const allowance = salary.allowance ?? 0;
  const deMinimis = salary.deMinimis ?? 0;
  const isTaxable = (code: string, fallback = true) =>
    componentRules?.get(code)?.taxable ?? fallback;

  const components: PayComponent[] = [
    { code: CD_SALARY, type: "C", amount: basic, taxable: isTaxable(CD_SALARY) },
  ];
  if (allowance) {
    components.push({
      code: CD_ALLOWANCE, type: "C", amount: allowance, taxable: isTaxable(CD_ALLOWANCE),
    });
  }
  if (deMinimis) {
    components.push({
      code: CD_DE_MINIMIS, type: "C", amount: deMinimis, taxable: isTaxable(CD_DE_MINIMIS),
    });
  }
  if (premiums.totalAmount) {
    const c = premiumComponent(premiums);
    components.push({ ...c, taxable: isTaxable(c.code) });
  }
  components.push(...timeComponents.map((c) => ({ ...c, taxable: isTaxable(c.code) })));

  if (statutoryEmployee || statutoryEmployer) {
    components.push(
      { code: CD_SSS, type: "D", amount: sss.employee, employerAmount: sss.employer, taxable: isTaxable(CD_SSS) },
      { code: CD_PHIC, type: "D", amount: phic.employee, employerAmount: phic.employer, taxable: isTaxable(CD_PHIC) },
      { code: CD_HDMF, type: "D", amount: hdmf.employee, employerAmount: hdmf.employer, taxable: isTaxable(CD_HDMF) },
    );
  }
  components.push(...adjustmentComponents(adjustments));

  // --- 7. tax --------------------------------------------------------------
  // With `componentRules` present the base follows `comded.cd_tax`: taxable
  // credits minus taxable deductions. Without them we fall back to the legacy
  // rule (basic - statutory), which is what the parity harness exercises.
  const taxable = componentRules
    ? taxableFromComponents(components, componentRules)
    : taxableIncome({
        basic,
        taxableEarnings: premiums.totalAmount + allowance + deMinimis,
        timeDeductions,
        statutoryEmployee,
        includeEarnings: period.includeEarningsInTax ?? false,
        deductTimeFromTax: period.deductTimeFromTax ?? false,
      });

  const tax = period.applyTax === false
    ? { amount: 0, rate: 0, fixed: 0, bracketCode: null }
    : computeTax(taxable, brackets.tax, period.taxFrequency ?? "S");

  // Tax and the audit snapshots are appended last — they must not feed back
  // into the base that produced them.
  if (tax.amount || tax.bracketCode) {
    components.push(
      { code: CD_TAX, type: "D", amount: tax.amount, taxable: isTaxable(CD_TAX) },
      { code: CD_TAX_RATE, type: "D", amount: tax.rate, taxable: true },
      { code: CD_TAX_AMOUNT, type: "D", amount: tax.amount, taxable: true },
    );
  }
  if (statutoryEmployee || statutoryEmployer) {
    // Bracket values used, so the payslip stays reproducible after the
    // government reissues its schedules. `cd_slip = '0'` keeps these out of
    // the tax base.
    components.push(...sssSnapshot(findSssBracket(monthly, sssTable)));
    components.push(
      ...contributionSnapshot(
        findBracket(brackets.philhealth, monthly, (b) => b.gph_fr, (b) => b.gph_to),
        findBracket(brackets.pagibig, monthly, (b) => b.gpg_frm, (b) => b.gpg_to),
      ),
    );
  }

  // --- 8. totals -----------------------------------------------------------
  const grossEarnings =
    basic + premiums.totalAmount + allowance + deMinimis + adjustmentCredits;
  const totalDeductions =
    timeDeductions + statutoryEmployee + tax.amount + loans + adjustmentDeductions;
  const net = grossEarnings - totalDeductions;

  return {
    employee,
    rates,
    basic,
    grossEarnings,
    timeDeductions,
    statutoryEmployee,
    statutoryEmployer,
    tax: tax.amount,
    loans,
    adjustmentCredits,
    adjustmentDeductions,
    totalDeductions,
    net,
    quantities,
    premiums,
    advanceDeductions,
    taxableIncome: taxable,
    components,
  };
}
