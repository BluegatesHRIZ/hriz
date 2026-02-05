import { prisma } from "@/lib/db/prisma";

/**
 * Request-related services (leave, overtime, undertime, COA, loan, schedule adjust).
 * Native Prisma; replaces stored procedure calls (reference: sql/stored_proc.sql).
 */

const MODTYPE_MENU: Record<string, string> = {
  LEA: "M1",
  COA: "M2",
  OVT: "M3",
  UNT: "M4",
  SCA: "M5",
  LOA: "M6",
};

async function addForApproval(taskId: string, employee: string) {
  const modtype = taskId.split("-")[0];
  const mtype = MODTYPE_MENU[modtype] ?? null;
  if (!mtype) return;
  const levels = await prisma.approvallevels.findMany({
    where: { al_emp: employee, al_menu: mtype },
  });
  for (const al of levels) {
    await prisma.forapproval.create({
      data: {
        fa_taskid: taskId,
        fa_emp: employee,
        fa_appvr: al.al_appvr ?? undefined,
        fa_menu: al.al_menu ?? undefined,
        fa_level: al.al_level ?? undefined,
      },
    });
  }
}

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// --- Leave ---
// Mirrors stored procedure `get_leavetypes(_emp_id)`:
// SELECT empleave.eml_leave AS lev_id, leave.lev_desc, lev_before, lev_after, lev_lead
// FROM empleave LEFT JOIN leave ON leave.lev_id = empleave.eml_leave
// WHERE eml_emp = _emp_id;
export async function getLeaveTypes(empId: string) {
  const empLeaves = await prisma.empleave.findMany({
    where: { eml_emp: empId },
    select: { eml_leave: true },
  });
  const leaveIds = empLeaves.map((e) => e.eml_leave).filter(Boolean) as string[];
  if (leaveIds.length === 0) return [];

  const leaves = await prisma.leave.findMany({
    where: { lev_id: { in: leaveIds } },
    select: {
      lev_id: true,
      lev_desc: true,
      lev_before: true,
      lev_after: true,
      lev_lead: true,
    },
  });

  // Preserve the same shape as the SP result
  return leaves.map((l) => ({
    lev_id: l.lev_id,
    lev_desc: l.lev_desc,
    lev_before: l.lev_before,
    lev_after: l.lev_after,
    lev_lead: l.lev_lead,
  }));
}

export async function getLeaveCurYear(employee: string) {
  // Mirrors stored procedure `get_leave_curyear(_employee)`:
  // start_date = YEAR(current_date())-01-01; end_date = YEAR(current_date())-12-31;
  // SELECT lea_sid, lea_did, lea_ddate, lea_dtype, lea_dampm
  // FROM leave_summary INNER JOIN leave_detail ON lea_sid = lea_dpk
  // WHERE lea_semp = _employee AND lea_sstatus = 1
  //   AND lea_sfrom BETWEEN start_date AND end_date
  //   AND lea_sto   BETWEEN start_date AND end_date;
  const year = new Date().getFullYear();
  const start_date = new Date(year, 0, 1);
  const end_date = new Date(year, 11, 31);

  const summaries = await prisma.leave_summary.findMany({
    where: {
      lea_semp: employee,
      lea_sstatus: 1,
      lea_sfrom: { gte: start_date, lte: end_date },
      lea_sto: { gte: start_date, lte: end_date },
    },
    select: { lea_sid: true },
  });
  const ids = summaries.map((s) => s.lea_sid).filter(Boolean) as string[];
  if (ids.length === 0) return [];

  const details = await prisma.leave_detail.findMany({
    where: { lea_dpk: { in: ids } },
    select: {
      lea_dpk: true,
      lea_did: true,
      lea_ddate: true,
      lea_dtype: true,
      lea_dampm: true,
    },
  });

  return details.map((d) => ({
    lea_sid: d.lea_dpk,
    lea_did: d.lea_did,
    lea_ddate: d.lea_ddate,
    lea_dtype: d.lea_dtype,
    lea_dampm: d.lea_dampm,
  }));
}

