import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listUndertimeReport } from "@/lib/services/reports.service";

interface UndertimeFilters {
  from?: string;
  to?: string;
  emp?: string;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiUndertimeReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as UndertimeFilters;
    if (!body.from || !body.to) {
      return NextResponse.json(
        { message: "from and to are required" },
        { status: 400 },
      );
    }
    const rows = await listUndertimeReport(body.from, body.to, body.emp ?? "All");
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Undertime report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "DBErr:" + message }, { status: 500 });
  }
}
