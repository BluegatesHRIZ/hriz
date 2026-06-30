import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { getPayrollReport } from "@/lib/services/reports.service";
import { parsePagination, paginateInMemory, REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

/**
 * Mirrors `GET api/PayrollReport/generate/{year}`. Runs `crearep_payroll`
 * once and then `crearep_payamt` per pay-header to build the nested response
 * shape `[{ Payreport, PayAmount[] }]`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollReport");
  if (!auth.ok) return auth.response;

  try {
    const { year } = await params;
    if (!year) {
      return NextResponse.json({ message: "year is required" }, { status: 400 });
    }
    const { page, limit } = parsePagination(request.nextUrl.searchParams, REPORT_DEFAULT_LIMIT);
    const rows = await getPayrollReport(year);
    return NextResponse.json(paginateInMemory(rows, page, limit));
  } catch (error) {
    console.error("Payroll report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
