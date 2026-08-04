/**
 * Data loading for the payroll engine.
 *
 * This is the ONLY module in `lib/services/payroll/` that touches Prisma —
 * everything else is pure so the parity harness can drive the same arithmetic
 * through the `mariadb` driver instead.
 *
 * Attendance is read with raw SQL rather than through the Prisma model. The
 * `att_*` premium columns are `TIME(0)` and can legitimately exceed 24 hours
 * (MySQL TIME runs to 838:59:59); Prisma maps TIME onto `Date`, which silently
 * mangles those. Converting to whole minutes in SQL (`HOUR()*60 + MINUTE()`)
 * avoids the problem entirely and keeps us off float hours, which is where the
 * client's spreadsheet picked up its `7.999999999941792` drift.
 */

import { prisma } from "@/lib/db/prisma";
import { recomputeAttendance } from "@/lib/services/attendance-recompute";
import { PREMIUM_BUCKETS, type PremiumBucket } from "./premiums";
import type { AttendanceDay, Advance, Adjustment } from "./deductions";
import type { LeaveApplication } from "./leave";
import type {
  SssBracket,
  PhilhealthBracket,
  PagibigBracket,
  TaxBracket,
} from "./statutory";
import type { OvertimeRates } from "./premiums";
import type { PayrollType, ComponentRules } from "./types";

/** `settings_tab` values the engine depends on. */
export interface PayrollSettings {
  yearDays: number;
  weekDays: number | null;
}

export async function loadSettings(): Promise<PayrollSettings> {
  const row = await prisma.settings_tab.findFirst({
    select: { set_yrdays: true, set_wkdays: true },
  });
  const yearDays = row?.set_yrdays ?? 0;
  if (!yearDays) {
    throw new Error(
      "settings_tab.set_yrdays is not configured — the payroll factor is required",
    );
  }
  return { yearDays, weekDays: row?.set_wkdays ?? null };
}

/** All statutory schedules, unfiltered — the engine narrows them itself. */
export async function loadBrackets(): Promise<{
  sss: SssBracket[];
  philhealth: PhilhealthBracket[];
  pagibig: PagibigBracket[];
  tax: TaxBracket[];
}> {
  const [sss, philhealth, pagibig, tax] = await Promise.all([
    prisma.govtsss.findMany(),
    prisma.govtph.findMany(),
    prisma.govtpag.findMany(),
    prisma.govttax.findMany(),
  ]);
  return {
    sss: sss as unknown as SssBracket[],
    philhealth: philhealth as unknown as PhilhealthBracket[],
    pagibig: pagibig as unknown as PagibigBracket[],
    tax: tax as unknown as TaxBracket[],
  };
}

/** The premium multiplier row, defaulting to OT1. */
export async function loadOvertimeRates(code = "OT1"): Promise<OvertimeRates> {
  const row = await prisma.otrates.findUnique({ where: { rts: code } });
  return (row ?? {}) as unknown as OvertimeRates;
}

/**
 * `comded` — the pay-component chart, and the authority on taxability.
 *
 * `cd_tax` says whether a line participates in taxable income; `cd_slip`
 * separates real payslip lines from the CD10xx/CD11xx/CD12xx/CD13xx audit
 * snapshots, which hold bracket values rather than money.
 */
export async function loadComponentRules(): Promise<ComponentRules> {
  const rows = await prisma.comded.findMany();
  const out: ComponentRules = new Map();
  for (const r of rows) {
    out.set(r.cd_code, {
      code: r.cd_code,
      type: (r.cd_type ?? "C").toUpperCase() === "D" ? "D" : "C",
      taxable: r.cd_tax === 1,
      onSlip: r.cd_slip === "1",
      description: r.cd_desc,
    });
  }
  return out;
}

/** One employee's salary as at a date, honouring effective dating. */
export interface EmployeeSalary {
  employee: string;
  amount: number;
  type: PayrollType;
  deMinimis: number;
  allowance: number;
}

/**
 * Resolve every active employee's salary for a period.
 *
 * `empsalary` is effective-dated by `emp_saldatefrom` only — `emp_saldateto` is
 * NULL on every live row — so the applicable record is the latest active one
 * starting on or before the period end. Employees with no salary record are
 * omitted rather than defaulted to zero, so they surface as "not payable"
 * instead of silently producing a blank payslip.
 */
