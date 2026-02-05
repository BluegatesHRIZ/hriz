import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";

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
      new Date(EmpAddate),
      EmpAdamt,
      EmpAdaddedamt || 0,
      EmpAdpaypermonth || 0,
      EmpAdpaycutoff || null,
      new Date(EmpAdstart),
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