export async function leaveInsertSummary(
  empId: string,
  LeaStype: string,
  LeaSfrom: Date,
  LeaSto: Date,
  LeaSreason: string,
  LeaSwithpay: number,
  LeaSwithoutpay: number
): Promise<string> {
  const today = dateOnly(new Date());
  const count = await prisma.leave_summary.count({
    where: { lea_semp: empId },
  });
  const ctr = count + 1;
  const lea_sid = `LEA-${formatYmd(today)}${empId}${ctr}`;
  await prisma.leave_summary.create({
    data: {
      lea_sid,
      lea_sctr: ctr,
      lea_stype: LeaStype,
      lea_sfrom: LeaSfrom,
      lea_sto: LeaSto,
      lea_sreason: LeaSreason,
      lea_swithpay: LeaSwithpay,
      lea_swithoutpay: LeaSwithoutpay,
      lea_semp: empId,
      lea_sapplieddate: new Date(),
      lea_sstatus: 0,
    },
  });
  await addForApproval(lea_sid, empId);
  return lea_sid;
}

export async function leaveInsertDetails(
  lea_dpk: string,
  lea_ddate: Date,
  lea_dtype: string,
  lea_dampm: string
) {
  const count = await prisma.leave_detail.count({
    where: { lea_dpk },
  });
  const counter = count + 1;
  const lea_did = `${lea_dpk}${counter}`;
  await prisma.leave_detail.create({
    data: {
      lea_did,
      lea_dpk,
      lea_dctr: counter,
      lea_ddate,
      lea_dtype,
      lea_dampm,
    },
  });
}

export async function leaveUpdateSummary(
  leaveId: string,
  LeaStype: string,
  LeaSfrom: Date,
  LeaSto: Date,
  LeaSreason: string,
  LeaSwithpay: number,
  LeaSwithoutpay: number
) {
  // Matches stored procedure behavior: update fields, reset status to 0, reset forapproval
  await prisma.leave_summary.update({
    where: { lea_sid: leaveId },
    data: {
      lea_stype: LeaStype,
      lea_sfrom: LeaSfrom,
      lea_sto: LeaSto,
      lea_sreason: LeaSreason,
      lea_swithpay: LeaSwithpay,
      lea_swithoutpay: LeaSwithoutpay,
      lea_sstatus: 0,
    },
  });
  await prisma.forapproval.updateMany({
    where: { fa_taskid: leaveId },
    data: { fa_status: 0, fa_appstat: 0 },
  });
}

// --- Overtime ---
export async function otInsertOtRequest(
  otm_emp: string,
  otm_type: number,
  otm_date: Date,
  otm_from: Date,
  otm_to: Date,
  otm_reason: string
) {
  // Mirrors stored procedure `ot_insert_otrequest`:
  // counter = count(otm_emp) + 1; id = "OVT-" + yyyymmdd + emp + counter
  const today = dateOnly(new Date());
  const count = await prisma.overtime.count({ where: { otm_emp } });
  const counter = count + 1;
  const otm_id = `OVT-${formatYmd(today)}${otm_emp}${counter}`;

  await prisma.overtime.create({
    data: {
      otm_id,
      otm_ctr: counter,
      otm_emp,
      otm_type: String(otm_type),
      otm_date,
      otm_from,
      otm_to,
      otm_to_A: otm_to,
      otm_reason,
      otm_logdate: new Date(),
      otm_applieddate: new Date(),
    },
  });
  await addForApproval(otm_id, otm_emp);
}

export async function otUpdateOtRequest(
  otm_id: string,
  otm_type: number,
  otm_date: Date,
  otm_from: Date,
  otm_to: Date,
  otm_reason: string
) {
  // Mirrors stored procedure `ot_update_otrequest`
  await prisma.overtime.update({
    where: { otm_id },
    data: {
      otm_type: String(otm_type),
      otm_date,
      otm_from,
      otm_to,
      otm_to_A: otm_to,
      otm_reason,
      otm_status: 0,
    },
  });
  await prisma.forapproval.updateMany({
    where: { fa_taskid: otm_id },
    data: { fa_status: 0, fa_appstat: 0 },
  });
}

export async function otGetRequestById(empId: string, otId: string) {
  return prisma.overtime.findFirst({
    where: { otm_id: otId, otm_emp: empId },
  });
}