export async function loadSalaries(asOf: Date): Promise<Map<string, EmployeeSalary>> {
  const rows = await prisma.empsalary.findMany({
    where: { emp_salstatus: 1, emp_saldatefrom: { lte: asOf } },
    orderBy: [{ emp_id: "asc" }, { emp_saldatefrom: "desc" }],
  });

  const out = new Map<string, EmployeeSalary>();
  for (const r of rows) {
    if (out.has(r.emp_id)) continue; // first hit is the latest by ordering
    const type = (r.emp_salpayrolltype ?? "").toUpperCase();
    if (type !== "D" && type !== "S" && type !== "M") continue;
    out.set(r.emp_id, {
      employee: r.emp_id,
      amount: r.emp_salamt ?? 0,
      type: type as PayrollType,
      deMinimis: r.emp_saldeminis ?? 0,
      allowance: r.emp_salallow ?? 0,
    });
  }
  return out;
}

/** Per-employee attendance plus premium bucket minutes for a period. */
export interface EmployeeAttendance {
  days: AttendanceDay[];
  premiumDays: Array<Partial<Record<PremiumBucket, number>>>;
}

/**
 * Load attendance for a period, keyed by employee.
 *
 * Callers should run `recomputeAttendance` first (see `prepareAttendance`) so
 * approved COA / overtime / undertime / leave / schedule-adjustment requests
 * are already overlaid.
 */
export async function loadAttendance(
  from: string,
  to: string,
): Promise<Map<string, EmployeeAttendance>> {
  // Compute every TIME column into whole minutes server-side.
  const bucketCols = PREMIUM_BUCKETS.map(
    (b) => `HOUR(att_${b}) * 60 + MINUTE(att_${b}) AS ${b}`,
  ).join(",\n    ");

  const sql = `
    SELECT
      att_emp AS emp,
      DATE_FORMAT(att_date, '%Y-%m-%d') AS d,
      att_schin IS NOT NULL AND att_schout IS NOT NULL AS scheduled,
      att_restday = '1' AS restday,
      COALESCE(att_holiday, 'N') AS holiday,
      att_fin IS NOT NULL AND att_fout IS NOT NULL AS haspunch,
      HOUR(att_late) * 60 + MINUTE(att_late) AS late_min,
      HOUR(att_undertime) * 60 + MINUTE(att_undertime) AS ut_min,
      ${bucketCols}
    FROM attendance
    WHERE att_date BETWEEN ? AND ?
    ORDER BY att_emp, att_date`;

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, from, to);

  const out = new Map<string, EmployeeAttendance>();
  for (const row of rows) {
    const emp = String(row.emp);
    const entry = out.get(emp) ?? { days: [], premiumDays: [] };

    entry.days.push({
      date: String(row.d),
      scheduled: Boolean(Number(row.scheduled)),
      restDay: Boolean(Number(row.restday)),
      holiday: String(row.holiday ?? "N"),
      hasPunch: Boolean(Number(row.haspunch)),
      lateMinutes: Number(row.late_min ?? 0),
      undertimeMinutes: Number(row.ut_min ?? 0),
    });

    const buckets: Partial<Record<PremiumBucket, number>> = {};
    for (const b of PREMIUM_BUCKETS) {
      const minutes = Number(row[b] ?? 0);
      if (minutes) buckets[b] = minutes;
    }
    entry.premiumDays.push(buckets);

    out.set(emp, entry);
  }
  return out;
}

/**
 * Re-apply the approved-request overlays before payroll reads attendance.
 *
 * Idempotent — `recomputeAttendance` resets the overlay columns and rebuilds
 * them, so running it before every compute is safe and guarantees payroll sees
 * the latest approvals.
 */
export async function prepareAttendance(from: string, to: string): Promise<void> {
  await recomputeAttendance(from, to);
}

/**
 * Approved leave applications overlapping a period, keyed by employee.
 *
 * This is the one sanctioned exception to "payroll reads `attendance` only":
 * `att_wrkhrsdec` credits leave hours without checking `lea_swithpay`, so the
 * paid/unpaid split has to come from `leave_summary` (plan risk R7).
 */
