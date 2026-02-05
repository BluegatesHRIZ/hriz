import { prisma } from "@/lib/db/prisma";
import { encryptPassword } from "@/lib/auth/password";

/**
 * Employee creation, advances/loans, work, approval levels, benefits, leaves (Prisma-based).
 * Replaces stored procedure logic (reference: sql/stored_proc.sql).
 */

/**
 * Create a new employee account (employee + optional personal records).
 * Mirrors core behavior of the C# ManageEmployeeController.CreateEmployee / employee_create_account.
 */
export async function createEmployeeAccount(
  account: {
    EmpFirst: string;
    EmpMid?: string | null;
    EmpLast: string;
    EmpDept?: string | null;
    EmpPos?: string | null;
    EmpLoc?: string | null;
    EmpRole?: string | null;
    EmpExternalId?: string | null;
    EmpPswd?: string | null;
  },
  personal: {
    EmpAddress?: string | null;
    EmpBirthday?: Date | null;
    EmpMother?: string | null;
    EmpFather?: string | null;
    EmpGender?: string | null;
    EmpCivil?: string | null;
    EmpSpouse?: string | null;
    EmpContact1?: string | null;
    EmpContact2?: string | null;
    EmpEmail?: string | null;
    EmpAccount?: string | null;
  } | null,
  createdByEmpId: string
) {
  // Mirrors stored procedure `employee_create_account`
  // Next emp_id (max+1, padded), excluding 'admin'
  const lastEmployee = await prisma.employee.findFirst({
    where: { emp_id: { not: "admin" } },
    orderBy: { emp_id: "desc" },
    select: { emp_id: true },
  });
  const newEmpId = lastEmployee
    ? String(Number(lastEmployee.emp_id) + 1).padStart(6, "0")
    : "000001";

  // Password: use provided, else lowercase last name, else "password"
  const rawPassword =
    (account.EmpPswd && account.EmpPswd.trim()) ||
    (account.EmpLast && account.EmpLast.toLowerCase()) ||
    "password";
  const passwordHash = encryptPassword(rawPassword);
  // Ensure Bytes column receives a Uint8Array; convert Buffer if needed
  const passwordBytes =
    passwordHash instanceof Uint8Array
      ? (passwordHash as unknown as Uint8Array<ArrayBuffer>)
      : (new Uint8Array(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (passwordHash as any).buffer ?? (passwordHash as any)
        ) as unknown as Uint8Array<ArrayBuffer>);

  await prisma.employee.create({
    data: {
      emp_id: newEmpId,
      emp_first: account.EmpFirst,
      emp_mid: account.EmpMid ?? null,
      emp_last: account.EmpLast,
      emp_dept: account.EmpDept ?? null,
      emp_pos: account.EmpPos ?? null,
      emp_loc: account.EmpLoc ?? null,
      emp_role: account.EmpRole ?? "EMPLOYEE",
      emp_pswd: passwordBytes,
      emp_createdby: createdByEmpId,
      emp_extid: account.EmpExternalId ?? null,
    },
  });

  if (personal) {
    await prisma.emppersonal.create({
      data: {
        emp_id: newEmpId,
        emp_address: personal.EmpAddress ?? null,
        emp_birthday: personal.EmpBirthday ?? null,
        emp_mother: personal.EmpMother ?? null,
        emp_father: personal.EmpFather ?? null,
        emp_gender: personal.EmpGender ?? null,
        emp_civil: personal.EmpCivil ?? null,
        emp_spouse: personal.EmpSpouse ?? null,
        emp_contact1: personal.EmpContact1 ?? null,
        emp_contact2: personal.EmpContact2 ?? null,
        emp_email: personal.EmpEmail ?? null,
        emp_account: personal.EmpAccount ?? null,
      },
    });
  }

  return { emp_id: newEmpId, emp_first: account.EmpFirst, emp_last: account.EmpLast };
}

/**
 * Update employee account information.
 * Mirrors stored procedure `employee_update_account`.
 */
