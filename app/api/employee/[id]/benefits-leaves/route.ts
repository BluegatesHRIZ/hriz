import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import {
  deleteEmployeeBenefits,
  deleteEmployeeLeaves,
  assignEmployeeLeave,
  insertEmployeeBenefit,
} from "@/lib/services/employee.service";

/**
 * PUT /api/employee/{id}/benefits-leaves
 * Save employee benefits and leaves
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
      await verifyToken(authHeader.substring(7));
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
    const { leaves, benefits } = body;

    if (!Array.isArray(leaves) || !Array.isArray(benefits)) {
      return NextResponse.json(
        { message: "Leaves and benefits must be arrays" },
        { status: 400 }
      );
    }

    // Delete all existing benefits and leaves
    await Promise.all([
      deleteEmployeeBenefits(empId),
      deleteEmployeeLeaves(empId),
    ]);

    // Insert new leaves
    for (const leave of leaves) {
      if (leave.EmlLeave && leave.EmlLeave !== "" && leave.EmlLeacredit > 0) {
        await assignEmployeeLeave(
          empId,
          leave.EmlLeave,
          Math.round(leave.EmlLeacredit * 10) / 10 // Round to 1 decimal place
        );
      }
    }

    // Insert new benefits
    for (const benefit of benefits) {
      if (
        benefit.EmbBcode &&
        benefit.EmbBcode !== "" &&
        benefit.EmbAmt !== undefined
      ) {
        await insertEmployeeBenefit(
          empId,
          benefit.EmbBcode,
          benefit.EmbDesc || null,
          benefit.EmbAmt || 0
        );
      }
    }

    return NextResponse.json({
      message: "Benefits and leaves saved successfully",
    });
  } catch (error) {
    console.error("Save benefits and leaves error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