// --- Undertime ---
export async function undertimeInsertSummary(
  utm_emp: string,
  utm_date: Date,
  utm_from: Date,
  utm_to: Date,
  utm_reason: string
) {
  // Mirrors stored procedure `undertime_insertsummary`
  const today = dateOnly(new Date());
  const count = await prisma.undertime.count({ where: { utm_emp } });
  const counter = count + 1;
  const utm_id = `UNT-${formatYmd(today)}${utm_emp}${counter}`;
  await prisma.undertime.create({
    data: {
      utm_id,
      utm_ctr: counter,
      utm_date,
      utm_from,
      utm_to,
      utm_reason,
      utm_emp,
      utm_applieddate: new Date(),
      utm_status: 0,
      utm_logdate: new Date(),
    },
  });
  await addForApproval(utm_id, utm_emp);
}

export async function undertimeUpdateSummary(
  utm_id: string,
  utm_date: Date,
  utm_from: Date,
  utm_to: Date,
  utm_reason: string
) {
  // Mirrors stored procedure `undertime_updatesummary`
  await prisma.undertime.update({
    where: { utm_id },
    data: {
      utm_date,
      utm_from,
      utm_to,
      utm_reason,
      utm_status: 0,
    },
  });
  await prisma.forapproval.updateMany({
    where: { fa_taskid: utm_id },
    data: { fa_status: 0, fa_appstat: 0 },
  });
}

// --- COA ---
export async function coaSummaryInsert(
  CoaStype: string,
  CoaStypedetail: string,
  CoaSreason: string,
  CoaSemp: string
): Promise<string> {
  // Mirrors stored procedure `coa_summary_insert`
  const today = dateOnly(new Date());
  // get last coa_sctr for today, else 0
  const last = await prisma.coa_summary.findFirst({
    where: {
      coa_sapplieddate: {
        gte: today,
        lt: new Date(today.getTime() + 86400000),
      },
    },
    orderBy: { coa_sctr: "desc" },
    select: { coa_sctr: true },
  });
  const counter = (last?.coa_sctr ?? 0) + 1;
  const coa_sid = `COA-${formatYmd(today)}${CoaSemp}${counter}`;
  await prisma.coa_summary.create({
    data: {
      coa_sid,
      coa_sctr: counter,
      coa_stype: CoaStype,
      coa_stypedetail: CoaStypedetail,
      coa_sreason: CoaSreason,
      coa_semp: CoaSemp,
      coa_sapplieddate: new Date(),
      coa_sstatus: 0,
    },
  });
  await addForApproval(coa_sid, CoaSemp);
  return coa_sid;
}

export async function coaDetailsInsert(
  coa_dpk: string,
  coa_dtype: string,
  coa_ddate: Date,
  coa_dtime: Date
) {
  // Mirrors stored procedure `coa_details_insert`
  const last = await prisma.coa_detail.findFirst({
    where: { coa_dpk },
    orderBy: { coa_dctr: "desc" },
    select: { coa_dctr: true },
  });
  const counter = (last?.coa_dctr ?? 0) + 1;
  const coa_did = `${coa_dpk}${counter}`;
  await prisma.coa_detail.create({
    data: {
      coa_did,
      coa_dpk,
      coa_dctr: counter,
      coa_dtype,
      coa_ddate,
      coa_dtime,
    },
  });
}

export async function coaSummaryUpdate(
  coa_sid: string,
  CoaStype: string,
  CoaStypedetail: string,
  CoaSreason: string
) {
  // Mirrors stored procedure `coa_summary_update`
  await prisma.coa_summary.update({
    where: { coa_sid },
    data: {
      coa_stype: CoaStype,
      coa_stypedetail: CoaStypedetail,
      coa_sreason: CoaSreason,
      coa_sstatus: 0,
    },
  });
  await prisma.forapproval.updateMany({
    where: { fa_taskid: coa_sid },
    data: { fa_status: 0, fa_appstat: 0 },
  });
}

