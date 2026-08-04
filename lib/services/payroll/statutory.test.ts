/**
 * Unit tests for statutory contributions.
 *
 * Fixtures are copied verbatim from the live `govtsss` / `govtph` / `govtpag` /
 * `govttax` rows, and every expected value comes from a POSTED payslip rather
 * than from theory.
 *
 * Run: npx tsx --test lib/services/payroll/statutory.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  computeSss,
  computePhilhealth,
  computePagibig,
  computeTax,
  taxableIncome,
  selectSssTable,
  sssTableYear,
  findSssBracket,
  sssSnapshot,
  taxBracketsFor,
  type SssBracket,
  type PhilhealthBracket,
  type PagibigBracket,
  type TaxBracket,
} from "./statutory";

// --------------------------------------------------------------- fixtures ---

function sss(over: Partial<SssBracket>): SssBracket {
  return {
    gss_code: "20251-1",
    gss_fr: 0,
    gss_to: 0,
    gss_ec: 0,
    gss_wisp: 0,
    gss_msct: 0,
    gss_rsser: 0,
    gss_rssee: 0,
    gss_rsst: 0,
    gss_ecer: 0,
    gss_ecee: 0,
    gss_ect: 0,
    gss_wisper: 0,
    gss_wipee: 0,
    gss_wispt: 0,
    gss_ter: 0,
    gss_tee: 0,
    gss_tt: 0,
    gss_stat: "1",
    ...over,
  };
}

/** The two real rows covering monthly 30,000, one per schedule. */
const SSS_2025_30K = sss({
  gss_code: "20251-51",
  gss_fr: 29750,
  gss_to: 30249.99,
  gss_ec: 20000,
  gss_wisp: 10000,
  gss_msct: 30000,
  gss_rsser: 2000,
  gss_rssee: 1000,
  gss_rsst: 30,
  gss_ecer: 3030,
  gss_ecee: 1000,
  gss_ect: 500,
  gss_wisper: 1500,
  gss_wipee: 0,
  gss_wispt: 0,
  gss_ter: 3030,
  gss_tee: 1500,
  gss_tt: 4530,
  gss_stat: "1",
});

const SSS_2024_30K = sss({
  gss_code: "20241-53",
  gss_fr: 29750,
  gss_to: 1000000,
  gss_msct: 30000,
  gss_ter: 2880,
  gss_tee: 1350,
  gss_stat: "0",
});

/** Real rows covering monthly 20,000 — 5% in 2025 vs 4.5% in 2024. */
const SSS_2025_20K = sss({
  gss_code: "20251-33",
  gss_fr: 19750,
  gss_to: 20249.99,
  gss_tee: 1000,
  gss_ter: 2050,
  gss_stat: "1",
});
const SSS_2024_20K = sss({
  gss_code: "20241-35",
  gss_fr: 19750,
  gss_to: 20249.99,
  gss_tee: 900,
  gss_ter: 1930,
  gss_stat: "0",
});

const ALL_SSS = [SSS_2025_30K, SSS_2024_30K, SSS_2025_20K, SSS_2024_20K];

const PHIC: PhilhealthBracket[] = [
  { gph_code: "PH1", gph_fr: 0, gph_to: 10000, gph_rate: 5, gph_ems: 500, gph_ees: 500 },
  { gph_code: "PH2", gph_fr: 10000.01, gph_to: 99999.99, gph_rate: 5, gph_ems: 0, gph_ees: 0 },
  { gph_code: "PH3", gph_fr: 100000, gph_to: 1000000, gph_rate: 5, gph_ems: 5000, gph_ees: 5000 },
];

const HDMF: PagibigBracket[] = [
  { gpg_code: "PG1", gpg_frm: 0, gpg_to: 1500, gpg_emrate: 1, gpg_pagem: 100, gpg_errate: 2, gpg_pager: 100 },
  { gpg_code: "PG2", gpg_frm: 1501, gpg_to: 1000000, gpg_emrate: 2, gpg_pagem: 200, gpg_errate: 2, gpg_pager: 200 },
];

/** The semi-monthly ("S") BIR schedule, plus one monthly row to prove filtering. */
const TAX: TaxBracket[] = [
  { gtx_code: "S1", gtx_rangefrm: 0, gtx_rangeto: 10417, gtx_rate: 0, gtx_amt: 0 },
  { gtx_code: "S2", gtx_rangefrm: 10417, gtx_rangeto: 16666, gtx_rate: 15, gtx_amt: 0 },
  { gtx_code: "S3", gtx_rangefrm: 16667, gtx_rangeto: 33332, gtx_rate: 20, gtx_amt: 1250 },
  { gtx_code: "M1", gtx_rangefrm: 0, gtx_rangeto: 20832, gtx_rate: 0, gtx_amt: 0 },
  { gtx_code: "M2", gtx_rangefrm: 20833, gtx_rangeto: 33332, gtx_rate: 15, gtx_amt: 0 },
];

