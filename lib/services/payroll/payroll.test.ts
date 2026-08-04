/**
 * Unit tests for the pure payroll modules.
 *
 * Uses Node's built-in test runner (`node:test`) so the project gains no new
 * dependency — there is no test framework configured here.
 *
 * Run:
 *   npx tsx --test lib/services/payroll/payroll.test.ts
 *
 * These cover the arithmetic in isolation. End-to-end agreement with the
 * legacy engine is checked separately by `scripts/payroll-parity.ts`, which
 * runs against the real posted payroll.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { deriveRates, annualise, basicForCutoff, statutoryBasis } from "./rates";
import {
  resolveLeaveApplication,
  paidLeaveByDate,
  type LeaveApplication,
} from "./leave";
import { quantifyDeductions, priceDeductions, type AttendanceDay } from "./deductions";

const FACTOR = 313; // settings_tab.set_yrdays on the live DB

// ---------------------------------------------------------------- rates ----

test("golden case: employee 000010 reproduces the posted deduction exactly", () => {
  // Posted payslip PR052025104 stored pyd_deduct = 1187.1805111821086 for a
  // monthly salary of 16,515. That inverts to exactly 900 late minutes.
  const rates = deriveRates(16515, "M", FACTOR);

  assert.equal(rates.annual, 198180);
  assert.equal(rates.daily, 198180 / 313);
  assert.equal(900 * rates.minute, 1187.1805111821086);
});

test("no other divisor reproduces the posted figure", () => {
  const target = 1187.1805111821086;
  for (const divisor of [312, 314, 365, 261]) {
    const minute = (16515 * 12) / divisor / 8 / 60;
    assert.notEqual(900 * minute, target, `divisor ${divisor} must not match`);
  }
});

test("annualise handles all three payroll types", () => {
  assert.equal(annualise(16515, "M", FACTOR), 198180); // monthly x 12
  assert.equal(annualise(10257.5, "S", FACTOR), 246180); // semi x 24
  assert.equal(annualise(250, "D", FACTOR), 250 * FACTOR); // daily x factor
});

test("a daily-paid employee's daily rate round-trips unchanged", () => {
  assert.equal(deriveRates(250, "D", FACTOR).daily, 250);
});

test("the spreadsheet's own ladder reproduces its Column C figures", () => {
  // sample pay.xlsx Sheet1: semi 10,257.50 -> 786.517571884984/day.
  const rates = deriveRates(10257.5, "S", FACTOR);
  assert.equal(rates.daily, 786.517571884984);
  assert.equal(rates.hourly, 786.517571884984 / 8);
});

test("basicForCutoff halves monthly but pays semi in full", () => {
  assert.equal(basicForCutoff(16515, "M"), 8257.5); // matches posted PR052025104
  assert.equal(basicForCutoff(15000, "S"), 15000); // matches posted PR052025104
  assert.equal(basicForCutoff(250, "D"), 0); // built from days worked instead
});

test("statutory brackets are looked up on the monthly figure", () => {
  // Employee 000008: semi 15,000 -> monthly 30,000 -> SSS tee 1,500 / ter 3,030.
  assert.equal(statutoryBasis(deriveRates(15000, "S", FACTOR)), 30000);
  assert.equal(statutoryBasis(deriveRates(16515, "M", FACTOR)), 16515);
});

test("an invalid factor is rejected rather than silently dividing by zero", () => {
  assert.throws(() => deriveRates(10000, "S", 0));
  assert.throws(() => deriveRates(10000, "S", -1));
});

// ---------------------------------------------------------------- leave ----

function app(over: Partial<LeaveApplication>): LeaveApplication {
  return {
    id: "LEA-TEST",
    employee: "000012",
    leaveType: "L10",
    status: 1,
    withPayDays: 0,
    withoutPayDays: 0,
    dates: [],
    ...over,
  };
}

const fourDays = [
  { date: "2025-01-06", sequence: 1, duration: "W" as const, half: "A" },
  { date: "2025-01-07", sequence: 2, duration: "W" as const, half: "" },
  { date: "2025-01-08", sequence: 3, duration: "W" as const, half: "A" },
  { date: "2025-01-09", sequence: 4, duration: "W" as const, half: "A" },
];

test("real case LEA-202501060000121: 1 paid of 4 days, earliest first", () => {
  const resolved = resolveLeaveApplication(
    app({ withPayDays: 1, withoutPayDays: 3, dates: fourDays }),
  );
  assert.deepEqual(
    resolved.map((r) => r.paid),
    [true, false, false, false],
  );
});

test("R8: a negative withPay budget pays nothing rather than throwing", () => {
  // Real row: lea_swithpay = -11, lea_swithoutpay = 13, across 2 dates.
  const resolved = resolveLeaveApplication(
    app({
      withPayDays: -11,
      withoutPayDays: 13,
      dates: fourDays.slice(0, 2),
    }),
  );
  assert.deepEqual(
    resolved.map((r) => r.paid),
    [false, false],
  );
});

test("the paid budget never exceeds the days actually applied for", () => {
  const resolved = resolveLeaveApplication(
    app({ withPayDays: 99, withoutPayDays: 0, dates: fourDays }),
  );
  assert.equal(resolved.filter((r) => r.paid).length, 4);
});

test("unapproved leave has no effect on pay", () => {
  for (const status of [0, 2, null]) {
    const resolved = resolveLeaveApplication(
      app({ status, withPayDays: 4, dates: fourDays }),
    );
    assert.deepEqual(resolved, [], `status ${status} must not resolve`);
  }
});

test("a half day consumes only half the paid budget", () => {
  const resolved = resolveLeaveApplication(
    app({
      withPayDays: 1,
      dates: [
        { date: "2025-01-06", sequence: 1, duration: "H", half: "A" },
        { date: "2025-01-07", sequence: 2, duration: "H", half: "P" },
      ],
    }),
  );
  assert.deepEqual(
    resolved.map((r) => r.paid),
    [true, true],
  );
});

test("overlapping applications cannot pay more than one day for a date", () => {
  const a = app({ id: "A", withPayDays: 1, dates: [fourDays[0]] });
  const b = app({ id: "B", withPayDays: 1, dates: [fourDays[0]] });
  assert.equal(paidLeaveByDate([a, b]).get("2025-01-06"), 1);
});

// ----------------------------------------------------------- deductions ----

function day(over: Partial<AttendanceDay>): AttendanceDay {
  return {
    date: "2026-06-25",
    scheduled: true,
    restDay: false,
    holiday: "N",
    hasPunch: true,
    lateMinutes: 0,
    undertimeMinutes: 0,
    ...over,
  };
}

test("a scheduled day with no punch and no leave is an absence", () => {
  const q = quantifyDeductions([day({ hasPunch: false })]);
  assert.equal(q.absentDays, 1);
});

test("R7: unpaid leave still counts as an absence", () => {
  const leave = paidLeaveByDate([
    app({
      withPayDays: 0,
      withoutPayDays: 1,
      dates: [{ date: "2026-06-25", sequence: 1, duration: "W", half: "A" }],
    }),
  ]);
  const q = quantifyDeductions([day({ hasPunch: false })], leave);
  assert.equal(q.absentDays, 1, "unpaid leave must not be paid");
});

test("paid leave cancels the absence", () => {
  const leave = paidLeaveByDate([
    app({
      withPayDays: 1,
      dates: [{ date: "2026-06-25", sequence: 1, duration: "W", half: "A" }],
    }),
  ]);
  const q = quantifyDeductions([day({ hasPunch: false })], leave);
  assert.equal(q.absentDays, 0);
  assert.equal(q.paidLeaveDays, 1);
});

test("a paid half day leaves half a day of absence", () => {
  const leave = paidLeaveByDate([
    app({
      withPayDays: 0.5,
      dates: [{ date: "2026-06-25", sequence: 1, duration: "H", half: "A" }],
    }),
  ]);
  const q = quantifyDeductions([day({ hasPunch: false })], leave);
  assert.equal(q.absentDays, 0.5);
});

test("rest days and unscheduled days are never absences", () => {
  assert.equal(quantifyDeductions([day({ hasPunch: false, restDay: true })]).absentDays, 0);
  assert.equal(quantifyDeductions([day({ hasPunch: false, scheduled: false })]).absentDays, 0);
});

test("late and undertime only accrue on days actually worked", () => {
  const worked = quantifyDeductions([day({ lateMinutes: 30, undertimeMinutes: 15 })]);
  assert.equal(worked.lateMinutes, 30);
  assert.equal(worked.undertimeMinutes, 15);

  const absent = quantifyDeductions([
    day({ hasPunch: false, lateMinutes: 30, undertimeMinutes: 15 }),
  ]);
  assert.equal(absent.lateMinutes, 0, "an absent day cannot also be late");
  assert.equal(absent.undertimeMinutes, 0);
});

test("pricing reproduces the posted 148-minute undertime deduction", () => {
  // Posted run PR062024102, employees 000006/000007: D 250 -> 77.08 undertime.
  const rates = deriveRates(250, "D", FACTOR);
  const [, , ut] = priceDeductions(
    { absentDays: 0, lateMinutes: 0, undertimeMinutes: 148, paidLeaveDays: 0 },
    rates,
  );
  assert.ok(Math.abs(ut.amount - 77.08) < 0.005, `got ${ut.amount}`);
});

test("pricing reproduces a posted absence deduction", () => {
  // Posted run PR012025101, employee 000009: M 31,000, 10 absent days -> 11,884.98.
  const rates = deriveRates(31000, "M", FACTOR);
  const [absent] = priceDeductions(
    { absentDays: 10, lateMinutes: 0, undertimeMinutes: 0, paidLeaveDays: 0 },
    rates,
  );
  assert.ok(Math.abs(absent.amount - 11884.98) < 0.005, `got ${absent.amount}`);
});

// ------------------------------------------------- advances / adjustments ---

import {
  amortiseAdvances,
  totalAdvances,
  adjustmentComponents,
  netAdjustments,
  type Advance,
} from "./deductions";

/** The live empadvance row: 10,000 principal + 300 fees, 500 per cutoff. */
function advance(over: Partial<Advance> = {}): Advance {
  return {
    id: "00001320251",
    type: "Company Loan",
    principal: 10000,
    addedAmount: 300,
    perPay: 500,
    paysPerMonth: 2,
    cutoff: null,
    start: "2025-06-23",
    end: null,
    paid: 0,
    status: 1,
    ...over,
  };
}

