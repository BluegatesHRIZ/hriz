import { callProc, execProc } from "@/lib/db/mariadb";

/**
 * Reports service - mirrors C# ReportController endpoints.
 *
 * All implementations call the existing MariaDB stored procedures via
 * `$queryRawUnsafe` / `$executeRawUnsafe` to ensure strict parity with the
 * Blazor reports module (sql/stored_proc.sql).
 *
 * Stored procedures used:
 * - `crearep_attendance(_dtefrom, _detto)` - mutates `attendance` to apply COA,
 *   overtime, undertime, leave, and schedule-adjust overlays for the range,
 *   then recomputes the per-row totals (late / OT / ND / RD / SH / LH / DH).
 * - `crearep_summary(_dtefrom, _detto, _loc, _dep, _pos)` - groups the
 *   recomputed `attendance` rows into per-employee headers.
 * - `crearep_details(_dtefrom, _detto, _loc, _dep, _pos)` - flattened daily
 *   rows used as the expandable detail under each header.
 * - `crearep_leaves(_date_frm, _date_to, _emp)` - leave summary report rows.
 * - `crearep_ot(_date_frm, _date_to, _emp)` - overtime report rows.
 * - `crearep_payroll(_year)` - per-pay-header totals.
 * - `crearep_payamt(_pay_code)` - per-pay-header amount breakdown
 *   (compensation / deduction definitions).
 * - `crearep_dailylog(_dte, _emp)` - per-employee daily attendance log.
 */

export interface AttendanceReportFilters {
  from: string;
  to: string;
  location?: string[];
  department?: string[];
  position?: string[];
}

export interface AttendanceEmployeeHeader {
  EmpId: string | null;
  ProfPic: string | null;
  EmpDepartment: string | null;
  EmpPosition: string | null;
  EmpLocation: string | null;
  EmpFullname: string | null;
  EmpWorkday: number | null;
  EmpPresent: number | null;
  EmpAbsent: number | null;
  EmpRestday: number | null;
  EmpLeave: number | null;
  EmpHoliday: number | null;
  EmpHoursworked: number | null;
  LateUT: number | null;
  OT: number | null;
  AttExcess: string | null;
  AttOt: string | null;
  AttNd: string | null;
  AttNdot: string | null;
  AttRd: string | null;
  AttRdot: string | null;
  AttRdnd: string | null;
  AttRdndot: string | null;
  AttSh: string | null;
  AttShot: string | null;
  AttShnd: string | null;
  AttShndot: string | null;
  AttShrd: string | null;
  AttShrdot: string | null;
  AttShrdnd: string | null;
  AttShrdndot: string | null;
  AttLh: string | null;
  AttLhot: string | null;
  AttLhnd: string | null;
  AttLhndot: string | null;
  AttLhrd: string | null;
  AttLhrdot: string | null;
  AttLhrdnd: string | null;
  AttLhrdndot: string | null;
  AttDh: string | null;
  AttDhot: string | null;
  AttDhnd: string | null;
  AttDhndot: string | null;
  AttDhrd: string | null;
  AttDhrdot: string | null;
  AttDhrdnd: string | null;
  AttDhrdndot: string | null;
  AttendanceDetails: AttendanceEmployeeDetail[];
}