export async function updateEmployeeAccount(
  empId: string,
  account: {
    EmpFirst: string;
    EmpMid?: string | null;
    EmpLast: string;
    EmpDept?: string | null;
    EmpPos?: string | null;
    EmpLoc?: string | null;
    EmpRole?: string | null;
    EmpExternalId?: string | null;
  }
) {
  await prisma.employee.update({
    where: { emp_id: empId },
    data: {
      emp_first: account.EmpFirst,
      emp_mid: account.EmpMid ?? null,
      emp_last: account.EmpLast,
      emp_dept: account.EmpDept ?? null,
      emp_pos: account.EmpPos ?? null,
      emp_loc: account.EmpLoc ?? null,
      emp_role: account.EmpRole ?? null,
      emp_extid: account.EmpExternalId ?? null,
    },
  });
}

/**
 * Update or insert employee personal information.
 * Mirrors stored procedures `employee_insert_personalinfo` and `employee_update_personalinfo`.
 */
export async function upsertEmployeePersonal(
  empId: string,
  personal: {
    EmpAddress?: string | null;
    EmpBirthday?: Date | null;
    EmpMother?: string | null;
    EmpFather?: string | null;
    EmpGender?: string | null;
    EmpCivil?: string | null;
    EmpSpouse?: string | null;
    EmpContact1?: string | null;
    EmpContact2?: string | null;
    EmpEmail?: string | null;
    EmpAccount?: string | null;
  }
) {
  const existing = await prisma.emppersonal.findUnique({
    where: { emp_id: empId },
  });

  const data = {
    emp_address: personal.EmpAddress ?? null,
    emp_birthday: personal.EmpBirthday ?? null,
    emp_mother: personal.EmpMother ?? null,
    emp_father: personal.EmpFather ?? null,
    emp_gender: personal.EmpGender ?? null,
    emp_civil: personal.EmpCivil ?? null,
    emp_spouse: personal.EmpSpouse ?? null,
    emp_contact1: personal.EmpContact1 ?? null,
    emp_contact2: personal.EmpContact2 ?? null,
    emp_email: personal.EmpEmail ?? null,
    emp_account: personal.EmpAccount ?? null,
  };

  if (existing) {
    await prisma.emppersonal.update({
      where: { emp_id: empId },
      data,
    });
  } else {
    await prisma.emppersonal.create({
      data: {
        emp_id: empId,
        ...data,
      },
    });
  }
}

export async function deleteEmployeeAdvances(empId: string) {
  await prisma.empadvance.deleteMany({
    where: { emp_id: empId },
  });
}

export async function insertEmployeeAdvance(
  empId: string,
  AdvType: string,
  AdvDate: Date,
  AdvAmount: number,
  AddedAmount: number,
  PayPerMonth: number,
  StartDate: Date,
  AmountPerPay: number,
  PayCutoff: number | null
) {
  const count = await prisma.empadvance.count({ where: { emp_id: empId } });
  // emp_adid is VarChar(20): use short format to fit (e.g. 000002-1)
  const emp_adid = `${empId}-${count + 1}`;
  const endDate = PayPerMonth > 0 ? new Date(StartDate) : null;
  if (endDate && PayPerMonth > 0) {
    endDate.setMonth(endDate.getMonth() + PayPerMonth);
  }
  await prisma.empadvance.create({
    data: {
      emp_id: empId,
      emp_adid,
      emp_adtype: AdvType,
      emp_addate: AdvDate,
      emp_adamt: AdvAmount,
      emp_adaddedamt: AddedAmount,
      emp_adpaypermonth: PayPerMonth,
      emp_adpaycutoff: PayCutoff ?? null,
      emp_adstart: StartDate,
      emp_adend: endDate ?? undefined,
      emp_adamtperpay: AmountPerPay,
    },
  });
}

