/**
 * Payroll parity harness.
 *
 * The 47 posted runs in `pay_header` are the specification for the new engine.
 * This script re-derives values with `lib/services/payroll/*` and diffs them
 * against what the legacy system actually stored.
 *
 * It is STRICTLY READ-ONLY — it issues SELECTs only. The live DB is remote and
 * shared (see plan risk R6).
 *
 * Uses the `mariadb` driver rather than Prisma, matching the convention in
 * `scripts/add-schedule-module.ts`. Prisma 7's wasm query compiler will not
 * load under `tsx`, and the payroll math modules are pure precisely so both
 * entry points can share them.
 *
 * Only genuinely POSTED runs are checked by default. Of the 47 `pay_header`
 * rows only 12 are posted (`pyh_status = '1'` with a `pyh_posteddate`); 10 sit
 * at status '0' (draft) and 25 at status '3' (voided). The drafts and voids
 * contain contradictory figures — e.g. employee 000010 (M 16,515) shows a basic
 * of 16,515 in some and 8,257.50 in others — so treating all 47 as the spec
 * would be chasing abandoned experiments. Pass --all to see them anyway.
 *
 * Usage:
 *   npx tsx scripts/payroll-parity.ts            # posted runs only (the spec)
 *   npx tsx scripts/payroll-parity.ts --all      # include drafts + voided
 *   npx tsx scripts/payroll-parity.ts --verbose  # per-payslip detail
 *   npx tsx scripts/payroll-parity.ts --run PR052025104
 *
 * Reads DATABASE_URL from .env via dotenv.
 */

import "dotenv/config";
import mariadb from "mariadb";
import { deriveRates, basicForCutoff, statutoryBasis } from "../lib/services/payroll/rates";
import {
  computeSss,
  selectSssTable,
  computePhilhealth,
  computePagibig,
  computeTax,
  taxableIncome,
  type SssBracket,
  type PhilhealthBracket,
  type PagibigBracket,
  type TaxBracket,
} from "../lib/services/payroll/statutory";
import type { PayrollType } from "../lib/services/payroll/types";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set (expected in .env)");
  process.exit(1);
}

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const INCLUDE_ALL = args.includes("--all");
const RUN_FILTER = args.includes("--run") ? args[args.indexOf("--run") + 1] : null;

/** Components we can currently decompose. Mirrors `comded`. */
const CD_ABSENT = "CD7";
const CD_LATE = "CD8";
const CD_UNDERTIME = "CD9";

/**
 * Payslips whose stored `pyd_salary` cannot be reproduced by ANY consistent
 * rule, verified by exhaustion rather than assumed.
 *
 * Run PR012025101 is the clearest case — it disagrees with itself:
 *
 *   000001  S 10,000 -> 10,000     (full semi)
 *   000003  M 18,515 ->  9,257.50  (half monthly)
 *   000009  M 31,000 -> 15,500     (half monthly)
 *   000002  S 18,515 ->  9,257.50  (halved, as if M)
 *   000008  S 15,000 ->    250     (a stale daily rate; empsalary has no 250 row)
 *   000010  M 16,515 -> 16,515     (NOT halved)
 *
 * "S means half" would break 000001; "M means full" would break 000003/4/5.
 * 7 of the 10 fit S=full / M=half, and both clean May-2025 runs match it
 * exactly, so the engine keeps that rule and these are flagged as bad data.
 *
 * The three Feb/Mar 2024 rows are "DEV" runs where employee 000002 was paid
 * 250/day x days-worked (2250 = 9 days, 1500 = 6 days) despite a type of "S".
 */
const KNOWN_BAD_SLIPS = new Map<string, string>([
  ["PR0220241010", "DEV run; emp 000002 paid as daily (250 x 9d) despite type S"],
  ["PR0220242010", "DEV run; emp 000002 paid as daily (250 x 6d) despite type S"],
  ["PR0320241010", "DEV run; emp 000002 paid as daily (250 x 9d) despite type S"],
  ["PR0120251011", "emp 000002 (S) halved as if M — run is self-inconsistent"],
  ["PR0120251015", "emp 000008 basic 250 — stale rate, no matching empsalary row"],
  ["PR0120251017", "emp 000010 (M) not halved — run is self-inconsistent"],
  [
    "PR0120251016",
    "emp 000009 taxed 0 despite 413.70 due on basic-minus-statutory; the only " +
      "case anywhere suggesting absences lower the withholding base, and it sits " +
      "in this same self-inconsistent run. bgc_bgc_hris PR022026201 contradicts " +
      "it with two cleaner cases — see `taxableIncome` in statutory.ts",
  ],
]);

