/**
 * End-to-end tests for the payslip orchestrator.
 *
 * The two headline cases reproduce POSTED payslips from run PR052025104 in
 * full — basic, statutory and tax together — which is the strongest check the
 * engine has short of the parity harness.
 *
 * Run: npx tsx --test lib/services/payroll/compute.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { computePayslip, type ComputeInput } from "./compute";
import type { SssBracket, PhilhealthBracket, PagibigBracket, TaxBracket } from "./statutory";

function sss(over: Partial<SssBracket>): SssBracket {
  return {
    gss_code: "20251-1", gss_fr: 0, gss_to: 0, gss_ec: 0, gss_wisp: 0, gss_msct: 0,
    gss_rsser: 0, gss_rssee: 0, gss_rsst: 0, gss_ecer: 0, gss_ecee: 0, gss_ect: 0,
    gss_wisper: 0, gss_wipee: 0, gss_wispt: 0, gss_ter: 0, gss_tee: 0, gss_tt: 0,
    gss_stat: "1", ...over,
  };
}

/** Real 2025 rows for the three posted employees. */
const SSS: SssBracket[] = [
  sss({ gss_code: "20251-51", gss_fr: 29750, gss_to: 30249.99, gss_msct: 30000, gss_tee: 1500, gss_ter: 3030 }),
  sss({ gss_code: "20251-53", gss_fr: 30750, gss_to: 31249.99, gss_msct: 31000, gss_tee: 1550, gss_ter: 3130 }),
  sss({ gss_code: "20251-24", gss_fr: 16250, gss_to: 16749.99, gss_msct: 16500, gss_tee: 825, gss_ter: 1680 }),
];

const PHIC: PhilhealthBracket[] = [
  { gph_code: "PH1", gph_fr: 0, gph_to: 10000, gph_rate: 5, gph_ems: 500, gph_ees: 500 },
  { gph_code: "PH2", gph_fr: 10000.01, gph_to: 99999.99, gph_rate: 5, gph_ems: 0, gph_ees: 0 },
];

const HDMF: PagibigBracket[] = [
  { gpg_code: "PG1", gpg_frm: 0, gpg_to: 1500, gpg_emrate: 1, gpg_pagem: 100, gpg_errate: 2, gpg_pager: 100 },
  { gpg_code: "PG2", gpg_frm: 1501, gpg_to: 1000000, gpg_emrate: 2, gpg_pagem: 200, gpg_errate: 2, gpg_pager: 200 },
];

const TAX: TaxBracket[] = [
  { gtx_code: "S1", gtx_rangefrm: 0, gtx_rangeto: 10417, gtx_rate: 0, gtx_amt: 0 },
  { gtx_code: "S2", gtx_rangefrm: 10417, gtx_rangeto: 16666, gtx_rate: 15, gtx_amt: 0 },
];

const PERIOD = { start: "2025-05-01", end: "2025-05-15", cutoff: 1 } as const;

function input(over: Partial<ComputeInput> = {}): ComputeInput {
  return {
    employee: "000008",
    period: { ...PERIOD },
    salary: { amount: 15000, type: "S" },
    yearDays: 313,
    attendance: [],
    brackets: { sss: SSS, philhealth: PHIC, pagibig: HDMF, tax: TAX },
    ...over,
  };
}

test("posted payslip PR0520251040 (employee 000008) reproduces in full", () => {
  const r = computePayslip(input());
  assert.equal(r.basic, 15000);
  assert.equal(r.statutoryEmployee, 1500 + 750 + 200);
  assert.equal(r.statutoryEmployer, 3030 + 750 + 200);
  assert.equal(r.taxableIncome, 12550);
  assert.ok(Math.abs(r.tax - 319.95) < 0.005, `tax ${r.tax}`);
});

test("posted payslip PR0520251041 (employee 000009, type M) reproduces in full", () => {
  const r = computePayslip(
    input({ employee: "000009", salary: { amount: 31000, type: "M" } }),
  );
  assert.equal(r.basic, 15500); // monthly halved for the cutoff
  assert.equal(r.statutoryEmployee, 1550 + 775 + 200);
  assert.equal(r.taxableIncome, 12975);
  assert.ok(Math.abs(r.tax - 383.7) < 0.005, `tax ${r.tax}`);
});

