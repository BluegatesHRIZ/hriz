/**
 * Philippine statutory contributions: SSS, PhilHealth, Pag-IBIG and BIR
 * withholding tax.
 *
 * Every formula here was reverse-engineered from POSTED payroll and verified
 * to the centavo against run PR052025104 (see `scripts/payroll-parity.ts`):
 *
 *   emp 000008  semi 15,000 -> monthly 30,000
 *     SSS  ee 1,500.00  er 3,030.00   (govtsss bracket 29,750-30,249.99)
 *     PHIC ee   750.00  er   750.00   (30,000 x 5% / 2)
 *     HDMF ee   200.00  er   200.00   (min(30,000 x 2%, 200))
 *     TAX       319.95                ((12,550 - 10,417) x 15%)
 *
 *   emp 000009  monthly 31,000 -> basic 15,500
 *     SSS  ee 1,550.00  er 3,130.00
 *     PHIC ee   775.00
 *     HDMF ee   200.00
 *     TAX       383.70                ((12,975 - 10,417) x 15%)
 *
 * All bracket tables are passed IN — this module performs no I/O, so the same
 * code runs under Next.js (Prisma) and under the parity harness (mariadb).
 */

import type { PayComponent } from "./types";

/** `govtsss.gss_stat` — '1' is the current (2025) table, '0' the 2024 one. */
export const SSS_TABLE_CURRENT = "1";

// --------------------------------------------------------------- brackets ---

/**
 * A `govtsss` row. Column names in the legacy schema are unreliable
 * (`gss_ecer` holds the same value as `gss_ter`, `gss_ec` looks like an MSC
 * cap), so we only rely on `gss_tee` / `gss_ter` for money and carry the rest
 * verbatim for the audit snapshot.
 */
export interface SssBracket {
  gss_code: string;
  gss_fr: number;
  gss_to: number;
  gss_ec: number;
  gss_wisp: number;
  gss_msct: number;
  gss_rsser: number;
  gss_rssee: number;
  gss_rsst: number;
  gss_ecer: number;
  gss_ecee: number;
  gss_ect: number;
  gss_wisper: number;
  gss_wipee: number;
  gss_wispt: number;
  gss_ter: number;
  gss_tee: number;
  gss_tt: number;
  gss_stat: string | null;
  /** When this schedule was loaded — used to pick the version in force. */
  gss_logdate?: Date | string | null;
}

/** A `govtph` row. */
export interface PhilhealthBracket {
  gph_code: string;
  gph_fr: number;
  gph_to: number;
  /** Percent, e.g. 5. */
  gph_rate: number;
  /** Fixed employer premium; 0 means "use the rate". */
  gph_ems: number;
  /** Fixed employee premium; 0 means "use the rate". */
  gph_ees: number;
}

/** A `govtpag` row. */
export interface PagibigBracket {
  gpg_code: string;
  gpg_frm: number;
  gpg_to: number;
  /** Employee percent, e.g. 1 or 2. */
  gpg_emrate: number;
  /** Employee peso cap, e.g. 100 or 200. */
  gpg_pagem: number;
  /** Employer percent. */
  gpg_errate: number;
  /** Employer peso cap. */
  gpg_pager: number;
}

/** A `govttax` row. Codes are prefixed by frequency: D / W / S / M. */
export interface TaxBracket {
  gtx_code: string;
  gtx_rangefrm: number;
  gtx_rangeto: number;
  /** Percent applied to the excess over `gtx_rangefrm`. */
  gtx_rate: number;
  /** Fixed peso amount added on top. */
  gtx_amt: number;
}

/** Which `govttax` set applies. Driven by the PAY RUN's cadence, not by
 *  `emp_salpayrolltype` — employee 000009 is type "M" but was taxed on the "S"
 *  table because the run itself is semi-monthly. */
export type TaxFrequency = "D" | "W" | "S" | "M";

/**
 * How much of a monthly contribution a single cutoff collects.
 *
 * The legacy Run Payroll dialog offers Full / Half / None per contribution,
 * stored on `pay_header` as '2' / '1' / '0':
 *
 *   full  the whole monthly contribution in this cutoff
 *   half  split across the month's two cutoffs
 *   none  skip entirely for this run
 *
 * Tax is the exception — it is With/Without only, no half.
 */
export type ContributionMode = "full" | "half" | "none";

/** `pay_header` stores these as '2' / '1' / '0'. */
export function contributionModeFromFlag(flag: string | null | undefined): ContributionMode {
  switch ((flag ?? "2").trim()) {
    case "0":
      return "none";
    case "1":
      return "half";
    default:
      return "full";
  }
}