export interface AttendanceEmployeeDetail {
  EmpId: string | null;
  EmpDate: string | null;
  EmpDay: string | null;
  EmpShift: string | null;
  EmpSchedule: string | null;
  EmpClockedinandout: string | null;
  EmpClockedhours: number | null;
  EmpLate: number | null;
  EmpRegularhours: number | null;
  EmpUndertime: number | null;
  EmpOvertime: number | null;
  EmpPaidHours: number | null;
  AttExcess: string | null;
  AttOt: string | null;
  AttNd: string | null;
  AttNdot: string | null;
  AttRd: string | null;
  AttRdot: string | null;
  AttRdnd: string | null;
  AttRdndot: string | null;
  AttSh: string | null;
  AttShot: string | null;
  AttShnd: string | null;
  AttShndot: string | null;
  AttShrd: string | null;
  AttShrdot: string | null;
  AttShrdnd: string | null;
  AttShrdndot: string | null;
  AttLh: string | null;
  AttLhot: string | null;
  AttLhnd: string | null;
  AttLhndot: string | null;
  AttLhrd: string | null;
  AttLhrdot: string | null;
  AttLhrdnd: string | null;
  AttLhrdndot: string | null;
  AttDh: string | null;
  AttDhot: string | null;
  AttDhnd: string | null;
  AttDhndot: string | null;
  AttDhrd: string | null;
  AttDhrdot: string | null;
  AttDhrdnd: string | null;
  AttDhrdndot: string | null;
}

export interface LeaveReportRow {
  lea_sid: string | null;
  lev_desc: string | null;
  lea_sfrom: string | Date | null;
  lea_sto: string | Date | null;
  lea_sreason: string | null;
  lea_swithpay: string | number | null;
  lea_swithoutpay: string | number | null;
  lea_semp: string | null;
  lea_sapplieddate: string | Date | null;
  name: string | null;
  department: string | null;
  location: string | null;
  status: string | null;
}

export interface OvertimeReportRow {
  otm_id: string | null;
  name: string | null;
  otm_date: string | Date | null;
  otm_from: string | Date | null;
  otm_to: string | Date | null;
  reason: string | null;
  otm_applieddate: string | Date | null;
  department: string | null;
  location: string | null;
  status: string | null;
  att_excess: string | null;
  att_ot: string | null;
  att_nd: string | null;
  att_ndot: string | null;
  att_rd: string | null;
  att_rdot: string | null;
  att_rdnd: string | null;
  att_rdndot: string | null;
  att_sh: string | null;
  att_shot: string | null;
  att_shnd: string | null;
  att_shndot: string | null;
  att_shrd: string | null;
  att_shrdot: string | null;
  att_shrdnd: string | null;
  att_shrdndot: string | null;
  att_lh: string | null;
  att_lhot: string | null;
  att_lhnd: string | null;
  att_lhndot: string | null;
  att_lhrd: string | null;
  att_lhrdot: string | null;
  att_lhrdnd: string | null;
  att_lhrdndot: string | null;
  att_dh: string | null;
  att_dhot: string | null;
  att_dhnd: string | null;
  att_dhndot: string | null;
  att_dhrd: string | null;
  att_dhrdot: string | null;
  att_dhrdnd: string | null;
  att_dhrdndot: string | null;
}

export interface PayrollReportHeader {
  PyhCode: string | null;
  PyhDesc: string | null;
  BaseSalary: number | null;
  TotalCompensation: number | null;
  TotalDeduction: number | null;
  Tax: number | null;
  Sss: number | null;
  Philhealth: number | null;
  Hdmf: number | null;
  SssEmployer: number | null;
  PhilhealthEmployer: number | null;
  HdmfEmployer: number | null;
  TaxAdjusted: number | null;
}

export interface PayrollReportAmount {
  PydPk: string | null;
  PydCode: string | null;
  PyaDef: string | null;
  CdDesc: string | null;
  CdType: string | null;
  PayAmount: number | null;
}

export interface PayrollReportRow {
  Payreport: PayrollReportHeader;
  PayAmount: PayrollReportAmount[];
}

export interface DailyLogRow {
  AttDate: string | Date | null;
  EmpId: string | null;
  EmpName: string | null;
  EmpSched: string | null;
  EmpTimeIn: string | null;
  EmpTimeOut: string | null;
  DepDesc: string | null;
  PstDesc: string | null;
  LocDesc: string | null;
  InIp: string | null;
  OutIp: string | null;
  InLoc: string | null;
  OutLoc: string | null;
}

/**
 * Normalizes a `string | string[]` filter argument into the comma-separated
 * inline string the stored proc expects (matches C# `string.Join(", ", ...)`).
 */
