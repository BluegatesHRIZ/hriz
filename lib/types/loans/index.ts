/**
 * Loan and advance types (the `empadvance` table and the Manage Loans flow).
 */

/** One `empadvance` row as returned inside the employee detail response. */
export interface EmployeeAdvance {
  /** Numeric form of `emp_adid`, kept for older consumers. */
  AdvId: number;
  /** `emp_adid` as stored. Use this to address the row. */
  AdvCode: string;
  /** `emp_adtype`, e.g. "Company Loan". */
  AdvType: string | null;
  /** `emp_adamt` - the principal. */
  AdvAmount: number | null;
  /** `emp_addate` (date issued). */
  AdvDate: Date | null;
  AdvRemarks: string | null;
  /** `emp_addate` as YYYY-MM-DD. */
  AdvDateIssued: string | null;
  /** `emp_adstart` as YYYY-MM-DD. */
  AdvDateStart: string | null;
  /** `emp_adaddedamt` - interest or fees on top of the principal. */
  AdvAddedAmount: number;
  /** `emp_adamtperpay` - the installment. */
  AdvAmountPerPay: number;
  /** `emp_adpaypermonth` - 1 (once) or 2 (twice) a month. */
  AdvPayPerMonth: number | null;
  /** `emp_adpaycutoff` - which cutoff when paid once a month. */
  AdvPayCutoff: number | null;
  /** `emp_adpaid` - amount already collected through payroll. */
  AdvPaid: number;
  /** `emp_adstatus` - 1 is active. */
  AdvStatus: number | null;
}

/** Body of POST /api/employee/{id}/advances (employee_insert_advances). */
export interface CreateAdvanceRequest {
  AdvType: string;
  /** Date issued, YYYY-MM-DD. */
  AdvDate: string;
  AdvAmount: number;
  AddedAmount: number;
  /** 1 (once) or 2 (twice) a month. */
  PayPerMonth: number;
  /** 1 or 2; ignored when PayPerMonth is 2. */
  PayCutoff: number | null;
  /** Date start, YYYY-MM-DD. */
  StartDate: string;
  AmountPerPay: number;
}

export interface CreateAdvanceResponse {
  message: string;
  AdvCode: string;
}

export interface DeleteAdvanceResponse {
  message: string;
}

/** The terms a loan is repaid on, as edited in the loan terms form. */
export interface LoanTerms {
  loanType: string;
  loanAmount: number;
  addedAmount: number;
  installmentAmount: number;
  /** YYYY-MM-DD */
  dateIssued: string;
  /** YYYY-MM-DD */
  dateStart: string;
  /** "1" once a month, "2" twice a month. */
  payPerMonth: "1" | "2";
  /** "" none, "1" first cutoff, "2" second cutoff. Only used when payPerMonth is "1". */
  payCutoff: "" | "1" | "2";
}
