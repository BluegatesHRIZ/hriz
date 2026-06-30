import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildOvertimeXlsx } from "@/lib/services/reports.excel";
import { listOvertimeReport } from "@/lib/services/reports.service";

interface ExportBody {
  from?: string;
  to?: string;
  emp?: string;
  filename?: string;
}

/** Independent export: re-fetches the FULL overtime report for the filters. */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiOvertimeReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!body.from || !body.to) {
      return NextResponse.json({ message: "from and to are required" }, { status: 400 });
    }
    const rows = await listOvertimeReport(body.from, body.to, body.emp ?? "All");
    const buffer = await buildOvertimeXlsx(rows);
    const filename = body.filename || "OvertimeReport.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Overtime report export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