function flatten(value?: string[] | null): string {
  if (!value || value.length === 0) return "";
  return value
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0)
    .join(", ");
}


/**
 * Coerces values returned by `$queryRawUnsafe` (which uses MariaDB native
 * types) into the plain shape the frontend expects. Time columns come back as
 * strings ("HH:MM:SS"); BigInts are stringified before they ever hit JSON;
 * Dates are kept as-is so Next.js can serialize them to ISO strings.
 */
function normalizeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "bigint") {
      out[key] = Number(value);
    } else if (value instanceof Date) {
      out[key] = value;
    } else if (
      value !== null &&
      typeof value === "object" &&
      // mysql time column returns a {hours, minutes, seconds, days} object on some drivers
      "toString" in (value as object) &&
      typeof (value as { toString(): unknown }).toString === "function"
    ) {
      out[key] = value;
    } else {
      out[key] = value as unknown;
    }
  }
  return out as T;
}

/**
 * Mirrors `POST api/AttendanceReport/generate`: runs `crearep_attendance` to
 * refresh the attendance table for the requested date range, then loads the
 * grouped summary + day-by-day detail and bundles them into one
 * `AttendanceEmployeeHeader[]` with `AttendanceDetails` nested.
 */
export async function generateAttendance(
  filters: AttendanceReportFilters,
): Promise<AttendanceEmployeeHeader[]> {
  const loc = flatten(filters.location);
  const dep = flatten(filters.department);
  const pos = flatten(filters.position);

  await execProc(`CALL crearep_attendance(?, ?)`, [filters.from, filters.to]);

  const headers = await callProc(
    `CALL crearep_summary(?, ?, ?, ?, ?)`,
    [filters.from, filters.to, loc, dep, pos],
  );
  const details = await callProc(
    `CALL crearep_details(?, ?, ?, ?, ?)`,
    [filters.from, filters.to, loc, dep, pos],
  );

  return mergeAttendance(headers, details);
}

/**
 * Mirrors `POST api/AttendanceReport/list`: re-reads the already computed
 * summary + detail rows for the given range (no `crearep_attendance` call).
 * C# passes empty location/department/position so list mirrors that exactly.
 */
export async function listAttendance(
  filters: AttendanceReportFilters,
): Promise<AttendanceEmployeeHeader[]> {
  const headers = await callProc(
    `CALL crearep_summary(?, ?, ?, ?, ?)`,
    [filters.from, filters.to, "", "", ""],
  );
  const details = await callProc(
    `CALL crearep_details(?, ?, ?, ?, ?)`,
    [filters.from, filters.to, "", "", ""],
  );

  return mergeAttendance(headers, details);
}

function mergeAttendance(
  headersRaw: Record<string, unknown>[],
  detailsRaw: Record<string, unknown>[],
): AttendanceEmployeeHeader[] {
  const headers = headersRaw.map((r) => mapAttendanceHeader(normalizeRow(r)));
  const details = detailsRaw.map((r) => mapAttendanceDetail(normalizeRow(r)));
  const detailByEmp = new Map<string, AttendanceEmployeeDetail[]>();

  for (const detail of details) {
    if (!detail.EmpId) continue;
    const bucket = detailByEmp.get(detail.EmpId) ?? [];
    bucket.push(detail);
    detailByEmp.set(detail.EmpId, bucket);
  }

  for (const header of headers) {
    if (!header.EmpId) continue;
    header.AttendanceDetails = detailByEmp.get(header.EmpId) ?? [];
  }

  return headers;
}

function pickString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = row[key];
    if (val === null || val === undefined) continue;
    return typeof val === "string" ? val : String(val);
  }
  return null;
}

function pickNumber(
  row: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const val = row[key];
    if (val === null || val === undefined) continue;
    if (typeof val === "number") return val;
    if (typeof val === "bigint") return Number(val);
    if (typeof val === "string") {
      const parsed = Number(val);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const coerced = Number(val as unknown);
    return Number.isFinite(coerced) ? coerced : null;
  }
  return null;
}

