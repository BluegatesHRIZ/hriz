import test from "node:test";
import assert from "node:assert/strict";

import {
  applyPresent,
  countPresent,
  supersededEndDate,
  SALARY_ENDED,
  SALARY_PRESENT,
  type SalaryPeriod,
} from "./salaryHistory";

const row = (from: string, status = SALARY_PRESENT): SalaryPeriod => ({
  SalDateFrom: new Date(`${from}T00:00:00`),
  SalDateTo: null,
  SalStatus: status,
});

test("a new Present salary ends the older one the day before it starts", () => {
  const result = applyPresent([row("2025-02-02"), row("2026-09-01")], 1);
  assert.ok(result.ok);
  const [old, current] = result.rows;
  assert.equal(old.SalStatus, SALARY_ENDED);
  assert.equal((old.SalDateTo as Date).toDateString(), new Date("2026-08-31T00:00:00").toDateString());
  assert.equal(current.SalStatus, SALARY_PRESENT);
  assert.equal(result.ended.length, 1);
  assert.equal(countPresent(result.rows), 1);
});

test("dates given as strings are handled", () => {
  const rows: SalaryPeriod[] = [
    { SalDateFrom: "2025-02-02T00:00:00", SalDateTo: null, SalStatus: SALARY_PRESENT },
    { SalDateFrom: "2026-09-01T00:00:00", SalDateTo: null, SalStatus: SALARY_PRESENT },
  ];
  const result = applyPresent(rows, 1);
  assert.ok(result.ok);
  assert.equal(countPresent(result.rows), 1);
});

test("a backdated Present salary is refused rather than guessed at", () => {
  const result = applyPresent([row("2026-09-01"), row("2025-02-02")], 1);
  assert.equal(result.ok, false);
});

test("two Present salaries on the same day are refused", () => {
  const result = applyPresent([row("2026-09-01"), row("2026-09-01")], 1);
  assert.equal(result.ok, false);
});

test("an Ended row at the index changes nothing", () => {
  const rows = [row("2025-02-02"), row("2026-09-01", SALARY_ENDED)];
  const result = applyPresent(rows, 1);
  assert.ok(result.ok);
  assert.equal(result.rows, rows);
  assert.equal(result.ended.length, 0);
});

test("already-ended rows are left alone", () => {
  const ended = { ...row("2024-01-01", SALARY_ENDED), SalDateTo: new Date("2025-02-01T00:00:00") };
  const result = applyPresent([ended, row("2025-02-02"), row("2026-09-01")], 2);
  assert.ok(result.ok);
  assert.equal(result.rows[0], ended);
  assert.equal(result.ended.length, 1);
});

test("a superseded salary ends the day before the next one starts", () => {
  const rows = [row("2026-08-31"), row("2025-02-02")];
  const end = supersededEndDate(rows, 1);
  assert.equal(end?.toDateString(), new Date("2026-08-30T00:00:00").toDateString());
});

test("the latest Present salary has no superseded end date", () => {
  assert.equal(supersededEndDate([row("2026-08-31"), row("2025-02-02")], 0), null);
});

test("the nearest later salary sets the end date, not the latest", () => {
  const rows = [row("2025-02-02"), row("2026-12-01"), row("2026-08-31")];
  assert.equal(
    supersededEndDate(rows, 0)?.toDateString(),
    new Date("2026-08-30T00:00:00").toDateString(),
  );
});

test("an Ended salary has no superseded end date", () => {
  assert.equal(
    supersededEndDate([row("2026-08-31"), row("2025-02-02", SALARY_ENDED)], 1),
    null,
  );
});
