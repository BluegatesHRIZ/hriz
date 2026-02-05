import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as employeeProcedures from "@/lib/services/employee.service";

/**
 * PUT /api/employee/{id}/advances
 * Save employee advances and loans
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // In Next.js 15+, params is a Promise - await it
    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { advances } = body;

    if (!Array.isArray(advances)) {
      return NextResponse.json(
        { message: "Advances must be an array" },
        { status: 400 }
      );
    }

    // Delete all existing advances
    await employeeProcedures.deleteEmployeeAdvances(empId);

    // Insert new advances
    for (const advance of advances) {
      if (
        advance.AdvType &&
        advance.AdvAmount > 0 &&
        advance.PayPerMonth > 0 &&
        advance.AmountPerPay > 0 &&
        advance.StartDate
      ) {
        await employeeProcedures.insertEmployeeAdvance(
          empId,
          advance.AdvType,
          new Date(advance.AdvDate || Date.now()),
          advance.AdvAmount,
          advance.AddedAmount || 0,
          advance.PayPerMonth,
          new Date(advance.StartDate),
          advance.AmountPerPay,
          advance.PayCutoff || null
        );
      }
    }

    return NextResponse.json({
      message: "Advances and loans saved successfully",
    });
  } catch (error) {
    console.error("Save advances error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
