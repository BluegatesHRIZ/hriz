import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiLoan");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const resolvedParams = await params;
    const loanId = resolvedParams.id;
    const user = payload.name; // EmpId from JWT payload

    const loan = await prisma.loan.findFirst({
      where: {
        loa_id: loanId,
        loa_emp: user,
      },
    });

    if (!loan) {
      return NextResponse.json({ message: "Loan not found" }, { status: 404 });
    }

    return NextResponse.json({
      LoaId: loan.loa_id,
      LoaEmp: loan.loa_emp,
      LoaAmt: loan.loa_amt,
      LoaReason: loan.loa_reason,
      LoaType: loan.loa_type,
      LoaExprelease: loan.loa_exprelease,
      LoaStatus: loan.loa_status,
      LoaApplieddate: loan.loa_applieddate,
      LoaApprovedby: loan.loa_approvedby,
      LoaApproveddate: loan.loa_approveddate,
    });
  } catch (error) {
    console.error("Get loan by ID error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeApiRequest(request, "apiLoan");
    if (!auth.ok) return auth.response;
    const payload = auth.payload;

    const resolvedParams = await params;
    const loanId = resolvedParams.id;
    const body = await request.json();

    const { LoaAmt, LoaReason, LoaType, LoaExprelease } = body;
    const employee = payload.name; // EmpId from JWT payload

    if (LoaAmt <= 0) {
      return NextResponse.json(
        { message: "Input your loan amount." },
        { status: 400 },
      );
    }
    if (!LoaReason || LoaReason.trim() === "") {
      return NextResponse.json(
        { message: "Input your loan reason." },
        { status: 400 },
      );
    }

    // Update loan request
    await requestProcedures.loanUpdateRequest(
      loanId,
      LoaAmt,
      LoaReason,
      LoaType || "",
      LoaExprelease ? new Date(LoaExprelease) : null,
      employee
    );

    return NextResponse.json({ message: "Loan request updated" });
  } catch (error) {
    console.error("Update loan error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
