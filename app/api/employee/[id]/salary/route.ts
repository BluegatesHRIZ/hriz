import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { saveEmployeeSalary } from "@/lib/services/employee.service";

/**
 * PUT /api/employee/{id}/salary
 * Replace employee salary history with the provided entries.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { salaries } = body;

    if (!Array.isArray(salaries)) {
      return NextResponse.json(
        { message: "salaries must be an array" },
        { status: 400 }
      );
    }

    const entries = salaries.map(
      (s: {
        SalPosition?: string;
        SalPayrollType?: string;
        SalDateFrom?: string | null;
        SalDateTo?: string | null;
        SalAmount?: number;
        SalRemarks?: string;
        SalStatus?: number;
      }) => ({
        SalPosition: s.SalPosition ?? "",
        SalPayrollType: s.SalPayrollType ?? "S",
        SalDateFrom: s.SalDateFrom ? new Date(s.SalDateFrom) : null,
        SalDateTo: s.SalDateTo ? new Date(s.SalDateTo) : null,
        SalAmount: typeof s.SalAmount === "number" ? s.SalAmount : 0,
        SalRemarks: s.SalRemarks ?? "",
        SalStatus: typeof s.SalStatus === "number" ? s.SalStatus : 0,
      })
    );

    await saveEmployeeSalary(empId, entries);

    return NextResponse.json({ message: "Salary history saved successfully" });
  } catch (error) {
    console.error("Save salary error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
