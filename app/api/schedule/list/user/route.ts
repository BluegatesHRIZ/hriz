import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { formatTimeForInput } from "@/lib/utils/time";

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

    const decoded = await verifyToken(authHeader.substring(7));
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

    // Format TIME fields to HH:mm strings to avoid timezone issues
    const formattedSchedules = schedules.map((sched) => ({
      sch_day: sched.sch_day,
      sch_rest: sched.sch_rest,
      sch_in: formatTimeForInput(sched.sch_in),
      sch_bin: formatTimeForInput(sched.sch_bin),
      sch_bout: formatTimeForInput(sched.sch_bout),
      sch_out: formatTimeForInput(sched.sch_out),
    }));

    return NextResponse.json(formattedSchedules);
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