// -------------------------------------------------------------------- SSS ---

test("SSS: posted run PR052025104 reproduces exactly", () => {
  const table = selectSssTable(ALL_SSS, new Date("2025-05-14"));
  const r = computeSss(30000, table);
  assert.equal(r.employee, 1500); // stored pyd_sss
  assert.equal(r.employer, 3030); // stored pyd_ssser
});

test("SSS: the Dec-2024 cutoff uses the 2024 schedule", () => {
  // Posted run PR012025101 covers 14-30 Dec 2024: employee 000001 (monthly
  // 20,000) was deducted 900 at 4.5%, not the 1,000 the 2025 table gives.
  const table = selectSssTable(ALL_SSS, new Date("2024-12-30"));
  assert.equal(computeSss(20000, table).employee, 900);
});

test("SSS: schedule year comes from the code prefix, not gss_logdate", () => {
  assert.equal(sssTableYear(SSS_2024_30K), 2024);
  assert.equal(sssTableYear(SSS_2025_30K), 2025);
});

test("SSS: omitting the period selects the current schedule", () => {
  assert.equal(computeSss(30000, selectSssTable(ALL_SSS)).employee, 1500);
});

test("SSS: an unfiltered mixed table must not double-match (risk R1)", () => {
  // Passing all four rows straight in still resolves to one answer.
  const r = computeSss(30000, ALL_SSS);
  assert.equal(r.employee, 1500, "must fall back to the current schedule");
});

test("SSS: a period older than every schedule falls back to the earliest", () => {
  assert.equal(computeSss(20000, selectSssTable(ALL_SSS, new Date("2019-01-01"))).employee, 900);
});

test("SSS: the CD11xx snapshot is the 15 value columns in order", () => {
  const bracket = findSssBracket(30000, selectSssTable(ALL_SSS, new Date("2025-05-14")));
  const snap = sssSnapshot(bracket);
  assert.equal(snap.length, 15);
  // Verified against stored pay_amounts for payslip PR0520251040.
  assert.deepEqual(
    snap.map((c) => [c.code, c.amount]),
    [
      ["CD1101", 20000], ["CD1102", 10000], ["CD1103", 30000],
      ["CD1104", 2000], ["CD1105", 1000], ["CD1106", 30],
      ["CD1107", 3030], ["CD1108", 1000], ["CD1109", 500],
      ["CD1110", 1500], ["CD1111", 0], ["CD1112", 0],
      ["CD1113", 3030], ["CD1114", 1500], ["CD1115", 4530],
    ],
  );
});

// ------------------------------------------------------------- PhilHealth ---

test("PhilHealth: percentage band splits 50/50", () => {
  const r = computePhilhealth(30000, PHIC); // posted pyd_phic 750
  assert.equal(r.employee, 750);
  assert.equal(r.employer, 750);
});

test("PhilHealth: the floor bracket uses its fixed premium", () => {
  // Employee 000011, monthly 4 -> stored 250 (half of the 500 fixed premium).
  assert.equal(computePhilhealth(4, PHIC).employee, 250);
  assert.equal(computePhilhealth(2000, PHIC).employee, 250);
});

test("PhilHealth: 20,000 monthly gives the posted 500", () => {
  assert.equal(computePhilhealth(20000, PHIC).employee, 500);
});

test("PhilHealth: the centavo gap between brackets still resolves", () => {
  assert.equal(computePhilhealth(10000, PHIC).bracketCode, "PH1");
  assert.equal(computePhilhealth(10000.01, PHIC).bracketCode, "PH2");
});

// --------------------------------------------------------------- Pag-IBIG ---

test("Pag-IBIG: percentage is capped in pesos", () => {
  // 30,000 x 2% = 600, capped to 200 (posted pyd_hdmf 200).
  const r = computePagibig(30000, HDMF);
  assert.equal(r.employee, 200);
  assert.equal(r.employer, 200);
});

test("Pag-IBIG: under the cap the raw percentage applies", () => {
  assert.equal(computePagibig(2000, HDMF).employee, 40); // posted 40
});

