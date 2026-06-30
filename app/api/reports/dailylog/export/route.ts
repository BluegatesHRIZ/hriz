import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildDailyLogXlsx } from "@/lib/services/reports.excel";
import { listDailyLog } from "@/lib/services/reports.service";

interface ExportBody {
  date?: string;
  emp?: string;
  filename?: string;
}

/** Independent export: re-fetches the FULL daily log report for the filters. */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiDailylogReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!body.date) {
      return NextResponse.json({ message: "date is required" }, { status: 400 });
    }
    const rows = await listDailyLog(body.date, body.emp ?? "All");
    const buffer = await buildDailyLogXlsx(rows);
    const filename = body.filename || "DailyLogReport.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Daily log report export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