function pickDate(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = row[key];
    if (val === null || val === undefined) continue;
    if (val instanceof Date) return val.toISOString();
    return typeof val === "string" ? val : String(val);
  }
  return null;
}

function mapAttendanceHeader(row: Record<string, unknown>): AttendanceEmployeeHeader {
  return {
    EmpId: pickString(row, "emp_id", "EmpId"),
    ProfPic: pickString(row, "prof_pic", "ProfPic"),
    EmpDepartment: pickString(row, "dep_desc", "DepDesc", "EmpDepartment"),
    EmpPosition: pickString(row, "pst_desc", "PstDesc", "EmpPosition"),
    EmpLocation: pickString(row, "loc_desc", "LocDesc", "EmpLocation"),
    EmpFullname: pickString(row, "emp_fullname", "EmpFullname"),
    EmpWorkday: pickNumber(row, "emp_workday", "EmpWorkday"),
    EmpPresent: pickNumber(row, "emp_present", "EmpPresent"),
    EmpAbsent: pickNumber(row, "emp_absent", "EmpAbsent"),
    EmpRestday: pickNumber(row, "emp_restday", "EmpRestday"),
    EmpLeave: pickNumber(row, "emp_leave", "EmpLeave"),
    EmpHoliday: pickNumber(row, "emp_holiday", "EmpHoliday"),
    EmpHoursworked: pickNumber(row, "emp_hoursworked", "EmpHoursworked"),
    LateUT: pickNumber(row, "emp_lateut", "LateUT"),
    OT: pickNumber(row, "emp_ot", "OT"),
    AttExcess: pickString(row, "att_excess", "AttExcess"),
    AttOt: pickString(row, "att_ot", "AttOt"),
    AttNd: pickString(row, "att_nd", "AttNd"),
    AttNdot: pickString(row, "att_ndot", "AttNdot"),
    AttRd: pickString(row, "att_rd", "AttRd"),
    AttRdot: pickString(row, "att_rdot", "AttRdot"),
    AttRdnd: pickString(row, "att_rdnd", "AttRdnd"),
    AttRdndot: pickString(row, "att_rdndot", "AttRdndot"),
    AttSh: pickString(row, "att_sh", "AttSh"),
    AttShot: pickString(row, "att_shot", "AttShot"),
    AttShnd: pickString(row, "att_shnd", "AttShnd"),
    AttShndot: pickString(row, "att_shndot", "AttShndot"),
    AttShrd: pickString(row, "att_shrd", "AttShrd"),
    AttShrdot: pickString(row, "att_shrdot", "AttShrdot"),
    AttShrdnd: pickString(row, "att_shrdnd", "AttShrdnd"),
    AttShrdndot: pickString(row, "att_shrdndot", "AttShrdndot"),
    AttLh: pickString(row, "att_lh", "AttLh"),
    AttLhot: pickString(row, "att_lhot", "AttLhot"),
    AttLhnd: pickString(row, "att_lhnd", "AttLhnd"),
    AttLhndot: pickString(row, "att_lhndot", "AttLhndot"),
    AttLhrd: pickString(row, "att_lhrd", "AttLhrd"),
    AttLhrdot: pickString(row, "att_lhrdot", "AttLhrdot"),
    AttLhrdnd: pickString(row, "att_lhrdnd", "AttLhrdnd"),
    AttLhrdndot: pickString(row, "att_lhrdndot", "AttLhrdndot"),
    AttDh: pickString(row, "att_dh", "AttDh"),
    AttDhot: pickString(row, "att_dhot", "AttDhot"),
    AttDhnd: pickString(row, "att_dhnd", "AttDhnd"),
    AttDhndot: pickString(row, "att_dhndot", "AttDhndot"),
    AttDhrd: pickString(row, "att_dhrd", "AttDhrd"),
    AttDhrdot: pickString(row, "att_dhrdot", "AttDhrdot"),
    AttDhrdnd: pickString(row, "att_dhrdnd", "AttDhrdnd"),
    AttDhrdndot: pickString(row, "att_dhrdndot", "AttDhrdndot"),
    AttendanceDetails: [],
  };
}

