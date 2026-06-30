import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listLeaveReport } from "@/lib/services/reports.service";
import { parsePagination, paginateInMemory, REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

interface LeaveFilters {
  from?: string;
  to?: string;
  emp?: string;
}

/**
 * Mirrors `POST api/AttendanceReport/generate/leave` - returns rows from
 * `crearep_leaves(_date_frm, _date_to, _emp)`. Defaults `_emp` to "All".
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiLeaveReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as LeaveFilters;
    if (!body.from || !body.to) {
      return NextResponse.json(
        { message: "from and to are required" },
        { status: 400 },
      );
    }
    const { page, limit } = parsePagination(request.nextUrl.searchParams, REPORT_DEFAULT_LIMIT);
    const rows = await listLeaveReport(body.from, body.to, body.emp ?? "All");
    return NextResponse.json(paginateInMemory(rows, page, limit));
  } catch (error) {
    console.error("Leave report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
