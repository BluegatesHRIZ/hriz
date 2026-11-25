import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  parseDateList,
  parseDatedDays,
  saveDatedSchedules,
} from "@/lib/services/dated-schedule.service";
import type {
  DatedScheduleDay,
  DatedScheduleGridRequest,
  DatedScheduleSaveResponse,
} from "@/lib/types";

const MAX_EMPLOYEES = 500;

/**
 * PUT /api/schedules/grid
 *
 * Saves the changed cells from the grid view, grouped by employee: `days` are
 * set, and `clearDates` lose their Manage Schedules entry. Dates covered by
 * the employee's own approved schedule change request are left as they are.
 * Everything is validated before anything is written.
 */
export async function PUT(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Partial<DatedScheduleGridRequest>;
    const raw = Array.isArray(body.employees) ? body.employees : [];
    if (!raw.length) {
      return NextResponse.json(
        { message: "No schedule changes to save." },
        { status: 400 }
      );
    }
    if (raw.length > MAX_EMPLOYEES) {
      return NextResponse.json(
        { message: `Save ${MAX_EMPLOYEES} employees or fewer at a time.` },
        { status: 400 }
      );
    }

    const seen = new Set<string>();
    const parsed: { empId: string; days: DatedScheduleDay[]; clearDates: string[] }[] = [];
    for (const entry of raw) {
      const empId = typeof entry?.empId === "string" ? entry.empId : "";
      if (!empId || seen.has(empId)) {
        return NextResponse.json(
          { message: "Each employee must appear once." },
          { status: 400 }
        );
      }
      seen.add(empId);
      const days = parseDatedDays(entry.days ?? []);
      if (!days.ok) {
        return NextResponse.json(
          { message: `${empId}: ${days.message}` },
          { status: 400 }
        );
      }
      const clear = parseDateList(entry.clearDates);
      if (!clear.ok) {
        return NextResponse.json(
          { message: `${empId}: ${clear.message}` },
          { status: 400 }
        );
      }
      if (days.days.length || clear.dates.length) {
        parsed.push({ empId, days: days.days, clearDates: clear.dates });
      }
    }
    if (!parsed.length) {
      return NextResponse.json(
        { message: "No schedule changes to save." },
        { status: 400 }
      );
    }

    const total = { employees: 0, written: 0, skipped: 0, cleared: 0 };
    for (const p of parsed) {
      const r = await saveDatedSchedules({
        empIds: [p.empId],
        days: p.days,
        clearDates: p.clearDates,
        adminId: auth.payload.name,
      });
      total.employees += r.employees;
      total.written += r.written;
      total.skipped += r.skipped;
      total.cleared += r.cleared;
    }

    const parts: string[] = [];
    if (total.written) {
      parts.push(`${total.written} date${total.written === 1 ? "" : "s"} set`);
    }
    if (total.cleared) parts.push(`${total.cleared} cleared`);
    if (total.skipped) {
      parts.push(`${total.skipped} skipped (employee request)`);
    }
    const response: DatedScheduleSaveResponse = {
      message: parts.length ? `${parts.join(", ")}.` : "Nothing changed.",
      ...total,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Save dated schedule grid error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
