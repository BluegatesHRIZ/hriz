import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildAttendanceXlsx } from "@/lib/services/reports.excel";
import {
  listAttendance,
  type AttendanceReportFilters,
} from "@/lib/services/reports.service";

interface ExportBody extends Partial<AttendanceReportFilters> {
  filename?: string;
}

/**
 * Independent export: re-fetches the FULL attendance report for the filters via
 * the read-only `listAttendance` (never re-runs the mutating generate proc),
 * then builds the .xlsx — independent of any client-side pagination.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiAttendanceReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!body.from || !body.to) {
      return NextResponse.json({ message: "from and to are required" }, { status: 400 });
    }
    const rows = await listAttendance({
      from: body.from,
      to: body.to,
      location: body.location ?? [],
      department: body.department ?? [],
      position: body.position ?? [],
    });
    const buffer = await buildAttendanceXlsx(rows);
    const filename = body.filename || "AttendanceReport.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Attendance report export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
