import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { storageService } from "@/lib/storage";
import { formatTimeForInput } from "@/lib/utils/time";

/**
 * GET /api/employee/{id}
 * Get employee details by ID
 * Ported from ManageEmployeeController.GetEmployeeById
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // In Next.js 15+, params is a Promise - await it
    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 },
      );
    }

    // Fetch employee with all related data
    // Note: Since Prisma schema doesn't have explicit relations, we'll fetch related data separately
    const employee = await prisma.employee.findFirst({
      where: {
        emp_id: empId,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found" },
        { status: 404 },
      );
    }

    // Fetch related data separately (using correct field names from schema)
    // Note: emppersonal and empwork use emp_id as @id, so findUnique works
    // empbenefit uses emb_id to link to employee
    const [
      emppersonal,
      empwork,
      empdependent,
      emphistory,
      empmed,
      empleave,
      empsalary,
      empadvance,
      empschedule,
      files,
      approvallevels,
      empbenefits,
    ] = await Promise.all([
      prisma.emppersonal
        .findUnique({ where: { emp_id: empId } })
        .catch(() => null),
      prisma.empwork.findUnique({ where: { emp_id: empId } }).catch(() => null),
      prisma.empdependent.findMany({
        where: { emp_id: empId },
        orderBy: { emp_depid: "asc" },
      }),
      prisma.emphist.findMany({
        where: { emp_id: empId },
        orderBy: { emp_htid: "asc" },
      }),
      prisma.empmed.findMany({
        where: { emp_id: empId },
        orderBy: { emp_medid: "asc" },
      }),
      prisma.empleave.findMany({
        where: { eml_emp: empId },
        orderBy: { eml_id: "asc" },
      }),
      prisma.empsalary.findMany({
        where: { emp_id: empId },
        orderBy: { emp_salid: "desc" },
      }),
      prisma.empadvance.findMany({
        where: { emp_id: empId },
        orderBy: { emp_adid: "desc" },
      }),
      prisma.schedule.findMany({
        where: { sch_emp: empId },
        orderBy: { sch_id: "asc" },
      }),
      prisma.files.findMany({
        where: { fil_fk: empId, fil_type: "profile" },
        orderBy: { fil_datetime: "desc" },
      }),
      prisma.approvallevels.findMany({
        where: { 
          al_emp: empId,
          al_menu: "M1", // Filter by M1 menu to get unique approvers (matches get_applvl SP)
        },
        orderBy: { al_level: "asc" },
      }),
      prisma.empbenefit.findMany({
        where: { emb_id: empId },
        orderBy: { emb_logdate: "desc" },
      }),
    ]);

    // Fetch leave types for empleave mapping
    const leaveTypes = await prisma.leave.findMany({
      where: {
        lev_status: 1, // Only active leave types
      },
    });
    const leaveTypeMap = new Map(
      leaveTypes.map((lt) => [lt.lev_id, lt.lev_desc || ""] as const),
    );

    // Transform to match EmpManagementDTO structure
    const result = {
      Account: {
        EmpId: employee.emp_id,
        EmpLast: employee.emp_last,
        EmpFirst: employee.emp_first,
        EmpMid: employee.emp_mid,
        EmpDept: employee.emp_dept,
        EmpPos: employee.emp_pos,
        EmpLoc: employee.emp_loc,
        EmpRole: employee.emp_role,
        EmpExternalId: employee.emp_extid,
        EmpDatecreated: employee.emp_datecreated,
      },
      Personal: emppersonal
        ? {
            EmpAddress: emppersonal.emp_address,
            EmpBirthday: emppersonal.emp_birthday,
            EmpMother: emppersonal.emp_mother,
            EmpFather: emppersonal.emp_father,
            EmpGender: emppersonal.emp_gender,
            EmpCivil: emppersonal.emp_civil,
            EmpSpouse: emppersonal.emp_spouse,
            EmpAccount: emppersonal.emp_account,
            EmpContact1: emppersonal.emp_contact1,
            EmpContact2: emppersonal.emp_contact2,
            EmpEmail: emppersonal.emp_email,
          }
        : null,
      EmpWrk: empwork
        ? {
            emp_code: empwork.emp_code,
            emp_type: empwork.emp_type,
            emp_datehired: empwork.emp_datehired,
            emp_dateexp: empwork.emp_dateexp,
            emp_datereg: empwork.emp_datereg,
            emp_supervisor: empwork.emp_supervisor,
            emp_remarks: empwork.emp_remarks,
            emp_sss: empwork.emp_sss,
            emp_philhealth: empwork.emp_philhealth,
            emp_pagibig: empwork.emp_pagibig,
            emp_tin: empwork.emp_tin,
            emp_taxstat: empwork.emp_taxstat,
            emp_rdo: empwork.emp_rdo,
            emp_passport: empwork.emp_passport,
            emp_prc: empwork.emp_prc,
            // Legacy fields for backward compatibility
            emp_hiredate: empwork.emp_datehired,
            emp_enddate: empwork.emp_dateexp,
            emp_regular: empwork.emp_type === 1 ? 1 : 0,
            emp_contract: empwork.emp_type === 2 ? 1 : 0,
            emp_probationary: empwork.emp_type === 3 ? 1 : 0,
            emp_status: empwork.emp_type,
          }
        : null,
      EmpDependent: empdependent.map((dep) => ({
        DepId: parseInt(dep.emp_depid) || 0,
        DepName: dep.emp_depname,
        DepRelation: dep.emp_deprelation,
        DepBirthday: dep.emp_depbdate,
        DepContact: null,
      })),
      EmpHistory: emphistory.map((his) => ({
        HisId: parseInt(his.emp_htid) || 0,
        HisCompany: his.emp_htcomp,
        HisPosition: his.emp_htpos,
        HisStartdate: his.emp_htdfrom,
        HisEnddate: his.emp_htdto,
        HisRemarks: null,
      })),
      EmpBenefit: empbenefits.map((ben) => ({
        BenId: 0, // emb_code is the primary key, but we'll use index for form management
        BenType: ben.emb_bcode,
        BenNumber: ben.emb_code,
        BenDate: ben.emb_logdate,
        BenRemarks: ben.emb_desc,
        // Additional fields for form
        EmbBcode: ben.emb_bcode,
        EmbDesc: ben.emb_desc,
        EmbAmt: ben.emb_amt || 0,
      })),
      EmpMed: empmed.map((med) => ({
        MedId: parseInt(med.emp_medid) || 0,
        MedType: med.emp_medtype,
        MedDate: med.emp_meddate,
        MedRemarks: med.emp_medrem,
        MedFile: null, // Would need to join with empmedrec table
      })),
      EmpLeave: empleave.map((lv) => ({
        LevId: parseInt(lv.eml_id) || 0,
        LevType: lv.eml_leave,
        LevCredits: lv.eml_leacredit || 0,
        LevUsed: lv.eml_used || 0,
        LevRemaining: (lv.eml_leacredit || 0) - (lv.eml_used || 0),
        LevTypeDesc: leaveTypeMap.get(lv.eml_leave || "") || "",
      })),
      EmpSalary: empsalary.map((sal) => ({
        SalId: parseInt(sal.emp_salid.replace(/[^0-9]/g, "")) || 0, // Extract numeric part for ID
        SalAmount: sal.emp_salamt || null,
        SalDate: sal.emp_saldatefrom,
        SalPosition: sal.emp_salposition,
        SalPayrollType: sal.emp_salpayrolltype || "S",
        SalDateFrom: sal.emp_saldatefrom,
        SalDateTo: sal.emp_saldateto,
        SalRemarks: sal.emp_salnote,
        SalStatus: sal.emp_salstatus ?? 1,
      })),
      EmpAdvance: empadvance.map((adv) => ({
        AdvId: parseInt(adv.emp_adid) || 0,
        AdvType: adv.emp_adtype,
        AdvAmount: adv.emp_adamt || 0,
        AdvDate: adv.emp_addate,
        AdvRemarks: null,
      })),
      Schedule: empschedule.map((sched) => ({
        SchedId: parseInt(sched.sch_id) || 0,
        SchedDay: sched.sch_day,
        SchedTimein: formatTimeForInput(sched.sch_in),
        SchedTimeout: formatTimeForInput(sched.sch_out),
        SchedBreakin: formatTimeForInput(sched.sch_bin),
        SchedBreakout: formatTimeForInput(sched.sch_bout),
        SchedShift: sched.sch_shift || null,
        SchedRemarks: null,
      })),
      Approval: approvallevels.map((al) => ({
        AlId: parseInt(al.al_id) || 0,
        AlLevel: al.al_level || 1,
        AlModule: al.al_menu,
        AlApprv: al.al_appvr,
        AlStatus: al.al_stat,
        AlRemarks: null,
      })),
      files: {
        profile: files[0]
          ? {
              fil_id: files[0].fil_id.toString(),
              fil_path: files[0].fil_path,
              fil_name: files[0].fil_name,
              // Convert relative path (./201/employee/filename.jpg) to storage path for URL generation
              // The DB stores: ./201/{path}/{filename}, but storage uses: {path}/{filename}
              fil_url: await storageService
                .getFileUrl(files[0].fil_path.replace(/^\.\/201\//, ""))
                .catch(() => null),
            }
          : null,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get employee error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/employee/{id}
 * Update employee account and personal information
 * Ported from ManageEmployeeController.UpdateEmployee
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // In Next.js 15+, params is a Promise - await it
    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 },
      );
    }

    // Check if employee exists
    const employeeExists = await prisma.employee.findUnique({
      where: { emp_id: empId },
    });

    if (!employeeExists) {
      return NextResponse.json(
        { message: "Employee not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const { Account, Personal } = body as {
      Account?: {
        EmpFirst?: string;
        EmpMid?: string | null;
        EmpLast?: string;
        EmpDept?: string | null;
        EmpPos?: string | null;
        EmpLoc?: string | null;
        EmpRole?: string | null;
        EmpExternalId?: string | null;
      };
      Personal?: {
        EmpAddress?: string | null;
        EmpBirthday?: string | Date | null;
        EmpMother?: string | null;
        EmpFather?: string | null;
        EmpGender?: string | null;
        EmpCivil?: string | null;
        EmpSpouse?: string | null;
        EmpContact1?: string | null;
        EmpContact2?: string | null;
        EmpEmail?: string | null;
        EmpAccount?: string | null;
      } | null;
    };

    if (!Account || !Account.EmpFirst || !Account.EmpLast) {
      return NextResponse.json(
        { message: "Account.EmpFirst and Account.EmpLast are required" },
        { status: 400 },
      );
    }

    const { updateEmployeeAccount, upsertEmployeePersonal } =
      await import("@/lib/services/employee.service");

    // Build a fully-typed account object (EmpFirst/EmpLast required)
    const accountForUpdate = {
      EmpFirst: Account.EmpFirst,
      EmpMid: Account.EmpMid ?? null,
      EmpLast: Account.EmpLast,
      EmpDept: Account.EmpDept ?? null,
      EmpPos: Account.EmpPos ?? null,
      EmpLoc: Account.EmpLoc ?? null,
      EmpRole: Account.EmpRole ?? null,
      EmpExternalId: Account.EmpExternalId ?? null,
    };

    // Update account information
    await updateEmployeeAccount(empId, accountForUpdate);

    // Update or insert personal information
    if (Personal != null) {
      const personalNormalized = {
        EmpAddress: Personal.EmpAddress ?? null,
        EmpBirthday: Personal.EmpBirthday
          ? new Date(Personal.EmpBirthday)
          : null,
        EmpMother: Personal.EmpMother ?? null,
        EmpFather: Personal.EmpFather ?? null,
        EmpGender: Personal.EmpGender ?? null,
        EmpCivil: Personal.EmpCivil ?? null,
        EmpSpouse: Personal.EmpSpouse ?? null,
        EmpContact1: Personal.EmpContact1 ?? null,
        EmpContact2: Personal.EmpContact2 ?? null,
        EmpEmail: Personal.EmpEmail ?? null,
        EmpAccount: Personal.EmpAccount ?? null,
      };
      await upsertEmployeePersonal(empId, personalNormalized);
    }

    return NextResponse.json({
      message: "Employee updated successfully",
      emp_id: empId,
    });
  } catch (error) {
    console.error("Update employee error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
