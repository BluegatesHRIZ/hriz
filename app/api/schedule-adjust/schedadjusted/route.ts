import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { date_from, date_to } = body;

    const employee = payload.name; // EmpId from JWT payload
    const dateFromStr = new Date(date_from).toISOString().split("T")[0];
    const dateToStr = new Date(date_to).toISOString().split("T")[0];

    const result = await requestProcedures.getSchedAdjustedDate(
      employee,
      dateFromStr,
      dateToStr
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get schedule adjusted date error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
