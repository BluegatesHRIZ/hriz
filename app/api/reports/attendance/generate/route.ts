import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  generateAttendance,
  type AttendanceReportFilters,
} from "@/lib/services/reports.service";
import { parsePagination, paginate, REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

/**
 * Mirrors `POST api/AttendanceReport/generate`. Runs `crearep_attendance`
 * then the summary + detail procs and returns the merged result.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiAttendanceReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Partial<AttendanceReportFilters>;
    if (!body.from || !body.to) {
      return NextResponse.json(
        { message: "from and to are required" },
        { status: 400 },
      );
    }

    const { page, limit } = parsePagination(request.nextUrl.searchParams, REPORT_DEFAULT_LIMIT);
    const { rows, total } = await generateAttendance(
      {
        from: body.from,
        to: body.to,
        location: body.location ?? [],
        department: body.department ?? [],
        position: body.position ?? [],
      },
      { page, limit },
    );

    // `rows` is already just the current page of employee headers (each with its
    // full nested details); `total` is the distinct-employee count for the range.
    return NextResponse.json(paginate(rows, total, page, limit));
  } catch (error) {
    console.error("Attendance report generate error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
