import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  listAttendance,
  type AttendanceReportFilters,
} from "@/lib/services/reports.service";

/**
 * Mirrors `POST api/AttendanceReport/list`. Re-reads the already computed
 * summary + detail without re-running `crearep_attendance` (matches C#).
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

    const rows = await listAttendance({
      from: body.from,
      to: body.to,
      location: body.location ?? [],
      department: body.department ?? [],
      position: body.position ?? [],
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Attendance report list error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