interface PayHeaderRow {
  pyh_code: string;
  pyh_from: Date | null;
  pyh_to: Date | null;
  pyh_year: number | null;
  pyh_month: number | null;
  pyh_desc: string | null;
  pyh_status: string | null;
  pyh_posteddate: Date | null;
}

interface PayDetailRow {
  pyd_pk: string;
  pyd_code: string;
  pyd_emp: string | null;
  pyd_salary: number | null;
  pyd_deduct: number | null;
  pyd_sss: number | null;
  pyd_ssser: number | null;
  pyd_phic: number | null;
  pyd_hdmf: number | null;
  pyd_tax: number | null;
}

interface SalaryRow {
  emp_id: string;
  emp_salamt: number | null;
  emp_salpayrolltype: string | null;
  emp_saldatefrom: Date | null;
  emp_salstatus: number | null;
}

/** Near-equality in pesos. Stored values are floats, so exact compare is wrong. */
function near(a: number, b: number, tol = 0.005): boolean {
  return Math.abs(a - b) <= tol;
}

/** True when x is a plausible day count: a whole day, half day, or 1/8th (an hour). */
function isCleanDays(x: number): boolean {
  const eighths = x * 8;
  return Math.abs(eighths - Math.round(eighths)) < 1e-6;
}

function fmt(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined) return "-";
  return n.toFixed(dp);
}

