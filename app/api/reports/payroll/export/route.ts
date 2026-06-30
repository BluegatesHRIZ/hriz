import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildPayrollXlsx } from "@/lib/services/reports.excel";
import { getPayrollReport } from "@/lib/services/reports.service";

interface ExportBody {
  year?: string;
  filename?: string;
}

/** Independent export: re-fetches the FULL payroll report for the year. */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiPayrollReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!body.year) {
      return NextResponse.json({ message: "year is required" }, { status: 400 });
    }
    const rows = await getPayrollReport(body.year);
    const buffer = await buildPayrollXlsx(rows);
    const filename = body.filename || "PayrollReport.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Payroll report export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
