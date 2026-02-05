import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import {
  insertSchedule,
  updateSchedule,
  ScheduleForm,
} from "@/lib/services/schedule.service";
import { prisma } from "@/lib/db/prisma";
import { formatTimeForInput } from "@/lib/utils/time";

/**
 * GET /api/employee/[id]/schedule
 * Get employee schedule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: empId } = await params;

    // Get schedule from database
    const schedules = await prisma.schedule.findMany({
      where: {
        sch_emp: empId,
      },
      orderBy: {
        sch_id: "asc",
      },
    });

    // Transform to match frontend format
    // Note: Using formatTimeForInput utility which handles TIME field conversion correctly
    const result = schedules.map((sched) => ({
      SchedId: parseInt(sched.sch_id) || 0,
      SchedDay: sched.sch_day,
      SchedTimein: formatTimeForInput(sched.sch_in),
      SchedTimeout: formatTimeForInput(sched.sch_out),
      SchedBreakin: formatTimeForInput(sched.sch_bin),
      SchedBreakout: formatTimeForInput(sched.sch_bout),
      SchedHours: sched.sch_hrs || 0,
      SchedRest: sched.sch_rest === 1,
      SchedShift: sched.sch_shift || "",
      HaveBreak:
        sched.sch_rest === 0 && sched.sch_bin && sched.sch_bout ? true : false,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get schedule error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employee/[id]/schedule
 * Save employee schedule (inserts or updates)
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
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const { id: empId } = await params;
    const schedules: ScheduleForm[] = await request.json();

    if (!Array.isArray(schedules)) {
      return NextResponse.json(
        { message: "Schedules must be an array" },
        { status: 400 }
      );
    }

    // Process each schedule entry
    for (const schedule of schedules) {
      schedule.sch_emp = empId;

      // Check if schedule exists for this day
      const existing = await prisma.schedule.findFirst({
        where: {
          sch_emp: empId,
          sch_day: schedule.sch_day,
        },
      });

      if (existing) {
        await updateSchedule(schedule);
      } else {
        await insertSchedule(schedule);
      }
    }

    return NextResponse.json({ message: "Schedule saved successfully" });
  } catch (error) {
    console.error("Save schedule error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