function mapAttendanceDetail(row: Record<string, unknown>): AttendanceEmployeeDetail {
  return {
    EmpId: pickString(row, "emp_id", "EmpId"),
    EmpDate: pickDate(row, "emp_date", "EmpDate"),
    EmpDay: pickString(row, "emp_day", "EmpDay"),
    EmpShift: pickString(row, "emp_shift", "EmpShift"),
    EmpSchedule: pickString(row, "emp_schedule", "EmpSchedule"),
    EmpClockedinandout: pickString(row, "emp_clockinandout", "EmpClockedinandout"),
    EmpClockedhours: pickNumber(row, "emp_clockedhours", "EmpClockedhours"),
    EmpLate: pickNumber(row, "emp_late", "EmpLate"),
    EmpRegularhours: pickNumber(row, "emp_regularhours", "EmpRegularhours"),
    EmpUndertime: pickNumber(row, "emp_undertime", "EmpUndertime"),
    EmpOvertime: pickNumber(row, "emp_overtime", "EmpOvertime"),
    EmpPaidHours: pickNumber(row, "emp_paidhours", "EmpPaidHours"),
    AttExcess: pickString(row, "att_excess", "AttExcess"),
    AttOt: pickString(row, "att_ot", "AttOt"),
    AttNd: pickString(row, "att_nd", "AttNd"),
    AttNdot: pickString(row, "att_ndot", "AttNdot"),
    AttRd: pickString(row, "att_rd", "AttRd"),
    AttRdot: pickString(row, "att_rdot", "AttRdot"),
    AttRdnd: pickString(row, "att_rdnd", "AttRdnd"),
    AttRdndot: pickString(row, "att_rdndot", "AttRdndot"),
    AttSh: pickString(row, "att_sh", "AttSh"),
    AttShot: pickString(row, "att_shot", "AttShot"),
    AttShnd: pickString(row, "att_shnd", "AttShnd"),
    AttShndot: pickString(row, "att_shndot", "AttShndot"),
    AttShrd: pickString(row, "att_shrd", "AttShrd"),
    AttShrdot: pickString(row, "att_shrdot", "AttShrdot"),
    AttShrdnd: pickString(row, "att_shrdnd", "AttShrdnd"),
    AttShrdndot: pickString(row, "att_shrdndot", "AttShrdndot"),
    AttLh: pickString(row, "att_lh", "AttLh"),
    AttLhot: pickString(row, "att_lhot", "AttLhot"),
    AttLhnd: pickString(row, "att_lhnd", "AttLhnd"),
    AttLhndot: pickString(row, "att_lhndot", "AttLhndot"),
    AttLhrd: pickString(row, "att_lhrd", "AttLhrd"),
    AttLhrdot: pickString(row, "att_lhrdot", "AttLhrdot"),
    AttLhrdnd: pickString(row, "att_lhrdnd", "AttLhrdnd"),
    AttLhrdndot: pickString(row, "att_lhrdndot", "AttLhrdndot"),
    AttDh: pickString(row, "att_dh", "AttDh"),
    AttDhot: pickString(row, "att_dhot", "AttDhot"),
    AttDhnd: pickString(row, "att_dhnd", "AttDhnd"),
    AttDhndot: pickString(row, "att_dhndot", "AttDhndot"),
    AttDhrd: pickString(row, "att_dhrd", "AttDhrd"),
    AttDhrdot: pickString(row, "att_dhrdot", "AttDhrdot"),
    AttDhrdnd: pickString(row, "att_dhrdnd", "AttDhrdnd"),
    AttDhrdndot: pickString(row, "att_dhrdndot", "AttDhrdndot"),
  };
}

