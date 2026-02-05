import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    return NextResponse.json(loan);
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

    const resolvedParams = await params;
    const loanId = resolvedParams.id;
    const body = await request.json();

    const { LoaAmt, LoaReason, LoaType, LoaExprelease } = body;
    const employee = payload.name; // EmpId from JWT payload

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