test("Pag-IBIG: the cap is a ceiling, never a floor", () => {
  // Employee 000011, monthly 4 -> stored 0.04, not the 100 cap.
  assert.ok(Math.abs(computePagibig(4, HDMF).employee - 0.04) < 1e-9);
});

// -------------------------------------------------------------------- tax ---

test("tax: both posted taxpayers reproduce to the centavo", () => {
  // emp 000008: 15,000 - (1,500 + 750 + 200) = 12,550 -> 319.95
  const a = taxableIncome({ basic: 15000, statutoryEmployee: 1500 + 750 + 200 });
  assert.equal(a, 12550);
  assert.ok(Math.abs(computeTax(a, TAX, "S").amount - 319.95) < 0.005);

  // emp 000009: 15,500 - (1,550 + 775 + 200) = 12,975 -> 383.70
  const b = taxableIncome({ basic: 15500, statutoryEmployee: 1550 + 775 + 200 });
  assert.equal(b, 12975);
  assert.ok(Math.abs(computeTax(b, TAX, "S").amount - 383.70) < 0.005);
});

test("tax: time deductions do NOT reduce the withholding base", () => {
  // PR022026201 employee 000009: 34,742.09 deducted, still taxed 256.20 on
  // 14,500 - 2,375 = 12,125. Employee 000001 is the same story with 1,480.11.
  const base = taxableIncome({
    basic: 14500,
    timeDeductions: 34742.09,
    statutoryEmployee: 1450 + 725 + 200,
  });
  assert.equal(base, 12125, "deductions must not touch the base");
  assert.ok(Math.abs(computeTax(base, TAX, "S").amount - 256.2) < 0.005);
});

test("tax: deductTimeFromTax opts into subtracting absences", () => {
  const opted = taxableIncome({
    basic: 14500,
    timeDeductions: 34742.09,
    statutoryEmployee: 1450 + 725 + 200,
    deductTimeFromTax: true,
  });
  assert.equal(opted, 0, "deductions exceeding pay floor the base at zero");
  assert.equal(computeTax(opted, TAX, "S").amount, 0);
});

test("tax: a de minimis benefit is paid but not taxed", () => {
  // PR022026201 employee 000001: 1,500 de minimis, taxed on 12,125 -> 256.20.
  const base = taxableIncome({
    basic: 14500,
    taxableEarnings: 1500,
    statutoryEmployee: 1450 + 725 + 200,
  });
  assert.equal(base, 12125);
  assert.ok(Math.abs(computeTax(base, TAX, "S").amount - 256.2) < 0.005);
});

test("tax: allowances are excluded by default to preserve parity", () => {
  // Employee 000008 received a 1,500 allowance yet was taxed on 12,550.
  // Including it would give 544.95 and break the posted 319.95.
  const excluded = taxableIncome({
    basic: 15000,
    taxableEarnings: 1500,
    statutoryEmployee: 2450,
  });
  assert.equal(excluded, 12550);

  const included = taxableIncome({
    basic: 15000,
    taxableEarnings: 1500,
    statutoryEmployee: 2450,
    includeEarnings: true,
  });
  assert.equal(included, 14050);
  assert.ok(Math.abs(computeTax(included, TAX, "S").amount - 544.95) < 0.005);
});

test("tax: the frequency picks the schedule", () => {
  assert.deepEqual(taxBracketsFor(TAX, "S").map((b) => b.gtx_code), ["S1", "S2", "S3"]);
  assert.deepEqual(taxBracketsFor(TAX, "M").map((b) => b.gtx_code), ["M1", "M2"]);
  // 12,975 is taxable semi-monthly but exempt monthly.
  assert.ok(computeTax(12975, TAX, "S").amount > 0);
  assert.equal(computeTax(12975, TAX, "M").amount, 0);
});

test("tax: the fixed component is added on top of the marginal rate", () => {
  // S3: (20,000 - 16,667) x 20% + 1,250
  const expected = (20000 - 16667) * 0.2 + 1250;
  assert.ok(Math.abs(computeTax(20000, TAX, "S").amount - expected) < 1e-9);
});

test("tax: zero or negative taxable income is never taxed", () => {
  assert.equal(computeTax(0, TAX, "S").amount, 0);
  assert.equal(computeTax(-500, TAX, "S").amount, 0);
  assert.equal(taxableIncome({ basic: 1000, statutoryEmployee: 5000 }), 0);
});

// ------------------------------------------------- cd_tax-driven tax base ---

import { taxableFromComponents } from "./statutory";