/** The multiplier a mode applies to the table amount. */
export function contributionFraction(mode: ContributionMode): number {
  switch (mode) {
    case "none":
      return 0;
    case "half":
      return 0.5;
    default:
      return 1;
  }
}

export interface ContributionResult {
  employee: number;
  employer: number;
  /** The bracket actually used, for the audit snapshot. */
  bracketCode: string | null;
}

export interface TaxResult {
  amount: number;
  rate: number;
  fixed: number;
  bracketCode: string | null;
}

// ---------------------------------------------------------------- lookup ---

/**
 * Find the bracket whose [from, to] range contains `value`.
 *
 * Ranges in these tables are inclusive on both ends and occasionally overlap by
 * a centavo (e.g. `govtph` 0-10,000 then 10,000.01-99,999.99), so the first
 * match in ascending order wins. Values above every bracket fall back to the
 * highest one, which is how the legacy tables cap contributions.
 */
export function findBracket<T>(
  rows: T[],
  value: number,
  from: (row: T) => number,
  to: (row: T) => number,
): T | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => from(a) - from(b));
  for (const row of sorted) {
    if (value >= from(row) && value <= to(row)) return row;
  }
  const highest = sorted[sorted.length - 1];
  return value > to(highest) ? highest : null;
}

// ------------------------------------------------------------------- SSS ---

/**
 * The year a `govtsss` schedule takes effect, read from its code prefix:
 * `20241-34` -> 2024, `20251-32` -> 2025.
 *
 * NOTE: do NOT use `gss_logdate` for this. On the live DB both schedules carry
 * a logdate of 2025-06-23 — they were bulk-loaded during a migration, and the
 * 2024 rows were actually inserted LATER in the day (09:36) than the 2025 rows
 * (08:40). The column records when the data was imported, not when the
 * schedule applies.
 */
