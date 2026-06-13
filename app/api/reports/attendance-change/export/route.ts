import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildCoaReportXlsx } from "@/lib/services/reports.excel";
import type { CoaReportRow } from "@/lib/services/reports.service";

interface ExportBody {
  rows: CoaReportRow[];
  filename?: string;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiCoaReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ message: "rows is required" }, { status: 400 });
    }
    const buffer = await buildCoaReportXlsx(body.rows);
    const filename = body.filename || "AttendanceChangeReport.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("COA report export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
