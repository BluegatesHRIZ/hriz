import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/leave/credit/request/{id}/{leavetype}
 * Get leave credit request for a specific employee and leave type.
 * Mirrors C# GetLeaveRequestCredit and stored procedure leave_getcreditrequest.
 * Returns: EmlLeacredit, EmlUsed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leavetype: string }> }
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

    const resolvedParams = await params;
    const empId = resolvedParams.id;
    const leaveType = resolvedParams.leavetype;

    if (!empId || !leaveType) {
      return NextResponse.json(
        { message: "Employee ID and leave type are required" },
        { status: 400 }
      );
    }

    // Get leave credit for specific employee and leave type (matches leave_getcreditrequest SP)
    // SP: SELECT * FROM empleave WHERE eml_leave = _eml_leave AND eml_emp = _eml_emp;
    const leaveCredit = await prisma.empleave.findFirst({
      where: {
        eml_emp: empId,
        eml_leave: leaveType,
      },
      select: {
        eml_leacredit: true,
        eml_used: true,
      },
    });

    if (!leaveCredit) {
      return NextResponse.json(
        {
          EmlLeacredit: 0,
          EmlUsed: 0,
        }
      );
    }

    return NextResponse.json({
      EmlLeacredit: leaveCredit.eml_leacredit || 0,
      EmlUsed: leaveCredit.eml_used || 0,
    });
  } catch (error) {
    console.error("Get leave credit request error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