export function sssTableYear(bracket: SssBracket): number | null {
  const year = Number(bracket.gss_code?.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}

/**
 * Pick the `govtsss` schedule that applies to a payroll period.
 *
 * The live DB holds BOTH schedules and their ranges overlap completely, so an
 * unfiltered query returns two rows per bracket with different amounts (plan
 * risk R1):
 *
 *   gss_stat '0', codes `20241-*` — the 2024 schedule (4.5% employee share)
 *   gss_stat '1', codes `20251-*` — the 2025 schedule (5% employee share)
 *
 * Filtering on `gss_stat = '1'` alone is right for NEW runs but wrong for
 * reproducing old ones. Posted run PR012025101 covers 14-30 Dec 2024 and stored
 * SSS from the 2024 schedule — employee 000001 (monthly 20,000) was deducted
 * 900 (4.5%), not the 1,000 the 2025 table gives.
 *
 * We therefore choose the newest schedule whose effective year is not after the
 * period. Omitting `periodEnd` selects the current table, which is what a fresh
 * run wants.
 */
export function selectSssTable(
  brackets: SssBracket[],
  periodEnd?: Date | null,
): SssBracket[] {
  if (!periodEnd) {
    const current = brackets.filter((b) => b.gss_stat === SSS_TABLE_CURRENT);
    return current.length > 0 ? current : brackets;
  }

  const periodYear = periodEnd.getUTCFullYear();
  const byYear = new Map<number, SssBracket[]>();
  for (const b of brackets) {
    const year = sssTableYear(b);
    if (year === null) continue;
    const list = byYear.get(year) ?? [];
    list.push(b);
    byYear.set(year, list);
  }
  if (byYear.size === 0) return brackets;

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const applicable = years.filter((y) => y <= periodYear);
  // A period older than every schedule falls back to the earliest one.
  const chosen = applicable.length > 0 ? applicable[applicable.length - 1] : years[0];
  return byYear.get(chosen)!;
}

/**
 * SSS is a flat lookup — the table already holds the peso amounts, so there is
 * no arithmetic to get wrong.
 *
 * Pass `brackets` already narrowed with `selectSssTable`, or pass the raw table
 * and the current version will be used.
 */
export function computeSss(
  monthly: number,
  brackets: SssBracket[],
  mode: ContributionMode = "full",
): ContributionResult {
  const rows = isSingleVersion(brackets) ? brackets : selectSssTable(brackets);
  const bracket = findBracket(rows, monthly, (b) => b.gss_fr, (b) => b.gss_to);
  if (!bracket) return { employee: 0, employer: 0, bracketCode: null };
  const f = contributionFraction(mode);
  return {
    employee: bracket.gss_tee * f,
    employer: bracket.gss_ter * f,
    bracketCode: bracket.gss_code,
  };
}

/**
 * The 15 `CD11xx` audit rows.
 *
 * Verified positionally against posted payslip PR0520251040: CD1101..CD1115
 * are the `govtsss` value columns in declaration order. Storing them alongside
 * the amounts is what keeps an old payslip reproducible after SSS reissues its
 * schedule.
 */
export function sssSnapshot(bracket: SssBracket | null): PayComponent[] {
  if (!bracket) return [];
  const ordered: number[] = [
    bracket.gss_ec,
    bracket.gss_wisp,
    bracket.gss_msct,
    bracket.gss_rsser,
    bracket.gss_rssee,
    bracket.gss_rsst,
    bracket.gss_ecer,
    bracket.gss_ecee,
    bracket.gss_ect,
    bracket.gss_wisper,
    bracket.gss_wipee,
    bracket.gss_wispt,
    bracket.gss_ter,
    bracket.gss_tee,
    bracket.gss_tt,
  ];
  return ordered.map((amount, i) => ({
    code: `CD11${String(i + 1).padStart(2, "0")}`,
    type: "D" as const,
    amount,
    taxable: true,
  }));
}

/** True when every row shares one `gss_stat`, i.e. already narrowed. */
function isSingleVersion(brackets: SssBracket[]): boolean {
  if (brackets.length === 0) return true;
  const first = brackets[0].gss_stat;
  return brackets.every((b) => b.gss_stat === first);
}

/** Re-find the SSS bracket so callers can build the snapshot. */
export function findSssBracket(monthly: number, brackets: SssBracket[]): SssBracket | null {
  const rows = isSingleVersion(brackets) ? brackets : selectSssTable(brackets);
  return findBracket(rows, monthly, (b) => b.gss_fr, (b) => b.gss_to);
}

// ------------------------------------------------------------ PhilHealth ---

/**
 * PhilHealth: a total premium split 50/50 between employee and employer.
 *
 * A bracket carries EITHER a fixed premium (`gph_ees` non-zero, used at the
 * floor and ceiling) OR a percentage (`gph_rate`, used in the middle band).
 *
 * Verified: monthly 30,000 -> 30,000 x 5% = 1,500 total -> 750 each (posted
 * `pyd_phic` 750 / `pyd_phicer` 750). Monthly 4 -> fixed 500 total -> 250 each
 * (posted 250 for employee 000011).
 */
export function computePhilhealth(
  monthly: number,
  brackets: PhilhealthBracket[],
  mode: ContributionMode = "full",
): ContributionResult {
  const bracket = findBracket(brackets, monthly, (b) => b.gph_fr, (b) => b.gph_to);
  if (!bracket) return { employee: 0, employer: 0, bracketCode: null };

  const total =
    bracket.gph_ees > 0 || bracket.gph_ems > 0
      ? bracket.gph_ees
      : monthly * (bracket.gph_rate / 100);
  // The premium splits 50/50 employee/employer; `mode` then scales the cutoff.
  const share = (total / 2) * contributionFraction(mode);
  return { employee: share, employer: share, bracketCode: bracket.gph_code };
}

// -------------------------------------------------------------- Pag-IBIG ---

/**
 * Pag-IBIG: a percentage of the monthly figure, capped in pesos.
 *
 * Verified: 30,000 x 2% = 600 -> capped to 200 (posted `pyd_hdmf` 200);
 * 2,000 x 2% = 40, under the 200 cap (posted 40); monthly 4 x 1% = 0.04
 * (posted 0.04, so the cap is a ceiling, never a floor).
 */
export function computePagibig(
  monthly: number,
  brackets: PagibigBracket[],
  mode: ContributionMode = "full",
): ContributionResult {
  const bracket = findBracket(brackets, monthly, (b) => b.gpg_frm, (b) => b.gpg_to);
  if (!bracket) return { employee: 0, employer: 0, bracketCode: null };
  // Cap first on the monthly amount, THEN scale for the cutoff — capping after
  // halving would let a half cutoff collect the full 200 ceiling.
  const f = contributionFraction(mode);
  return {
    employee: Math.min(monthly * (bracket.gpg_emrate / 100), bracket.gpg_pagem) * f,
    employer: Math.min(monthly * (bracket.gpg_errate / 100), bracket.gpg_pager) * f,
    bracketCode: bracket.gpg_code,
  };
}

// ------------------------------------------------------------------- tax ---

/** Select the D / W / S / M subset of `govttax` by code prefix. */
export function taxBracketsFor(
  brackets: TaxBracket[],
  frequency: TaxFrequency,
): TaxBracket[] {
  return brackets.filter((b) => b.gtx_code.startsWith(frequency));
}

/**
 * BIR withholding: `(taxable - bracket floor) x rate% + fixed`.
 *
 * Verified exactly on both posted taxpayers using the semi-monthly ("S") set:
 *   (12,550 - 10,417) x 15% + 0 = 319.95
 *   (12,975 - 10,417) x 15% + 0 = 383.70
 */
export function computeTax(
  taxable: number,
  brackets: TaxBracket[],
  frequency: TaxFrequency,
): TaxResult {
  const set = taxBracketsFor(brackets, frequency);
  const bracket = findBracket(set, taxable, (b) => b.gtx_rangefrm, (b) => b.gtx_rangeto);
  if (!bracket || taxable <= 0) {
    return { amount: 0, rate: 0, fixed: 0, bracketCode: bracket?.gtx_code ?? null };
  }
  const amount =
    (taxable - bracket.gtx_rangefrm) * (bracket.gtx_rate / 100) + bracket.gtx_amt;
  return {
    amount: Math.max(0, amount),
    rate: bracket.gtx_rate,
    fixed: bracket.gtx_amt,
    bracketCode: bracket.gtx_code,
  };
}

/**
 * The base BIR withholding is computed on.
 *
 * THE LEGACY RULE IS SIMPLY:  basic - statutory employee share
 *
 * Nothing else enters it. Two separate exclusions, both verified against posted
 * payroll on two independent databases:
 *
 * 1. TAXABLE EARNINGS ARE EXCLUDED, even though `comded` marks them taxable
 *    (`CD3 Allowance` and `CD4 De Minimis` both carry `cd_tax = 1`).
 *      bgc_ofc_hris  PR052025104 emp 000008: 1,500 allowance, taxed on
 *                    15,000 - 2,450 = 12,550 -> 319.95 (including it: 544.95)
 *      bgc_bgc_hris  PR022026201 emp 000001: 1,500 de minimis, taxed on
 *                    14,500 - 2,375 = 12,125 -> 256.20
 *
 * 2. TIME DEDUCTIONS ARE ALSO EXCLUDED. Absences, lates and undertime reduce
 *    take-home pay but NOT the withholding base. The decisive evidence is
 *    PR022026201, where the only two employees with both deductions and a
 *    non-zero tax were taxed as if they had none:
 *      emp 000001: 1,480.11 deducted, still taxed 256.20 on 12,125
 *      emp 000009: 34,742.09 deducted, still taxed 256.20 on 12,125
 *    Subtracting deductions gives 34.18 and 0.00 respectively. Across all 19
 *    payslips in that run, excluding deductions matches 19/19; subtracting
 *    them matches 17/19.
 *
 *    THIS CORRECTS AN EARLIER READING, and the two databases genuinely
 *    disagree — this is not fully resolved. On bgc_ofc_hris, run PR012025101
 *    employee 000009 had 10 days absent and a stored tax of 0 where this rule
 *    predicts 413.70. A run-level tax toggle would explain it, but that was
 *    checked and ruled out: PR012025101 carries `pyh_tax = '2'`, exactly like
 *    the runs that did withhold. So it is a real counter-example.
 *
 *    We still follow the no-deduction rule, on weight of evidence:
 *      - bgc_bgc_hris PR022026201 gives TWO discriminating cases, both
 *        consistent, inside a run that otherwise matches 19/19. The cleanest
 *        is employee 000001 — an ordinary 1,480.11 undertime deduction and a
 *        textbook 256.20 withheld on basic minus statutory.
 *      - bgc_ofc_hris PR012025101 gives ONE, inside a run already documented
 *        as self-inconsistent: three of its ten payslips carry a basic that no
 *        rule reproduces (employees 000002, 000008 and 000010).
 *
 *    If the client confirms absences should lower withholding, flip
 *    `deductTimeFromTax` — the behaviour is one flag away, not a rewrite.
 *
 * Both exclusions are very likely legacy bugs — one under-withholds on
 * allowances, the other over-withholds when an employee was absent — so each is
 * exposed as an opt-in flag. The engine reproduces the legacy behaviour by
 * default and must never change withholding amounts on its own.
 */
export function taxableIncome(params: {
  basic: number;
  taxableEarnings?: number;
  timeDeductions?: number;
  statutoryEmployee: number;
  /** Add allowances / de minimis / premiums to the base. Legacy: false. */
  includeEarnings?: boolean;
  /** Subtract absences, lates and undertime from the base. Legacy: false. */
  deductTimeFromTax?: boolean;
}): number {
  const {
    basic,
    taxableEarnings = 0,
    timeDeductions = 0,
    statutoryEmployee,
    includeEarnings = false,
    deductTimeFromTax = false,
  } = params;
  const gross =
    basic +
    (includeEarnings ? taxableEarnings : 0) -
    (deductTimeFromTax ? timeDeductions : 0);
  return Math.max(0, gross - statutoryEmployee);
}

/**
 * The tax base, driven by `comded.cd_tax` — the configured rule.
 *
 *     taxable = SUM(credits    where cd_tax = 1)
 *             - SUM(deductions where cd_tax = 1)
 *
 * Two categories of row are excluded:
 *
 *   - anything with `cd_slip = '0'`. Those are the `CD10xx`/`CD11xx`/`CD12xx`/
 *     `CD13xx` audit snapshots, which hold bracket values (MSCs, rates, caps)
 *     rather than money. Summing them would be nonsense.
 *   - `CD10` (Tax) itself, which is the output of this calculation. Including
 *     it would be circular.
 *
 * NOTE — this deliberately DIVERGES from the legacy engine, which ignored
 * `cd_tax` and taxed `basic - statutory` flat. On posted run PR022026201
 * employee 000001 the two differ by ~3 pesos (259.18 vs the stored 256.20).
 * The divergence is intentional and was chosen explicitly; `taxableIncome`
 * below still implements the legacy rule so the parity harness can quantify
 * the gap.
 */
export function taxableFromComponents(
  components: Array<{ code: string; type: "C" | "D"; amount: number }>,
  rules: Map<string, { taxable: boolean; onSlip: boolean }>,
): number {
  let total = 0;
  for (const c of components) {
    if (c.code === CD_TAX) continue; // circular: tax is the output
    const rule = rules.get(c.code);
    // Unknown codes are skipped rather than assumed taxable — a component the
    // config does not describe must not silently move someone's withholding.
    if (!rule || !rule.onSlip || !rule.taxable) continue;
    total += c.type === "C" ? c.amount : -c.amount;
  }
  return Math.max(0, total);
}

// ------------------------------------------------------------ components ---

/** `comded` codes for the statutory deductions and their audit snapshots. */
export const CD_TAX = "CD10";
export const CD_SSS = "CD11";
export const CD_PHIC = "CD12";
export const CD_HDMF = "CD13";
export const CD_TAX_RATE = "CD1001";
export const CD_TAX_AMOUNT = "CD1002";
export const CD_PHIC_RATE = "CD1201";
export const CD_PHIC_ER = "CD1202";
export const CD_PHIC_EE = "CD1203";
export const CD_HDMF_EE_RATE = "CD1301";
export const CD_HDMF_EE_CAP = "CD1302";
export const CD_HDMF_ER_RATE = "CD1303";
export const CD_HDMF_ER_CAP = "CD1304";

/**
 * Build the PhilHealth / Pag-IBIG audit rows, mirroring what the legacy engine
 * stored (`CD1201`=`gph_rate`, `CD1202`=`gph_ems`, `CD1203`=`gph_ees`,
 * `CD1301`=`gpg_emrate`, `CD1302`=`gpg_pagem`, `CD1303`=`gpg_errate`,
 * `CD1304`=`gpg_pager`).
 */
export function contributionSnapshot(
  phic: PhilhealthBracket | null,
  hdmf: PagibigBracket | null,
): PayComponent[] {
  const out: PayComponent[] = [];
  if (phic) {
    out.push(
      { code: CD_PHIC_RATE, type: "D", amount: phic.gph_rate, taxable: true },
      { code: CD_PHIC_ER, type: "D", amount: phic.gph_ems, taxable: true },
      { code: CD_PHIC_EE, type: "D", amount: phic.gph_ees, taxable: true },
    );
  }
  if (hdmf) {
    out.push(
      { code: CD_HDMF_EE_RATE, type: "D", amount: hdmf.gpg_emrate, taxable: true },
      { code: CD_HDMF_EE_CAP, type: "D", amount: hdmf.gpg_pagem, taxable: true },
      { code: CD_HDMF_ER_RATE, type: "D", amount: hdmf.gpg_errate, taxable: true },
      { code: CD_HDMF_ER_CAP, type: "D", amount: hdmf.gpg_pager, taxable: true },
    );
  }
  return out;
}