test("posted payslip PR0520251042 (employee 000010) reproduces its late deduction", () => {
  // 900 late minutes -> 1187.1805111821086, and taxable falls below the floor.
  const r = computePayslip(
    input({
      employee: "000010",
      salary: { amount: 16515, type: "M" },
      attendance: [
        {
          date: "2025-05-05", scheduled: true, restDay: false, holiday: "N",
          hasPunch: true, lateMinutes: 900, undertimeMinutes: 0,
        },
      ],
    }),
  );
  assert.equal(r.basic, 8257.5);
  assert.ok(Math.abs(r.timeDeductions - 1187.1805111821086) < 1e-9);
  assert.equal(r.statutoryEmployee, 825 + 412.875 + 200);
  assert.equal(r.tax, 0);
});

test("an allowance is paid but excluded from tax, matching the legacy engine", () => {
  const r = computePayslip(input({ salary: { amount: 15000, type: "S", allowance: 1500 } }));
  assert.equal(r.grossEarnings, 16500, "the allowance is still paid");
  assert.equal(r.taxableIncome, 12550, "but not taxed");
  assert.ok(Math.abs(r.tax - 319.95) < 0.005);
});

test("includeEarningsInTax flips the allowance into taxable income", () => {
  const r = computePayslip(
    input({
      period: { ...PERIOD, includeEarningsInTax: true },
      salary: { amount: 15000, type: "S", allowance: 1500 },
    }),
  );
  assert.equal(r.taxableIncome, 14050);
  assert.ok(Math.abs(r.tax - 544.95) < 0.005);
});

test("absences reduce pay but not the withholding base", () => {
  const absent = Array.from({ length: 5 }, (_, i) => ({
    date: `2025-05-0${i + 1}`, scheduled: true, restDay: false, holiday: "N",
    hasPunch: false, lateMinutes: 0, undertimeMinutes: 0,
  }));
  const r = computePayslip(input({ attendance: absent }));
  assert.equal(r.quantities.absentDays, 5);
  assert.ok(r.timeDeductions > 0);
  assert.ok(r.net < 15000, "absence must lower take-home pay");
  // ...but NOT the withholding base — that is the legacy rule.
  assert.equal(r.taxableIncome, 12550, "deductions must not touch the tax base");

  const opted = computePayslip(
    input({ period: { ...PERIOD, deductTimeFromTax: true }, attendance: absent }),
  );
  assert.ok(opted.taxableIncome < 12550, "the flag opts into lowering it");
});

test("paid leave keeps the employee whole", () => {
  const day = {
    date: "2025-05-02", scheduled: true, restDay: false, holiday: "N",
    hasPunch: false, lateMinutes: 0, undertimeMinutes: 0,
  };
  const withLeave = computePayslip(
    input({
      attendance: [day],
      leave: [{
        id: "L", employee: "000008", leaveType: "L1", status: 1,
        withPayDays: 1, withoutPayDays: 0,
        dates: [{ date: "2025-05-02", sequence: 1, duration: "W", half: "A" }],
      }],
    }),
  );
  assert.equal(withLeave.quantities.absentDays, 0);
  assert.equal(withLeave.timeDeductions, 0);
});

test("R7: unpaid leave is deducted, not paid", () => {
  const day = {
    date: "2025-05-02", scheduled: true, restDay: false, holiday: "N",
    hasPunch: false, lateMinutes: 0, undertimeMinutes: 0,
  };
  const r = computePayslip(
    input({
      attendance: [day],
      leave: [{
        id: "L", employee: "000008", leaveType: "L1", status: 1,
        withPayDays: 0, withoutPayDays: 1,
        dates: [{ date: "2025-05-02", sequence: 1, duration: "W", half: "A" }],
      }],
    }),
  );
  assert.equal(r.quantities.absentDays, 1);
  assert.ok(r.timeDeductions > 0, "unpaid leave must cost the employee a day");
});