async function main() {
  const url = new URL(DATABASE_URL!);
  const conn = await mariadb.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: url.username,
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectTimeout: 20000,
  });

  try {
    // ---- settings: the year-days factor drives every rate -------------------
    const [settings] = await conn.query(
      "SELECT set_id, set_yrdays, set_wkdays FROM settings_tab LIMIT 1",
    );
    const factor: number = Number(settings?.set_yrdays);
    if (!factor) throw new Error("settings_tab.set_yrdays is not set");
    console.log(
      `settings: set_id=${settings.set_id} set_yrdays=${factor} set_wkdays=${settings.set_wkdays}\n`,
    );

    // ---- statutory bracket tables (loaded once) -----------------------------
    const sssBrackets: SssBracket[] = await conn.query("SELECT * FROM govtsss");
    const phicBrackets: PhilhealthBracket[] = await conn.query("SELECT * FROM govtph");
    const hdmfBrackets: PagibigBracket[] = await conn.query("SELECT * FROM govtpag");
    const taxBrackets: TaxBracket[] = await conn.query("SELECT * FROM govttax");
    console.log(
      `brackets: sss=${sssBrackets.length} phic=${phicBrackets.length} ` +
        `hdmf=${hdmfBrackets.length} tax=${taxBrackets.length}`,
    );

    // ---- the runs to check --------------------------------------------------
    // Posted runs are the specification; drafts (status 0) and voided runs
    // (status 3) disagree with each other and with themselves.
    const where = RUN_FILTER
      ? "WHERE pyh_code = ?"
      : INCLUDE_ALL
        ? ""
        : "WHERE pyh_status = '1' AND pyh_posteddate IS NOT NULL";
    const headers: PayHeaderRow[] = await conn.query(
      `SELECT pyh_code, pyh_from, pyh_to, pyh_year, pyh_month, pyh_desc, pyh_status, pyh_posteddate
         FROM pay_header
        ${where}
        ORDER BY pyh_year, pyh_month, pyh_code`,
      RUN_FILTER ? [RUN_FILTER] : [],
    );
    console.log(
      RUN_FILTER
        ? `scope: single run ${RUN_FILTER}`
        : INCLUDE_ALL
          ? "scope: ALL runs (incl. drafts + voided)"
          : "scope: posted runs only",
    );

    if (headers.length === 0) {
      console.log("No matching pay_header rows.");
      return;
    }

    let slips = 0;
    let decomposed = 0;
    let unexplained = 0;
    let noSalary = 0;
    let statutoryChecked = 0;
    const mismatches: string[] = [];
    const knownBad: string[] = [];

    for (const h of headers) {
      const details: PayDetailRow[] = await conn.query(
        `SELECT pyd_pk, pyd_code, pyd_emp, pyd_salary, pyd_deduct,
                pyd_sss, pyd_ssser, pyd_phic, pyd_hdmf, pyd_tax
           FROM pay_details WHERE pyd_code = ? ORDER BY pyd_pk`,
        [h.pyh_code],
      );
      if (details.length === 0) continue;

      if (VERBOSE) {
        console.log(
          `\n=== ${h.pyh_code}  ${h.pyh_desc ?? ""}  [status ${h.pyh_status}]  ` +
            `${h.pyh_from?.toISOString().slice(0, 10)} .. ${h.pyh_to?.toISOString().slice(0, 10)}`,
        );
      }

      for (const d of details) {
        slips += 1;
        if (!d.pyd_emp) continue;

        // Salary effective for this period.
        const sals: SalaryRow[] = await conn.query(
          `SELECT emp_id, emp_salamt, emp_salpayrolltype, emp_saldatefrom, emp_salstatus
             FROM empsalary
            WHERE emp_id = ? AND emp_saldatefrom <= ?
            ORDER BY emp_saldatefrom DESC`,
          [d.pyd_emp, h.pyh_to ?? h.pyh_from],
        );
        const sal = sals.find((s) => s.emp_salstatus === 1) ?? sals[0];
        if (!sal || !sal.emp_salamt || !sal.emp_salpayrolltype) {
          noSalary += 1;
          if (VERBOSE) console.log(`  ${d.pyd_emp}: no empsalary row for period — skipped`);
          continue;
        }

        const type = sal.emp_salpayrolltype as PayrollType;
        const rates = deriveRates(sal.emp_salamt, type, factor);
        const basic = basicForCutoff(sal.emp_salamt, type);

        // Stored component breakdown for this payslip.
        const comps: { pya_def: string; pya_amt: number }[] = await conn.query(
          `SELECT pya_def, pya_amt FROM pay_amounts
            WHERE pya_code = ? AND pya_def IN (?, ?, ?)`,
          [d.pyd_pk, CD_ABSENT, CD_LATE, CD_UNDERTIME],
        );
        const byDef = new Map(comps.map((c) => [c.pya_def, Number(c.pya_amt)]));
        const absentAmt = byDef.get(CD_ABSENT) ?? 0;
        const lateAmt = byDef.get(CD_LATE) ?? 0;
        const utAmt = byDef.get(CD_UNDERTIME) ?? 0;

        // Invert the rate ladder: what quantities produced those amounts?
        const absentDays = absentAmt / rates.daily;
        const lateMins = lateAmt / rates.minute;
        const utMins = utAmt / rates.minute;

        const componentSum = absentAmt + lateAmt + utAmt;
        const storedDeduct = Number(d.pyd_deduct ?? 0);
        const deductMatches = near(componentSum, storedDeduct);

        // Does the basic we derive agree with what was stored?
        const basicMatches = basic === 0 || near(basic, Number(d.pyd_salary ?? 0), 0.01);

        if (deductMatches && (absentAmt === 0 || isCleanDays(absentDays))) decomposed += 1;
        else if (storedDeduct !== 0) unexplained += 1;

        if (!basicMatches) {
          const line =
            `${d.pyd_pk} emp ${d.pyd_emp}: basic derived ${fmt(basic)} vs stored ${fmt(d.pyd_salary)} ` +
            `(${type} ${fmt(sal.emp_salamt)})`;
          const known = KNOWN_BAD_SLIPS.get(d.pyd_pk);
          if (known) knownBad.push(`${line}  [${known}]`);
          else mismatches.push(line);
        }
        if (!deductMatches && storedDeduct !== 0) {
          mismatches.push(
            `${d.pyd_pk} emp ${d.pyd_emp}: CD7+CD8+CD9 ${fmt(componentSum)} vs pyd_deduct ${fmt(storedDeduct)}`,
          );
        }

        // ---- statutory ------------------------------------------------------
        // Only checked on runs that actually applied statutory deductions; the
        // 2024 DEV runs stored zeros across the board.
        const anyStatutory =
          Number(d.pyd_sss ?? 0) !== 0 ||
          Number(d.pyd_phic ?? 0) !== 0 ||
          Number(d.pyd_hdmf ?? 0) !== 0;

        if (anyStatutory) {
          const monthly = statutoryBasis(rates);
          // Use the SSS schedule effective for the period being paid: the
          // 2024 table for the Dec-2024 cutoff, the 2025 table from Jan 2025.
          const sssTable = selectSssTable(sssBrackets, h.pyh_to ?? h.pyh_from);
          const sss = computeSss(monthly, sssTable);
          const phic = computePhilhealth(monthly, phicBrackets);
          const hdmf = computePagibig(monthly, hdmfBrackets);

          const statutoryEE = sss.employee + phic.employee + hdmf.employee;
          // The run cadence drives the tax table, not emp_salpayrolltype:
          // employee 000009 is "M" but was taxed on the "S" schedule.
          const tax = computeTax(
            // The legacy base is basic - statutory. Neither taxable earnings
            // nor time deductions enter it; see `taxableIncome`.
            taxableIncome({ basic, statutoryEmployee: statutoryEE }),
            taxBrackets,
            "S",
          );

          const checks: [string, number, number][] = [
            ["sss", sss.employee, Number(d.pyd_sss ?? 0)],
            ["sss_er", sss.employer, Number(d.pyd_ssser ?? 0)],
            ["phic", phic.employee, Number(d.pyd_phic ?? 0)],
            ["hdmf", hdmf.employee, Number(d.pyd_hdmf ?? 0)],
            ["tax", tax.amount, Number(d.pyd_tax ?? 0)],
          ];
          for (const [label, got, want] of checks) {
            // 2024 runs predate the ER columns being populated; skip those.
            if (label === "sss_er" && want === 0 && got !== 0) continue;
            if (!near(got, want, 0.01)) {
              const line = `${d.pyd_pk} emp ${d.pyd_emp}: ${label} computed ${fmt(got)} vs stored ${fmt(want)}`;
              const known = KNOWN_BAD_SLIPS.get(d.pyd_pk);
              if (known) knownBad.push(`${line}  [${known}]`);
              else mismatches.push(line);
            }
          }
          statutoryChecked += 1;
        }

        if (VERBOSE) {
          console.log(
            `  ${d.pyd_emp} ${type} ${fmt(sal.emp_salamt)}` +
              ` | daily ${fmt(rates.daily, 6)} min ${fmt(rates.minute, 6)}` +
              ` | basic ${fmt(basic)}/${fmt(d.pyd_salary)}` +
              ` | absent ${fmt(absentAmt)} = ${fmt(absentDays, 4)}d` +
              ` | late ${fmt(lateAmt)} = ${fmt(lateMins, 2)}m` +
              ` | ut ${fmt(utAmt)} = ${fmt(utMins, 2)}m` +
              ` | statutory sss ${fmt(d.pyd_sss)}/${fmt(d.pyd_ssser)} phic ${fmt(d.pyd_phic)} hdmf ${fmt(d.pyd_hdmf)} tax ${fmt(d.pyd_tax)}` +
              ` | msc-basis ${fmt(statutoryBasis(rates))}`,
          );
        }
      }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`runs checked      : ${headers.length}`);
    console.log(`payslips          : ${slips}`);
    console.log(`cleanly decomposed: ${decomposed}`);
    console.log(`unexplained       : ${unexplained}`);
    console.log(`no empsalary row  : ${noSalary}`);
    console.log(`statutory checked : ${statutoryChecked}`);
    if (knownBad.length) {
      console.log(`\nknown-bad legacy data, not engine failures (${knownBad.length}):`);
      for (const m of knownBad) console.log("  " + m);
    }
    if (mismatches.length) {
      console.log(`\nMISMATCHES (${mismatches.length}):`);
      for (const m of mismatches.slice(0, 40)) console.log("  " + m);
      if (mismatches.length > 40) console.log(`  ... and ${mismatches.length - 40} more`);
      process.exitCode = 1;
    } else {
      console.log("\nPARITY GREEN — no unexplained mismatches");
    }
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
