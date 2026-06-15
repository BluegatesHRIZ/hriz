import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiLoan");
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
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
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