// --- Loan ---
export async function loanInsertRequest(
  LoaAmt: number,
  LoaReason: string,
  LoaType: string,
  LoaExprelease: Date | null,
  LoaEmp: string
) {
  // Mirrors stored procedure `loan_insert_request`
  const today = dateOnly(new Date());
  const last = await prisma.loan.findFirst({
    where: {
      loa_applieddate: { gte: today, lt: new Date(today.getTime() + 86400000) },
    },
    orderBy: { loa_ctr: "desc" },
    select: { loa_ctr: true },
  });
  const counter = (last?.loa_ctr ?? 0) + 1;
  const loa_id = `LOA-${formatYmd(today)}${LoaEmp}${counter}`;
  await prisma.loan.create({
    data: {
      loa_id,
      loa_ctr: counter,
      loa_amt: LoaAmt,
      loa_reason: LoaReason,
      loa_type: LoaType,
      loa_exprelease: LoaExprelease,
      loa_emp: LoaEmp,
      loa_applieddate: new Date(),
    },
  });
}

export async function loanUpdateRequest(
  loa_id: string,
  LoaAmt: number,
  LoaReason: string,
  LoaType: string,
  LoaExprelease: Date | null,
  LoaEmp: string
) {
  // Mirrors stored procedure `loan_update_request`
  await prisma.loan.update({
    where: { loa_id },
    data: {
      loa_amt: LoaAmt,
      loa_reason: LoaReason,
      loa_type: LoaType,
      loa_exprelease: LoaExprelease,
      loa_status: 0,
    },
  });
}

export async function loanManagementList() {
  const loans = await prisma.loan.findMany({
    where: { loa_status: { notIn: [2, 4, 5] } },
    orderBy: { loa_applieddate: "desc" },
  });
  const empIds = [
    ...new Set(
      loans.flatMap(
        (l) => [l.loa_emp, l.loa_approvedby].filter(Boolean) as string[]
      )
    ),
  ];
  const loanIds = loans.map((l) => l.loa_id);
  const [employees, advances] = await Promise.all([
    empIds.length
      ? prisma.employee.findMany({ where: { emp_id: { in: empIds } } })
      : [],
    prisma.empadvance.findMany({ where: { emp_adid: { in: loanIds } } }),
  ]);
  const empById = new Map(employees.map((e) => [e.emp_id, e] as const));
  const advByLoaId = new Map(advances.map((a) => [a.emp_adid, a] as const));
  return loans.map((l) => {
    const emp = l.loa_emp ? empById.get(l.loa_emp) : null;
    const app = l.loa_approvedby ? empById.get(l.loa_approvedby) : null;
    const adv = advByLoaId.get(l.loa_id);
    return {
      ...l,
      emp_name: emp
        ? `${emp.emp_last ?? ""}, ${emp.emp_first ?? ""}`.trim() || null
        : null,
      loa_approvedby: app
        ? `${app.emp_last ?? ""}, ${app.emp_first ?? ""}`.trim() || null
        : null,
      emp_adaddedamt: adv?.emp_adaddedamt ?? null,
      emp_adamtperpay: adv?.emp_adamtperpay ?? null,
      emp_adpaypermonth: adv?.emp_adpaypermonth ?? null,
      emp_adpaycutoff: adv?.emp_adpaycutoff ?? null,
    };
  });
}

