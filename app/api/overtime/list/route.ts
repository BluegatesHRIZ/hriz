import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";
import { parsePagination, paginate } from "@/lib/pagination";
import { statusGroupToCodes } from "@/lib/requests/status";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const employee = payload.name; // EmpId from JWT payload
    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);
    const statuses = statusGroupToCodes(request.nextUrl.searchParams.get("status"));
    const { data, total } = await requestProcedures.displayGrid("OVT", employee, { skip, take, statuses });

    return NextResponse.json(paginate(data, total, page, limit));
  } catch (error) {
    console.error("Get overtime requests error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