test("mode None switches statutory deductions off entirely", () => {
  const r = computePayslip(
    input({
      period: {
        ...PERIOD,
        sssMode: "none", philhealthMode: "none", pagibigMode: "none",
        applyTax: false,
      },
    }),
  );
  assert.equal(r.statutoryEmployee, 0);
  assert.equal(r.tax, 0);
  assert.equal(r.net, 15000);
});

test("premiums are added to gross and priced from the buckets", () => {
  const r = computePayslip(
    input({
      premiumDays: [{ ot: "08:00:00" }],
      overtimeRates: { rts: "OT1", ot: 1.25 },
    }),
  );
  assert.equal(r.premiums.totalHours, 8);
  assert.ok(Math.abs(r.premiums.totalAmount - 8 * 1.25 * r.rates.hourly) < 1e-9);
  assert.ok(Math.abs(r.grossEarnings - (15000 + r.premiums.totalAmount)) < 1e-9);
});

test("an advance instalment is deducted and reduces net", () => {
  const r = computePayslip(
    input({
      advances: [{
        id: "A1", type: "Company Loan", principal: 10000, addedAmount: 300,
        perPay: 500, paysPerMonth: 2, cutoff: null,
        start: "2025-01-01", end: null, paid: 0, status: 1,
      }],
    }),
  );
  assert.equal(r.loans, 500);
  assert.equal(r.advanceDeductions[0].balanceAfter, 9800);
  const base = computePayslip(input());
  assert.ok(Math.abs(base.net - r.net - 500) < 1e-9);
});

test("the payslip carries the SSS audit snapshot", () => {
  const codes = computePayslip(input()).components.map((c) => c.code);
  assert.ok(codes.includes("CD1"), "basic salary line");
  assert.ok(codes.includes("CD11"), "SSS");
  assert.ok(codes.includes("CD1114"), "SSS employee snapshot");
  assert.ok(codes.includes("CD1201"), "PhilHealth rate snapshot");
  assert.ok(codes.includes("CD1301"), "Pag-IBIG rate snapshot");
});

test("net equals gross minus every deduction", () => {
  const r = computePayslip(
    input({
      salary: { amount: 15000, type: "S", allowance: 1000, deMinimis: 500 },
      attendance: [{
        date: "2025-05-02", scheduled: true, restDay: false, holiday: "N",
        hasPunch: true, lateMinutes: 60, undertimeMinutes: 30,
      }],
      advances: [{
        id: "A1", type: "Company Loan", principal: 5000, addedAmount: 0,
        perPay: 250, paysPerMonth: 2, cutoff: null,
        start: "2025-01-01", end: null, paid: 0, status: 1,
      }],
      adjustments: [{ counter: 1, code: "CD15", type: "D", description: "charge", amount: 100, taxable: 0 }],
    }),
  );
  assert.ok(Math.abs(r.net - (r.grossEarnings - r.totalDeductions)) < 1e-9);
  assert.ok(
    Math.abs(
      r.totalDeductions -
        (r.timeDeductions + r.statutoryEmployee + r.tax + r.loans + r.adjustmentDeductions),
    ) < 1e-9,
  );
});

test("mode Half collects half the monthly contribution", () => {
  const full = computePayslip(input());
  const half = computePayslip(
    input({
      period: {
        ...PERIOD,
        sssMode: "half", philhealthMode: "half", pagibigMode: "half",
      },
    }),
  );
  // Employee 000008: monthly 30,000 -> SSS 1,500 / PHIC 750 / HDMF 200 full.
  assert.equal(full.statutoryEmployee, 2450);
  assert.equal(half.statutoryEmployee, 1225);
  assert.equal(half.statutoryEmployer, full.statutoryEmployer / 2);
});

test("mode Half caps Pag-IBIG on the monthly figure before halving", () => {
  // 30,000 x 2% = 600, capped to 200, then halved to 100. Capping after
  // halving would wrongly yield the full 200.
  const half = computePayslip(
    input({ period: { ...PERIOD, sssMode: "none", philhealthMode: "none", pagibigMode: "half" } }),
  );
  assert.equal(half.statutoryEmployee, 100);
});
