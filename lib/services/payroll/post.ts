/**
 * Persistence for payroll runs — compute (draft), post, and unpost.
 *
 * Writes land in the legacy tables so the existing payslip reader
 * (`app/api/payroll/payslips/route.ts`) keeps working unchanged:
 *
 *   pay_header   one row per run
 *   pay_details  one row per payslip      (pyd_pk = pyh_code + index)
 *   pay_amounts  one row per component    (pya_code = pyd_pk)
 *   pay_loan     one row per advance instalment collected
 *   pay_ytd      year-to-date accumulators, written only on POST
 *
 * SAFETY
 * ------
 * Computing is destructive but repeatable: it replaces the run's detail rows
 * wholesale, so it can be re-run freely while a run is still a draft. Posting
 * is the irreversible-ish step — it stamps `pyh_postedby`/`pyh_posteddate`,
 * advances `empadvance.emp_adpaid`, and accumulates `pay_ytd`. A posted run
 * cannot be recomputed without unposting first, which reverses those effects.
 */

import type { Prisma } from "../../../src/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import { computePayslip, type ComputeResult } from "./compute";
import {
  loadSettings,
  loadBrackets,
  loadOvertimeRates,
  loadSalaries,
  loadAttendance,
  loadLeave,
  loadAdvances,
  loadAdjustments,
  loadComponentRules,
  prepareAttendance,
} from "./repository";
import { contributionModeFromFlag, type TaxFrequency } from "./statutory";

/**
 * `pay_header.pyh_status` — the legacy grid labels these as:
 *
 *   '0' Unposted  computed, awaiting review
 *   '1' Posted    finalised
 *   '5' Saved     header keyed in but not yet generated
 *
 * Anything else renders as "Undefined" in the legacy UI.
 */
export const RUN_UNPOSTED = "0";
export const RUN_POSTED = "1";
export const RUN_SAVED = "5";

/** Kept for backwards compatibility with earlier callers. */
export const RUN_DRAFT = RUN_UNPOSTED;

export interface RunOptions {
  /** Skip `recomputeAttendance` — only for tests; production must not. */
  skipRecompute?: boolean;
  taxFrequency?: TaxFrequency;
  includeEarningsInTax?: boolean;
  /**
   * Employee ids to include. A payroll run targets a SELECTED set, chosen in
   * the Run Payroll dialog — not everyone with a salary record.
   *
   * Omit on a recompute and the previous selection is reused (read back from
   * the run's existing `pay_details`), so re-running never silently widens the
   * payroll. If there is no previous selection either, every payable employee
   * is included.
   */
  employees?: string[];
}

