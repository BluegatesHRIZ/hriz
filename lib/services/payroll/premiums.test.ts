/**
 * Unit tests for premium pay.
 *
 * Unlike rates and statutory, these cannot be checked against posted payroll —
 * no run in the database contains bucket-derived premium pay. They pin the
 * arithmetic and the TIME parsing instead.
 *
 * Run: npx tsx --test lib/services/payroll/premiums.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { deriveRates } from "./rates";
import {
  PREMIUM_BUCKETS,
  pricePremiums,
  premiumComponent,
  accumulateBuckets,
  timeToMinutes,
  minutesToHours,
  type OvertimeRates,
} from "./premiums";

/** The live `otrates` OT1 row. */
const OT1: OvertimeRates = {
  rts: "OT1",
  ot: 1.25, nd: 0.1, ndot: 1.375,
  rd: 1.3, rdot: 1.69, rdnd: 1.43, rdndot: 1.859,
  sh: 0.3, shot: 1.69, shnd: 0.43, shndot: 1.859,
  shrd: 1.5, shrdot: 1.95, shrdnd: 1.65, shrdndot: 2.145,
  lh: 1, lhot: 2.6, lhnd: 1.2, lhndot: 2.86,
  lhrd: 2.6, lhrdot: 3.38, lhrdnd: 2.86, lhrdndot: 3.719,
  dh: 1.6, dhot: 3.38, dhnd: 1.86, dhndot: 3.718,
  dhrd: 3, dhrdot: 3.9, dhrdnd: 3.3, dhrdndot: 4.29,
};

const LADDER = deriveRates(16515, "M", 313); // hourly 79.14536741214...

test("there are 31 premium buckets and OT1 prices every one", () => {
  assert.equal(PREMIUM_BUCKETS.length, 31);
  for (const b of PREMIUM_BUCKETS) {
    assert.ok(OT1[b] !== undefined, `otrates.OT1 is missing ${b}`);
  }
});

test("an overtime hour is paid at 125% of the hourly rate", () => {
  const r = pricePremiums({ ot: 8 }, OT1, LADDER);
  assert.equal(r.totalAmount, 8 * 1.25 * LADDER.hourly);
  assert.equal(r.totalHours, 8);
});

test("night differential adds only its 10% increment", () => {
  // The base hours already sit inside the fixed basic, so ND must not pay 110%.
  const r = pricePremiums({ nd: 8 }, OT1, LADDER);
  assert.equal(r.totalAmount, 8 * 0.1 * LADDER.hourly);
  assert.ok(r.totalAmount < LADDER.hourly, "ND must be an increment, not a full rate");
});

test("a legal holiday adds another full day's worth", () => {
  const r = pricePremiums({ lh: 8 }, OT1, LADDER);
  assert.ok(Math.abs(r.totalAmount - 8 * LADDER.hourly) < 1e-9);
});

test("buckets combine additively", () => {
  const r = pricePremiums({ ot: 2, nd: 3, rd: 4 }, OT1, LADDER);
  const expected =
    2 * 1.25 * LADDER.hourly + 3 * 0.1 * LADDER.hourly + 4 * 1.3 * LADDER.hourly;
  assert.ok(Math.abs(r.totalAmount - expected) < 1e-9);
  assert.equal(r.lines.length, 3);
  assert.equal(r.totalHours, 9);
});

test("zero-hour buckets are omitted from the payslip", () => {
  const r = pricePremiums({ ot: 0, nd: 4 }, OT1, LADDER);
  assert.deepEqual(r.lines.map((l) => l.bucket), ["nd"]);
});

test("a bucket with no configured multiplier is surfaced, not silently dropped", () => {
  // otrates OT2 only defines `ot`; everything else is absent.
  const r = pricePremiums({ rdot: 5 }, { rts: "OT2", ot: 3 }, LADDER);
  assert.equal(r.totalAmount, 0);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].multiplier, 0, "must appear so misconfiguration is visible");
});

test("no premium hours yields an empty, zero-valued result", () => {
  const r = pricePremiums({}, OT1, LADDER);
  assert.equal(r.totalAmount, 0);
  assert.equal(r.lines.length, 0);
  assert.equal(premiumComponent(r).amount, 0);
});

test("the CD2 component carries a readable breakdown", () => {
  const c = premiumComponent(pricePremiums({ ot: 2, nd: 3 }, OT1, LADDER));
  assert.equal(c.code, "CD2");
  assert.equal(c.type, "C");
  assert.equal(c.taxable, true);
  assert.match(c.description!, /ot 2h x1\.25/);
  assert.match(c.description!, /nd 3h x0\.1/);
});

// ------------------------------------------------------------ TIME parsing --

test("TIME strings convert to minutes", () => {
  assert.equal(timeToMinutes("08:00:00"), 480);
  assert.equal(timeToMinutes("01:30:00"), 90);
  assert.equal(timeToMinutes("00:00:00"), 0);
  assert.equal(timeToMinutes("02:15"), 135);
});

test("TIME values beyond 24 hours are handled", () => {
  // attendance TIME columns run to 838:59:59, so Date parsing would be wrong.
  assert.equal(timeToMinutes("100:30:00"), 6030);
  assert.equal(timeToMinutes("838:59:59"), 838 * 60 + 60);
});

test("null, empty and malformed TIME values are zero, not NaN", () => {
  for (const v of [null, undefined, "", "garbage"]) {
    assert.equal(timeToMinutes(v as never), 0);
  }
});

test("negative TIME values keep their sign", () => {
  assert.equal(timeToMinutes("-01:30:00"), -90);
});

test("minutes convert to the hours otrates multiplies", () => {
  assert.equal(minutesToHours(480), 8);
  assert.equal(minutesToHours(90), 1.5);
});

test("accumulateBuckets sums whole minutes across days", () => {
  // 1h30 + 2h15 = 3h45 = 3.75h, exact — no float drift.
  const hours = accumulateBuckets([
    { ot: "01:30:00", nd: "00:00:00" },
    { ot: "02:15:00", nd: "01:00:00" },
  ]);
  assert.equal(hours.ot, 3.75);
  assert.equal(hours.nd, 1);
});

test("accumulateBuckets ignores buckets that never fired", () => {
  const hours = accumulateBuckets([{ ot: "01:00:00" }]);
  assert.deepEqual(Object.keys(hours), ["ot"]);
});

test("end to end: a day of holiday overtime prices correctly", () => {
  const hours = accumulateBuckets([{ lhot: "04:00:00" }]);
  const r = pricePremiums(hours, OT1, LADDER);
  assert.ok(Math.abs(r.totalAmount - 4 * 2.6 * LADDER.hourly) < 1e-9);
});