export async function loanManageRequest(
  LoaId: string,
  Status: string,
  Reason: string | null,
  LoaEmp: string,
  EmpAdtype: string,
  EmpAddate: Date,
  EmpAdamt: number,
  EmpAdaddedamt: number,
  EmpAdpaypermonth: number,
  EmpAdpaycutoff: number | null,
  EmpAdstart: Date,
  EmpAdamtperpay: number,
  approver: string
) {
  const now = new Date();
  switch (Status) {
    case "resubmit":
      await prisma.loan.update({
        where: { loa_id: LoaId },
        data: { loa_status: 4 },
      });
      await prisma.fapreason.create({
        data: {
          fap_taskid: LoaId,
          fap_type: "R",
          fap_appvr: approver,
          fap_reason: Reason ?? "",
        },
      });
      break;
    case "approve":
      await prisma.loan.update({
        where: { loa_id: LoaId },
        data: {
          loa_approvedby: approver,
          loa_approveddate: now,
          loa_status: 1,
        },
      });
      await prisma.empadvance.upsert({
        where: { emp_adid: LoaId },
        create: {
          emp_id: LoaEmp,
          emp_adid: LoaId,
          emp_adtype: EmpAdtype,
          emp_addate: EmpAddate,
          emp_adamt: EmpAdamt,
          emp_adaddedamt: EmpAdaddedamt,
          emp_adpaypermonth: EmpAdpaypermonth,
          emp_adpaycutoff: EmpAdpaypermonth === 2 ? null : EmpAdpaycutoff,
          emp_adstart: EmpAdstart,
          emp_adamtperpay: EmpAdamtperpay,
          emp_adstatus: 1,
        },
        update: {},
      });
      break;
    case "reject":
      await prisma.loan.update({
        where: { loa_id: LoaId },
        data: {
          loa_approvedby: approver,
          loa_approveddate: now,
          loa_status: 2,
        },
      });
      await prisma.empadvance.deleteMany({
        where: { emp_adid: LoaId },
      });
      break;
    case "release":
      await prisma.loan.update({
        where: { loa_id: LoaId },
        data: { loa_approvedby: approver, loa_status: 5 },
      });
      await prisma.empadvance.updateMany({
        where: { emp_adid: LoaId },
        data: { emp_adstatus: 1 },
      });
      break;
    default:
      break;
  }
}

// --- Schedule adjust ---
export async function schedAdjustInsertSummary(
  ScaSdatefrom: Date,
  ScaSdateto: Date,
  ScaSreason: string,
  ScaSemp: string
): Promise<string> {
  const today = dateOnly(new Date());
  const last = await prisma.schedadjust_summary.findFirst({
    where: {
      sca_sapplieddate: {
        gte: today,
        lt: new Date(today.getTime() + 86400000),
      },
    },
    orderBy: { sca_sctr: "desc" },
    select: { sca_sctr: true },
  });
  const counter = (last?.sca_sctr ?? 0) + 1;
  const sca_sid = `SCA-${formatYmd(today)}${ScaSemp}${counter}`;
  await prisma.schedadjust_summary.create({
    data: {
      sca_sid,
      sca_sctr: counter,
      sca_sdatefrom: ScaSdatefrom,
      sca_sdateto: ScaSdateto,
      sca_semp: ScaSemp,
      sca_sreason: ScaSreason,
      sca_sapplieddate: new Date(),
    },
  });
  await addForApproval(sca_sid, ScaSemp);
  return sca_sid;
}

export async function schedAdjustInsertDetails(
  scaId: string,
  ScaDdate: Date,
  ScaDshiftstart: Date,
  ScaDbreakstart: Date,
  ScaDbreakend: Date,
  ScaDshiftend: Date,
  ScaDrest: number,
  ScaDbreak: number,
  ScaDShift: number | string
) {
  const last = await prisma.schedadjust_detail.findFirst({
    where: { sca_dpk: scaId },
    orderBy: { sca_dctr: "desc" },
    select: { sca_dctr: true },
  });
  const counter = (last?.sca_dctr ?? 0) + 1;
  const sca_did = `${scaId}${counter}`;
  await prisma.schedadjust_detail.create({
    data: {
      sca_did,
      sca_dpk: scaId,
      sca_dctr: counter,
      sca_ddate: ScaDdate,
      sca_dshiftstart: ScaDshiftstart,
      sca_dbreakstart: ScaDbreakstart,
      sca_dbreakend: ScaDbreakend,
      sca_dshiftend: ScaDshiftend,
      sca_drest: ScaDrest,
      sca_dbreak: ScaDbreak,
      sca_dshift: String(ScaDShift),
    },
  });
}

export async function scheduleUpdateSummary(
  scaId: string,
  ScaSdatefrom: Date,
  ScaSdateto: Date,
  ScaSreason: string
) {
  // Mirrors stored procedure `schedule_updatesummary`
  await prisma.schedadjust_summary.update({
    where: { sca_sid: scaId },
    data: {
      sca_sdatefrom: ScaSdatefrom,
      sca_sdateto: ScaSdateto,
      sca_sreason: ScaSreason,
      sca_sstatus: 0,
    },
  });
  await prisma.forapproval.updateMany({
    where: { fa_taskid: scaId },
    data: { fa_status: 0, fa_appstat: 0 },
  });
}

