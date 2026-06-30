import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listOvertimeReport } from "@/lib/services/reports.service";
import { parsePagination, paginateInMemory, REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

interface OvertimeFilters {
  from?: string;
  to?: string;
  emp?: string;
}

/**
 * Mirrors `POST api/OvertimeReport/generate` - calls
 * `crearep_ot(_date_frm, _date_to, _emp)`. `_emp` defaults to "All".
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiOvertimeReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as OvertimeFilters;
    if (!body.from || !body.to) {
      return NextResponse.json(
        { message: "from and to are required" },
        { status: 400 },
      );
    }
    const { page, limit } = parsePagination(request.nextUrl.searchParams, REPORT_DEFAULT_LIMIT);
    const rows = await listOvertimeReport(body.from, body.to, body.emp ?? "All");
    return NextResponse.json(paginateInMemory(rows, page, limit));
  } catch (error) {
    console.error("Overtime report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
