import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listDailyLog } from "@/lib/services/reports.service";

interface DailyLogFilters {
  date?: string;
  emp?: string;
}

/**
 * Mirrors `POST api/UserDailylog/list`. The SP signature is
 * `crearep_dailylog(_dte, _emp)`; if no `emp` filter is provided we fall
 * back to "All" so it behaves like the C# controller (which only ever
 * passes the date).
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiDailylogReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as DailyLogFilters;
    if (!body.date) {
      return NextResponse.json({ message: "date is required" }, { status: 400 });
    }
    const rows = await listDailyLog(body.date, body.emp ?? "All");
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Daily log report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "DBErr:" + message },
      { status: 500 },
    );
  }
}
