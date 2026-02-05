import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import * as requestProcedures from "@/lib/services/requests.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userid: string; otid: string }> }
) {
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

    const resolvedParams = await params;
    const empId = payload.name; // Use authenticated user's ID
    const otId = resolvedParams.otid;

    const result = await requestProcedures.otGetRequestById(empId, otId);

    if (!result) {
      return NextResponse.json(
        { message: "Overtime request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get overtime by ID error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
