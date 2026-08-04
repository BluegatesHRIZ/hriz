import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  saveEmployeeScheduleBatch,
  ScheduleForm,
} from "@/lib/services/schedule.service";

/**
 * PUT /api/schedules/grid
 *
 * Saves per-employee schedule edits from the grid view. Body:
 *   { employees: [{ empId: string, days: Omit<ScheduleForm, "sch_emp">[] }] }
 * Each employee's weekly schedule is replaced via one batched transaction.
 */
export async function PUT(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      employees?: Array<{
        empId?: string;
        days?: Omit<ScheduleForm, "sch_emp">[];
      }>;
    };

    const employees = Array.isArray(body.employees) ? body.employees : [];
    if (!employees.length) {
      return NextResponse.json(
        { message: "No schedule changes to save." },
        { status: 400 }
      );
    }

    let saved = 0;
    for (const entry of employees) {
      if (!entry.empId || !Array.isArray(entry.days) || !entry.days.length) {
        continue;
      }
      const days = entry.days.map((d) => ({
        ...d,
        sch_emp: entry.empId as string,
      })) as ScheduleForm[];
      await saveEmployeeScheduleBatch(entry.empId, days);
      saved += 1;
    }

    return NextResponse.json({
      message: `Saved schedule for ${saved} employee${saved === 1 ? "" : "s"}.`,
      count: saved,
    });
  } catch (error) {
    console.error("Save schedule grid error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
