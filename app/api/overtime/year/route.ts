import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const employee = payload.name; // EmpId from JWT payload
    const result = await requestProcedures.getOvertimeCurYear(employee);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get overtime year error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
