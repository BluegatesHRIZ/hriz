import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildBiologReportXlsx } from "@/lib/services/reports.excel";
import { listBiologReport } from "@/lib/services/reports.service";

interface ExportBody {
  from?: string;
  to?: string;
  filename?: string;
}

/**
 * Independent export: re-fetches the FULL biolog report for the filters.
 * Employee is taken from the JWT, matching the view route.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiBiologReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!body.from || !body.to) {
      return NextResponse.json({ message: "from and to are required" }, { status: 400 });
    }
    const emp = auth.payload.name;
    if (!emp) {
      return NextResponse.json({ message: "Employee id missing from token" }, { status: 400 });
    }
    const rows = await listBiologReport(emp, body.from, body.to);
    const buffer = await buildBiologReportXlsx(rows);
    const filename = body.filename || "UserBiolog.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Biolog report export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
