import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  bulkApplySchedule,
  ScheduleForm,
} from "@/lib/services/schedule.service";

/**
 * POST /api/schedules/bulk-apply
 *
 * Applies one weekly schedule (`days`) to many employees at once. Replaces each
 * target employee's full weekly template. Body:
 *   { empIds: string[], days: Omit<ScheduleForm, "sch_emp">[] }
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      empIds?: unknown;
      days?: unknown;
    };

    const empIds = Array.isArray(body.empIds)
      ? (body.empIds.filter((x) => typeof x === "string") as string[])
      : [];
    const days = Array.isArray(body.days)
      ? (body.days as Omit<ScheduleForm, "sch_emp">[])
      : [];

    if (!empIds.length) {
      return NextResponse.json(
        { message: "Select at least one employee." },
        { status: 400 }
      );
    }
    if (!days.length) {
      return NextResponse.json(
        { message: "Provide a schedule to apply." },
        { status: 400 }
      );
    }

    // sch_emp is set per-employee inside the service.
    const withEmp = days.map((d) => ({ ...d, sch_emp: "" })) as ScheduleForm[];
    const count = await bulkApplySchedule(empIds, withEmp);

    return NextResponse.json({
      message: `Schedule applied to ${count} employee${count === 1 ? "" : "s"}.`,
      count,
    });
  } catch (error) {
    console.error("Bulk apply schedule error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