/**
 * Mirrors `POST api/AttendanceReport/generate/leave`: pulls `crearep_leaves`
 * for the active employee scope. C# calls the proc with 2 args; the proc
 * itself signs `(_date_frm, _date_to, _emp)` so we pass "All" for the third
 * to keep parity with the SP definition (mirrors UI behavior).
 */
export async function listLeaveReport(
  from: string,
  to: string,
  emp: string = "All",
): Promise<LeaveReportRow[]> {
  const rows = await callProc(`CALL crearep_leaves(?, ?, ?)`, [from, to, emp]);
  return rows.map((row) => normalizeRow(row) as unknown as LeaveReportRow);
}

/**
 * Mirrors `POST api/OvertimeReport/generate`. The SP signature is
 * `crearep_ot(_date_frm, _date_to, _emp)`; C# only passes 2 args (relying on
 * a custom version of the proc), so we pass "All" by default for parity.
 */
export async function listOvertimeReport(
  from: string,
  to: string,
  emp: string = "All",
): Promise<OvertimeReportRow[]> {
  const rows = await callProc(`CALL crearep_ot(?, ?, ?)`, [from, to, emp]);
  return rows.map((row) => normalizeRow(row) as unknown as OvertimeReportRow);
}

/**
 * Mirrors `GET api/PayrollReport/generate/{year}` - fetches the per-pay
 * header roll-up then loads the per-amount breakdown for each header. Returns
 * the shape the Razor view expects: `[{ Payreport, PayAmount: [...] }]`.
 */
export async function getPayrollReport(year: string): Promise<PayrollReportRow[]> {
  const headerRows = await callProc(`CALL crearep_payroll(?)`, [year]);
  const headers = headerRows.map((row) => mapPayrollHeader(normalizeRow(row)));

  const result: PayrollReportRow[] = [];
  for (const header of headers) {
    if (!header.PyhCode) {
      result.push({ Payreport: header, PayAmount: [] });
      continue;
    }
    const amtRows = await callProc(`CALL crearep_payamt(?)`, [header.PyhCode]);
    const amounts = amtRows.map((row) => mapPayrollAmount(normalizeRow(row)));
    result.push({ Payreport: header, PayAmount: amounts });
  }
  return result;
}

function mapPayrollHeader(row: Record<string, unknown>): PayrollReportHeader {
  return {
    PyhCode: pickString(row, "pyh_code", "PyhCode"),
    PyhDesc: pickString(row, "pyh_desc", "PyhDesc"),
    BaseSalary: pickNumber(row, "base_salary", "BaseSalary"),
    TotalCompensation: pickNumber(row, "total_compensation", "TotalCompensation"),
    TotalDeduction: pickNumber(row, "total_deduction", "TotalDeduction"),
    Tax: pickNumber(row, "tax", "Tax"),
    Sss: pickNumber(row, "sss", "Sss"),
    Philhealth: pickNumber(row, "philhealth", "Philhealth"),
    Hdmf: pickNumber(row, "hdmf", "Hdmf"),
    SssEmployer: pickNumber(row, "sss_employer", "SssEmployer"),
    PhilhealthEmployer: pickNumber(row, "philhealth_employer", "PhilhealthEmployer"),
    HdmfEmployer: pickNumber(row, "hdmf_employer", "HdmfEmployer"),
    TaxAdjusted: pickNumber(row, "tax_adjusted", "TaxAdjusted"),
  };
}

function mapPayrollAmount(row: Record<string, unknown>): PayrollReportAmount {
  return {
    PydPk: pickString(row, "pyd_pk", "PydPk"),
    PydCode: pickString(row, "pyd_code", "PydCode"),
    PyaDef: pickString(row, "pya_def", "PyaDef"),
    CdDesc: pickString(row, "cd_desc", "CdDesc"),
    CdType: pickString(row, "cd_type", "CdType"),
    PayAmount: pickNumber(row, "pay_amount", "PayAmount"),
  };
}

/**
 * Mirrors `POST api/UserDailylog/list`. The C# controller only passes `_dte`,
 * but the SP signature is `(_dte, _emp)`; we forward the caller's empId (or
 * "All" for elevated viewers) to keep stored proc parity.
 */
