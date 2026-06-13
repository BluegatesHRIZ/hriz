import ExcelJS from "exceljs";
import type {
  AttendanceEmployeeDetail,
  AttendanceEmployeeHeader,
  BiologReportRow,
  CoaReportRow,
  DailyLogRow,
  LeaveReportRow,
  OvertimeReportRow,
  PayrollReportRow,
  ScheduleChangeReportRow,
  UndertimeReportRow,
} from "@/lib/services/reports.service";

/**
 * Excel (.xlsx) builders for the five ported reports. Mirrors the column
 * order used by the Razor pages (`AttendanceReport.razor`,
 * `LeaveReport.razor`, etc.) so the generated worksheets line up with the
 * Blazor output the user is familiar with. All helpers return an
 * `ArrayBuffer` ready to be wrapped in a `NextResponse` with the standard
 * .xlsx Content-Type header.
 *
 * Cell formatting is intentionally minimal (header bold + light gray fill);
 * the C# version uses DevExpress-specific styling that would require a much
 * larger port. The data shape and column layout match exactly.
 */

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F0F0" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11 };

function autoSize(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((column) => {
    if (!column.eachCell) return;
    let max = 8;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) return;
      const text =
        typeof value === "object" && value && "richText" in value
          ? (value as { richText: { text: string }[] }).richText
              .map((t) => t.text)
              .join("")
          : String(value);
      if (text.length > max) max = text.length;
    });
    column.width = Math.min(max + 2, 50);
  });
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
}

const OVERTIME_COLUMNS = [
  "EXCESS",
  "OT",
  "ND",
  "ND-OT",
  "RD",
  "RD-OT",
  "RD-ND",
  "RD-ND-OT",
  "SH",
  "SH-OT",
  "SH-ND",
  "SH-ND-OT",
  "SH-RD",
  "SH-RD-OT",
  "SH-RD-ND",
  "SH-RD-ND-OT",
  "LH",
  "LH-OT",
  "LH-ND",
  "LH-ND-OT",
  "LH-RD",
  "LH-RD-OT",
  "LH-RD-ND",
  "LH-RD-ND-OT",
  "DH",
  "DH-OT",
  "DH-ND",
  "DH-ND-OT",
  "DH-RD",
  "DH-RD-OT",
  "DH-RD-ND",
  "DH-RD-ND-OT",
] as const;

/**
 * Returns the 32 holiday/RD/ND overtime fields in column order, mirroring
 * `OvertimeColumns.razor` from the Blazor report.
 */
function overtimeValues(
  source:
    | AttendanceEmployeeHeader
    | AttendanceEmployeeDetail
    | OvertimeReportRow,
): (string | null)[] {
  const r = source as unknown as Record<string, string | null | undefined>;
  return [
    r.AttExcess ?? r.att_excess ?? null,
    r.AttOt ?? r.att_ot ?? null,
    r.AttNd ?? r.att_nd ?? null,
    r.AttNdot ?? r.att_ndot ?? null,
    r.AttRd ?? r.att_rd ?? null,
    r.AttRdot ?? r.att_rdot ?? null,
    r.AttRdnd ?? r.att_rdnd ?? null,
    r.AttRdndot ?? r.att_rdndot ?? null,
    r.AttSh ?? r.att_sh ?? null,
    r.AttShot ?? r.att_shot ?? null,
    r.AttShnd ?? r.att_shnd ?? null,
    r.AttShndot ?? r.att_shndot ?? null,
    r.AttShrd ?? r.att_shrd ?? null,
    r.AttShrdot ?? r.att_shrdot ?? null,
    r.AttShrdnd ?? r.att_shrdnd ?? null,
    r.AttShrdndot ?? r.att_shrdndot ?? null,
    r.AttLh ?? r.att_lh ?? null,
    r.AttLhot ?? r.att_lhot ?? null,
    r.AttLhnd ?? r.att_lhnd ?? null,
    r.AttLhndot ?? r.att_lhndot ?? null,
    r.AttLhrd ?? r.att_lhrd ?? null,
    r.AttLhrdot ?? r.att_lhrdot ?? null,
    r.AttLhrdnd ?? r.att_lhrdnd ?? null,
    r.AttLhrdndot ?? r.att_lhrdndot ?? null,
    r.AttDh ?? r.att_dh ?? null,
    r.AttDhot ?? r.att_dhot ?? null,
    r.AttDhnd ?? r.att_dhnd ?? null,
    r.AttDhndot ?? r.att_dhndot ?? null,
    r.AttDhrd ?? r.att_dhrd ?? null,
    r.AttDhrdot ?? r.att_dhrdot ?? null,
    r.AttDhrdnd ?? r.att_dhrdnd ?? null,
    r.AttDhrdndot ?? r.att_dhrdndot ?? null,
  ];
}

/**
 * Mirrors the C# "Attendance Summary Report" + per-employee detail exports.
 * Generates one workbook with:
 *  - A "Summary" sheet listing the headers (mirrors `ExportHeader()`).
 *  - One detail sheet per employee with their day-by-day rows
 *    (mirrors `ExportDetails(empid)`).
 */
