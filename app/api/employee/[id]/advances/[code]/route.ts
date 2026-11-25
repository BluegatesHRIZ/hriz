import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { deleteEmployeeAdvance } from "@/lib/services/employee.service";
import type { DeleteAdvanceResponse } from "@/lib/types";

/**
 * DELETE /api/employee/{id}/advances/{code}
 * Remove one advance, only while payroll has collected nothing against it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; code: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const { id: empId, code } = await params;
    const result = await deleteEmployeeAdvance(empId, decodeURIComponent(code));

    if (result === "not_found") {
      return NextResponse.json({ message: "Advance not found" }, { status: 404 });
    }
    if (result === "has_payments") {
      return NextResponse.json(
        { message: "Payroll has already collected installments for this loan, so it cannot be deleted" },
        { status: 409 },
      );
    }
    const response: DeleteAdvanceResponse = { message: "Advance deleted" };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Delete advance error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