export async function listDailyLog(
  date: string,
  emp: string = "All",
): Promise<DailyLogRow[]> {
  const rows = await callProc(`CALL crearep_dailylog(?, ?)`, [date, emp]);
  return rows.map((row) => mapDailyLog(normalizeRow(row)));
}

function mapDailyLog(row: Record<string, unknown>): DailyLogRow {
  return {
    AttDate: pickDate(row, "att_date", "AttDate"),
    EmpId: pickString(row, "emp_id", "EmpId"),
    EmpName: pickString(row, "empname", "EmpName"),
    EmpSched: pickString(row, "mysched", "EmpSched"),
    EmpTimeIn: pickString(row, "timein", "EmpTimeIn"),
    EmpTimeOut: pickString(row, "timeout", "EmpTimeOut"),
    DepDesc: pickString(row, "dep_desc", "DepDesc"),
    PstDesc: pickString(row, "pst_desc", "PstDesc"),
    LocDesc: pickString(row, "loc_desc", "LocDesc"),
    InIp: pickString(row, "inip", "InIp"),
    OutIp: pickString(row, "outip", "OutIp"),
    InLoc: pickString(row, "inloc", "InLoc"),
    OutLoc: pickString(row, "outloc", "OutLoc"),
  };
}

export interface UndertimeReportRow {
  utm_id: string | null;
  name: string | null;
  utm_date: string | null;
  utm_from: string | null;
  utm_to: string | null;
  utm_reason: string | null;
  utm_applieddate: string | null;
  status: string | null;
}

export interface ScheduleChangeReportRow {
  sca_did: string | null;
  name: string | null;
  sca_ddate: string | null;
  sca_dshiftstart: string | null;
  sca_dshiftend: string | null;
  sca_dbreakstart: string | null;
  sca_dbreakend: string | null;
  sca_drest: string | null;
  att_schin: string | null;
  att_schout: string | null;
  att_schbin: string | null;
  att_schbout: string | null;
  att_restday: string | null;
  status: string | null;
}

export interface CoaReportRow {
  name: string | null;
  coa_did: string | null;
  coa_dtype: string | null;
  coa_ddate: string | null;
  coa_dtime: string | null;
  coa_stypedetail: string | null;
  coa_sreason: string | null;
  status: string | null;
}

export interface BiologReportRow {
  bio_date: string | null;
  bio_emp: string | null;
  bio_type: string | null;
  bio_time: string | null;
  bio_loc: string | null;
  bio_ip: string | null;
}

export async function listUndertimeReport(
  from: string,
  to: string,
  emp: string = "All",
): Promise<UndertimeReportRow[]> {
  const rows = await callProc(`CALL crearep_ut(?, ?, ?)`, [from, to, emp]);
  return rows.map((row) => normalizeRow(row) as unknown as UndertimeReportRow);
}

export async function listScheduleChangeReport(
  from: string,
  to: string,
  emp: string = "All",
): Promise<ScheduleChangeReportRow[]> {
  const rows = await callProc(`CALL crearep_schedchange(?, ?, ?)`, [
    from,
    to,
    emp,
  ]);
  return rows.map(
    (row) => normalizeRow(row) as unknown as ScheduleChangeReportRow,
  );
}

export async function listCoaReport(
  from: string,
  to: string,
  emp: string = "All",
): Promise<CoaReportRow[]> {
  const rows = await callProc(`CALL crearep_coa(?, ?, ?)`, [from, to, emp]);
  return rows.map((row) => normalizeRow(row) as unknown as CoaReportRow);
}

export async function listBiologReport(
  emp: string,
  from: string,
  to: string,
): Promise<BiologReportRow[]> {
  const rows = await callProc(`CALL crearep_biolog(?, ?, ?)`, [emp, from, to]);
  return rows.map((row) => normalizeRow(row) as unknown as BiologReportRow);
}
