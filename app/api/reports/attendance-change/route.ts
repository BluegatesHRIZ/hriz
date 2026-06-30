import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listCoaReport } from "@/lib/services/reports.service";
import { parsePagination, paginateInMemory, REPORT_DEFAULT_LIMIT } from "@/lib/pagination";

interface CoaReportFilters {
  from?: string;
  to?: string;
  emp?: string;
}

/** COA *report* (crearep_coa) — not the attendance-change request API. */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiCoaReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as CoaReportFilters;
    if (!body.from || !body.to) {
      return NextResponse.json(
        { message: "from and to are required" },
        { status: 400 },
      );
    }
    const { page, limit } = parsePagination(request.nextUrl.searchParams, REPORT_DEFAULT_LIMIT);
    const rows = await listCoaReport(body.from, body.to, body.emp ?? "All");
    return NextResponse.json(paginateInMemory(rows, page, limit));
  } catch (error) {
    console.error("COA report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "DBErr:" + message }, { status: 500 });
  }
}
