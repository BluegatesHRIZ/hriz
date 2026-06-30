import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  generateAttendance,
  type AttendanceReportFilters,
} from "@/lib/services/reports.service";
import { parsePagination, paginateInMemory, REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

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
    const rows = await generateAttendance({
      from: body.from,
      to: body.to,
      location: body.location ?? [],
      department: body.department ?? [],
      position: body.position ?? [],
    });

    // Paginate by employee header; each header keeps its full nested details.
    return NextResponse.json(paginateInMemory(rows, page, limit));
  } catch (error) {
    console.error("Attendance report generate error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
