import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

/**
 * PUT /api/employee/status/{id}
 * Update employee employment status (Active, Resigned, etc.)
 * Mirrors EmployeeController.ManageEmployeeStatus (sets EmpStatus).
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

    const resolvedParams = await params;
    const empId = resolvedParams.id;

    if (!empId || typeof empId !== "string") {
      return NextResponse.json(
        { message: "Employee ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { status } = body as { status?: number };

    if (
      typeof status !== "number" ||
      ![1, 2, 3, 4, 5].includes(status)
    ) {
      return NextResponse.json(
        { message: "Invalid status value" },
        { status: 400 },
      );
    }

    // Ensure employee exists
    const employee = await prisma.employee.findUnique({
      where: { emp_id: empId },
      select: { emp_id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { message: "Employee not found" },
        { status: 404 },
      );
    }

    await prisma.employee.update({
      where: { emp_id: empId },
      data: { emp_status: status },
    });

    return NextResponse.json({ message: "Status updated successfully" });
  } catch (error) {
    console.error("Update employee status error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

