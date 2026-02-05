import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import * as requestProcedures from "@/lib/services/requests.service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params;
    const utId = resolvedParams.id;
    const username = payload.name; // EmpId from JWT payload

    // Cancel the request
    await requestProcedures.cancelRequest(utId, username);

    // Fetch updated undertime requests
    const result = await requestProcedures.displayGrid("UNT", username);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Cancel undertime error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