const PERIOD = { start: "2025-09-01", end: "2025-09-15", cutoff: 1 };

test("an active advance is collected at its per-pay amount", () => {
  const [d] = amortiseAdvances([advance()], PERIOD);
  assert.equal(d.amount, 500); // matches the stored pay_loan pyl_amt
  assert.equal(d.balanceBefore, 10300); // principal + added
  assert.equal(d.balanceAfter, 9800);
});

test("the final instalment is trimmed so an advance never over-collects", () => {
  const [d] = amortiseAdvances([advance({ paid: 10100 })], PERIOD);
  assert.equal(d.amount, 200, "only 200 remained");
  assert.equal(d.balanceAfter, 0);
});

test("a fully repaid advance is skipped", () => {
  assert.deepEqual(amortiseAdvances([advance({ paid: 10300 })], PERIOD), []);
  assert.deepEqual(amortiseAdvances([advance({ paid: 99999 })], PERIOD), []);
});

test("inactive advances are never collected", () => {
  assert.deepEqual(amortiseAdvances([advance({ status: 0 })], PERIOD), []);
});

test("advances outside their date window are skipped", () => {
  assert.deepEqual(amortiseAdvances([advance({ start: "2025-12-01" })], PERIOD), []);
  assert.deepEqual(amortiseAdvances([advance({ end: "2025-01-01" })], PERIOD), []);
});