export async function loadLeave(
  from: string,
  to: string,
): Promise<Map<string, LeaveApplication[]>> {
  const details = await prisma.leave_detail.findMany({
    where: { lea_ddate: { gte: new Date(from), lte: new Date(to) } },
  });
  if (details.length === 0) return new Map();

  const summaries = await prisma.leave_summary.findMany({
    where: { lea_sid: { in: [...new Set(details.map((d) => d.lea_dpk))] }, lea_sstatus: 1 },
  });

  const byId = new Map<string, LeaveApplication>();
  for (const s of summaries) {
    byId.set(s.lea_sid, {
      id: s.lea_sid,
      employee: s.lea_semp ?? "",
      leaveType: s.lea_stype,
      status: s.lea_sstatus,
      withPayDays: s.lea_swithpay ?? 0,
      withoutPayDays: s.lea_swithoutpay ?? 0,
      dates: [],
    });
  }

  for (const d of details) {
    const app = byId.get(d.lea_dpk);
    if (!app || !d.lea_ddate) continue;
    const duration = (d.lea_dtype ?? "W").toUpperCase() === "H" ? "H" : "W";
    app.dates.push({
      date: d.lea_ddate.toISOString().slice(0, 10),
      sequence: d.lea_dctr,
      duration,
      half: d.lea_dampm ?? null,
    });
  }

  const out = new Map<string, LeaveApplication[]>();
  for (const app of byId.values()) {
    if (!app.employee) continue;
    const list = out.get(app.employee) ?? [];
    list.push(app);
    out.set(app.employee, list);
  }
  return out;
}

/** Running advances, keyed by employee. */
export async function loadAdvances(): Promise<Map<string, Advance[]>> {
  const rows = await prisma.empadvance.findMany({ where: { emp_adstatus: 1 } });
  const out = new Map<string, Advance[]>();
  for (const r of rows) {
    const list = out.get(r.emp_id) ?? [];
    list.push({
      id: r.emp_adid,
      type: r.emp_adtype,
      principal: r.emp_adamt ?? 0,
      addedAmount: r.emp_adaddedamt ?? 0,
      perPay: r.emp_adamtperpay ?? 0,
      paysPerMonth: r.emp_adpaypermonth,
      cutoff: r.emp_adpaycutoff,
      start: r.emp_adstart ? r.emp_adstart.toISOString().slice(0, 10) : null,
      end: r.emp_adend ? r.emp_adend.toISOString().slice(0, 10) : null,
      paid: r.emp_adpaid ?? 0,
      status: r.emp_adstatus,
    });
    out.set(r.emp_id, list);
  }
  return out;
}

/**
 * One-off adjustments for a run, keyed by EMPLOYEE id.
 *
 * Adjustments are `pay_amounts` rows flagged `pya_adj = 1` — NOT rows in the
 * `pay_adjust` table, which the legacy app never used (it is empty on both
 * databases). The legacy save path is
 * `DELETE FROM pay_amounts WHERE pya_code = ? AND pya_adj = 1` followed by a
 * re-insert, so the flag is the whole mechanism.
 *
 * Keyed by employee rather than by `pyd_pk` on purpose. A pk is
 * `code + row index`, so if the employee selection changes between computes the
 * indexes shift and adjustments would silently reattach to the WRONG person.
 * We resolve pk -> employee through the run's existing `pay_details` first.
 */
export async function loadAdjustments(code: string): Promise<Map<string, Adjustment[]>> {
  const details = await prisma.pay_details.findMany({
    where: { pyd_code: code },
    select: { pyd_pk: true, pyd_emp: true },
  });
  if (details.length === 0) return new Map();

  const employeeByPk = new Map(details.map((d) => [d.pyd_pk, d.pyd_emp ?? ""]));
  const rows = await prisma.pay_amounts.findMany({
    where: { pya_code: { in: [...employeeByPk.keys()] }, pya_adj: 1 },
    orderBy: [{ pya_code: "asc" }, { pya_ctr: "asc" }],
  });

  const out = new Map<string, Adjustment[]>();
  for (const r of rows) {
    const employee = employeeByPk.get(r.pya_code);
    if (!employee) continue;
    const list = out.get(employee) ?? [];
    list.push({
      counter: r.pya_ctr,
      code: r.pya_def,
      type: r.pya_cd,
      description: r.pya_desc,
      amount: r.pya_amt ?? 0,
      taxable: r.pya_tax,
    });
    out.set(employee, list);
  }
  return out;
}

/** Active employees eligible for a run. */
export async function loadPayableEmployees(): Promise<
  Array<{ id: string; name: string }>
> {
  const rows = await prisma.employee.findMany({
    where: { emp_status: 1 },
    select: { emp_id: true, emp_last: true, emp_first: true, emp_mid: true },
    orderBy: [{ emp_last: "asc" }, { emp_first: "asc" }],
  });
  return rows.map((r) => ({
    id: r.emp_id,
    name: [r.emp_last, r.emp_first].filter(Boolean).join(", ") || r.emp_id,
  }));
}
