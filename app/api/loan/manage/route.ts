import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(request: NextRequest) {
  try {
    // Lists every employee's loans, so only Manage Loans users may read it.
    const auth = await authorizeApiRequest(request, "adminManageLoans");
    if (!auth.ok) return auth.response;

    const rows = await requestProcedures.loanManagementList();
    const result = rows.map((l) => ({
      LoaId: (l as any).loa_id,
      LoaEmp: (l as any).loa_emp,
      LoaAmt: (l as any).loa_amt,
      LoaReason: (l as any).loa_reason,
      LoaType: (l as any).loa_type,
      LoaStatus: (l as any).loa_status,
      LoaExprelease: (l as any).loa_exprelease,
      LoaApplieddate: (l as any).loa_applieddate,
      EmpName: (l as any).emp_name,
      EmpAdaddedamt: (l as any).emp_adaddedamt,
      EmpAdamtperpay: (l as any).emp_adamtperpay,
      EmpAdpaypermonth: (l as any).emp_adpaypermonth,
      EmpAdpaycutoff: (l as any).emp_adpaycutoff,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Get loan management list error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Read the action first so the right permission can be checked:
    // Release needs Loan Release; Approve, Reject and Resubmit need Loan Approve.
    const body = await request.clone().json();
    const routeKey = body?.Status === "release" ? "apiLoanRelease" : "apiLoanApprove";
    const auth = await authorizeApiRequest(request, routeKey);
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const {
      LoaId,
      Status,
      Reason,
      LoaEmp,
      EmpAdtype,
      EmpAddate,
      EmpAdamt,
      EmpAdaddedamt,
      EmpAdpaypermonth,
      EmpAdpaycutoff,
      EmpAdstart,
      EmpAdamtperpay,
    } = body;

    const approver = payload.name; // EmpId from JWT payload

    if (Status === "release") {
      const problem =
        !EmpAdtype ? "Loan type is required"
        : !(Number(EmpAdamt) > 0) ? "Loan amount must be greater than zero"
        : !(Number(EmpAdamtperpay) > 0) ? "Installment amount must be greater than zero"
        : EmpAdpaypermonth !== 1 && EmpAdpaypermonth !== 2 ? "Monthly installment must be once or twice"
        : !EmpAddate || !EmpAdstart ? "Date issued and date start are required"
        : null;
      if (problem) {
        return NextResponse.json({ message: problem }, { status: 400 });
      }
    }

    // Manage loan request
    await requestProcedures.loanManageRequest(
      LoaId,
      Status,
      Reason || null,
      LoaEmp,
      EmpAdtype || "",
      EmpAddate ? new Date(EmpAddate) : new Date(),
      EmpAdamt,
      EmpAdaddedamt || 0,
      EmpAdpaypermonth || 0,
      EmpAdpaycutoff || null,
      EmpAdstart ? new Date(EmpAdstart) : new Date(),
      EmpAdamtperpay || 0,
      approver
    );

    return NextResponse.json({ message: "Loan request managed" });
  } catch (error) {
    console.error("Manage loan error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
