import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  parseDatedDays,
  saveDatedSchedules,
} from "@/lib/services/dated-schedule.service";
import type {
  DatedScheduleBulkRequest,
  DatedScheduleSaveResponse,
} from "@/lib/types";

const MAX_EMPLOYEES = 2000;

/**
 * POST /api/schedules/bulk-apply
 *
 * Sets the same dated schedule for many employees. Each date replaces the
 * employee's earlier Manage Schedules entry for that date; dates covered by the
 * employee's own approved schedule change request are skipped.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Partial<DatedScheduleBulkRequest>;

    const empIds = Array.isArray(body.empIds)
      ? body.empIds.filter((x): x is string => typeof x === "string" && !!x)
      : [];
    if (!empIds.length) {
      return NextResponse.json(
        { message: "Select at least one employee." },
        { status: 400 }
      );
    }
    if (empIds.length > MAX_EMPLOYEES) {
      return NextResponse.json(
        { message: `Apply to ${MAX_EMPLOYEES} employees or fewer at a time.` },
        { status: 400 }
      );
    }

    const parsed = parseDatedDays(body.days);
    if (!parsed.ok) {
      return NextResponse.json({ message: parsed.message }, { status: 400 });
    }
    if (!parsed.days.length) {
      return NextResponse.json(
        { message: "Pick at least one date." },
        { status: 400 }
      );
    }

    const result = await saveDatedSchedules({
      empIds,
      days: parsed.days,
      adminId: auth.payload.name,
    });

    const n = result.employees;
    const skippedNote = result.skipped
      ? ` ${result.skipped} date${result.skipped === 1 ? " was" : "s were"} skipped because the employee already has an approved schedule change for ${result.skipped === 1 ? "it" : "them"}.`
      : "";
    const response: DatedScheduleSaveResponse = {
      message: `Schedule set for ${n} employee${n === 1 ? "" : "s"}.${skippedNote}`,
      ...result,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Bulk apply dated schedule error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
