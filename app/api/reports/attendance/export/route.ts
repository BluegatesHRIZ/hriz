import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildAttendanceXlsx } from "@/lib/services/reports.excel";
import type { AttendanceEmployeeHeader } from "@/lib/services/reports.service";

interface ExportBody {
  rows: AttendanceEmployeeHeader[];
  filename?: string;
}

/**
 * Receives the already-rendered grid rows and returns a .xlsx export. The
 * client posts back exactly what it sees on the table so the export matches
 * any UI-side filtering / column changes.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiAttendanceReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ message: "rows is required" }, { status: 400 });
    }
    const buffer = await buildAttendanceXlsx(body.rows);
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