export async function buildAttendanceXlsx(
  rows: AttendanceEmployeeHeader[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HRIS";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary");
  const summaryColumns = [
    "ID",
    "Employee",
    "Department",
    "Position",
    "Location",
    "Workday",
    "Present",
    "Absent",
    "Restday",
    "Leave",
    "Holiday",
    "Hours Worked",
    ...OVERTIME_COLUMNS,
  ];
  summary.addRow(summaryColumns);
  styleHeader(summary.getRow(1));

  for (const row of rows) {
    summary.addRow([
      row.EmpId,
      row.EmpFullname,
      row.EmpDepartment,
      row.EmpPosition,
      row.EmpLocation,
      row.EmpWorkday,
      row.EmpPresent,
      row.EmpAbsent,
      row.EmpRestday,
      row.EmpLeave,
      row.EmpHoliday,
      row.EmpHoursworked,
      ...overtimeValues(row),
    ]);
  }
  autoSize(summary);

  for (const employee of rows) {
    if (!employee.EmpId) continue;
    const sheetName = sanitizeSheetName(employee.EmpId);
    const sheet = wb.addWorksheet(sheetName);

    sheet.addRow(["ID", "Employee", "Location", "Department", "Position"]);
    styleHeader(sheet.getRow(1));
    sheet.addRow([
      employee.EmpId,
      employee.EmpFullname,
      employee.EmpLocation,
      employee.EmpDepartment,
      employee.EmpPosition,
    ]);
    sheet.addRow([]);

    const summaryHeader = [
      "Workday",
      "Present",
      "Hours Worked",
      "Restday",
      "Holiday",
      "Leave",
      "Absent",
      ...OVERTIME_COLUMNS,
    ];
    sheet.addRow(summaryHeader);
    styleHeader(sheet.getRow(sheet.rowCount));
    sheet.addRow([
      employee.EmpWorkday,
      employee.EmpPresent,
      employee.EmpHoursworked,
      employee.EmpRestday,
      employee.EmpHoliday,
      employee.EmpLeave,
      employee.EmpAbsent,
      ...overtimeValues(employee),
    ]);
    sheet.addRow([]);

    const detailHeader = [
      "Date",
      "Day",
      "Schedule",
      "Clock In and Out",
      "Clocked Hours",
      "Late",
      "Regular Hours",
      "Undertime",
      "Overtime",
      "Paid Hours",
      ...OVERTIME_COLUMNS,
    ];
    sheet.addRow(detailHeader);
    styleHeader(sheet.getRow(sheet.rowCount));

    for (const detail of employee.AttendanceDetails) {
      sheet.addRow([
        detail.EmpDate,
        detail.EmpDay,
        detail.EmpSchedule,
        detail.EmpClockedinandout,
        detail.EmpClockedhours,
        detail.EmpLate,
        detail.EmpRegularhours,
        detail.EmpUndertime,
        detail.EmpOvertime,
        detail.EmpPaidHours,
        ...overtimeValues(detail),
      ]);
    }

    autoSize(sheet);
  }

  return wb.xlsx.writeBuffer();
}

/**
 * Sheet names in Excel are capped at 31 chars and can't contain : \ / ? * [ ].
 */
function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*:[\]]/g, "_").slice(0, 31);
}

/**
 * Mirrors the "Leave Report" sheet from the Blazor page - one flat table.
 */
export async function buildLeaveXlsx(
  rows: LeaveReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Leave Report");

  sheet.addRow([
    "ID",
    "Employee",
    "Department",
    "Location",
    "Leave Type",
    "From",
    "To",
    "Reason",
    "With Pay",
    "Without Pay",
    "Applied Date",
    "Status",
  ]);
  styleHeader(sheet.getRow(1));

  for (const row of rows) {
    sheet.addRow([
      row.lea_semp,
      row.name,
      row.department,
      row.location,
      row.lev_desc,
      row.lea_sfrom,
      row.lea_sto,
      row.lea_sreason,
      row.lea_swithpay,
      row.lea_swithoutpay,
      row.lea_sapplieddate,
      row.status,
    ]);
  }
  autoSize(sheet);

  return wb.xlsx.writeBuffer();
}

/**
 * Mirrors "Overtime Report" - includes the 32 OT/RD/SH/LH/DH breakdown
 * columns the Blazor page exports.
 */
export async function buildOvertimeXlsx(
  rows: OvertimeReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Overtime Report");

  sheet.addRow([
    "OT ID",
    "Employee",
    "Department",
    "Location",
    "Date",
    "From",
    "To",
    "Reason",
    "Applied Date",
    "Status",
    ...OVERTIME_COLUMNS,
  ]);
  styleHeader(sheet.getRow(1));

  for (const row of rows) {
    sheet.addRow([
      row.otm_id,
      row.name,
      row.department,
      row.location,
      row.otm_date,
      row.otm_from,
      row.otm_to,
      row.reason,
      row.otm_applieddate,
      row.status,
      ...overtimeValues(row),
    ]);
  }
  autoSize(sheet);

  return wb.xlsx.writeBuffer();
}

