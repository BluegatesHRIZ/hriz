import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { ApprovalLevelError, setSelfApproval } from "@/lib/services/approvalLevels.service";
import type { SetSelfApprovalResponse } from "@/lib/types";

/**
 * PUT /api/employee/{id}/approval-levels/self
 * Mark the employee N/A: their approval chain becomes just themselves.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    await verifyToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  try {
    const { id: empId } = await params;
    await setSelfApproval(empId);
    const response: SetSelfApprovalResponse = { message: "Set to N/A: approves own requests" };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ApprovalLevelError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("Set self approval error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