export interface ComputedRun {
  code: string;
  slips: Array<{ pk: string; employee: string; result: ComputeResult }>;
  skipped: Array<{ employee: string; reason: string }>;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build the legacy run code: PR + MM + YYYY + period + 2-digit sequence. */
export async function generateRunCode(
  month: number,
  year: number,
  period: number,
): Promise<string> {
  const prefix = `PR${String(month).padStart(2, "0")}${year}${period}`;
  const existing = await prisma.pay_header.findMany({
    where: { pyh_code: { startsWith: prefix } },
    select: { pyh_code: true },
  });
  const next = existing.length + 1;
  for (let seq = next; seq < next + 100; seq++) {
    const code = `${prefix}${String(seq).padStart(2, "0")}`;
    if (!existing.some((e) => e.pyh_code === code)) return code;
  }
  throw new Error(`Could not allocate a run code for ${prefix}`);
}

/**
 * Compute (or recompute) every payslip in a run and store it as a draft.
 *
 * Refuses to touch a run that has already been posted — unpost it first.
 */
export async function computeRun(code: string, options: RunOptions = {}): Promise<ComputedRun> {
  const header = await prisma.pay_header.findUnique({ where: { pyh_code: code } });
  if (!header) throw new Error(`Payroll run ${code} does not exist`);
  if (header.pyh_status === RUN_POSTED) {
    throw new Error(`Payroll run ${code} is already posted — unpost it before recomputing`);
  }
  if (!header.pyh_from || !header.pyh_to) {
    throw new Error(`Payroll run ${code} has no period set`);
  }

  const from = ymd(header.pyh_from);
  const to = ymd(header.pyh_to);

  // Approved COA / OT / UT / leave / schedule-adjustment requests must be
  // overlaid onto `attendance` before payroll reads it.
  if (!options.skipRecompute) await prepareAttendance(from, to);

  const [settings, brackets, otRates, salaries, attendance, leave, advances, componentRules] =
    await Promise.all([
      loadSettings(),
      loadBrackets(),
      loadOvertimeRates(),
      loadSalaries(header.pyh_to),
      loadAttendance(from, to),
      loadLeave(from, to),
      loadAdvances(),
      loadComponentRules(),
    ]);

  // Keyed-in adjustments (`pay_amounts.pya_adj = 1`) must feed the computation,
  // not just be re-attached afterwards — they change gross, and taxable ones
  // change the withholding base.
  const adjustments = await loadAdjustments(code);

  // A run targets a SELECTED set of employees, chosen in the Run Payroll
  // dialog. On a recompute with no explicit list, reuse whoever was in the run
  // last time so re-running never silently widens the payroll.
  let selection = options.employees?.filter(Boolean) ?? [];
  if (selection.length === 0) {
    const previous = await prisma.pay_details.findMany({
      where: { pyd_code: code },
      select: { pyd_emp: true },
    });
    selection = previous.map((p) => p.pyd_emp ?? "").filter(Boolean);
  }

  const payable = [...new Set([...attendance.keys(), ...salaries.keys()])];
  // An empty selection anywhere means "everyone payable".
  const candidates = (
    selection.length > 0 ? payable.filter((e) => selection.includes(e)) : payable
  ).sort();

  const slips: ComputedRun["slips"] = [];
  const skipped: ComputedRun["skipped"] = [];
  let index = 0;

  for (const employee of candidates) {
    const salary = salaries.get(employee);
    if (!salary) {
      skipped.push({ employee, reason: "no active empsalary record for this period" });
      continue;
    }
    const att = attendance.get(employee) ?? { days: [], premiumDays: [] };
    const pk = `${code}${index}`;

    const result = computePayslip({
      employee,
      period: {
        start: from,
        end: to,
        cutoff: header.pyh_per,
        taxFrequency: options.taxFrequency ?? "S",
        includeEarningsInTax: options.includeEarningsInTax,
        // Full / Half / None per contribution, straight off the header.
        sssMode: contributionModeFromFlag(header.pyh_sss),
        philhealthMode: contributionModeFromFlag(header.pyh_phl),
        pagibigMode: contributionModeFromFlag(header.pyh_pag),
        applyTax: header.pyh_tax !== "0",
        applyLoans: header.pyh_loan !== "0",
      },
      salary: {
        amount: salary.amount,
        type: salary.type,
        deMinimis: salary.deMinimis,
        allowance: salary.allowance,
      },
      yearDays: settings.yearDays,
      attendance: att.days,
      premiumDays: att.premiumDays,
      leave: leave.get(employee) ?? [],
      overtimeRates: otRates,
      brackets,
      advances: advances.get(employee) ?? [],
      adjustments: adjustments.get(employee) ?? [],
      componentRules,
    });

    slips.push({ pk, employee, result });
    index += 1;
  }

  await persistRun(code, slips);

  return { code, slips, skipped };
}

/** Replace a run's detail rows in one transaction. */
async function persistRun(
  code: string,
  slips: ComputedRun["slips"],
): Promise<void> {
  const pks = slips.map((s) => s.pk);

  // Build every row up front so the transaction is three bulk inserts instead
  // of a create() round trip per component — a 300-employee run blew past the
  // 5s interactive-transaction timeout doing it one at a time.
  const detailRows = slips.map(({ pk, employee, result }) => ({
    pyd_pk: pk,
    pyd_code: code,
    pyd_emp: employee,
    pyd_salary: result.basic,
    pyd_comp: result.premiums.totalAmount,
    pyd_tadjc: result.adjustmentCredits,
    pyd_deduct: result.timeDeductions,
    pyd_tadjd: result.adjustmentDeductions,
    pyd_tloan: result.loans,
    pyd_tax: result.tax,
    pyd_sss: sumComponent(result, "CD11"),
    pyd_phic: sumComponent(result, "CD12"),
    pyd_hdmf: sumComponent(result, "CD13"),
    pyd_ssser: sumComponent(result, "CD11", true),
    pyd_phicer: sumComponent(result, "CD12", true),
    pyd_hdmfer: sumComponent(result, "CD13", true),
  }));

  const amountRows = slips.flatMap(({ pk, result }) =>
    result.components.map((c, ctr) => ({
      pya_code: pk,
      pya_ctr: ctr,
      pya_def: c.code,
      pya_desc: c.description ?? "",
      pya_cd: c.type,
      pya_amt: c.amount,
      pya_eramt: c.employerAmount ?? 0,
      pya_tax: c.taxable ? 1 : 0,
      // Only keyed-in adjustments carry the flag; that is what makes them
      // survive the next recompute.
      pya_adj: c.isAdjustment ? 1 : 0,
    })),
  );

  const loanRows = slips.flatMap(({ pk, result }) =>
    result.advanceDeductions.map((loan) => ({
      pyl_code: pk,
      pyl_lcode: loan.advanceId,
      pyl_amt: loan.amount,
      pyl_bal: loan.balanceBefore,
    })),
  );

  await prisma.$transaction(
    async (tx) => {
      // Wholesale replace — computing is repeatable while a run is a draft.
      // Adjustments were read before computing and are re-emitted as components,
      // so clearing everything here does not lose them.
      await tx.pay_amounts.deleteMany({ where: { pya_code: { in: pks } } });
      await tx.pay_loan.deleteMany({ where: { pyl_code: { in: pks } } });
      await tx.pay_details.deleteMany({ where: { pyd_code: code } });

      if (detailRows.length) await tx.pay_details.createMany({ data: detailRows });
      // Chunked so a big run does not build one oversized INSERT statement.
      for (const chunk of chunks(amountRows, 1000)) {
        await tx.pay_amounts.createMany({ data: chunk });
      }
      for (const chunk of chunks(loanRows, 1000)) {
        await tx.pay_loan.createMany({ data: chunk });
      }

      await tx.pay_header.update({
        where: { pyh_code: code },
        data: { pyh_status: RUN_DRAFT },
      });
    },
    // Payroll runs are big; the 5s default is not enough for a full company.
    { timeout: 120_000, maxWait: 20_000 },
  );
}

/** Split rows into batches so a single INSERT never gets unreasonably large. */
function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Pull one statutory component's employee or employer amount off a result. */
function sumComponent(result: ComputeResult, code: string, employer = false): number {
  const c = result.components.find((x) => x.code === code);
  if (!c) return 0;
  return employer ? (c.employerAmount ?? 0) : c.amount;
}

/**
 * Finalise a run: stamp it posted, advance the loan balances, accumulate YTD.
 *
 * These are the effects `unpostRun` has to undo, so they are kept together in
 * one transaction.
 */
export async function postRun(code: string, userId: string): Promise<void> {
  const header = await prisma.pay_header.findUnique({ where: { pyh_code: code } });
  if (!header) throw new Error(`Payroll run ${code} does not exist`);
  if (header.pyh_status === RUN_POSTED) throw new Error(`Payroll run ${code} is already posted`);

  const details = await prisma.pay_details.findMany({ where: { pyd_code: code } });
  if (details.length === 0) throw new Error(`Payroll run ${code} has no payslips — compute it first`);

  const loans = await prisma.pay_loan.findMany({
    where: { pyl_code: { in: details.map((d) => d.pyd_pk) } },
  });
  const year = header.pyh_year ?? new Date().getFullYear();

  // Everything the transaction needs is read up front, in bulk — the old
  // per-loan / per-component round trips inside the transaction ran it past
  // the 5s interactive-transaction timeout on a full company.
  const advances = await prisma.empadvance.findMany({
    where: { emp_adid: { in: loans.map((l) => l.pyl_lcode).filter(Boolean) as string[] } },
  });
  const advanceById = new Map(advances.map((a) => [a.emp_adid, a]));
  const amounts = await prisma.pay_amounts.findMany({
    where: { pya_code: { in: details.map((d) => d.pyd_pk) } },
  });
  const empByPk = new Map(details.map((d) => [d.pyd_pk, d.pyd_emp ?? ""]));

  // Collapse to one advance update per advance, even if collected twice.
  const paidByAdvance = new Map<string, number>();
  for (const loan of loans) {
    if (!loan.pyl_lcode || !advanceById.has(loan.pyl_lcode)) continue;
    paidByAdvance.set(
      loan.pyl_lcode,
      (paidByAdvance.get(loan.pyl_lcode) ?? 0) + (loan.pyl_amt ?? 0),
    );
  }

  const ytd = ytdDeltas(amounts, empByPk, year);

  await prisma.$transaction(
    async (tx) => {
      // Advance every collected loan by the instalment taken.
      for (const [advanceId, collected] of paidByAdvance) {
        const advance = advanceById.get(advanceId)!;
        const paid = (advance.emp_adpaid ?? 0) + collected;
        const total = (advance.emp_adamt ?? 0) + (advance.emp_adaddedamt ?? 0);
        await tx.empadvance.update({
          where: { emp_adid: advanceId },
          // Close the advance once it is fully recovered.
          data: { emp_adpaid: paid, emp_adstatus: paid >= total ? 0 : advance.emp_adstatus },
        });
      }

      // Year-to-date accumulators, keyed (year, employee, component).
      await applyYtd(tx, ytd, 1);

      await tx.pay_header.update({
        where: { pyh_code: code },
        data: {
          pyh_status: RUN_POSTED,
          pyh_postedby: userId.slice(0, 10),
          pyh_posteddate: new Date(),
        },
      });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}

type YtdDelta = { year: number; emp: string; code: string; amt: number; eramt: number };

/** Sum a run's component amounts per (year, employee, component). */
function ytdDeltas(
  amounts: { pya_code: string | null; pya_def: string; pya_amt: number | null; pya_eramt: number | null }[],
  empByPk: Map<string, string>,
  year: number,
): YtdDelta[] {
  const acc = new Map<string, YtdDelta>();
  for (const a of amounts) {
    const emp = empByPk.get(a.pya_code ?? "") ?? "";
    const key = `${emp}\u0000${a.pya_def}`;
    const cur =
      acc.get(key) ?? { year, emp, code: a.pya_def, amt: 0, eramt: 0 };
    cur.amt += a.pya_amt ?? 0;
    cur.eramt += a.pya_eramt ?? 0;
    acc.set(key, cur);
  }
  return [...acc.values()];
}

/**
 * Add (`sign` 1) or back out (`sign` -1) YTD deltas in one statement.
 *
 * MySQL upserts on the (year, employee, component) primary key, so posting a
 * component an employee has never had still creates its row, and unposting
 * subtracts exactly what posting added.
 */
async function applyYtd(
  tx: Prisma.TransactionClient,
  deltas: YtdDelta[],
  sign: 1 | -1,
): Promise<void> {
  for (const chunk of chunks(deltas, 500)) {
    const values = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const params = chunk.flatMap((d) => [
      d.year,
      d.emp,
      d.code,
      sign * d.amt,
      sign * d.eramt,
    ]);
    await tx.$executeRawUnsafe(
      `INSERT INTO pay_ytd (pytd_year, pytd_emp, pytd_code, pytd_amt, pytd_eramt)
       VALUES ${values}
       ON DUPLICATE KEY UPDATE
         pytd_amt = pytd_amt + VALUES(pytd_amt),
         pytd_eramt = pytd_eramt + VALUES(pytd_eramt)`,
      ...params,
    );
  }
}

/**
 * Reverse a post so the run can be corrected and recomputed.
 *
 * Undoes exactly what `postRun` applied — loan balances and YTD accumulators —
 * then returns the run to draft. The payslips themselves are left in place;
 * recomputing replaces them.
 */
export async function unpostRun(code: string): Promise<void> {
  const header = await prisma.pay_header.findUnique({ where: { pyh_code: code } });
  if (!header) throw new Error(`Payroll run ${code} does not exist`);
  if (header.pyh_status !== RUN_POSTED) throw new Error(`Payroll run ${code} is not posted`);

  const details = await prisma.pay_details.findMany({ where: { pyd_code: code } });
  const loans = await prisma.pay_loan.findMany({
    where: { pyl_code: { in: details.map((d) => d.pyd_pk) } },
  });
  const year = header.pyh_year ?? new Date().getFullYear();

  const advances = await prisma.empadvance.findMany({
    where: { emp_adid: { in: loans.map((l) => l.pyl_lcode).filter(Boolean) as string[] } },
  });
  const advanceById = new Map(advances.map((a) => [a.emp_adid, a]));
  const amounts = await prisma.pay_amounts.findMany({
    where: { pya_code: { in: details.map((d) => d.pyd_pk) } },
  });
  const empByPk = new Map(details.map((d) => [d.pyd_pk, d.pyd_emp ?? ""]));

  const paidByAdvance = new Map<string, number>();
  for (const loan of loans) {
    if (!loan.pyl_lcode || !advanceById.has(loan.pyl_lcode)) continue;
    paidByAdvance.set(
      loan.pyl_lcode,
      (paidByAdvance.get(loan.pyl_lcode) ?? 0) + (loan.pyl_amt ?? 0),
    );
  }

  const ytd = ytdDeltas(amounts, empByPk, year);

  await prisma.$transaction(
    async (tx) => {
      for (const [advanceId, collected] of paidByAdvance) {
        const advance = advanceById.get(advanceId)!;
        await tx.empadvance.update({
          where: { emp_adid: advanceId },
          data: {
            emp_adpaid: Math.max(0, (advance.emp_adpaid ?? 0) - collected),
            emp_adstatus: 1, // reopen — it was collectable at post time
          },
        });
      }

      await applyYtd(tx, ytd, -1);

      await tx.pay_header.update({
        where: { pyh_code: code },
        data: { pyh_status: RUN_DRAFT, pyh_postedby: null, pyh_posteddate: null },
      });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}
