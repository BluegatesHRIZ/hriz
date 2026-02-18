import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/schedule/list/user
 * Get user schedule list for leave requests (matches C# GetUserLeaveScheduleList).
 * Mirrors stored procedure `schedule_list(@_Sch_Emp)`.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(authHeader.substring(7));
    const empId = decoded.name;

    if (!empId) {
      return NextResponse.json(
        { message: "Employee ID not found" },
        { status: 400 }
      );
    }

    // Get employee schedules (matches schedule_list SP)
    const schedules = await prisma.schedule.findMany({
      where: { sch_emp: empId },
      select: {
        sch_day: true,
        sch_rest: true,
        sch_in: true,
        sch_bin: true,
        sch_bout: true,
        sch_out: true,
      },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Get user schedule list error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