/** The live `comded` config: cd_tax = does this line enter taxable income. */
const RULES = new Map<string, { taxable: boolean; onSlip: boolean }>([
  // credits
  ["CD1", { taxable: true, onSlip: true }], // Salary
  ["CD2", { taxable: true, onSlip: true }], // Overtime
  ["CD3", { taxable: true, onSlip: true }], // Allowance
  ["CD4", { taxable: true, onSlip: true }], // De Minimis
  ["CD5", { taxable: false, onSlip: true }], // Reimbursement
  ["CD6", { taxable: false, onSlip: true }], // Commission
  ["CD16", { taxable: false, onSlip: true }], // COLA
  ["CD18", { taxable: false, onSlip: true }], // Telco Allowance
  // deductions
  ["CD7", { taxable: true, onSlip: true }], // Absent
  ["CD8", { taxable: true, onSlip: true }], // Late
  ["CD9", { taxable: true, onSlip: true }], // Undertime
  ["CD10", { taxable: true, onSlip: true }], // Tax itself
  ["CD11", { taxable: true, onSlip: true }], // SSS
  ["CD12", { taxable: true, onSlip: true }], // PHIC
  ["CD13", { taxable: true, onSlip: true }], // HDMF
  ["CD14", { taxable: false, onSlip: true }], // Coop
  ["CD15", { taxable: false, onSlip: true }], // Charge
  ["CD17", { taxable: false, onSlip: true }], // Personal Loan
  // audit snapshots — never money
  ["CD1001", { taxable: true, onSlip: false }],
  ["CD1114", { taxable: true, onSlip: false }],
  ["CD1201", { taxable: true, onSlip: false }],
]);

const C = (code: string, amount: number) => ({ code, type: "C" as const, amount });
const D = (code: string, amount: number) => ({ code, type: "D" as const, amount });

test("cd_tax base: taxable credits minus taxable deductions", () => {
  // PR022026201 employee 000001 under the cd_tax rule.
  const base = taxableFromComponents(
    [
      C("CD1", 14500), C("CD4", 1500),
      D("CD9", 1480.111821086262),
      D("CD11", 1450), D("CD12", 725), D("CD13", 200),
    ],
    RULES,
  );
  assert.ok(Math.abs(base - 12144.888178913738) < 1e-9, `got ${base}`);
  assert.ok(Math.abs(computeTax(base, TAX, "S").amount - 259.18) < 0.01);
});

test("cd_tax base: exempt earnings stay out", () => {
  const base = taxableFromComponents(
    [C("CD1", 10000), C("CD16", 2000), C("CD18", 1500), C("CD5", 900), C("CD6", 700)],
    RULES,
  );
  assert.equal(base, 10000, "COLA, telco, reimbursement and commission are exempt");
});

test("cd_tax base: non-taxable deductions do not reduce it", () => {
  const base = taxableFromComponents(
    [C("CD1", 10000), D("CD14", 500), D("CD15", 300), D("CD17", 1200)],
    RULES,
  );
  assert.equal(base, 10000, "coop, charge and loans must not lower taxable pay");
});

test("cd_tax base: audit-snapshot rows are excluded", () => {
  // CD1114 carries an SSS bracket value (1,500); summing it would be nonsense.
  const base = taxableFromComponents(
    [C("CD1", 10000), D("CD1114", 1500), D("CD1001", 15), D("CD1201", 5)],
    RULES,
  );
  assert.equal(base, 10000);
});

test("cd_tax base: CD10 Tax is excluded to avoid circularity", () => {
  const base = taxableFromComponents([C("CD1", 12000), D("CD10", 256.2)], RULES);
  assert.equal(base, 12000);
});

test("cd_tax base: an unconfigured code is skipped, not assumed taxable", () => {
  const base = taxableFromComponents([C("CD1", 10000), C("CD99", 5000)], RULES);
  assert.equal(base, 10000, "unknown components must not move withholding");
});

test("cd_tax base: never negative", () => {
  const base = taxableFromComponents([C("CD1", 1000), D("CD7", 9000)], RULES);
  assert.equal(base, 0);
});

test("cd_tax base: absences DO reduce it, unlike the legacy rule", () => {
  const cd = taxableFromComponents(
    [C("CD1", 14500), D("CD7", 2000), D("CD11", 1450), D("CD12", 725), D("CD13", 200)],
    RULES,
  );
  const legacy = taxableIncome({ basic: 14500, statutoryEmployee: 2375 });
  assert.equal(legacy, 12125);
  assert.equal(cd, 10125, "the cd_tax rule honours the absence");
});
