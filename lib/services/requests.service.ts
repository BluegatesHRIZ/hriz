import { prisma } from "@/lib/db/prisma";
import { randomUUID } from "crypto";

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
  try {
    // Match stored procedure exactly:
    // SET _modtype=SUBSTRING_INDEX(_taskid,'-',1);
    // CASE _modtype WHEN 'LEA' THEN SET _mtype='M1'; ... END CASE;
    // INSERT INTO forapproval(fa_taskid, fa_emp, fa_appvr, fa_menu, fa_level)
    // SELECT _taskid,_employee,al_appvr,al_menu,al_level
    // FROM approvallevels WHERE al_emp=_employee AND al_menu=_mtype;
    
    const modtype = taskId.split("-")[0];
    const mtype = MODTYPE_MENU[modtype] ?? null;
    if (!mtype) {
      console.warn(`addForApproval: Unknown modtype "${modtype}" for taskId "${taskId}"`);
      return;
    }
    
    // Get approval levels matching the stored procedure query
    const levels = await prisma.approvallevels.findMany({
      where: { al_emp: employee, al_menu: mtype },
    });
    
    console.log(
      `addForApproval: Found ${levels.length} approval levels for employee "${employee}", menu "${mtype}", taskId "${taskId}"`
    );
    
    if (levels.length === 0) {
      console.warn(
        `addForApproval: No approval levels found for employee "${employee}" and menu "${mtype}" (taskId: "${taskId}"). ` +
        `This means the leave request will not appear in any approver's list. ` +
        `Please configure approval levels for this employee.`
      );
      return;
    }
    
    // Log the approval levels we're about to create
    console.log(
      `addForApproval: Creating forapproval records with approvers: ${levels.map((al) => al.al_appvr || "NULL").join(", ")}`
    );
    
    // Insert all approval levels at once (matching SP INSERT INTO ... SELECT behavior)
    // Explicitly set fa_status and fa_appstat to 0 to ensure clean reset
    const dataToInsert = levels.map((al) => ({
      fa_taskid: taskId,
      fa_emp: employee,
      fa_appvr: al.al_appvr ?? null,
      fa_menu: al.al_menu ?? null,
      fa_level: al.al_level ?? null,
      fa_status: 0, // Explicitly set to 0 for clean reset
      fa_appstat: 0, // Explicitly set to 0 for clean reset
    }));
    
    const result = await prisma.forapproval.createMany({
      data: dataToInsert,
      skipDuplicates: false, // We delete first, so no duplicates should exist
    });
    
    console.log(
      `addForApproval: Created ${result.count} approval entries for taskId "${taskId}", employee "${employee}", menu "${mtype}"`
    );
    
    // Verify the records were created
    if (result.count === 0) {
      console.warn(
        `addForApproval: WARNING - createMany returned count=0. This might mean records already exist or there was an issue.`
      );
      // Check if records already exist
      const existing = await prisma.forapproval.findMany({
        where: { fa_taskid: taskId },
      });
      console.log(
        `addForApproval: Found ${existing.length} existing forapproval records for taskId "${taskId}"`
      );
    }
  } catch (error) {
    console.error(`addForApproval error for taskId "${taskId}", employee "${employee}":`, error);
    throw error;
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

/**
 * Exact conversion of leave_insertsummary stored procedure.
 * SP: SET _Lea_Ctr = ((select count(Lea_Semp) from leave_summary WHERE Lea_Semp = _lea_semp) + 1);
 * SP: SET _Lea_Sid = CONCAT("LEA-", datenow ,_Lea_Semp,_Lea_Ctr);
 * We use UUID instead of counter-based ID.
 */
export async function leaveInsertSummary(
  empId: string,
  LeaStype: string,
  LeaSfrom: Date,
  LeaSto: Date,
  LeaSreason: string,
  LeaSwithpay: number,
  LeaSwithoutpay: number
): Promise<string> {
  // SP: SET datenow = DATE_FORMAT(DATE(CURRENT_TIMESTAMP),"%Y%m%d");
  const today = dateOnly(new Date());
  // SP: SET _Lea_Ctr = ((select count(Lea_Semp) from leave_summary WHERE Lea_Semp = _lea_semp) + 1);
  // SP: SET _Lea_Sid = CONCAT("LEA-", datenow ,_Lea_Semp,_Lea_Ctr);
  // We use UUID instead: keep "LEA-" prefix for compatibility
  const lea_sid = `LEA-${randomUUID()}`;
  
  // SP: INSERT INTO leave_summary (Lea_Sid, Lea_sCtr, Lea_Stype, Lea_Sfrom, Lea_Sto, Lea_Sreason, Lea_Swithpay, Lea_Swithoutpay, Lea_Semp, Lea_Sapplieddate)
  // SP: VALUES (_Lea_Sid, _Lea_Ctr, _Lea_Stype, _Lea_Sfrom, _Lea_Sto, _Lea_Sreason, _Lea_Swithpay, _Lea_Swithoutpay, _Lea_Semp, now());
  await prisma.leave_summary.create({
    data: {
      lea_sid,
      lea_sctr: 1, // Keep counter field but use 1 since UUID is unique
      lea_stype: LeaStype,
      lea_sfrom: LeaSfrom,
      lea_sto: LeaSto,
      lea_sreason: LeaSreason,
      lea_swithpay: LeaSwithpay,
      lea_swithoutpay: LeaSwithoutpay,
      lea_semp: empId,
      lea_sapplieddate: new Date(), // SP: now()
      lea_sstatus: 0,
    },
  });
  
  // SP: call addforApproval(_Lea_Sid,_Lea_Semp);
  await addForApproval(lea_sid, empId);
  
  // SP: SELECT Lea_Sid INTO _LeaveSummaryID FROM leave_summary WHERE Lea_Sid = _Lea_Sid;
  return lea_sid;
}

/**
 * Exact conversion of leave_updatedetails stored procedure.
 * SP: SET _Lev_Dctr = ((select lev_dctr FROM leave_detail WHERE Lea_Did = _Lea_Did order by lev_dctr desc limit 1) + 1);
 * SP: SET _Lea_Dpk = CONCAT(_Lea_Did,_Lev_Dctr);
 * SP: INSERT INTO leave_detail (Lea_Did, Lea_Dpk, ...) VALUES (_Lea_Did, _Lea_Dpk, ...);
 * Note: SP uses _Lea_Did (summary ID) for lea_did, and _Lea_Dpk (summary ID + counter) for lea_dpk.
 * Since lea_did is VARCHAR(20) and UUIDs are too long, we use a short unique ID instead.
 */
export async function leaveInsertDetails(
  lea_dpk: string, // This is the summary ID (leaveId) - SP parameter _Lea_Did
  lea_ddate: Date,
  lea_dtype: string,
  lea_dampm: string
) {
  // SP: SET _Lev_Dctr = ((select lev_dctr FROM leave_detail WHERE Lea_Did = _Lea_Did order by lev_dctr desc limit 1) + 1);
  // Note: SP filters by lea_did = summary ID, but we filter by lea_dpk (parent reference) to get counter
  const last = await prisma.leave_detail.findFirst({
    where: { lea_dpk },
    orderBy: { lea_dctr: "desc" },
    select: { lea_dctr: true },
  });
  const counter = (last?.lea_dctr ?? 0) + 1;
  
  // SP: SET _Lea_Dpk = CONCAT(_Lea_Did,_Lev_Dctr);
  const lea_dpk_value = `${lea_dpk}${counter}`; // Summary ID + counter (e.g., "LEA-2026021100001321")
  
  // SP: INSERT INTO leave_detail (Lea_Did, Lea_Dpk, ...) VALUES (_Lea_Did, _Lea_Dpk, ...);
  // SP uses _Lea_Did (summary ID) for lea_did, but lea_did is PRIMARY KEY VARCHAR(20) and must be unique.
  // Since summary ID + counter can exceed 20 chars, use a short UUID (16 hex chars) for lea_did.
  // Keep lea_dpk as summary ID + counter for the parent relationship.
  const lea_did = randomUUID().replace(/-/g, "").substring(0, 16); // 16 chars fits VARCHAR(20)
  
  await prisma.leave_detail.create({
    data: {
      lea_did,
      lea_dpk: lea_dpk_value,
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
  // SP: UPDATE leave_summary SET ... Lea_Sstatus='0' WHERE Lea_Sid=_Lea_Sid;
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
      lea_sapprovedby: null, // Reset approved by when updating
      lea_sapproveddate: null, // Reset approved date when updating
    },
  });
  
  // Match stored procedure: update forapproval set fa_status='0',fa_appstat=0 where fa_taskid=_Lea_Sid;
  // Get employee ID first to recreate approval records if needed
  const leaveSummary = await prisma.leave_summary.findUnique({
    where: { lea_sid: leaveId },
    select: { lea_semp: true },
  });
  
  if (!leaveSummary?.lea_semp) {
    console.warn(`leaveUpdateSummary: Could not find leave summary for leaveId "${leaveId}"`);
    return;
  }
  
  // Delete existing approval records and recreate them to ensure a clean reset
  // This ensures the approval flow is completely reset when updating a leave request
  const deleteResult = await prisma.forapproval.deleteMany({
    where: { fa_taskid: leaveId },
  });
  
  console.log(
    `leaveUpdateSummary: Deleted ${deleteResult.count} existing approval records for leaveId "${leaveId}"`
  );
  
  // Verify deletion worked
  const remainingRecords = await prisma.forapproval.count({
    where: { fa_taskid: leaveId },
  });
  
  if (remainingRecords > 0) {
    console.warn(
      `leaveUpdateSummary: WARNING - ${remainingRecords} approval records still exist after delete for leaveId "${leaveId}"`
    );
    // Force delete any remaining records
    await prisma.forapproval.deleteMany({
      where: { fa_taskid: leaveId },
    });
  }
  
  // Recreate approval records with fresh status
  await addForApproval(leaveId, leaveSummary.lea_semp);
  
  // Verify records were created
  const createdRecords = await prisma.forapproval.count({
    where: { fa_taskid: leaveId },
  });
  
  console.log(
    `leaveUpdateSummary: Recreated ${createdRecords} approval records for leaveId "${leaveId}"`
  );
  
  if (createdRecords === 0) {
    console.error(
      `leaveUpdateSummary: ERROR - No approval records were created for leaveId "${leaveId}". Approval flow may not work correctly.`
    );
  }
}

// --- Overtime ---
/**
 * Exact conversion of ot_insert_otrequest stored procedure.
 * SP uses counter-based ID; we use UUID instead.
 */
export async function otInsertOtRequest(
  otm_emp: string,
  otm_type: number,
  otm_date: Date,
  otm_from: Date,
  otm_to: Date,
  otm_reason: string
) {
  // SP: counter = count(otm_emp) + 1; id = "OVT-" + yyyymmdd + emp + counter
  // We use UUID: keep "OVT-" prefix for compatibility
  const otm_id = `OVT-${randomUUID()}`;

  await prisma.overtime.create({
    data: {
      otm_id,
      otm_ctr: 1, // Keep counter field but use 1 since UUID is unique
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
/**
 * Exact conversion of undertime_insertsummary stored procedure.
 * SP uses counter-based ID; we use UUID instead.
 */
export async function undertimeInsertSummary(
  utm_emp: string,
  utm_date: Date,
  utm_from: Date,
  utm_to: Date,
  utm_reason: string
) {
  // SP uses counter-based ID; we use UUID: keep "UNT-" prefix for compatibility
  const utm_id = `UNT-${randomUUID()}`;
  await prisma.undertime.create({
    data: {
      utm_id,
      utm_ctr: 1, // Keep counter field but use 1 since UUID is unique
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
/**
 * Exact conversion of coa_summary_insert stored procedure.
 * SP uses counter-based ID; we use UUID instead.
 */
export async function coaSummaryInsert(
  CoaStype: string,
  CoaStypedetail: string,
  CoaSreason: string,
  CoaSemp: string
): Promise<string> {
  // SP: get last coa_sctr for today, else 0; counter = last + 1; id = "COA-" + yyyymmdd + emp + counter
  // We use UUID: keep "COA-" prefix for compatibility
  // coa_sid is VARCHAR(20), so "COA-" (4) + 16 chars = 20 total
  const coa_sid = `COA-${randomUUID().replace(/-/g, "").substring(0, 16)}`;
  await prisma.coa_summary.create({
    data: {
      coa_sid,
      coa_sctr: 1, // Keep counter field but use 1 since UUID is unique
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

/**
 * Exact conversion of coa_details_insert stored procedure.
 * SP: SET detailid = CONCAT(_coa_dpk,counter);
 * SP: INSERT INTO coa_detail (coa_did, coa_dpk, coa_dctr, ...) VALUES (detailid, _coa_dpk, counter, ...);
 * Since coa_did is VARCHAR(25) and UUIDs are too long, we use a short UUID (20 chars) instead.
 */
export async function coaDetailsInsert(
  coa_dpk: string,
  coa_dtype: string,
  coa_ddate: Date,
  coa_dtime: Date
) {
  // SP: get last coa_dctr for coa_dpk, counter = last + 1; detailid = coa_dpk + counter
  const last = await prisma.coa_detail.findFirst({
    where: { coa_dpk },
    orderBy: { coa_dctr: "desc" },
    select: { coa_dctr: true },
  });
  const counter = (last?.coa_dctr ?? 0) + 1;
  
  // SP: SET detailid = CONCAT(_coa_dpk,counter);
  // Use short UUID (20 chars) to fit VARCHAR(25) instead of summary ID + counter
  const coa_did = randomUUID().replace(/-/g, "").substring(0, 20); // 20 chars fits VARCHAR(25)
  
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
  // Get employee ID first to recreate approval records if needed
  const coaSummary = await prisma.coa_summary.findUnique({
    where: { coa_sid },
    select: { coa_semp: true },
  });
  
  if (!coaSummary?.coa_semp) {
    console.warn(`coaSummaryUpdate: Could not find COA summary for coa_sid "${coa_sid}"`);
    return;
  }

  await prisma.coa_summary.update({
    where: { coa_sid },
    data: {
      coa_stype: CoaStype,
      coa_stypedetail: CoaStypedetail,
      coa_sreason: CoaSreason,
      coa_sstatus: 0,
      coa_sapprovedby: null, // Reset approved by when updating
      coa_sapproveddate: null, // Reset approved date when updating
    },
  });
  
  // Delete existing approval records and recreate them to ensure a clean reset
  const deleteResult = await prisma.forapproval.deleteMany({
    where: { fa_taskid: coa_sid },
  });
  
  console.log(
    `coaSummaryUpdate: Deleted ${deleteResult.count} existing approval records for coa_sid "${coa_sid}"`
  );
  
  // Verify deletion worked
  const remainingRecords = await prisma.forapproval.count({
    where: { fa_taskid: coa_sid },
  });
  
  if (remainingRecords > 0) {
    console.warn(
      `coaSummaryUpdate: WARNING - ${remainingRecords} approval records still exist after delete for coa_sid "${coa_sid}"`
    );
    // Force delete any remaining records
    await prisma.forapproval.deleteMany({
      where: { fa_taskid: coa_sid },
    });
  }
  
  // Recreate approval records with fresh status
  await addForApproval(coa_sid, coaSummary.coa_semp);
  
  // Verify records were created
  const createdRecords = await prisma.forapproval.count({
    where: { fa_taskid: coa_sid },
  });
  
  console.log(
    `coaSummaryUpdate: Recreated ${createdRecords} approval records for coa_sid "${coa_sid}"`
  );
  
  if (createdRecords === 0) {
    console.error(
      `coaSummaryUpdate: ERROR - No approval records were created for coa_sid "${coa_sid}". Approval flow may not work correctly.`
    );
  }
}

// --- Loan ---
/**
 * Exact conversion of loan_insert_request stored procedure.
 * SP uses counter-based ID; we use UUID instead.
 */
export async function loanInsertRequest(
  LoaAmt: number,
  LoaReason: string,
  LoaType: string,
  LoaExprelease: Date | null,
  LoaEmp: string
) {
  // SP: get last loa_ctr for today, counter = last + 1; id = "LOA-" + yyyymmdd + emp + counter
  // We use UUID: keep "LOA-" prefix for compatibility
  const loa_id = `LOA-${randomUUID()}`;
  await prisma.loan.create({
    data: {
      loa_id,
      loa_ctr: 1, // Keep counter field but use 1 since UUID is unique
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
/**
 * Exact conversion of schedadjust_insertsummary stored procedure.
 * SP uses counter-based ID; we use UUID instead.
 */
export async function schedAdjustInsertSummary(
  ScaSdatefrom: Date,
  ScaSdateto: Date,
  ScaSreason: string,
  ScaSemp: string
): Promise<string> {
  // SP: get last sca_sctr for today, counter = last + 1; id = "SCA-" + yyyymmdd + emp + counter
  // We use UUID: keep "SCA-" prefix for compatibility
  const sca_sid = `SCA-${randomUUID()}`;
  await prisma.schedadjust_summary.create({
    data: {
      sca_sid,
      sca_sctr: 1, // Keep counter field but use 1 since UUID is unique
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

/**
 * Exact conversion of schedadjust_insertdetails stored procedure.
 * SP: SET _Sca_Dctr = ((select count(Sca_Dctr) from schedadjust_detail WHERE Sca_Dpk = _Sca_Dpk) + 1);
 * SP: SET _Sca_Did = CONCAT(_Sca_Dpk, _Sca_Dctr);
 * SP: INSERT INTO schedadjust_detail (Sca_Did, Sca_Dpk, Sca_Dctr, ...) VALUES (_Sca_Did, _Sca_Dpk, _Sca_Dctr, ...);
 * Since sca_did is VARCHAR(40) and UUIDs are too long, we use a short UUID (32 chars) instead.
 */
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
  // SP: SET _Sca_Dctr = ((select count(Sca_Dctr) from schedadjust_detail WHERE Sca_Dpk = _Sca_Dpk) + 1);
  const count = await prisma.schedadjust_detail.count({
    where: { sca_dpk: scaId },
  });
  const counter = count + 1;
  
  // SP: SET _Sca_Did = CONCAT(_Sca_Dpk, _Sca_Dctr);
  // Use short UUID (32 chars without dashes) to fit VARCHAR(40) instead of summary ID + counter
  const sca_did = randomUUID().replace(/-/g, "").substring(0, 32); // 32 chars fits VARCHAR(40)
  
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

// --- Display grids (return list for OVT, LEA, UNT, COA) ---
// Matches stored procedure display_grid - returns grid data with joins
export async function displayGrid(
  menu: "OVT" | "LEA" | "UNT" | "COA",
  employee: string
): Promise<unknown[]> {
  switch (menu) {
    case "OVT":
      return prisma.overtime.findMany({
        where: { otm_emp: employee },
        orderBy: { otm_applieddate: "desc" },
      });
    case "COA":
      // Match stored procedure: join with coa_summary, employee, and fapreason
      const coas = await prisma.coa_summary.findMany({
        where: { coa_semp: employee },
        orderBy: [
          { coa_sapproveddate: "desc" },
          { coa_sapplieddate: "desc" },
        ],
      });

      // Get approver names
      const coaApproverIds = coas
        .map((c) => c.coa_sapprovedby)
        .filter(Boolean) as string[];
      const coaApprovers =
        coaApproverIds.length > 0
          ? await prisma.employee.findMany({
              where: { emp_id: { in: coaApproverIds } },
              select: {
                emp_id: true,
                emp_first: true,
                emp_last: true,
              },
            })
          : [];

      // Get latest fapreason for each COA
      const coaTaskIds = coas.map((c) => c.coa_sid).filter(Boolean) as string[];
      const coaFapreasons =
        coaTaskIds.length > 0
          ? await prisma.fapreason.findMany({
              where: {
                fap_taskid: { in: coaTaskIds },
              },
              orderBy: { fap_datetime: "desc" },
            })
          : [];

      // Group fapreasons by taskid and get the latest one
      const latestCoaFapreasons = new Map<string, string>();
      for (const fap of coaFapreasons) {
        if (fap.fap_taskid && !latestCoaFapreasons.has(fap.fap_taskid)) {
          latestCoaFapreasons.set(fap.fap_taskid, fap.fap_reason || "");
        }
      }

      // Build result matching stored procedure output
      return coas.map((coa) => {
        const approver = coaApprovers.find((a) => a.emp_id === coa.coa_sapprovedby);
        const fapReason = latestCoaFapreasons.get(coa.coa_sid || "") || null;

        return {
          coa_sid: coa.coa_sid,
          coa_stype: coa.coa_stype,
          coa_stypedetail: coa.coa_stypedetail || (coa.coa_stypedetail === "" ? "Others" : null),
          coa_sreason: coa.coa_sreason,
          FapReason: fapReason,
          coa_semp: coa.coa_semp,
          coa_sapplieddate: coa.coa_sapplieddate,
          coa_sstatus: coa.coa_sstatus,
          coa_sapproveddate: coa.coa_sapproveddate,
          coa_sapprovedby: approver
            ? `${approver.emp_last}, ${approver.emp_first}`
            : null,
        };
      });
    case "LEA":
      // Match stored procedure: join with leave, employee, and fapreason
      const leaves = await prisma.leave_summary.findMany({
        where: { lea_semp: employee },
        orderBy: [
          { lea_sapproveddate: "desc" },
          { lea_sapplieddate: "desc" },
        ],
      });

      // Get leave type descriptions
      const leaveIds = leaves.map((l) => l.lea_stype).filter(Boolean) as string[];
      const leaveTypes =
        leaveIds.length > 0
          ? await prisma.leave.findMany({
              where: { lev_id: { in: leaveIds } },
              select: { lev_id: true, lev_desc: true },
            })
          : [];

      // Get approver names
      const approverIds = leaves
        .map((l) => l.lea_sapprovedby)
        .filter(Boolean) as string[];
      const approvers =
        approverIds.length > 0
          ? await prisma.employee.findMany({
              where: { emp_id: { in: approverIds } },
              select: {
                emp_id: true,
                emp_first: true,
                emp_last: true,
              },
            })
          : [];

      // Get latest fapreason for each leave
      const leaveTaskIds = leaves.map((l) => l.lea_sid).filter(Boolean) as string[];
      const fapreasons =
        leaveTaskIds.length > 0
          ? await prisma.fapreason.findMany({
              where: {
                fap_taskid: { in: leaveTaskIds },
              },
              orderBy: { fap_datetime: "desc" },
            })
          : [];

      // Group fapreasons by taskid and get the latest one
      const latestFapreasons = new Map<string, string>();
      for (const fap of fapreasons) {
        if (fap.fap_taskid && !latestFapreasons.has(fap.fap_taskid)) {
          latestFapreasons.set(fap.fap_taskid, fap.fap_reason || "");
        }
      }

      // Build result matching stored procedure output
      return leaves.map((leave) => {
        const leaveType = leaveTypes.find((lt) => lt.lev_id === leave.lea_stype);
        const approver = approvers.find((a) => a.emp_id === leave.lea_sapprovedby);
        const fapReason = latestFapreasons.get(leave.lea_sid || "") || null;

        return {
          LeaSid: leave.lea_sid,
          LeaStype: leave.lea_stype,
          LeaSfrom: leave.lea_sfrom,
          LeaSto: leave.lea_sto,
          LeaSreason: leave.lea_sreason,
          FapReason: fapReason,
          LeaSwithpay: leave.lea_swithpay,
          LeaSwithoutpay: leave.lea_swithoutpay,
          LeaSapplieddate: leave.lea_sapplieddate,
          LeaSstatus: leave.lea_sstatus,
          LeaSapproveddate: leave.lea_sapproveddate,
          LeaSapprovedby: approver
            ? `${approver.emp_last}, ${approver.emp_first}`
            : null,
          LevDesc: leaveType?.lev_desc || null,
        };
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
