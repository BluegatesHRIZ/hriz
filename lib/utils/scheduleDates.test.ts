import test from "node:test";
import assert from "node:assert/strict";

import {
  addDays,
  isIsoDate,
  listDates,
  rangeLength,
  startOfWeek,
  weekdayOf,
} from "./scheduleDates";
import {
  fillRange,
  reconcileRange,
  rowsForEmployee,
  toDatedPayload,
  weekFromDates,
  parseCellText,
  dayFromCell,
  cellText,
  sameDay,
} from "../../components/schedules/scheduleDates";
import { applyDayUpdate, emptyWeek } from "../../components/schedules/scheduleDays";

const officeWeek = () =>
  emptyWeek().map((d) =>
    applyDayUpdate(d, {
      sch_in: "08:00",
      sch_out: "17:00",
      sch_rest: d.sch_day === "SATURDAY" || d.sch_day === "SUNDAY",
    })
  );

test("isIsoDate accepts real dates only", () => {
  assert.equal(isIsoDate("2026-12-01"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-1-1"), false);
  assert.equal(isIsoDate(null), false);
});

test("weekdays and ranges are timezone independent", () => {
  assert.equal(weekdayOf("2026-11-30"), "MONDAY");
  assert.equal(weekdayOf("2026-12-06"), "SUNDAY");
  assert.equal(startOfWeek("2026-12-06"), "2026-11-30");
  assert.equal(startOfWeek("2026-11-30"), "2026-11-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(rangeLength("2026-12-01", "2026-12-01"), 1);
  assert.equal(rangeLength("2026-12-02", "2026-12-01"), 0);
  assert.deepEqual(listDates("2026-12-30", "2027-01-02"), [
    "2026-12-30",
    "2026-12-31",
    "2027-01-01",
    "2027-01-02",
  ]);
});

test("fillRange applies the weekly pattern by weekday", () => {
  const days = fillRange(listDates("2026-12-04", "2026-12-07"), officeWeek());
  assert.deepEqual(
    days.map((d) => [d.date, d.sch_day, d.sch_rest]),
    [
      ["2026-12-04", "FRIDAY", false],
      ["2026-12-05", "SATURDAY", true],
      ["2026-12-06", "SUNDAY", true],
      ["2026-12-07", "MONDAY", false],
    ]
  );
  assert.equal(days[0].sch_hrs, 8);
});

test("reconcileRange keeps edits for dates still in range", () => {
  const week = officeWeek();
  const days = fillRange(listDates("2026-12-01", "2026-12-03"), week);
  days[1] = applyDayUpdate(days[1], { sch_in: "10:00" });
  const next = reconcileRange(days, listDates("2026-12-02", "2026-12-04"), week);
  assert.deepEqual(next.map((d) => d.date), ["2026-12-02", "2026-12-03", "2026-12-04"]);
  assert.equal(next[0].sch_in, "10:00");
  assert.equal(next[2].sch_in, "08:00");
});

test("grid rows: entries set, requests locked, others unset", () => {
  const dates = listDates("2026-12-01", "2026-12-03");
  const rows = rowsForEmployee(
    dates,
    [
      {
        date: "2026-12-01",
        sch_in: "07:00",
        sch_out: "16:00",
        sch_bin: "11:00",
        sch_bout: "12:00",
        sch_rest: false,
        sch_shift: "R",
        have_break: true,
        source: "admin",
      },
      {
        date: "2026-12-02",
        sch_in: "",
        sch_out: "",
        sch_bin: "",
        sch_bout: "",
        sch_rest: true,
        sch_shift: "R",
        have_break: false,
        source: "request",
      },
    ],
    officeWeek()
  );
  assert.deepEqual(
    rows.map((r) => [r.set, r.locked]),
    [
      [true, false],
      [true, true],
      [false, false],
    ]
  );
  assert.equal(rows[0].sch_hrs, 8);
  // Locked and unset rows are never sent.
  assert.deepEqual(toDatedPayload(rows).map((d) => d.date), ["2026-12-01"]);
});

test("weekFromDates needs all seven weekdays", () => {
  const week = officeWeek();
  assert.equal(weekFromDates(fillRange(listDates("2026-12-01", "2026-12-06"), week)), null);
  const full = weekFromDates(fillRange(listDates("2026-12-03", "2026-12-09"), week));
  assert.deepEqual(full?.map((d) => d.sch_day), [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ]);
});

test("parseCellText reads common ways of typing a shift", () => {
  const work = (sch_in: string, sch_out: string) => ({ kind: "work", sch_in, sch_out });
  assert.deepEqual(parseCellText("8-5"), work("08:00", "17:00"));
  assert.deepEqual(parseCellText("8-17"), work("08:00", "17:00"));
  assert.deepEqual(parseCellText("08:00-17:00"), work("08:00", "17:00"));
  assert.deepEqual(parseCellText("8:30 - 5:30"), work("08:30", "17:30"));
  assert.deepEqual(parseCellText("0830-1730"), work("08:30", "17:30"));
  assert.deepEqual(parseCellText("8am-5pm"), work("08:00", "17:00"));
  assert.deepEqual(parseCellText("8:00 AM - 5:00 PM"), work("08:00", "17:00"));
  assert.deepEqual(parseCellText("9 to 6"), work("09:00", "18:00"));
  assert.deepEqual(parseCellText("22-6"), work("22:00", "06:00"));
  assert.deepEqual(parseCellText("10pm-6am"), work("22:00", "06:00"));
  assert.deepEqual(parseCellText("Rest"), { kind: "rest" });
  assert.deepEqual(parseCellText("off"), { kind: "rest" });
  assert.deepEqual(parseCellText("Exempt"), { kind: "exempt" });
  assert.deepEqual(parseCellText(""), { kind: "clear" });
  assert.deepEqual(parseCellText(" - "), { kind: "clear" });
  assert.equal(parseCellText("25-5").kind, "error");
  assert.equal(parseCellText("8").kind, "error");
  assert.equal(parseCellText("8-8").kind, "error");
  assert.equal(parseCellText("hello").kind, "error");
});

test("dayFromCell builds a full day and keeps breaks when the start is unchanged", () => {
  const fresh = dayFromCell({ kind: "work", sch_in: "08:00", sch_out: "17:00" }, "2026-12-01", null);
  assert.equal(fresh.have_break, true);
  assert.equal(fresh.sch_bin, "12:00");
  assert.equal(fresh.sch_bout, "13:00");
  assert.equal(fresh.sch_shift, "R");
  assert.equal(cellText(fresh), "08:00-17:00");

  const custom = { ...fresh, sch_bin: "11:30", sch_bout: "12:00" };
  const later = dayFromCell({ kind: "work", sch_in: "08:00", sch_out: "18:00" }, "2026-12-01", custom);
  assert.equal(later.sch_bin, "11:30");
  assert.equal(later.sch_out, "18:00");

  const night = dayFromCell({ kind: "work", sch_in: "22:00", sch_out: "06:00" }, "2026-12-01", fresh);
  assert.equal(night.sch_shift, "N");
  assert.equal(night.sch_bin, "02:00");

  const rest = dayFromCell({ kind: "rest" }, "2026-12-01", fresh);
  assert.equal(rest.sch_rest, true);
  assert.equal(cellText(rest), "Rest");
  assert.equal(sameDay(fresh, { ...fresh }), true);
  assert.equal(sameDay(fresh, later), false);
});