/**
 * Mirrors "Payroll Report" - per pay-header line plus the dynamic
 * compensation/deduction columns the `PayAmount[]` payload produces.
 */
export async function buildPayrollXlsx(
  rows: PayrollReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Payroll Report");

  const amountKeys = new Map<string, string>();
  for (const row of rows) {
    for (const amt of row.PayAmount) {
      if (!amt.PyaDef) continue;
      if (!amountKeys.has(amt.PyaDef)) {
        amountKeys.set(amt.PyaDef, amt.CdDesc ?? amt.PyaDef);
      }
    }
  }

  const baseHeader = [
    "Pay Code",
    "Description",
    "Base Salary",
    "Total Compensation",
    "Total Deduction",
    "Tax",
    "SSS",
    "PhilHealth",
    "HDMF",
    "SSS Employer",
    "PhilHealth Employer",
    "HDMF Employer",
    "Tax Adjusted",
  ];
  const dynamicHeader = Array.from(amountKeys.values());
  sheet.addRow([...baseHeader, ...dynamicHeader]);
  styleHeader(sheet.getRow(1));

  for (const row of rows) {
    const dyn = Array.from(amountKeys.keys()).map((key) => {
      const match = row.PayAmount.find((a) => a.PyaDef === key);
      return match?.PayAmount ?? 0;
    });
    sheet.addRow([
      row.Payreport.PyhCode,
      row.Payreport.PyhDesc,
      row.Payreport.BaseSalary,
      row.Payreport.TotalCompensation,
      row.Payreport.TotalDeduction,
      row.Payreport.Tax,
      row.Payreport.Sss,
      row.Payreport.Philhealth,
      row.Payreport.Hdmf,
      row.Payreport.SssEmployer,
      row.Payreport.PhilhealthEmployer,
      row.Payreport.HdmfEmployer,
      row.Payreport.TaxAdjusted,
      ...dyn,
    ]);
  }
  autoSize(sheet);

  return wb.xlsx.writeBuffer();
}

/**
 * Mirrors "Daily Log" - one row per employee per day with bio time-in/out.
 */
export async function buildDailyLogXlsx(
  rows: DailyLogRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Daily Log");

  sheet.addRow([
    "Date",
    "Employee ID",
    "Employee",
    "Department",
    "Position",
    "Location",
    "Schedule",
    "Time In",
    "Time Out",
    "In IP",
    "Out IP",
    "In Location",
    "Out Location",
  ]);
  styleHeader(sheet.getRow(1));

  for (const row of rows) {
    sheet.addRow([
      row.AttDate,
      row.EmpId,
      row.EmpName,
      row.DepDesc,
      row.PstDesc,
      row.LocDesc,
      row.EmpSched,
      row.EmpTimeIn,
      row.EmpTimeOut,
      row.InIp,
      row.OutIp,
      row.InLoc,
      row.OutLoc,
    ]);
  }
  autoSize(sheet);

  return wb.xlsx.writeBuffer();
}

export async function buildUndertimeReportXlsx(
  rows: UndertimeReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Undertime Report");
  sheet.addRow([
    "ID",
    "Employee",
    "Date",
    "From",
    "To",
    "Reason",
    "Applied Date",
    "Status",
  ]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.utm_id,
      row.name,
      row.utm_date,
      row.utm_from,
      row.utm_to,
      row.utm_reason,
      row.utm_applieddate,
      row.status,
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}

export async function buildScheduleChangeReportXlsx(
  rows: ScheduleChangeReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Schedule Change Report");
  sheet.addRow([
    "Detail ID",
    "Employee",
    "Date",
    "Shift Start",
    "Shift End",
    "Break Start",
    "Break End",
    "Rest Day",
    "Sched In",
    "Sched Out",
    "Break In",
    "Break Out",
    "Rest",
    "Status",
  ]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.sca_did,
      row.name,
      row.sca_ddate,
      row.sca_dshiftstart,
      row.sca_dshiftend,
      row.sca_dbreakstart,
      row.sca_dbreakend,
      row.sca_drest,
      row.att_schin,
      row.att_schout,
      row.att_schbin,
      row.att_schbout,
      row.att_restday,
      row.status,
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}

export async function buildCoaReportXlsx(
  rows: CoaReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Attendance Change Report");
  sheet.addRow([
    "Employee",
    "Detail ID",
    "Type",
    "Date",
    "Time",
    "Type Detail",
    "Reason",
    "Status",
  ]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.name,
      row.coa_did,
      row.coa_dtype,
      row.coa_ddate,
      row.coa_dtime,
      row.coa_stypedetail,
      row.coa_sreason,
      row.status,
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}

export async function buildBiologReportXlsx(
  rows: BiologReportRow[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("User Biolog");
  sheet.addRow(["Date", "Employee", "Type", "Time", "Location", "IP"]);
  styleHeader(sheet.getRow(1));
  for (const row of rows) {
    sheet.addRow([
      row.bio_date,
      row.bio_emp,
      row.bio_type,
      row.bio_time,
      row.bio_loc,
      row.bio_ip,
    ]);
  }
  autoSize(sheet);
  return wb.xlsx.writeBuffer();
}