test("a once-a-month advance only fires on its nominated cutoff", () => {
  const once = advance({ paysPerMonth: 1, cutoff: 2 });
  assert.deepEqual(amortiseAdvances([once], { ...PERIOD, cutoff: 1 }), []);
  assert.equal(amortiseAdvances([once], { ...PERIOD, cutoff: 2 }).length, 1);
});

test("a twice-a-month advance fires on both cutoffs", () => {
  assert.equal(amortiseAdvances([advance()], { ...PERIOD, cutoff: 1 }).length, 1);
  assert.equal(amortiseAdvances([advance()], { ...PERIOD, cutoff: 2 }).length, 1);
});

test("totalAdvances sums what goes to pyd_tloan", () => {
  const ds = amortiseAdvances([advance(), advance({ id: "B", perPay: 250 })], PERIOD);
  assert.equal(totalAdvances(ds), 750);
});

test("adjustments split into credits and deductions", () => {
  const adj = [
    { counter: 1, code: "CD3", type: "C", description: "rice", amount: 1500, taxable: 0 },
    { counter: 2, code: "CD15", type: "D", description: "charge", amount: 200, taxable: 1 },
  ];
  assert.deepEqual(netAdjustments(adj), { credits: 1500, deductions: 200 });

  const comps = adjustmentComponents(adj);
  assert.deepEqual(comps.map((c) => [c.code, c.type, c.amount, c.taxable]), [
    ["CD3", "C", 1500, false],
    ["CD15", "D", 200, true],
  ]);
});

test("zero-value adjustments produce no payslip line", () => {
  assert.deepEqual(adjustmentComponents([
    { counter: 1, code: "CD3", type: "C", description: "x", amount: 0, taxable: 0 },
  ]), []);
});

test("a negative adjustment amount is taken as a magnitude", () => {
  const [c] = adjustmentComponents([
    { counter: 1, code: "CD15", type: "D", description: "reversal", amount: -300, taxable: 0 },
  ]);
  assert.equal(c.amount, 300);
  assert.equal(c.type, "D");
});