export async function insertEmployeeWork(
  empId: string,
  emp_code: string | null,
  emp_type: number,
  emp_datehired: Date | null,
  emp_dateexp: Date | null,
  emp_datereg: Date | null,
  emp_remarks: string | null,
  emp_supervisor: string,
  emp_sss: string | null,
  emp_philhealth: string | null,
  emp_pagibig: string | null,
  emp_tin: string | null,
  emp_taxstat: string | null,
  emp_rdo: string | null,
  emp_passport: string | null,
  emp_prc: string | null
) {
  const existing = await prisma.empwork.findUnique({ where: { emp_id: empId } });
  if (!existing) {
    await prisma.empwork.create({
      data: {
        emp_id: empId,
        emp_code,
        emp_type,
        emp_datehired,
        emp_dateexp,
        emp_datereg,
        emp_remarks,
        emp_supervisor,
        emp_sss,
        emp_philhealth,
        emp_pagibig,
        emp_tin,
        emp_taxstat,
        emp_rdo,
        emp_passport,
        emp_prc,
      },
    });
  } else {
    await prisma.empwork.update({
      where: { emp_id: empId },
      data: {
        emp_code,
        emp_type,
        emp_datehired,
        emp_dateexp,
        emp_datereg,
        emp_remarks,
        emp_supervisor,
        emp_sss,
        emp_philhealth,
        emp_pagibig,
        emp_tin,
        emp_taxstat,
        emp_rdo,
        emp_passport,
        emp_prc,
      },
    });
  }
}

export async function deleteEmployeeApprovalLevels(empId: string) {
  await prisma.approvallevels.deleteMany({
    where: { al_emp: empId },
  });
}

export async function addApprovalLevel(
  empId: string,
  AlApprv: string,
  AlLevel: number
) {
  const al_id = `${empId}-${AlApprv}-${AlLevel}-${Date.now()}`;
  await prisma.approvallevels.create({
    data: {
      al_id,
      al_appvr: AlApprv,
      al_emp: empId,
      al_menu: null,
      al_level: AlLevel,
      al_stat: 1,
    },
  });
}

export async function deleteEmployeeBenefits(empId: string) {
  await prisma.empbenefit.deleteMany({
    where: { emb_id: empId },
  });
}

export async function deleteEmployeeLeaves(empId: string) {
  await prisma.empleave.deleteMany({
    where: { eml_emp: empId },
  });
}

export async function assignEmployeeLeave(
  empId: string,
  EmlLeave: string,
  EmlLeacredit: number
) {
  const eml_id = `${empId}${EmlLeave}`;
  await prisma.empleave.upsert({
    where: { eml_id },
    create: {
      eml_id,
      eml_emp: empId,
      eml_leave: EmlLeave,
      eml_leacredit: EmlLeacredit,
      eml_used: 0,
    },
    update: {
      eml_leacredit: EmlLeacredit,
    },
  });
}

export async function insertEmployeeBenefit(
  empId: string,
  EmbBcode: string,
  EmbDesc: string | null,
  EmbAmt: number
) {
  const count = await prisma.empbenefit.count({ where: { emb_id: empId } });
  const emb_code = `${empId}-${EmbBcode}-${count + 1}`;
  await prisma.empbenefit.create({
    data: {
      emb_code,
      emb_id: empId,
      emb_bcode: EmbBcode,
      emb_ctr: count + 1,
      emb_desc: EmbDesc,
      emb_amt: EmbAmt,
    },
  });
}

export interface SalaryEntry {
  SalPosition: string;
  SalPayrollType: string;
  SalDateFrom: Date | null;
  SalDateTo: Date | null;
  SalAmount: number;
  SalRemarks: string;
  SalStatus: number;
}

/**
 * Replace all salary history for an employee with the given entries.
 */
export async function saveEmployeeSalary(
  empId: string,
  salaries: SalaryEntry[]
) {
  await prisma.empsalary.deleteMany({
    where: { emp_id: empId },
  });

  for (let i = 0; i < salaries.length; i++) {
    const sal = salaries[i];
    const emp_salid = `${empId}-SAL-${i + 1}`;
    const dateFrom = sal.SalDateFrom ? new Date(sal.SalDateFrom) : null;
    const dateTo = sal.SalDateTo ? new Date(sal.SalDateTo) : null;
    await prisma.empsalary.create({
      data: {
        emp_id: empId,
        emp_salid,
        emp_salposition: sal.SalPosition || null,
        emp_salpayrolltype: sal.SalPayrollType || null,
        emp_saldatefrom: dateFrom,
        emp_saldateto: dateTo,
        emp_salamt: sal.SalAmount ?? 0,
        emp_salnote: sal.SalRemarks || null,
        emp_salstatus: sal.SalStatus ?? 0,
      },
    });
  }
}
