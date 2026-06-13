import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listBiologReport } from "@/lib/services/reports.service";

interface BiologFilters {
  from?: string;
  to?: string;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiBiologReport");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as BiologFilters;
    if (!body.from || !body.to) {
      return NextResponse.json(
        { message: "from and to are required" },
        { status: 400 },
      );
    }
    const emp = auth.payload.name;
    if (!emp) {
      return NextResponse.json(
        { message: "Employee id missing from token" },
        { status: 400 },
      );
    }
    const rows = await listBiologReport(emp, body.from, body.to);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("Biolog report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "DBErr:" + message }, { status: 500 });
  }
}