// --- Cancel request (status 3 = cancel/void) ---
export async function cancelRequest(taskId: string, employee: string) {
  const modtype = taskId.split("-")[0];
  const now = new Date();
  switch (modtype) {
    case "LEA":
      await prisma.leave_summary.update({
        where: { lea_sid: taskId },
        data: {
          lea_sstatus: 3,
          lea_sapprovedby: employee,
          lea_sapproveddate: now,
        },
      });
      break;
    case "COA":
      await prisma.coa_summary.update({
        where: { coa_sid: taskId },
        data: {
          coa_sstatus: 3,
          coa_sapprovedby: employee,
          coa_sapproveddate: now,
        },
      });
      break;
    case "OVT":
      await prisma.overtime.update({
        where: { otm_id: taskId },
        data: {
          otm_status: 3,
          otm_approvedby: employee,
          otm_approveddate: now,
        },
      });
      break;
    case "UNT":
      await prisma.undertime.update({
        where: { utm_id: taskId },
        data: {
          utm_status: 3,
          utm_approvedby: employee,
          utm_approveddate: now,
        },
      });
      break;
    case "SCA":
      await prisma.schedadjust_summary.update({
        where: { sca_sid: taskId },
        data: {
          sca_sstatus: 3,
          sca_sapprovedby: employee,
          sca_sapproveddate: now,
        },
      });
      break;
    case "LOA":
      await prisma.loan.update({
        where: { loa_id: taskId },
        data: {
          loa_status: 3,
          loa_approvedby: employee,
          loa_approveddate: now,
        },
      });
      break;
    default:
      break;
  }
  await prisma.forapproval.updateMany({
    where: { fa_taskid: taskId },
    data: { fa_status: 3 },
  });
}

// --- Display grids (return list for OVT, LEA, UNT) ---
export async function displayGrid(
  menu: "OVT" | "LEA" | "UNT",
  employee: string
): Promise<unknown[]> {
  switch (menu) {
    case "OVT":
      return prisma.overtime.findMany({
        where: { otm_emp: employee },
        orderBy: { otm_applieddate: "desc" },
      });
    case "LEA":
      return prisma.leave_summary.findMany({
        where: { lea_semp: employee },
        orderBy: { lea_sapplieddate: "desc" },
      });
    case "UNT":
      return prisma.undertime.findMany({
        where: { utm_emp: employee },
        orderBy: { utm_applieddate: "desc" },
      });
    default:
      return [];
  }
}

// --- Year / date lists ---
export async function getOvertimeCurYear(employee: string) {
  const start = new Date(new Date().getFullYear(), 0, 1);
  const end = new Date(new Date().getFullYear(), 11, 31);
  return prisma.overtime.findMany({
    where: {
      otm_emp: employee,
      otm_status: 1,
      otm_from: { gte: start },
      otm_to: { lte: end },
    },
  });
}

export async function getSchedAdjustedCurYear(employee: string) {
  const start = new Date(new Date().getFullYear(), 0, 1);
  const end = new Date(new Date().getFullYear(), 11, 31);
  const rows = await prisma.schedadjust_summary.findMany({
    where: {
      sca_semp: employee,
      sca_sstatus: 1,
      sca_sdatefrom: { gte: start },
      sca_sdateto: { lte: end },
    },
  });
  return rows;
}

export async function getSchedAdjustedDate(
  employee: string,
  dateFrom: string,
  dateTo: string
) {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const details = await prisma.schedadjust_detail.findMany({
    where: {
      sca_ddate: { gte: from, lte: to },
    },
  });
  const summaryIds = [
    ...new Set(details.map((d) => d.sca_dpk).filter(Boolean)),
  ];
  const summaries = summaryIds.length
    ? await prisma.schedadjust_summary.findMany({
        where: {
          sca_sid: { in: summaryIds as string[] },
          sca_semp: employee,
          sca_sstatus: 1,
        },
      })
    : [];
  const validPks = new Set(summaries.map((s) => s.sca_sid));
  return details
    .filter((d) => d.sca_dpk && validPks.has(d.sca_dpk))
    .map((d) => ({ ...d, sca_sid: d.sca_dpk }));
}
